import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "child_process";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "fs";
import { dirname, isAbsolute, join } from "path";
import { restoreConfigFromBase } from "../src/github/operations/restore-config";

const HAIJUN_PR_EXCLUDE_PATTERN = "/.haijun-pr/";

describe("restoreConfigFromBase", () => {
  let originalCwd: string;
  let tempDir = "";
  let repoDir: string;
  let remoteDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join("/tmp", "restore-config-"));
    repoDir = join(tempDir, "repo");
    remoteDir = join(tempDir, "origin.git");

    execFileSync("git", ["init", "--bare", remoteDir], { stdio: "pipe" });
    execFileSync("git", ["init", repoDir], { stdio: "pipe" });
    git(["checkout", "-b", "main"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "Test User"]);

    writeRepoFile("HAIJUN.md", "base haijun instructions\n");
    writeRepoFile(
      ".haijun/settings.json",
      `${JSON.stringify({ source: "base" })}\n`,
    );
    writeRepoFile("src/index.ts", "export const base = true;\n");

    git(["add", "HAIJUN.md", ".haijun/settings.json", "src/index.ts"]);
    git(["commit", "-m", "base config"]);
    git(["remote", "add", "origin", remoteDir]);
    git(["push", "-u", "origin", "main"]);

    git(["checkout", "-b", "pr"]);
    writeRepoFile("HAIJUN.md", "pr haijun instructions\n");
    writeRepoFile(
      ".haijun/settings.json",
      `${JSON.stringify({ source: "pr" })}\n`,
    );
    git(["add", "HAIJUN.md", ".haijun/settings.json"]);
    git(["commit", "-m", "pr config"]);

    process.chdir(repoDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("preserves PR sensitive files while excluding .haijun-pr from broad staging", () => {
    const gitignoreExistedBefore = existsRepoFile(".gitignore");
    const gitignoreContentsBefore = gitignoreExistedBefore
      ? readRepoFile(".gitignore")
      : "";

    restoreConfigFromBase("main");

    expect(readRepoFile(".haijun-pr/HAIJUN.md")).toBe(
      "pr haijun instructions\n",
    );
    expect(readRepoFile(".haijun-pr/.haijun/settings.json")).toBe(
      `${JSON.stringify({ source: "pr" })}\n`,
    );
    expect(readRepoFile("HAIJUN.md")).toBe("base haijun instructions\n");
    expect(readRepoFile(".haijun/settings.json")).toBe(
      `${JSON.stringify({ source: "base" })}\n`,
    );
    expect(git(["check-ignore", ".haijun-pr/HAIJUN.md"]).trim()).toBe(
      ".haijun-pr/HAIJUN.md",
    );
    expect(countHaijunPrExcludeEntries()).toBe(1);

    restoreConfigFromBase("main");

    expect(countHaijunPrExcludeEntries()).toBe(1);
    expect(existsRepoFile(".gitignore")).toBe(gitignoreExistedBefore);
    if (gitignoreExistedBefore) {
      expect(readRepoFile(".gitignore")).toBe(gitignoreContentsBefore);
    }

    writeRepoFile("src/fix.ts", "export const fix = true;\n");
    git(["add", "-A"]);

    const stagedFiles = git(["diff", "--cached", "--name-only"])
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
    expect(stagedFiles).toContain("src/fix.ts");
    expect(stagedFiles.some((file) => file.startsWith(".haijun-pr/"))).toBe(
      false,
    );

    git(["commit", "-m", "apply fix"]);

    const committedFiles = git(["show", "--name-only", "--format=", "HEAD"])
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
    expect(committedFiles).toContain("src/fix.ts");
    expect(committedFiles.some((file) => file.startsWith(".haijun-pr/"))).toBe(
      false,
    );
    expect(existsRepoFile(".gitignore")).toBe(gitignoreExistedBefore);
    if (gitignoreExistedBefore) {
      expect(readRepoFile(".gitignore")).toBe(gitignoreContentsBefore);
    }
  });

  test("restores symlinked HAIJUN.md paths from the PR base branch", () => {
    setupSymlinkedMainBranch();

    git(["checkout", "pr"]);
    writeRepoFile(
      ".haijun/settings.json",
      `${JSON.stringify({ source: "pr-with-symlinks" })}\n`,
    );
    git(["add", ".haijun/settings.json"]);
    git(["commit", "-m", "pr updates settings"]);

    restoreConfigFromBase("main");

    expect(lstatRepoFile("HAIJUN.md").isSymbolicLink()).toBe(true);
    expect(lstatRepoFile(".haijun/HAIJUN.md").isSymbolicLink()).toBe(true);
    expect(readRepoFile("HAIJUN.md").trim()).toBe("shared agent instructions");
    expect(readRepoFile(".haijun/HAIJUN.md").trim()).toBe(
      "shared agent instructions",
    );
    expect(readRepoFile(".haijun/settings.json")).toBe(
      `${JSON.stringify({ source: "base" })}\n`,
    );
  });

  test("records dangling links as placeholders, including top-level ones", () => {
    setupSymlinkedMainBranch();

    git(["checkout", "pr"]);
    rmSync(join(repoDir, "AGENTS.md"), { force: true });
    git(["add", "-A"]);
    git(["commit", "-m", "pr deletes agents file"]);

    restoreConfigFromBase("main");

    expectPlaceholder(".haijun-pr/HAIJUN.md");
    expectPlaceholder(".haijun-pr/.haijun/HAIJUN.md");
    expectNoLinksInSnapshot();
    expect(readRepoFile(".haijun/settings.json")).toBe(
      `${JSON.stringify({ source: "base" })}\n`,
    );
  });

  test("snapshots links to tracked in-tree files as dereferenced content", () => {
    setupSymlinkedMainBranch();

    git(["checkout", "pr"]);

    restoreConfigFromBase("main");

    expect(lstatRepoFile(".haijun-pr/HAIJUN.md").isFile()).toBe(true);
    expect(lstatRepoFile(".haijun-pr/.haijun/HAIJUN.md").isFile()).toBe(true);
    expect(readRepoFile(".haijun-pr/HAIJUN.md")).toBe(
      "shared agent instructions\n",
    );
    expect(readRepoFile(".haijun-pr/.haijun/HAIJUN.md")).toBe(
      "shared agent instructions\n",
    );
    expectNoLinksInSnapshot();
  });

  test("records HAIJUN.md links to targets outside the working tree as placeholders", () => {
    const outsideFile = writeOutsideFile("notes.md", "outside notes\n");

    rmSync(join(repoDir, "HAIJUN.md"), { force: true });
    symlinkRepoFile("HAIJUN.md", outsideFile);
    git(["add", "-A"]);
    git(["commit", "-m", "pr links HAIJUN.md outside the repo"]);

    restoreConfigFromBase("main");

    expectPlaceholder(".haijun-pr/HAIJUN.md");
    expect(readRepoFile(".haijun-pr/HAIJUN.md")).not.toBe("outside notes\n");
    expect(snapshotRegularFileContents()).not.toContain("outside notes\n");
    expectNoLinksInSnapshot();
    expect(readRepoFile("HAIJUN.md")).toBe("base haijun instructions\n");
  });

  test("records nested links to targets outside the working tree as placeholders", () => {
    const outsideFile = writeOutsideFile(
      "secret.txt",
      "outside file content\n",
    );
    writeOutsideFile("dir/inner.txt", "outside dir content\n");
    const outsideDir = join(tempDir, "outside", "dir");

    symlinkRepoFile(".haijun/linked-file.md", outsideFile);
    symlinkRepoFile(".haijun/linked-dir", outsideDir);
    git(["add", "-A"]);
    git(["commit", "-m", "pr adds nested links outside the repo"]);

    restoreConfigFromBase("main");

    expect(readRepoFile(".haijun-pr/.haijun/settings.json")).toBe(
      `${JSON.stringify({ source: "pr" })}\n`,
    );
    expectPlaceholder(".haijun-pr/.haijun/linked-file.md");
    expectPlaceholder(".haijun-pr/.haijun/linked-dir");
    const contents = snapshotRegularFileContents();
    expect(contents).not.toContain("outside file content\n");
    expect(contents).not.toContain("outside dir content\n");
    expectNoLinksInSnapshot();
    expect(readRepoFile(".haijun/settings.json")).toBe(
      `${JSON.stringify({ source: "base" })}\n`,
    );
  });

  test("records links into git metadata as placeholders", () => {
    symlinkRepoFile(".haijun/git-config", "../.git/config");
    git(["add", "-A"]);
    git(["commit", "-m", "pr links into git metadata"]);

    restoreConfigFromBase("main");

    expectPlaceholder(".haijun-pr/.haijun/git-config");
    expect(snapshotRegularFileContents()).not.toContain(
      readRepoFile(".git/config"),
    );
    expectNoLinksInSnapshot();
  });

  test("records relative links that only resolve from inside the snapshot as placeholders", () => {
    // Both targets dangle at their source location but would resolve to the
    // repository's .git/config if re-created one directory deeper.
    symlinkRepoFile(".haijun/x", "../../.git/config");
    rmSync(join(repoDir, "HAIJUN.md"), { force: true });
    symlinkRepoFile("HAIJUN.md", "../.git/config");
    git(["add", "-A"]);
    git(["commit", "-m", "pr adds relative links"]);

    restoreConfigFromBase("main");

    const gitConfig = readRepoFile(".git/config");
    for (const path of [".haijun-pr/.haijun/x", ".haijun-pr/HAIJUN.md"]) {
      expectPlaceholder(path);
      expect(readRepoFile(path)).not.toBe(gitConfig);
    }
    expect(snapshotRegularFileContents()).not.toContain(gitConfig);
    expectNoLinksInSnapshot();
  });

  test("records links into nested git metadata inside the working tree as placeholders", () => {
    writeRepoFile("other/.git/config", "nested checkout config\n");
    symlinkRepoFile(".haijun/x", "../other/.git/config");

    restoreConfigFromBase("main");

    expectPlaceholder(".haijun-pr/.haijun/x");
    expect(snapshotRegularFileContents()).not.toContain(
      "nested checkout config\n",
    );
    expectNoLinksInSnapshot();
  });

  test("records links to untracked in-tree files as placeholders", () => {
    writeRepoFile(".env", "untracked env contents\n");
    symlinkRepoFile(".haijun/env", "../.env");
    git(["add", ".haijun/env"]);
    git(["commit", "-m", "pr links to an untracked file"]);

    restoreConfigFromBase("main");

    expectPlaceholder(".haijun-pr/.haijun/env");
    expect(snapshotRegularFileContents()).not.toContain(
      "untracked env contents\n",
    );
    expect(readRepoFile(".haijun-pr/.haijun/settings.json")).toBe(
      `${JSON.stringify({ source: "pr" })}\n`,
    );
    expectNoLinksInSnapshot();
  });

  test("records links to tracked files modified after checkout as placeholders", () => {
    writeRepoFile(".env", "PLACEHOLDER=1\n");
    symlinkRepoFile(".haijun/env", "../.env");
    git(["add", ".env", ".haijun/env"]);
    git(["commit", "-m", "pr links to a tracked file"]);
    writeRepoFile(".env", "written after checkout\n");

    restoreConfigFromBase("main");

    expectPlaceholder(".haijun-pr/.haijun/env");
    expect(snapshotRegularFileContents()).not.toContain(
      "written after checkout\n",
    );
    expectNoLinksInSnapshot();
  });

  test("snapshots a sensitive path that links to a tracked in-tree directory", () => {
    rmSync(join(repoDir, ".haijun"), { recursive: true, force: true });
    writeRepoFile(
      "config/haijun/settings.json",
      `${JSON.stringify({ source: "linked-dir" })}\n`,
    );
    writeRepoFile("config/haijun/agents/reviewer.md", "reviewer agent\n");
    writeRepoFile("docs/agents/writer.md", "writer agent\n");
    symlinkRepoFile("config/haijun/more-agents", "../../docs/agents");
    symlinkRepoFile(".haijun", "config/haijun");
    git(["add", "-A"]);
    git(["commit", "-m", "pr links .haijun to a tracked directory"]);
    writeRepoFile("config/haijun/local.txt", "untracked file\n");
    writeRepoFile("config/haijun/cache/entry.txt", "untracked dir entry\n");

    restoreConfigFromBase("main");

    expect(lstatRepoFile(".haijun-pr/.haijun").isDirectory()).toBe(true);
    expect(readRepoFile(".haijun-pr/.haijun/settings.json")).toBe(
      `${JSON.stringify({ source: "linked-dir" })}\n`,
    );
    expect(readRepoFile(".haijun-pr/.haijun/agents/reviewer.md")).toBe(
      "reviewer agent\n",
    );
    expect(readRepoFile(".haijun-pr/.haijun/more-agents/writer.md")).toBe(
      "writer agent\n",
    );
    expectPlaceholder(".haijun-pr/.haijun/local.txt");
    expectPlaceholder(".haijun-pr/.haijun/cache");
    const contents = snapshotRegularFileContents();
    expect(contents).not.toContain("untracked file\n");
    expect(contents).not.toContain("untracked dir entry\n");
    expectNoLinksInSnapshot();
    expect(lstatRepoFile(".haijun").isDirectory()).toBe(true);
    expect(readRepoFile(".haijun/settings.json")).toBe(
      `${JSON.stringify({ source: "base" })}\n`,
    );
  });

  test("records links to untracked in-tree directories as a single placeholder", () => {
    writeRepoFile("build/out/a.js", "generated a\n");
    writeRepoFile("build/out/b.js", "generated b\n");
    symlinkRepoFile(".haijun/build", "../build");
    git(["add", ".haijun/build"]);
    git(["commit", "-m", "pr links to an untracked directory"]);

    restoreConfigFromBase("main");

    expectPlaceholder(".haijun-pr/.haijun/build");
    const contents = snapshotRegularFileContents();
    expect(contents).not.toContain("generated a\n");
    expect(contents).not.toContain("generated b\n");
    expectNoLinksInSnapshot();
  });

  test("records links back into a parent directory as placeholders", () => {
    symlinkRepoFile(".haijun/parent-dir", "..");
    git(["add", "-A"]);
    git(["commit", "-m", "pr adds a link back to the repo root"]);

    restoreConfigFromBase("main");

    expectPlaceholder(".haijun-pr/.haijun/parent-dir");
    expect(existsRepoFile(".haijun-pr/.haijun/parent-dir/src")).toBe(false);
    expect(readRepoFile(".haijun-pr/.haijun/settings.json")).toBe(
      `${JSON.stringify({ source: "pr" })}\n`,
    );
    expectNoLinksInSnapshot();
  });

  test("does not modify an existing .gitignore", () => {
    writeRepoFile(".gitignore", "node_modules\n");
    git(["add", ".gitignore"]);
    git(["commit", "-m", "add gitignore"]);

    const gitignoreBefore = readRepoFile(".gitignore");

    restoreConfigFromBase("main");

    expect(readRepoFile(".gitignore")).toBe(gitignoreBefore);
    expect(countHaijunPrExcludeEntries()).toBe(1);
  });

  test("leaves a full checkout unshallow so base..HEAD stays scoped to the PR", () => {
    // The damage only shows up once base has moved on since the PR branched:
    // the merge base is then an older commit that a depth-limited fetch of base
    // truncates away, and every base..HEAD comparison silently changes meaning.
    git(["checkout", "main"]);
    writeRepoFile("src/other.ts", "export const advanced = true;\n");
    git(["add", "src/other.ts"]);
    git(["commit", "-m", "base advance"]);
    git(["push", "origin", "main"]);
    git(["checkout", "pr"]);

    expect(git(["rev-parse", "--is-shallow-repository"]).trim()).toBe("false");
    const mergeBaseBefore = git(["merge-base", "origin/main", "HEAD"]).trim();

    restoreConfigFromBase("main");

    expect(git(["rev-parse", "--is-shallow-repository"]).trim()).toBe("false");
    expect(git(["merge-base", "origin/main", "HEAD"]).trim()).toBe(
      mergeBaseBefore,
    );
    // These are the two commands the prompt tells Haijun to run to scope its
    // work to the PR: the log range must not pick up already-merged commits,
    // and the three-dot diff must still resolve a merge base at all.
    expect(git(["log", "--format=%s", "origin/main..HEAD"]).trim()).toBe(
      "pr config",
    );
    expect(
      git(["diff", "--name-only", "origin/main...HEAD"]).trim().split("\n"),
    ).toEqual([".haijun/settings.json", "HAIJUN.md"]);
  });

  function git(args: string[]): string {
    return execFileSync("git", args, {
      cwd: repoDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  function writeRepoFile(path: string, contents: string): void {
    const fullPath = join(repoDir, path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, contents);
  }

  function readRepoFile(path: string): string {
    return readFileSync(join(repoDir, path), "utf8");
  }

  function writeOutsideFile(path: string, contents: string): string {
    const fullPath = join(tempDir, "outside", path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, contents);
    return fullPath;
  }

  // Contents of every regular file recorded in the snapshot, without following
  // links, so tests can assert what actually got copied into the repository.
  function snapshotRegularFileContents(): string[] {
    const contents: string[] = [];
    const visit = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const entryPath = join(dir, entry);
        const stats = lstatSync(entryPath);
        if (stats.isDirectory()) {
          visit(entryPath);
        } else if (stats.isFile()) {
          contents.push(readFileSync(entryPath, "utf8"));
        }
      }
    };
    visit(join(repoDir, ".haijun-pr"));
    return contents;
  }

  // The snapshot must never contain links: every entry is a regular file or a
  // real directory.
  function expectNoLinksInSnapshot(): void {
    const visit = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const entryPath = join(dir, entry);
        const stats = lstatSync(entryPath);
        expect(stats.isSymbolicLink()).toBe(false);
        if (stats.isDirectory()) {
          visit(entryPath);
        }
      }
    };
    visit(join(repoDir, ".haijun-pr"));
  }

  function expectPlaceholder(path: string): void {
    const stats = lstatRepoFile(path);
    expect(stats.isSymbolicLink()).toBe(false);
    expect(stats.isFile()).toBe(true);
    expect(readRepoFile(path)).toStartWith("Snapshot placeholder: ");
  }

  function existsRepoFile(path: string): boolean {
    return existsSync(join(repoDir, path));
  }

  function symlinkRepoFile(path: string, target: string): void {
    const fullPath = join(repoDir, path);
    mkdirSync(dirname(fullPath), { recursive: true });
    symlinkSync(target, fullPath);
  }

  function lstatRepoFile(path: string) {
    return lstatSync(join(repoDir, path));
  }

  function setupSymlinkedMainBranch(): void {
    git(["checkout", "main"]);
    rmSync(join(repoDir, "HAIJUN.md"), { force: true });
    writeRepoFile("AGENTS.md", "shared agent instructions\n");
    symlinkRepoFile("HAIJUN.md", "AGENTS.md");
    symlinkRepoFile(".haijun/HAIJUN.md", "../AGENTS.md");
    git(["add", "AGENTS.md", "HAIJUN.md", ".haijun/HAIJUN.md"]);
    git(["commit", "-m", "add symlinked haijun files"]);
    git(["push", "origin", "main"]);
    git(["branch", "-D", "pr"]);
    git(["checkout", "-b", "pr"]);
  }

  function countHaijunPrExcludeEntries(): number {
    return readFileSync(getExcludePath(), "utf8")
      .split(/\r?\n/)
      .filter((line) => line === HAIJUN_PR_EXCLUDE_PATTERN).length;
  }

  function getExcludePath(): string {
    const gitPath = git(["rev-parse", "--git-path", "info/exclude"]).trim();
    return isAbsolute(gitPath) ? gitPath : join(repoDir, gitPath);
  }
});
