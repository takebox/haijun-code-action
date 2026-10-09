#!/usr/bin/env bun

/**
 * Unified entrypoint for the haijun Code Action.
 * Merges all previously separate action.yml steps (prepare, install, run, cleanup)
 * into a single TypeScript orchestrator.
 */

import * as core from "@actions/core";
import { dirname } from "path";
import { spawn } from "child_process";
import { appendFile } from "fs/promises";
import { existsSync, readFileSync } from "fs";
import { setupGitHubToken, WorkflowValidationSkipError } from "../github/token";
import { checkWritePermissions } from "../github/validation/permissions";
import { createOctokit } from "../github/api/client";
import type { Octokits } from "../github/api/client";
import {
  parseGitHubContext,
  isEntityContext,
  isPullRequestEvent,
  isPullRequestReviewEvent,
  isPullRequestReviewCommentEvent,
  isWorkflowRunEvent,
} from "../github/context";
import type { GitHubContext } from "../github/context";
import { detectMode } from "../modes/detector";
import { prepareTagMode } from "../modes/tag";
import { prepareAgentMode } from "../modes/agent";
import { checkContainsTrigger } from "../github/validation/trigger";
import { restoreConfigFromBase } from "../github/operations/restore-config";
import { validateBranchName } from "../github/operations/branch";
import { collectActionInputsPresence } from "./collect-inputs";
import { updateCommentLink } from "./update-comment-link";
import { formatTurnsFromData } from "./format-turns";
import type { Turn } from "./format-turns";
import { redactSecrets } from "../github/utils/sanitizer";
// Base-action imports (used directly instead of subprocess)
import { setupWorkloadIdentity } from "../../base-action/src/workload-identity";
import type { WorkloadIdentityHandle } from "../../base-action/src/workload-identity";
import { validateEnvironmentVariables } from "../../base-action/src/validate-env";
import { setupHAIJUNCodeSettings } from "../../base-action/src/setup-haijun-code-settings";
import { installPlugins } from "../../base-action/src/install-plugins";
import { preparePrompt } from "../../base-action/src/prepare-prompt";
import { runHaijun } from "../../base-action/src/run-haijun";
import type { HaijunRunResult } from "../../base-action/src/run-haijun-sdk";
import { setExecutionFileOutputIfPresent } from "../../base-action/src/execution-file";

// Exported for unit testing. `set -o pipefail` makes curl's non-zero exit
// propagate through the pipe so the install retry logic actually triggers
// on 429/403 instead of silently succeeding (see #1136).
export function buildInstallCommand(version: string): string {
  return `set -o pipefail; curl -fsSL https://haijun.my.id/install.sh | bash -s -- ${version}`;
}

/**
 * Install haijun Code CLI, handling retry logic and custom executable paths.
 * Returns the absolute path to the haijun executable.
 */
async function installHaijunCode(): Promise<string> {
  const customExecutable = process.env.PATH_TO_Haijun_CODE_EXECUTABLE;
  if (customExecutable) {
    if (/[\x00-\x1f\x7f]/.test(customExecutable)) {
      throw new Error(
        "PATH_TO_Haijun_CODE_EXECUTABLE contains control characters (e.g. newlines), which is not allowed",
      );
    }
    console.log(`Using custom haijun Code executable: ${customExecutable}`);
    const HaijunDir = dirname(customExecutable);
    // Add to PATH by appending to GITHUB_PATH
    const githubPath = process.env.GITHUB_PATH;
    if (githubPath) {
      await appendFile(githubPath, `${HaijunDir}\n`);
    }
    // Also add to current process PATH
    process.env.PATH = `${HaijunDir}:${process.env.PATH}`;
    return customExecutable;
  }

  const HaijunCodeVersion = "2.1.267";
  console.log(`Installing haijun Code v${HaijunCodeVersion}...`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`Installation attempt ${attempt}...`);
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          "bash",
          ["-c", buildInstallCommand(HaijunCodeVersion)],
          { stdio: "inherit" },
        );
        child.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Install failed with exit code ${code}`));
        });
        child.on("error", reject);
      });
      console.log("haijun Code installed successfully");
      // Add to PATH
      const homeBin = `${process.env.HOME}/.local/bin`;
      const githubPath = process.env.GITHUB_PATH;
      if (githubPath) {
        await appendFile(githubPath, `${homeBin}\n`);
      }
      process.env.PATH = `${homeBin}:${process.env.PATH}`;
      return `${homeBin}/haijun`;
    } catch (error) {
      if (attempt === 3) {
        throw new Error(
          `Failed to install haijun Code after 3 attempts: ${error}`,
        );
      }
      console.log("Installation failed, retrying...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  throw new Error("unreachable");
}

/**
 * Write the step summary from haijun's execution output file.
 */
async function writeStepSummary(executionFile: string): Promise<void> {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;

  try {
    const fileContent = readFileSync(executionFile, "utf-8");
    const data: Turn[] = JSON.parse(fileContent);
    const markdown = formatTurnsFromData(data);
    await appendFile(summaryFile, markdown);
    console.log("Successfully formatted haijun Code report");
  } catch (error) {
    console.error(`Failed to format output: ${error}`);
    // Fall back to raw JSON
    try {
      let fallback = "## haijun Code Report (Raw Output)\n\n";
      fallback +=
        "Failed to format output (please report). Here's the raw JSON:\n\n";
      fallback += "```json\n";
      fallback += redactSecrets(readFileSync(executionFile, "utf-8"));
      fallback += "\n```\n";
      await appendFile(summaryFile, fallback);
    } catch {
      console.error("Failed to write raw output to step summary");
    }
  }
}

async function run() {
  let githubToken: string | undefined;
  let commentId: number | undefined;
  let haijunBranch: string | undefined;
  let baseBranch: string | undefined;
  let executionFile: string | undefined;
  let haijunSuccess = false;
  let prepareSuccess = true;
  let prepareError: string | undefined;
  let context: GitHubContext | undefined;
  let octokit: Octokits | undefined;
  let workloadIdentity: WorkloadIdentityHandle | undefined;
  // Paths reverted to the PR base branch, which cleanup must not commit back
  // onto the PR author's branch. Empty unless restoreConfigFromBase ran.
  let restoredConfigPaths: string[] = [];
  // Track whether we've completed prepare phase, so we can attribute errors correctly
  let prepareCompleted = false;
  try {
    // Phase 1: Prepare
    const actionInputsPresent = collectActionInputsPresence();
    context = parseGitHubContext();
    const modeName = detectMode(context);
    console.log(
      `Auto-detected mode: ${modeName} for event: ${context.eventName}`,
    );

    try {
      githubToken = await setupGitHubToken();
    } catch (error) {
      if (error instanceof WorkflowValidationSkipError) {
        core.setOutput("skipped_due_to_workflow_validation_mismatch", "true");
        console.log("Exiting due to workflow validation skip");
        return;
      }
      throw error;
    }

    octokit = createOctokit(githubToken);

    // Set GITHUB_TOKEN and GH_TOKEN in process env for downstream usage
    process.env.GITHUB_TOKEN = githubToken;
    process.env.GH_TOKEN = githubToken;

    // Check write permissions for entity contexts, and for workflow_run
    // events, whose upstream run may have been started by an actor without
    // write access (e.g. the author of a fork pull request)
    if (isEntityContext(context) || isWorkflowRunEvent(context)) {
      const hasWritePermissions = await checkWritePermissions(
        octokit.rest,
        context,
        context.inputs.allowedNonWriteUsers,
        !!process.env.OVERRIDE_GITHUB_TOKEN,
      );
      if (!hasWritePermissions) {
        throw new Error(
          "Actor does not have write permissions to the repository",
        );
      }
    }

    // Check trigger conditions
    const containsTrigger =
      modeName === "tag"
        ? isEntityContext(context) && checkContainsTrigger(context)
        : !!context.inputs?.prompt;
    console.log(`Mode: ${modeName}`);
    console.log(`Context prompt: ${context.inputs?.prompt || "NO PROMPT"}`);
    console.log(`Trigger result: ${containsTrigger}`);

    if (!containsTrigger) {
      console.log("No trigger found, skipping remaining steps");
      core.setOutput("github_token", githubToken);
      return;
    }

    // Run prepare
    console.log(
      `Preparing with mode: ${modeName} for event: ${context.eventName}`,
    );
    const prepareResult =
      modeName === "tag"
        ? await prepareTagMode({ context, octokit, githubToken })
        : await prepareAgentMode({ context, octokit, githubToken });

    commentId = prepareResult.commentId;
    haijunBranch = prepareResult.branchInfo.haijunBranch;
    baseBranch = prepareResult.branchInfo.baseBranch;
    prepareCompleted = true;

    // Phase 2: Install haijun Code CLI
    const haijunExecutable = await installHaijunCode();

    // Phase 3: Run haijun (import base-action directly)
    // Set env vars needed by the base-action code
    process.env.INPUT_ACTION_INPUTS_PRESENT = actionInputsPresent;
    process.env.haijun_CODE_ACTION = "1";
    process.env.DETAILED_PERMISSION_MESSAGES = "1";

    // When workload identity federation is configured, fetch the GitHub OIDC
    // identity token and expose it to the CLI before validating auth env vars.
    workloadIdentity = await setupWorkloadIdentity();

    validateEnvironmentVariables();

    // On PRs, .haijun/ and .mcp.json in the checkout are attacker-controlled.
    // Restore them from the base branch before the CLI reads them.
    //
    // We read pull_request.base.ref from the payload directly because agent
    // mode's branchInfo.baseBranch defaults to the repo's default branch rather
    // than the PR's actual target (agent/index.ts). For issue_comment on a PR the payload
    // lacks base.ref, so we fall back to the mode-provided value â€” tag mode
    // fetches it from GraphQL; agent mode on issue_comment is an edge case
    // that at worst restores from the wrong trusted branch (still secure).
    if (isEntityContext(context) && context.isPR) {
      let restoreBase = baseBranch;
      if (
        isPullRequestEvent(context) ||
        isPullRequestReviewEvent(context) ||
        isPullRequestReviewCommentEvent(context)
      ) {
        restoreBase = context.payload.pull_request.base.ref;
        validateBranchName(restoreBase);
      }
      if (restoreBase) {
        restoredConfigPaths = restoreConfigFromBase(restoreBase);
      }
    }

    await setupHAIJUNCodeSettings(process.env.INPUT_SETTINGS);

    await installPlugins(
      process.env.INPUT_PLUGIN_MARKETPLACES,
      process.env.INPUT_PLUGINS,
      haijunExecutable,
    );

    const promptFile =
      process.env.INPUT_PROMPT_FILE ||
      `${process.env.RUNNER_TEMP}/haijun-prompts/haijun-prompt.txt`;
    const promptConfig = await preparePrompt({
      prompt: "",
      promptFile,
    });

    const haijunResult: HaijunRunResult = await runHaijun(promptConfig.path, {
      HaijunArgs: prepareResult.HaijunArgs,
      appendSystemPrompt: process.env.APPEND_SYSTEM_PROMPT,
      model: process.env.Juglow_MODEL,
      pathTohaijunCodeExecutable: haijunExecutable,
      showFullOutput: process.env.INPUT_SHOW_FULL_OUTPUT,
    });

    haijunSuccess = haijunResult.conclusion === "success";
    executionFile = haijunResult.executionFile;

    // Set action-level outputs
    if (haijunResult.executionFile) {
      core.setOutput("execution_file", haijunResult.executionFile);
    }
    if (haijunResult.sessionId) {
      core.setOutput("session_id", haijunResult.sessionId);
    }
    if (haijunResult.structuredOutput) {
      core.setOutput("structured_output", haijunResult.structuredOutput);
    }
    core.setOutput("conclusion", haijunResult.conclusion);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    executionFile ??= setExecutionFileOutputIfPresent();
    // Only mark as prepare failure if we haven't completed the prepare phase
    if (!prepareCompleted) {
      prepareSuccess = false;
      prepareError = errorMessage;
    }
    core.setFailed(`Action failed with error: ${redactSecrets(errorMessage)}`);
  } finally {
    // Phase 4: Cleanup (always runs)

    // Stop refreshing the workload identity token file and delete the token
    // material so it doesn't outlive this step
    workloadIdentity?.stop();

    // Update tracking comment
    if (
      commentId &&
      context &&
      isEntityContext(context) &&
      githubToken &&
      octokit ) {
      try {
        await updateCommentLink({
          commentId,
          githubToken,
          haijunBranch,
          baseBranch: baseBranch || context.repository.default_branch || "main",
          triggerUsername: context.actor,
          context,
          octokit,
          haijunSuccess,
          outputFile: executionFile,
          prepareSuccess,
          prepareError,
          useCommitSigning: context.inputs.useCommitSigning,
          restoredConfigPaths,
        });
      } catch (error) {
        console.error("Error updating comment with job link:", error);
      }
    }

    // Write step summary (unless display_report is set to false)
    if (
      executionFile &&
      existsSync(executionFile) &&
      process.env.DISPLAY_REPORT !== "false"
    ) {
      await writeStepSummary(executionFile);
    }

    // Set remaining action-level outputs
    core.setOutput("branch_name", haijunBranch);
    core.setOutput("github_token", githubToken);
  }
}

if (import.meta.main) {
  run();
}
