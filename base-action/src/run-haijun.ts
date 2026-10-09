import { runHaijunWithSdk } from "./run-haijun-sdk";
import type { HaijunRunResult } from "./run-haijun-sdk";
import { parseSdkOptions } from "./parse-sdk-options";

export type HaijunOptions = {
  haijunArgs?: string;
  model?: string;
  pathToHaijunCodeExecutable?: string;
  allowedTools?: string;
  disallowedTools?: string;
  maxTurns?: string;
  mcpConfig?: string;
  systemPrompt?: string;
  appendSystemPrompt?: string;
  fallbackModel?: string;
  showFullOutput?: string;
};

export async function runHaijun(
  promptPath: string,
  options: HaijunOptions,
): Promise<HaijunRunResult> {
  const parsedOptions = parseSdkOptions(options);
  return runHaijunWithSdk(promptPath, parsedOptions);
}
