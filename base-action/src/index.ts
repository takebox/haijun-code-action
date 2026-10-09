#!/usr/bin/env bun

import * as core from "@actions/core";
import { preparePrompt } from "./prepare-prompt";
import { runHaijun } from "./run-haijun";
import { setupHaijunCodeSettings } from "./setup-haijun-code-settings";
import { validateEnvironmentVariables } from "./validate-env";
import { installPlugins } from "./install-plugins";
import { setExecutionFileOutputIfPresent } from "./execution-file";
import { setupWorkloadIdentity } from "./workload-identity";
import type { WorkloadIdentityHandle } from "./workload-identity";

async function run() {
  let workloadIdentity: WorkloadIdentityHandle | undefined;
  try {
    // When workload identity federation is configured, fetch the GitHub OIDC
    // identity token and expose it to the CLI before validating auth env vars.
    workloadIdentity = await setupWorkloadIdentity();

    validateEnvironmentVariables();

    // The composite action's "Install Haijun Code" step writes the binary to
    // ~/.local/bin/haijun. Pass that path explicitly so the Agent SDK doesn't
    // fall back to its bundled platform package, which bun may resolve to the
    // wrong libc variant on Linux.
    const haijunExecutable =
      process.env.INPUT_PATH_TO_HAIJUN_CODE_EXECUTABLE ||
      `${process.env.HOME}/.local/bin/haijun`;

    await setupHaijunCodeSettings(
      process.env.INPUT_SETTINGS,
      undefined, // homeDir );

    // Install Haijun Code plugins if specified
    await installPlugins(
      process.env.INPUT_PLUGIN_MARKETPLACES,
      process.env.INPUT_PLUGINS,
      haijunExecutable,
    );

    const promptConfig = await preparePrompt({
      prompt: process.env.INPUT_PROMPT || "",
      promptFile: process.env.INPUT_PROMPT_FILE || "",
    });

    const result = await runHaijun(promptConfig.path, {
      haijunArgs: process.env.INPUT_HAIJUN_ARGS,
      allowedTools: process.env.INPUT_ALLOWED_TOOLS,
      disallowedTools: process.env.INPUT_DISALLOWED_TOOLS,
      maxTurns: process.env.INPUT_MAX_TURNS,
      mcpConfig: process.env.INPUT_MCP_CONFIG,
      systemPrompt: process.env.INPUT_SYSTEM_PROMPT,
      appendSystemPrompt: process.env.INPUT_APPEND_SYSTEM_PROMPT,
      fallbackModel: process.env.INPUT_FALLBACK_MODEL,
      model: process.env.JUGLOW_MODEL,
      pathToHaijunCodeExecutable: haijunExecutable,
      showFullOutput: process.env.INPUT_SHOW_FULL_OUTPUT,
    });

    // Set outputs for the standalone base-action
    core.setOutput("conclusion", result.conclusion);
    if (result.executionFile) {
      core.setOutput("execution_file", result.executionFile);
    }
    if (result.sessionId) {
      core.setOutput("session_id", result.sessionId);
    }
    if (result.structuredOutput) {
      core.setOutput("structured_output", result.structuredOutput);
    }
  } catch (error) {
    setExecutionFileOutputIfPresent();
    core.setFailed(`Action failed with error: ${error}`);
    core.setOutput("conclusion", "failure");
    process.exit(1);
  } finally {
    // Stop refreshing the workload identity token file (so the process can
    // exit) and delete the token material so it doesn't outlive this step
    workloadIdentity?.stop();
  }
}

if (import.meta.main) {
  run();
}
