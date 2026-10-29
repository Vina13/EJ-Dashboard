# Release notes procedure

## 1. Resolve the range

1. Validate the new version (first argument) (`v<major>.<minor>.<patch>`). Stop and ask if invalid.
2. Check the version is not already a tag: `git tag -l "<version>"`. If it exists, stop and tell
   the user.
3. Pick the base:
   - the base tag (second argument) if given; confirm it exists with `git tag -l "<base>"`;
   - otherwise `git describe --tags --abbrev=0 --match "v*"`;
   - otherwise no base: the range is the whole history.
4. Range is `<base>..HEAD`, or `HEAD` when there is no base.

## 2. Collect commits

```bash
git log <range> --no-merges --pretty=format:"%h%x09%s%x09%an"
```

If the range is empty, stop and report that nothing changed since the base tag.

## 3. Group commits

Group by the commit subject (Conventional Commits prefix first, then the leading verb):

| Section          | Matches                                      |
| ---------------- | -------------------------------------------- |
| Breaking changes | `!:` in prefix, or `BREAKING CHANGE` in body |
| Features         | `feat:`, or subject starts with "Add"        |
| Fixes            | `fix:`, or subject starts with "Fix"         |
| Other            | everything else (`chore`, `docs`, `ci`, ...) |

Check bodies for breaking changes with `git log <range> --grep "BREAKING CHANGE"`.
Omit empty sections (including Requirements, Test results, Design decisions and Known open
questions when step 3b found nothing). Rewrite each subject as one plain sentence; keep the
short hash.

## 3b. Collect requirements and test results

1. Requirement IDs: `git log <range> --pretty=format:"%s%n%b" | grep -o "REQ-[A-Z]*-[0-9]*" | sort -u`,
   plus every `REQ-*` in `docs/ej-dashboard/changes/*.md` files added or changed in the range
   (`git diff --name-only <range> -- docs/ej-dashboard/changes/`). Look up each ID's title
   and status in `docs/ej-dashboard/PRD.md`.
2. Test scripts: for each `docs/ej-dashboard/test-scripts/*.md` added or changed in the
   range, copy its "Ringkasan eksekusi" row and list every test case whose Status is not
   `Pass`.
3. ADRs: list `docs/ej-dashboard/adr/*.md` added or changed in the range.
4. Open questions: copy rows from PRD § 8 marked "Ya" in the Blocking column that name a
   requirement from step 1.

## 4. Write the draft

Write `RELEASE_NOTES_<version>.md` in the repo root (do not stage or commit it):

```markdown
# <version> — <YYYY-MM-DD>

Changes since <base tag, or "the initial commit">. <N> commits.

## Breaking changes
- ... (`abc1234`)

## Features
- ... (`abc1234`)

## Fixes
- ... (`abc1234`)

## Other
- ... (`abc1234`)

## Requirements
| ID | Requirement | Status di PRD |
| --- | --- | --- |
| REQ-... | ... | ... |

## Test results
| Test script | Total | Pass | Fail | Blocked | Belum dijalankan |
| --- | --- | --- | --- | --- | --- |
| [<slug>](docs/ej-dashboard/test-scripts/<slug>.md) | ... | ... | ... | ... | ... |

Not passed: TC-... (<status>, <reason or defect>)

## Design decisions
- [ADR-NNNN: ...](docs/ej-dashboard/adr/...)

## Known open questions
- ... (blocks REQ-...)

## Release checklist (human)
<the checklist from step 5, copied verbatim>
```

## 5. Human checklist

Append this checklist unchanged. These steps are for a person; Claude does not run them.

- [ ] Read the draft; reword or drop entries that are unclear or internal-only
- [ ] Confirm the version bump fits the changes (breaking → major, feature → minor, fix → patch)
- [ ] Every requirement in the release has status `Selesai` in the PRD, or is listed as a known gap
- [ ] Every test script in the release has no `Fail` and no `Belum dijalankan`, or the exceptions are signed off
- [ ] `npm test` and `npm run typecheck` pass locally on the release commit
- [ ] CI is green on the branch being released
- [ ] Version numbers in `package.json` files are updated if they need to be
- [ ] Working tree is clean and you are on the intended release branch
- [ ] Create the tag yourself: `git tag -a <version> -m "<version>"`
- [ ] Push it yourself: `git push origin <version>`
- [ ] Publish the release notes (GitHub release or changelog)

## 6. Report

Tell the user the range used, the commit count, the path of the draft, and remind them that
nothing was tagged, committed or pushed.
