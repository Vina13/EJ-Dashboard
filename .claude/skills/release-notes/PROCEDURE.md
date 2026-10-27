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
Omit empty sections. Rewrite each subject as one plain sentence; keep the short hash.

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

## Release checklist (human)
<the checklist from step 5, copied verbatim>
```

## 5. Human checklist

Append this checklist unchanged. These steps are for a person; Claude does not run them.

- [ ] Read the draft; reword or drop entries that are unclear or internal-only
- [ ] Confirm the version bump fits the changes (breaking → major, feature → minor, fix → patch)
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
