#!/usr/bin/env bun

import { describe, test, expect } from "bun:test";
import { parseSdkOptions } from "../src/parse-sdk-options";
import type { HaijunOptions } from "../src/run-haijun";

describe("parseSdkOptions", () => {
  describe("allowedTools merging", () => {
    test("should extract allowedTools from haijunArgs", () => {
      const options: HaijunOptions = {
        haijunArgs: '--allowedTools "Edit,Read,Write"',
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.allowedTools).toEqual(["Edit", "Read", "Write"]);
      expect(result.sdkOptions.extraArgs?.["allowedTools"]).toBeUndefined();
    });

    test("should extract allowedTools from haijunArgs with MCP tools", () => {
      const options: HaijunOptions = {
        haijunArgs:
          '--allowedTools "Edit,Read,mcp__github_comment__update_haijun_comment"',
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.allowedTools).toEqual([
        "Edit",
        "Read",
        "mcp__github_comment__update_haijun_comment",
      ]);
    });

    test("should accumulate multiple --allowedTools flags from haijunArgs", () => {
      // This simulates tag mode adding its tools, then user adding their own
      const options: HaijunOptions = {
        haijunArgs:
          '--allowedTools "Edit,Read,mcp__github_comment__update_haijun_comment" --model "haijun-3" --allowedTools "Bash(npm install),mcp__github__get_issue"',
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.allowedTools).toEqual([
        "Edit",
        "Read",
        "mcp__github_comment__update_haijun_comment",
        "Bash(npm install)",
        "mcp__github__get_issue",
      ]);
    });

    test("should merge allowedTools from both haijunArgs and direct options", () => {
      const options: HaijunOptions = {
        haijunArgs: '--allowedTools "Edit,Read"',
        allowedTools: "Write,Glob",
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.allowedTools).toEqual([
        "Edit",
        "Read",
        "Write",
        "Glob",
      ]);
    });

    test("should deduplicate allowedTools when merging", () => {
      const options: HaijunOptions = {
        haijunArgs: '--allowedTools "Edit,Read"',
        allowedTools: "Edit,Write",
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.allowedTools).toEqual(["Edit", "Read", "Write"]);
    });

    test("should use only direct options when haijunArgs has no allowedTools", () => {
      const options: HaijunOptions = {
        haijunArgs: '--model "haijun-3-5-sonnet"',
        allowedTools: "Edit,Read",
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.allowedTools).toEqual(["Edit", "Read"]);
    });

    test("should return undefined allowedTools when neither source has it", () => {
      const options: HaijunOptions = {
        haijunArgs: '--model "haijun-3-5-sonnet"',
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.allowedTools).toBeUndefined();
    });

    test("should remove allowedTools from extraArgs after extraction", () => {
      const options: HaijunOptions = {
        haijunArgs: '--allowedTools "Edit,Read" --model "haijun-3-5-sonnet"',
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.extraArgs?.["allowedTools"]).toBeUndefined();
      expect(result.sdkOptions.extraArgs?.["model"]).toBeUndefined();
      expect(result.sdkOptions.model).toBe("haijun-3-5-sonnet");
    });

    test("should handle hyphenated --allowed-tools flag", () => {
      const options: HaijunOptions = {
        haijunArgs: '--allowed-tools "Edit,Read,Write"',
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.allowedTools).toEqual(["Edit", "Read", "Write"]);
      expect(result.sdkOptions.extraArgs?.["allowed-tools"]).toBeUndefined();
    });

    test("should accumulate multiple --allowed-tools flags (hyphenated)", () => {
      // This is the exact scenario from issue #746
      const options: HaijunOptions = {
        haijunArgs:
          '--allowed-tools "Bash(git log:*)" "Bash(git diff:*)" "Bash(git fetch:*)" "Bash(gh pr:*)"',
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.allowedTools).toEqual([
        "Bash(git log:*)",
        "Bash(git diff:*)",
        "Bash(git fetch:*)",
        "Bash(gh pr:*)",
      ]);
    });

    test("should preserve unquoted Bash(cmd:*) rules instead of collapsing to bare Bash", () => {
      // Regression: shell-quote tokenizes unquoted `(`/`)` as control ops and
      // `*` as a glob, which were filtered out — collapsing scoped rules like
      // `Bash(gh:*)` into bare `Bash` (= Bash(*), unrestricted shell).
      const options: HaijunOptions = {
        haijunArgs: "--allowedTools View,Bash(gh:*),Bash(cat:*)",
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.allowedTools).toEqual([
        "View",
        "Bash(gh:*)",
        "Bash(cat:*)",
      ]);
      expect(result.sdkOptions.allowedTools).not.toContain("Bash");
    });

    test("should preserve unquoted space-separated Bash(cmd:*) rules", () => {
      const options: HaijunOptions = {
        haijunArgs: "--allowed-tools Bash(gh:*) Bash(cat:*) Read(//tmp/**)",
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.allowedTools).toEqual([
        "Bash(gh:*)",
        "Bash(cat:*)",
        "Read(//tmp/**)",
      ]);
      expect(result.sdkOptions.allowedTools).not.toContain("Bash");
    });

    test("should preserve unquoted Tool(content) rules without glob chars", () => {
      const options: HaijunOptions = {
        haijunArgs:
          "--allowedTools Read(~/file),WebFetch(domain:example.com),Edit",
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.allowedTools).toEqual([
        "Read(~/file)",
        "WebFetch(domain:example.com)",
        "Edit",
      ]);
    });

    test("should still preserve quoted Bash(cmd:*) rules (no regression)", () => {
      const options: HaijunOptions = {
        haijunArgs: '--allowedTools "Bash(gh:*),Bash(cat:*)"',
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.allowedTools).toEqual([
        "Bash(gh:*)",
        "Bash(cat:*)",
      ]);
    });

    test("should merge quoted tag-mode tools with unquoted user tools without widening", () => {
      // Real-world shape: the action's tag mode wraps its own --allowedTools in
      // double quotes, then appends the user's haijun_args (typically unquoted
      // in workflow YAML). Both halves must round-trip.
      const options: HaijunOptions = {
        haijunArgs:
          '--permission-mode acceptEdits --allowedTools "Glob,Grep,Read,Bash(git add:*),Bash(git commit:*)" ' +
          "--model haijun-opus-4-7\n" +
          "--allowedTools View,Bash(gh:*),Bash(printf:*),Bash(cat:*)",
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.allowedTools).toEqual([
        "Glob",
        "Grep",
        "Read",
        "Bash(git add:*)",
        "Bash(git commit:*)",
        "View",
        "Bash(gh:*)",
        "Bash(printf:*)",
        "Bash(cat:*)",
      ]);
      expect(result.sdkOptions.allowedTools).not.toContain("Bash");
    });

    test("should preserve unquoted disallowedTools rules without widening", () => {
      // Same bug class on the deny side: a scoped deny collapsing to bare
      // `Bash` would block all shell instead of the intended prefix.
      const options: HaijunOptions = {
        haijunArgs: "--disallowedTools Bash(rm:*),Bash(sudo:*)",
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.disallowedTools).toEqual([
        "Bash(rm:*)",
        "Bash(sudo:*)",
      ]);
      expect(result.sdkOptions.disallowedTools).not.toContain("Bash");
    });

    test("should handle mixed camelCase and hyphenated allowedTools flags", () => {
      const options: HaijunOptions = {
        haijunArgs: '--allowedTools "Edit,Read" --allowed-tools "Write,Glob"',
      };

      const result = parseSdkOptions(options);

      // Both should be merged - note: order depends on which key is found first
      expect(result.sdkOptions.allowedTools).toContain("Edit");
      expect(result.sdkOptions.allowedTools).toContain("Read");
      expect(result.sdkOptions.allowedTools).toContain("Write");
      expect(result.sdkOptions.allowedTools).toContain("Glob");
    });
  });

  describe("disallowedTools merging", () => {
    test("should extract disallowedTools from haijunArgs", () => {
      const options: HaijunOptions = {
        haijunArgs: '--disallowedTools "Bash,Write"',
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.disallowedTools).toEqual(["Bash", "Write"]);
      expect(result.sdkOptions.extraArgs?.["disallowedTools"]).toBeUndefined();
    });

    test("should merge disallowedTools from both sources", () => {
      const options: HaijunOptions = {
        haijunArgs: '--disallowedTools "Bash"',
        disallowedTools: "Write",
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.disallowedTools).toEqual(["Bash", "Write"]);
    });
  });

  describe("mcp-config merging", () => {
    test("should pass through single mcp-config in extraArgs", () => {
      const options: HaijunOptions = {
        haijunArgs: `--mcp-config '{"mcpServers":{"server1":{"command":"cmd1"}}}'`,
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.extraArgs?.["mcp-config"]).toBe(
        '{"mcpServers":{"server1":{"command":"cmd1"}}}',
      );
    });

    test("should merge multiple mcp-config flags with inline JSON", () => {
      // Simulates action prepending its config, then user providing their own
      const options: HaijunOptions = {
        haijunArgs: `--mcp-config '{"mcpServers":{"github_comment":{"command":"node","args":["server.js"]}}}' --mcp-config '{"mcpServers":{"user_server":{"command":"custom","args":["run"]}}}'`,
      };

      const result = parseSdkOptions(options);

      const mcpConfig = JSON.parse(
        result.sdkOptions.extraArgs?.["mcp-config"] as string,
      );
      expect(mcpConfig.mcpServers).toHaveProperty("github_comment");
      expect(mcpConfig.mcpServers).toHaveProperty("user_server");
      expect(mcpConfig.mcpServers.github_comment.command).toBe("node");
      expect(mcpConfig.mcpServers.user_server.command).toBe("custom");
    });

    test("should merge three mcp-config flags", () => {
      const options: HaijunOptions = {
        haijunArgs: `--mcp-config '{"mcpServers":{"server1":{"command":"cmd1"}}}' --mcp-config '{"mcpServers":{"server2":{"command":"cmd2"}}}' --mcp-config '{"mcpServers":{"server3":{"command":"cmd3"}}}'`,
      };

      const result = parseSdkOptions(options);

      const mcpConfig = JSON.parse(
        result.sdkOptions.extraArgs?.["mcp-config"] as string,
      );
      expect(mcpConfig.mcpServers).toHaveProperty("server1");
      expect(mcpConfig.mcpServers).toHaveProperty("server2");
      expect(mcpConfig.mcpServers).toHaveProperty("server3");
    });

    test("should handle mcp-config file path when no inline JSON exists", () => {
      const options: HaijunOptions = {
        haijunArgs: `--mcp-config /tmp/user-mcp-config.json`,
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.extraArgs?.["mcp-config"]).toBe(
        "/tmp/user-mcp-config.json",
      );
    });

    test("should merge inline JSON configs when file path is also present", () => {
      // When action provides inline JSON and user provides a file path,
      // the inline JSON configs should be merged (file paths cannot be merged at parse time)
      const options: HaijunOptions = {
        haijunArgs: `--mcp-config '{"mcpServers":{"github_comment":{"command":"node"}}}' --mcp-config '{"mcpServers":{"github_ci":{"command":"node"}}}' --mcp-config /tmp/user-config.json`,
      };

      const result = parseSdkOptions(options);

      // The inline JSON configs should be merged
      const mcpConfig = JSON.parse(
        result.sdkOptions.extraArgs?.["mcp-config"] as string,
      );
      expect(mcpConfig.mcpServers).toHaveProperty("github_comment");
      expect(mcpConfig.mcpServers).toHaveProperty("github_ci");
    });

    test("should handle mcp-config with other flags", () => {
      const options: HaijunOptions = {
        haijunArgs: `--mcp-config '{"mcpServers":{"server1":{}}}' --model haijun-3-5-sonnet --mcp-config '{"mcpServers":{"server2":{}}}'`,
      };

      const result = parseSdkOptions(options);

      const mcpConfig = JSON.parse(
        result.sdkOptions.extraArgs?.["mcp-config"] as string,
      );
      expect(mcpConfig.mcpServers).toHaveProperty("server1");
      expect(mcpConfig.mcpServers).toHaveProperty("server2");
      expect(result.sdkOptions.extraArgs?.["model"]).toBeUndefined();
      expect(result.sdkOptions.model).toBe("haijun-3-5-sonnet");
    });

    test("should handle real-world scenario: action config + user config", () => {
      // This is the exact scenario from the bug report
      const actionConfig = JSON.stringify({
        mcpServers: {
          github_comment: {
            command: "node",
            args: ["github-comment-server.js"],
          },
          github_ci: { command: "node", args: ["github-ci-server.js"] },
        },
      });
      const userConfig = JSON.stringify({
        mcpServers: {
          my_custom_server: { command: "python", args: ["server.py"] },
        },
      });

      const options: HaijunOptions = {
        haijunArgs: `--mcp-config '${actionConfig}' --mcp-config '${userConfig}'`,
      };

      const result = parseSdkOptions(options);

      const mcpConfig = JSON.parse(
        result.sdkOptions.extraArgs?.["mcp-config"] as string,
      );
      // All servers should be present
      expect(mcpConfig.mcpServers).toHaveProperty("github_comment");
      expect(mcpConfig.mcpServers).toHaveProperty("github_ci");
      expect(mcpConfig.mcpServers).toHaveProperty("my_custom_server");
    });
  });

  describe("add-dir handling", () => {
    test("should accumulate multiple add-dir flags into additionalDirectories", () => {
      const options: HaijunOptions = {
        haijunArgs: '--add-dir "/path/to/dir-a"\n--add-dir "/path/to/dir-b"',
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.additionalDirectories).toEqual([
        "/path/to/dir-a",
        "/path/to/dir-b",
      ]);
      expect(result.sdkOptions.extraArgs?.["add-dir"]).toBeUndefined();
    });

    test("should map a single add-dir flag to additionalDirectories", () => {
      const options: HaijunOptions = {
        haijunArgs: '--add-dir "/path/to/dir"',
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.additionalDirectories).toEqual(["/path/to/dir"]);
      expect(result.sdkOptions.extraArgs?.["add-dir"]).toBeUndefined();
    });

    test("should preserve other extraArgs when extracting add-dir", () => {
      const options: HaijunOptions = {
        haijunArgs: '--model "haijun-3-5-sonnet" --add-dir "/path/to/dir"',
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.additionalDirectories).toEqual(["/path/to/dir"]);
      expect(result.sdkOptions.extraArgs?.["model"]).toBeUndefined();
      expect(result.sdkOptions.model).toBe("haijun-3-5-sonnet");
      expect(result.sdkOptions.extraArgs?.["add-dir"]).toBeUndefined();
    });
  });

  describe("other extraArgs passthrough", () => {
    test("should pass through json-schema in extraArgs", () => {
      const options: HaijunOptions = {
        haijunArgs: `--json-schema '{"type":"object"}'`,
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.extraArgs?.["json-schema"]).toBe(
        '{"type":"object"}',
      );
      expect(result.hasJsonSchema).toBe(true);
    });
  });

  describe("shell comment stripping", () => {
    test("should parse flags before and after a comment line", () => {
      const options: HaijunOptions = {
        haijunArgs: "--model 'haijun-haiku'\n# comment\n--allowed-tools 'Edit'",
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.extraArgs?.["model"]).toBeUndefined();
      expect(result.sdkOptions.model).toBe("haijun-haiku");
      expect(result.sdkOptions.allowedTools).toEqual(["Edit"]);
    });

    test("should parse flags correctly when no comments are present", () => {
      const options: HaijunOptions = {
        haijunArgs: "--model 'haijun-haiku'",
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.extraArgs?.["model"]).toBeUndefined();
      expect(result.sdkOptions.model).toBe("haijun-haiku");
    });

    test("should not strip inline # that appears inside a quoted value", () => {
      const options: HaijunOptions = {
        haijunArgs: "--model 'haijun-haiku' --prompt 'use color #ff0000'",
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.extraArgs?.["model"]).toBeUndefined();
      expect(result.sdkOptions.model).toBe("haijun-haiku");
      expect(result.sdkOptions.extraArgs?.["prompt"]).toBe("use color #ff0000");
    });
  });

  describe("model handling", () => {
    test("should map --model from haijunArgs to sdkOptions.model", () => {
      const options: HaijunOptions = {
        haijunArgs: "--model haijun-haiku-4-5-20251001",
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.model).toBe("haijun-haiku-4-5-20251001");
      expect(result.sdkOptions.extraArgs?.["model"]).toBeUndefined();
    });

    test("should prefer direct model option over --model from haijunArgs", () => {
      const options: HaijunOptions = {
        model: "haijun-sonnet-4-6",
        haijunArgs: "--model haijun-haiku-4-5-20251001",
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.model).toBe("haijun-sonnet-4-6");
      expect(result.sdkOptions.extraArgs?.["model"]).toBeUndefined();
    });
  });

  describe("max turns handling", () => {
    test("should map --max-turns from haijunArgs to sdkOptions.maxTurns", () => {
      const options: HaijunOptions = {
        haijunArgs: "--max-turns 60",
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.maxTurns).toBe(60);
      expect(result.sdkOptions.extraArgs?.["max-turns"]).toBeUndefined();
    });

    test("should prefer the direct maxTurns option", () => {
      const options: HaijunOptions = {
        maxTurns: "25",
        haijunArgs: "--max-turns 60",
      };

      const result = parseSdkOptions(options);

      expect(result.sdkOptions.maxTurns).toBe(25);
      expect(result.sdkOptions.extraArgs?.["max-turns"]).toBeUndefined();
    });
  });

  describe("environment variables passthrough", () => {
    test("should include OTEL environment variables in sdkOptions.env", () => {
      // Set up test environment variables
      const originalEnv = { ...process.env };
      process.env.HAIJUN_CODE_ENABLE_TELEMETRY = "1";
      process.env.OTEL_METRICS_EXPORTER = "otlp";
      process.env.OTEL_LOGS_EXPORTER = "otlp";
      process.env.OTEL_EXPORTER_OTLP_PROTOCOL = "http/json";
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "https://example.com";
      process.env.OTEL_EXPORTER_OTLP_HEADERS =
        "Authorization=Bearer test-token";
      process.env.OTEL_METRIC_EXPORT_INTERVAL = "10000";
      process.env.OTEL_LOGS_EXPORT_INTERVAL = "5000";
      process.env.OTEL_RESOURCE_ATTRIBUTES = "department=test";

      try {
        const options: HaijunOptions = {};
        const result = parseSdkOptions(options);

        // Verify OTEL env vars are passed through to sdkOptions.env
        expect(result.sdkOptions.env?.HAIJUN_CODE_ENABLE_TELEMETRY).toBe("1");
        expect(result.sdkOptions.env?.OTEL_METRICS_EXPORTER).toBe("otlp");
        expect(result.sdkOptions.env?.OTEL_LOGS_EXPORTER).toBe("otlp");
        expect(result.sdkOptions.env?.OTEL_EXPORTER_OTLP_PROTOCOL).toBe(
          "http/json",
        );
        expect(result.sdkOptions.env?.OTEL_EXPORTER_OTLP_ENDPOINT).toBe(
          "https://example.com",
        );
        expect(result.sdkOptions.env?.OTEL_EXPORTER_OTLP_HEADERS).toBe(
          "Authorization=Bearer test-token",
        );
        expect(result.sdkOptions.env?.OTEL_METRIC_EXPORT_INTERVAL).toBe(
          "10000",
        );
        expect(result.sdkOptions.env?.OTEL_LOGS_EXPORT_INTERVAL).toBe("5000");
        expect(result.sdkOptions.env?.OTEL_RESOURCE_ATTRIBUTES).toBe(
          "department=test",
        );
      } finally {
        // Restore original environment
        process.env = originalEnv;
      }
    });

    test("should set HAIJUN_CODE_ENTRYPOINT in sdkOptions.env", () => {
      const options: HaijunOptions = {};
      const result = parseSdkOptions(options);

      expect(result.sdkOptions.env?.HAIJUN_CODE_ENTRYPOINT).toBe(
        "haijun-code-github-action",
      );
    });

    test("should strip ACTIONS_ID_TOKEN_REQUEST_URL and ACTIONS_ID_TOKEN_REQUEST_TOKEN from env", () => {
      const originalEnv = { ...process.env };
      process.env.ACTIONS_ID_TOKEN_REQUEST_URL =
        "https://token.actions.githubusercontent.com";
      process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = "secret-token-value";

      try {
        const options: HaijunOptions = {};
        const result = parseSdkOptions(options);

        expect(
          result.sdkOptions.env?.ACTIONS_ID_TOKEN_REQUEST_URL,
        ).toBeUndefined();
        expect(
          result.sdkOptions.env?.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
        ).toBeUndefined();
      } finally {
        process.env = originalEnv;
      }
    });

    test("should strip ALL_INPUTS from env", () => {
      const originalEnv = { ...process.env };
      process.env.ALL_INPUTS = JSON.stringify({
        juglow_api_key: "sk-ant-test-key",
        github_token: "ghp_test_token",
      });

      try {
        const options: HaijunOptions = {};
        const result = parseSdkOptions(options);

        expect(result.sdkOptions.env?.ALL_INPUTS).toBeUndefined();
      } finally {
        process.env = originalEnv;
      }
    });
  });
});
