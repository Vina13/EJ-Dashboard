---
name: release-notes
description: Draft release notes from the commits since the latest v* release tag, plus a human release checklist. Manual only; never pushes or tags.
argument-hint: "<new-version> [base-tag]"
disable-model-invocation: true
allowed-tools: Bash(git describe:*), Bash(git log:*), Bash(git tag:*), Bash(git rev-list:*), Bash(git status:*), Read, Write
---

# Release notes since the last v* tag

Draft release notes for version `$0`, covering every commit since the base release tag,
and end with a checklist a human works through before releasing.

## Arguments

- `$0` — the new version, e.g. `v1.3.0` (required). If it is missing or does not match
  `v<major>.<minor>.<patch>`, stop and ask for it.
- `$1` — the base tag to compare from (optional). Defaults to the latest `v*` tag.

Raw arguments: `$ARGUMENTS`

## Current repo state

- Latest v* tag: !`git describe --tags --abbrev=0 --match "v*" 2>/dev/null || echo "NONE"`
- Branch and working tree: !`git status --short --branch`

## Rules

- Do not run `git push`, `git tag`, `git commit`, or `npm publish`. A tag or push is public
  and hard to undo, and the release decision belongs to a person after reading the draft,
  so those steps live in the human checklist instead.
- Only read git history; the one file you write is the release-notes draft, left unstaged
  so the human can edit it before anything is committed.
- If there is no `v*` tag and no `$1`, use the whole history (from the root commit) and say
  so at the top of the draft.

## Procedure

Follow [PROCEDURE.md](PROCEDURE.md) step by step. It defines how to collect commits, how to
group them, the draft template, and the human checklist that must appear at the end.
