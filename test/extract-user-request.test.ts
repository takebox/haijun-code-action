import { describe, test, expect } from "bun:test";
import { extractUserRequest } from "../src/utils/extract-user-request";

describe("extractUserRequest", () => {
  test("extracts text after @haijun trigger", () => {
    expect(extractUserRequest("@haijun /review-pr", "@haijun")).toBe(
      "/review-pr",
    );
  });

  test("extracts slash command with arguments", () => {
    expect(
      extractUserRequest(
        "@haijun /review-pr please check the auth module",
        "@haijun",
      ),
    ).toBe("/review-pr please check the auth module");
  });

  test("handles trigger phrase with extra whitespace", () => {
    expect(extractUserRequest("@haijun    /review-pr", "@haijun")).toBe(
      "/review-pr",
    );
  });

  test("handles trigger phrase at start of multiline comment", () => {
    const comment = `@haijun /review-pr
Please review this PR carefully.
Focus on security issues.`;
    expect(extractUserRequest(comment, "@haijun")).toBe(
      `/review-pr
Please review this PR carefully.
Focus on security issues.`,
    );
  });

  test("handles trigger phrase in middle of text", () => {
    expect(
      extractUserRequest("Hey team, @haijun can you review this?", "@haijun"),
    ).toBe("can you review this?");
  });

  test("returns null for empty comment body", () => {
    expect(extractUserRequest("", "@haijun")).toBeNull();
  });

  test("returns null for undefined comment body", () => {
    expect(extractUserRequest(undefined, "@haijun")).toBeNull();
  });

  test("returns null when trigger phrase not found", () => {
    expect(extractUserRequest("Please review this PR", "@haijun")).toBeNull();
  });

  test("returns null when only trigger phrase with no request", () => {
    expect(extractUserRequest("@haijun", "@haijun")).toBeNull();
  });

  test("handles custom trigger phrase", () => {
    expect(extractUserRequest("/haijun help me", "/haijun")).toBe("help me");
  });

  test("handles trigger phrase with special regex characters", () => {
    expect(
      extractUserRequest("@haijun[bot] do something", "@haijun[bot]"),
    ).toBe("do something");
  });

  test("is case insensitive", () => {
    expect(extractUserRequest("@HAIJUN /review-pr", "@haijun")).toBe(
      "/review-pr",
    );
    expect(extractUserRequest("@Haijun /review-pr", "@haijun")).toBe(
      "/review-pr",
    );
  });
});
