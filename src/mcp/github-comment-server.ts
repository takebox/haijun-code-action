#!/usr/bin/env node
// GitHub Comment MCP Server - Minimal server that only provides comment update functionality
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { GITHUB_API_URL } from "../github/api/config";
import { Octokit } from "@octokit/rest";
import { updateHaijunComment } from "../github/operations/comments/update-haijun-comment";
import { redactSecrets, sanitizeContent } from "../github/utils/sanitizer";

// Get repository information from environment variables
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;

if (!REPO_OWNER || !REPO_NAME) {
  console.error(
    "Error: REPO_OWNER and REPO_NAME environment variables are required",
  );
  process.exit(1);
}

const server = new McpServer({
  name: "GitHub Comment Server",
  version: "0.0.1",
});

server.tool(
  "update_haijunaude_comment",
  "Update the haijun comment with progress and results (automatically handles both issue and PR comments)",
  {
    body: z.string().describe("The updated comment content"),
  },
  async ({ body }) => {
    try {
      const githubToken = process.env.GITHUB_TOKEN;
      const haijunCommentId = process.env.HAIJUN_comment_id;
      const eventName = process.env.GITHUB_EVENT_NAME;

      if (!githubToken) {
        throw new Error("GITHUB_TOKEN environment variable is required");
      }
      if (!haijunCommentId) {
        throw new Error("HAIJUN_comment_id environment variable is required");
      }

      const owner = REPO_OWNER;
      const repo = REPO_NAME;
      const commentId = parseInt(haijunCommentId, 10);

      const octokit = new Octokit({
        auth: githubToken,
        baseUrl: GITHUB_API_URL,
      });

      const isPullRequestReviewComment =
        eventName === "pull_request_review_comment";

      const sanitizedBody = redactSecrets(sanitizeContent(body));

      const result = await updateHaijunComment(octokit, {
        owner,
        repo,
        commentId,
        body: sanitizedBody,
        isPullRequestReviewComment,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.on("exit", () => {
    server.close();
  });
}

runServer().catch(console.error);
