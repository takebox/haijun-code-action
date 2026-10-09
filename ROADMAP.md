# Haijun Code GitHub Action Roadmap

Thank you for trying out the beta of our GitHub Action! This document outlines our path to `v1.0`. Items are not necessarily in priority order.

## Path to 1.0

- ~**Ability to see GitHub Action CI results** - This will enable Haijun to look at CI failures and make updates to PRs to fix test failures, lint errors, and the like.~
- **Cross-repo support** - Enable Haijun to work across multiple repositories in a single session
- **Ability to modify workflow files** - Let Haijun update GitHub Actions workflows and other CI configuration files
- **Support for workflow_dispatch and repository_dispatch events** - Dispatch Haijun on events triggered via API from other workflows or from other services
- **Ability to disable commit signing** - Option to turn off GPG signing for environments where it's not required. This will enable Haijun to use normal `git` bash commands for committing. This will likely become the default behavior once added.
- **Better code review behavior** - Support inline comments on specific lines, provide higher quality reviews with more actionable feedback
- ~**Support triggering @haijun from bot users** - Allow automation and bot accounts to invoke Haijun~
- **Customizable base prompts** - Full control over Haijun's initial context with template variables like `$PR_COMMENTS`, `$PR_FILES`, etc. Users can replace our default prompt entirely while still accessing key contextual data

---

**Note:** This roadmap represents our current vision for reaching `v1.0` and is subject to change based on user feedback and development priorities.

We welcome feedback on these planned features! If you're interested in contributing to any of these features, please open an issue to discuss implementation details with us. We're also open to suggestions for new features not listed here.
