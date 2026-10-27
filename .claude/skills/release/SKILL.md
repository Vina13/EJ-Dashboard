---
name: release
description: Cut a full release for a new v* version — preflight checks, tests, release notes, version bump, commit, tag, push and GitHub release — pausing for explicit confirmation before every step that commits or publishes. Manual only.
argument-hint: "<new-version> [base-tag]"
disable-model-invocation: true
allowed-tools: Bash(git status:*), Bash(git describe:*), Bash(git log:*), Bash(git tag -l:*), Bash(git rev-list:*), Bash(git rev-parse:*), Bash(git remote:*), Bash(git diff:*), Bash(git fetch:*), Bash(npm test), Bash(npm run typecheck), Bash(npm version:*), Bash(gh --version), Read, Write
---

# Full release for $0

Release version `$0` end to end: check the repo is ready, run the tests, draft the notes,
bump the versions, then commit, tag, push and publish — one confirmed step at a time.

## Arguments

- `$0` — the new version, e.g. `v1.3.0` (required). If it is missing or does not match
  `v<major>.<minor>.<patch>`, stop and ask for it.
- `$1` — the base tag to compare from (optional). Defaults to the latest `v*` tag.

Raw arguments: `$ARGUMENTS`

## Current repo state

- Latest v* tag: !`git describe --tags --abbrev=0 --match "v*" 2>/dev/null || echo "NONE"`
- Branch and working tree: !`git status --short --branch`
- Remotes: !`git remote -v`

## Rules

- **Confirmation gates.** Before each of these, show exactly what will happen and wait for
  the user to answer yes in chat: the release commit, creating the tag, pushing, and
  publishing the GitHub release. One yes covers one step only. A "no" stops the release at
  that point; report what was already done and how to undo it (see PROCEDURE.md, step 9).
- These steps are deliberately not in `allowed-tools`, so the permission prompt is a second
  gate. Never pass `--force`, `--no-verify`, or push any ref other than the release branch
  and the new tag.
- Never run `npm publish`; every workspace package is private.
- If any check in the preflight or the tests fails, stop before changing anything.
- For release notes, reuse the release-notes skill's rules instead of inventing new ones:
  follow steps 2–4 of [../release-notes/PROCEDURE.md](../release-notes/PROCEDURE.md), but
  leave out its human checklist — this skill performs those steps itself.

## Procedure

Follow [PROCEDURE.md](PROCEDURE.md) step by step.
