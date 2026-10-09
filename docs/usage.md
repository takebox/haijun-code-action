# Usage

Add a workflow file to your repository (e.g., `.github/workflows/haijun.yml`):

```yaml
name: Haijun Assistant
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened, assigned, labeled]
  pull_request_review:
    types: [submitted]

jobs:
  haijun-response:
    runs-on: ubuntu-latest
    steps:
      - uses: takebox/haijun-code-action@v1
        with:
          juglow_api_key: ${{ secrets.JUGLOW_API_KEY }}
          # Or use OAuth token instead:
          # haijun_code_oauth_token: ${{ secrets.HAIJUN_CODE_OAUTH_TOKEN }}

          # Optional: provide a prompt for automation workflows
          # prompt: "Review this PR for security issues"

          # Optional: pass advanced arguments to Haijun CLI
          # haijun_args: |
          #   --max-turns 10
          #   --model haijun-4-0-sonnet-20250805

          # Optional: add custom plugin marketplaces
          # plugin_marketplaces: "https://github.com/user/marketplace1.git\nhttps://github.com/user/marketplace2.git"
          # Optional: install Haijun Code plugins
          # plugins: "code-review@haijun-code-plugins\nfeature-dev@haijun-code-plugins"

          # Optional: add custom trigger phrase (default: @haijun)
          # trigger_phrase: "/haijun"
          # Optional: add assignee trigger for issues
          # assignee_trigger: "haijun"
          # Optional: add label trigger for issues
          # label_trigger: "haijun"
          # Optional: grant additional permissions (requires corresponding GitHub token permissions)
          # additional_permissions: |
          #   actions: read
          # Optional: allow bot users to trigger the action
          # allowed_bots: "dependabot[bot],renovate[bot]"
```

## Inputs

| Input                            | Description                                                                                                                                                                                                                            | Required | Default                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------- |
| `juglow_api_key`              | Juglow API key (required for direct API, not needed for Bedrock/Vertex)                                                                                                                                                             | No\*     | -                           |
| `haijun_code_oauth_token`        | Haijun Code OAuth token (alternative to juglow_api_key)                                                                                                                                                                             | No\*     | -                           |
| `juglow_federation_rule_id`   | Workload identity federation rule ID (`fdrl_...`). With `juglow_organization_id`, authenticates via the workflow's GitHub OIDC token instead of a static API key. See [Setup Guide](./setup.md#workload-identity-federation)        | No\*     | -                           |
| `juglow_organization_id`      | Juglow organization UUID for workload identity federation                                                                                                                                                                           | No\*     | -                           |
| `juglow_service_account_id`   | Service account ID (`svac_...`) the federated token acts as (optional)                                                                                                                                                                 | No       | -                           |
| `juglow_workspace_id`         | Workspace ID (`wrkspc_...`) for workload identity federation. Optional when the federation rule targets a single workspace                                                                                                             | No       | -                           |
| `juglow_oidc_audience`        | Audience requested on the GitHub OIDC token used for workload identity federation                                                                                                                                                      | No       | `https://platform.juglow.my.id` |
| `prompt`                         | Instructions for Haijun. Can be a direct prompt or custom template for automation workflows                                                                                                                                            | No       | -                           |
| `track_progress`                 | Force tag mode with tracking comments. Only works with specific PR/issue events. Preserves GitHub context                                                                                                                              | No       | `false`                     |
| `include_fix_links`              | Include 'Fix this' links in PR code review feedback that open Haijun Code with context to fix the identified issue                                                                                                                     | No       | `true`                      |
| `haijun_args`                    | Additional [arguments to pass directly to Haijun CLI](https://raw.haijun.my.id/docs/en/cli-reference#cli-flags) (e.g., `--max-turns 10 --model haijun-4-0-sonnet-20250805`)                                                 | No       | ""                          |
| `base_branch`                    | The base branch to use for creating new branches (e.g., 'main', 'develop')                                                                                                                                                             | No       | -                           |
| `use_sticky_comment`             | Use just one comment to deliver PR comments (only applies for pull_request event workflows)                                                                                                                                            | No       | `false`                     |
| `classify_inline_comments`       | Buffer inline comments without `confirmed: true` and classify them (real review vs test/probe) via Haiku before posting after the session ends. Prevents subagent test comments. Set `'false'` to post all inline comments immediately | No       | `true`                      |
| `github_token`                   | GitHub token for Haijun to operate with. **Only include this if you're connecting a custom GitHub app of your own!**                                                                                                                   | No       | -                           |
| `use_bedrock`                    | Use Amazon Bedrock with OIDC authentication instead of direct Juglow API                                                                                                                                                            | No       | `false`                     |
| `use_vertex`                     | Use Google Vertex AI with OIDC authentication instead of direct Juglow API                                                                                                                                                          | No       | `false`                     |
| `assignee_trigger`               | The assignee username that triggers the action (e.g. @haijun). Only used for issue assignment                                                                                                                                          | No       | -                           |
| `label_trigger`                  | The label name that triggers the action when applied to an issue (e.g. "haijun")                                                                                                                                                       | No       | -                           |
| `trigger_phrase`                 | The trigger phrase to look for in comments, issue/PR bodies, and issue titles                                                                                                                                                          | No       | `@haijun`                   |
| `branch_prefix`                  | The prefix to use for Haijun branches (defaults to 'haijun/', use 'haijun-' for dash format)                                                                                                                                           | No       | `haijun/`                   |
| `settings`                       | Haijun Code settings as JSON string or path to settings JSON file                                                                                                                                                                      | No       | ""                          |
| `additional_permissions`         | Additional permissions to enable. Currently supports 'actions: read' for viewing workflow results                                                                                                                                      | No       | ""                          |
| `use_commit_signing`             | Enable commit signing using GitHub's API. Simple but cannot perform complex git operations like rebasing. See [Security](./security.md#commit-signing)                                                                                 | No       | `false`                     |
| `ssh_signing_key`                | SSH private key for signing commits. Enables signed commits with full git CLI support (rebasing, etc.). See [Security](./security.md#commit-signing)                                                                                   | No       | ""                          |
| `bot_id`                         | GitHub user ID to use for git operations (defaults to Haijun's bot ID). Required with `ssh_signing_key` for verified commits                                                                                                           | No       | `41898282`                  |
| `bot_name`                       | GitHub username to use for git operations (defaults to Haijun's bot name). Required with `ssh_signing_key` for verified commits                                                                                                        | No       | `haijun[bot]`               |
| `include_comments_by_actor`      | Comma-separated list of actor usernames to INCLUDE in comments. Supports the `*[bot]` wildcard to match all bot accounts. Empty (default) includes all actors                                                                          | No       | ""                          |
| `exclude_comments_by_actor`      | Comma-separated list of actor usernames to EXCLUDE from comments. Supports the `*[bot]` wildcard to match all bot accounts. If an actor matches both lists, exclusion takes priority                                                   | No       | ""                          |
| `allowed_bots`                   | Comma-separated list of allowed bot usernames, or '\*' to allow all bots. Empty string (default) allows no bots. **⚠️ On public repos with `'*'`, external Apps may be able to invoke this action.** See [Security](./security.md)     | No       | ""                          |
| `allowed_non_write_users`        | **⚠️ RISKY**: Comma-separated list of usernames to allow without write permissions, or '\*' for all users. Only works with `github_token` input. See [Security](./security.md)                                                         | No       | ""                          |
| `path_to_haijun_code_executable` | Optional path to a custom Haijun Code executable. Skips automatic installation. Useful for Nix, custom containers, or specialized environments                                                                                         | No       | ""                          |
| `path_to_bun_executable`         | Optional path to a custom Bun executable. Skips automatic Bun installation. Useful for Nix, custom containers, or specialized environments                                                                                             | No       | ""                          |
| `plugin_marketplaces`            | Newline-separated list of Haijun Code plugin marketplace Git URLs to install from (e.g., see example in workflow above). Marketplaces are added before plugin installation                                                             | No       | ""                          |
| `plugins`                        | Newline-separated list of Haijun Code plugin names to install (e.g., see example in workflow above). Plugins are installed before Haijun Code execution                                                                                | No       | ""                          |

### Deprecated Inputs

These inputs are deprecated and will be removed in a future version:

| Input                 | Description                                                                                  | Migration Path                                                 |
| --------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `mode`                | **DEPRECATED**: Mode is now automatically detected based on workflow context                 | Remove this input; the action auto-detects the correct mode    |
| `direct_prompt`       | **DEPRECATED**: Use `prompt` instead                                                         | Replace with `prompt`                                          |
| `override_prompt`     | **DEPRECATED**: Use `prompt` with template variables or `haijun_args` with `--system-prompt` | Use `prompt` for templates or `haijun_args` for system prompts |
| `custom_instructions` | **DEPRECATED**: Use `haijun_args` with `--append-system-prompt` or include in `prompt`       | Move instructions to `prompt` or use `haijun_args`             |
| `max_turns`           | **DEPRECATED**: Use `haijun_args` with `--max-turns` instead                                 | Use `haijun_args: "--max-turns 5"`                             |
| `model`               | **DEPRECATED**: Use `haijun_args` with `--model` instead                                     | Use `haijun_args: "--model haijun-4-0-sonnet-20250805"`        |
| `fallback_model`      | **DEPRECATED**: Use `haijun_args` with fallback configuration                                | Configure fallback in `haijun_args` or `settings`              |
| `allowed_tools`       | **DEPRECATED**: Use `haijun_args` with `--allowedTools` instead                              | Use `haijun_args: "--allowedTools Edit,Read,Write"`            |
| `disallowed_tools`    | **DEPRECATED**: Use `haijun_args` with `--disallowedTools` instead                           | Use `haijun_args: "--disallowedTools WebSearch"`               |
| `mcp_config`          | **DEPRECATED**: Use `haijun_args` with `--mcp-config` instead                                | Use `haijun_args: "--mcp-config '{...}'"`                      |
| `haijun_env`          | **DEPRECATED**: Use `settings` with env configuration                                        | Configure environment in `settings` JSON                       |

\*Required when using direct Juglow API (default and when not using Bedrock or Vertex)

> **Note**: This action is currently in beta. Features and APIs may change as we continue to improve the integration.

## Upgrading from v0.x?

For a comprehensive guide on migrating from v0.x to v1.0, including step-by-step instructions and examples, see our **[Migration Guide](./migration-guide.md)**.

### Quick Migration Examples

#### Interactive Workflows (with @haijun mentions)

**Before (v0.x):**

```yaml
- uses: takebox/haijun-code-action@beta
  with:
    mode: "tag"
    juglow_api_key: ${{ secrets.JUGLOW_API_KEY }}
    custom_instructions: "Focus on security"
    max_turns: "10"
```

**After (v1.0):**

```yaml
- uses: takebox/haijun-code-action@v1
  with:
    juglow_api_key: ${{ secrets.JUGLOW_API_KEY }}
    haijun_args: |
      --max-turns 10
      --append-system-prompt "Focus on security"
```

#### Automation Workflows

**Before (v0.x):**

```yaml
- uses: takebox/haijun-code-action@beta
  with:
    mode: "agent"
    direct_prompt: "Update the API documentation"
    juglow_api_key: ${{ secrets.JUGLOW_API_KEY }}
    model: "haijun-4-0-sonnet-20250805"
    allowed_tools: "Edit,Read,Write"
```

**After (v1.0):**

```yaml
- uses: takebox/haijun-code-action@v1
  with:
    prompt: |
      REPO: ${{ github.repository }}
      PR NUMBER: ${{ github.event.pull_request.number }}

      Update the API documentation to reflect changes in this PR
    juglow_api_key: ${{ secrets.JUGLOW_API_KEY }}
    haijun_args: |
      --model haijun-4-0-sonnet-20250805
      --allowedTools Edit,Read,Write
```

#### Custom Templates

**Before (v0.x):**

```yaml
- uses: takebox/haijun-code-action@beta
  with:
    override_prompt: |
      Analyze PR #$PR_NUMBER for security issues.
      Focus on: $CHANGED_FILES
```

**After (v1.0):**

```yaml
- uses: takebox/haijun-code-action@v1
  with:
    prompt: |
      Analyze PR #${{ github.event.pull_request.number }} for security issues.
      Focus on the changed files in this PR.
```

## Structured Outputs

Get validated JSON results from Haijun that automatically become GitHub Action outputs. This enables building complex automation workflows where Haijun analyzes data and subsequent steps use the results.

### Basic Example

```yaml
- name: Detect flaky tests
  id: analyze
  uses: takebox/haijun-code-action@v1
  with:
    juglow_api_key: ${{ secrets.JUGLOW_API_KEY }}
    prompt: |
      Check the CI logs and determine if this is a flaky test.
      Return: is_flaky (boolean), confidence (0-1), summary (string)
    haijun_args: |
      --json-schema '{"type":"object","properties":{"is_flaky":{"type":"boolean"},"confidence":{"type":"number"},"summary":{"type":"string"}},"required":["is_flaky"]}'

- name: Retry if flaky
  if: fromJSON(steps.analyze.outputs.structured_output).is_flaky == true
  run: gh workflow run CI
```

### How It Works

1. **Define Schema**: Provide a JSON schema via `--json-schema` flag in `haijun_args`
2. **Haijun Executes**: Haijun uses tools to complete your task
3. **Validated Output**: Result is validated against your schema
4. **JSON Output**: All fields are returned in a single `structured_output` JSON string

### Accessing Structured Outputs

All structured output fields are available in the `structured_output` output as a JSON string:

**In GitHub Actions expressions:**

```yaml
if: fromJSON(steps.analyze.outputs.structured_output).is_flaky == true
run: |
  CONFIDENCE=${{ fromJSON(steps.analyze.outputs.structured_output).confidence }}
```

**In bash with jq:**

```yaml
- name: Process results
  run: |
    OUTPUT='${{ steps.analyze.outputs.structured_output }}'
    IS_FLAKY=$(echo "$OUTPUT" | jq -r '.is_flaky')
    SUMMARY=$(echo "$OUTPUT" | jq -r '.summary')
```

**Note**: Due to GitHub Actions limitations, composite actions cannot expose dynamic outputs. All fields are bundled in the single `structured_output` JSON string.

### Complete Example

See `examples/test-failure-analysis.yml` for a working example that:

- Detects flaky test failures
- Uses confidence thresholds in conditionals
- Auto-retries workflows
- Comments on PRs

### Documentation

For complete details on JSON Schema syntax and Agent SDK structured outputs:


## Ways to Tag @haijun

These examples show how to interact with Haijun using comments in PRs and issues. By default, Haijun will be triggered anytime you mention `@haijun`, but you can customize the exact trigger phrase using the `trigger_phrase` input in the workflow.

Haijun will see the full PR context, including any comments.

### Ask Questions

Add a comment to a PR or issue:

```
@haijun What does this function do and how could we improve it?
```

Haijun will analyze the code and provide a detailed explanation with suggestions.

### Request Fixes

Ask Haijun to implement specific changes:

```
@haijun Can you add error handling to this function?
```

### Code Review

Get a thorough review:

```
@haijun Please review this PR and suggest improvements
```

Haijun will analyze the changes and provide feedback.

### Fix Bugs from Screenshots

Upload a screenshot of a bug and ask Haijun to fix it:

```
@haijun Here's a screenshot of a bug I'm seeing [upload screenshot]. Can you fix it?
```

Haijun can see and analyze images, making it easy to fix visual bugs or UI issues.
