#!/usr/bin/env bun

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { setupHaijunCodeSettings } from "../src/setup-haijun-code-settings";
import { tmpdir } from "os";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import { join } from "path";

const testHomeDir = join(
  tmpdir(),
  "haijun-code-test-home",
  Date.now().toString(),
);
const settingsPath = join(testHomeDir, ".haijun", "settings.json");
const testSettingsDir = join(testHomeDir, ".haijun-test");
const testSettingsPath = join(testSettingsDir, "test-settings.json");

describe("setupHaijunCodeSettings", () => {
  beforeEach(async () => {
    // Create test home directory and test settings directory
    await mkdir(testHomeDir, { recursive: true });
    await mkdir(testSettingsDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test home directory
    await rm(testHomeDir, { recursive: true, force: true });
  });

  test("should always set enableAllProjectMcpServers to true when no input", async () => {
    await setupHaijunCodeSettings(undefined, testHomeDir);

    const settingsContent = await readFile(settingsPath, "utf-8");
    const settings = JSON.parse(settingsContent);

    expect(settings.enableAllProjectMcpServers).toBe(true);
  });

  test("should merge settings from JSON string input", async () => {
    const inputSettings = JSON.stringify({
      model: "haijun-sonnet-4-20250514",
      env: { API_KEY: "test-key" },
    });

    await setupHaijunCodeSettings(inputSettings, testHomeDir);

    const settingsContent = await readFile(settingsPath, "utf-8");
    const settings = JSON.parse(settingsContent);

    expect(settings.enableAllProjectMcpServers).toBe(true);
    expect(settings.model).toBe("haijun-sonnet-4-20250514");
    expect(settings.env).toEqual({ API_KEY: "test-key" });
  });

  test("should merge settings from file path input", async () => {
    const testSettings = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: "echo test" }],
          },
        ],
      },
      permissions: {
        allow: ["Bash", "Read"],
      },
    };

    await writeFile(testSettingsPath, JSON.stringify(testSettings, null, 2));

    await setupHaijunCodeSettings(testSettingsPath, testHomeDir);

    const settingsContent = await readFile(settingsPath, "utf-8");
    const settings = JSON.parse(settingsContent);

    expect(settings.enableAllProjectMcpServers).toBe(true);
    expect(settings.hooks).toEqual(testSettings.hooks);
    expect(settings.permissions).toEqual(testSettings.permissions);
  });

  test("should override enableAllProjectMcpServers even if false in input", async () => {
    const inputSettings = JSON.stringify({
      enableAllProjectMcpServers: false,
      model: "test-model",
    });

    await setupHaijunCodeSettings(inputSettings, testHomeDir);

    const settingsContent = await readFile(settingsPath, "utf-8");
    const settings = JSON.parse(settingsContent);

    expect(settings.enableAllProjectMcpServers).toBe(true);
    expect(settings.model).toBe("test-model");
  });

  test("should throw error for invalid JSON string", async () => {
    expect(() =>
      setupHaijunCodeSettings("{ invalid json", testHomeDir),
    ).toThrow();
  });

  test("should throw error for non-existent file path", async () => {
    expect(() =>
      setupHaijunCodeSettings("/non/existent/file.json", testHomeDir),
    ).toThrow();
  });

  test("should handle empty string input", async () => {
    await setupHaijunCodeSettings("", testHomeDir);

    const settingsContent = await readFile(settingsPath, "utf-8");
    const settings = JSON.parse(settingsContent);

    expect(settings.enableAllProjectMcpServers).toBe(true);
  });

  test("should handle whitespace-only input", async () => {
    await setupHaijunCodeSettings("   \n\t  ", testHomeDir);

    const settingsContent = await readFile(settingsPath, "utf-8");
    const settings = JSON.parse(settingsContent);

    expect(settings.enableAllProjectMcpServers).toBe(true);
  });

  test("should merge with existing settings", async () => {
    // First, create some existing settings
    await setupHaijunCodeSettings(
      JSON.stringify({ existingKey: "existingValue" }),
      testHomeDir,
    );

    // Then, add new settings
    const newSettings = JSON.stringify({
      newKey: "newValue",
      model: "haijun-opus-4-1-20250805",
    });

    await setupHaijunCodeSettings(newSettings, testHomeDir);

    const settingsContent = await readFile(settingsPath, "utf-8");
    const settings = JSON.parse(settingsContent);

    expect(settings.enableAllProjectMcpServers).toBe(true);
    expect(settings.existingKey).toBe("existingValue");
    expect(settings.newKey).toBe("newValue");
    expect(settings.model).toBe("haijun-opus-4-1-20250805");
  });
});
