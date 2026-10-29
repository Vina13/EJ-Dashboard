---
name: new-feature
description: Read a new or revised EJ Dashboard FSD (.docx or .md), compare it with the PRD, ADRs and code, and draft the impact analysis (which files to change), PRD requirement rows and a manual test script. Manual only; never changes application code.
argument-hint: "<fsd-path> [previous-fsd-path]"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Grep, Glob, PowerShell(powershell -NoProfile -File *extract-docx.ps1*), Bash(git log:*), Bash(git status:*), Bash(git diff:*)
---

# New feature from FSD

Turn an FSD for the EJ Dashboard into the three documents a new feature needs before any
code is written: the impact analysis, the PRD update, and the test script.

## Arguments

- `$0`: path to the FSD (required). `.docx` or `.md`. If it is missing or the file does
  not exist, stop and ask for it.
- `$1`: path to the previous FSD version (optional). When given, only what changed between
  the two versions counts as new. Without it, compare the FSD with the PRD.

Raw arguments: `$ARGUMENTS`

## Current repo state

- Branch and working tree: !`git status --short --branch`
- Requirement IDs in the PRD: !`grep -o "REQ-[A-Z]*-[0-9]*" docs/ej-dashboard/PRD.md | sort -u | tr "\n" " "`

## Rules

- **The FSD is the source of truth** for behaviour: roles, menu access, validation,
  screens, flows. When the PRD or code differs, the PRD is updated and the code change is
  planned.
- **ADRs win on technology.** When the FSD names a different stack, library or storage
  (for example PHP Laravel, XAMPP, AES for passwords), do not plan a rewrite: list it under
  "Revisi yang diusulkan untuk FSD" in the PRD instead, citing the ADR.
- Never change application code (`apps/`, `packages/`). This skill writes documents only;
  the developer implements from the impact analysis.
- Never invent a requirement the FSD does not state. When the FSD is ambiguous, add an
  open question to PRD § 8 and mark the requirement `Perlu konfirmasi`.
- Every new requirement gets the next free `REQ-<MODUL>-<NNN>` ID; never reuse or renumber
  an existing ID.
- Every file path in the impact analysis must exist in the repo, or be marked `(baru)`.
  Check with Glob/Grep before writing it.

## Procedure

Follow [PROCEDURE.md](PROCEDURE.md) step by step. It defines how to read the FSD, what to
compare, where each layer of the app lives, and the templates for the impact analysis
([templates/impact-analysis.md](templates/impact-analysis.md)) and the test script
([templates/test-script.md](templates/test-script.md)).
