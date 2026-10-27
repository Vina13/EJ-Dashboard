# Release procedure

Steps 1–5 only read or change local files. Steps 6–8 each need an explicit yes in chat.

## 1. Preflight

Stop and report at the first failure.

1. Validate the version (`v<major>.<minor>.<patch>`). Strip the `v` for package versions.
2. The tag must not exist yet: `git tag -l "<version>"` returns nothing.
3. Working tree is clean: `git status --porcelain` returns nothing.
4. Branch is `main`: `git rev-parse --abbrev-ref HEAD`. If not, stop and ask whether to
   release from this branch anyway.
5. A remote exists: `git remote`. If there is none, say so — steps 1–6 can still run, but
   pushing (step 7) and the GitHub release (step 8) will be skipped.
6. With a remote, `git fetch` and check the branch is not behind its upstream
   (`git rev-list --count HEAD..@{u}` is `0`). If it is behind, stop.
7. Resolve the base exactly as in release-notes PROCEDURE.md step 1 (base tag argument,
   else latest `v*` tag, else whole history). The range must not be empty.
8. Check the bump fits the changes: breaking → major, feature → minor, fix → patch. If it
   looks wrong, say so and ask before continuing.

## 2. Tests

Run `npm test`, then `npm run typecheck`. If either fails, stop and show the output.

## 3. Release notes

Follow release-notes PROCEDURE.md steps 2–4 to write `RELEASE_NOTES_<version>.md` in the
repo root, without its "Release checklist (human)" section. Show the draft and let the user
edit it before going on.

## 4. Version bump

Set every workspace package to the new version without creating a commit or tag:

```bash
npm version <version-without-v> --workspaces --no-git-tag-version
```

## 5. Review the diff

Show `git status --short` and `git diff --stat`. Expected: the workspace `package.json`
files, `package-lock.json`, and the release-notes file. Anything else → stop and ask.

## 6. Commit — confirm first

Ask: "Commit these files as `chore(release): <version>` on `<branch>`?" On yes:

```bash
git add <the files from step 5>
git commit -m "chore(release): <version>"
```

## 7. Tag and push — confirm each

1. Ask: "Create annotated tag `<version>` on `<short sha>`?" On yes:
   `git tag -a <version> -m "<version>"`.
2. With no remote, stop here and tell the user to add one and push later.
3. Ask: "Push `<branch>` and tag `<version>` to `<remote>`?" On yes:

   ```bash
   git push <remote> <branch>
   git push <remote> <version>
   ```

## 8. GitHub release — confirm first

Check `gh --version`. If `gh` is missing or the remote is not GitHub, skip this step and
tell the user to create the release in the GitHub UI using the release-notes file as the body.

Otherwise ask: "Publish GitHub release `<version>` with these notes?" On yes:

```bash
gh release create <version> --title "<version>" --notes-file RELEASE_NOTES_<version>.md
```

## 9. Report

Tell the user which steps ran, which were skipped or declined, the commit sha, the tag and
the release URL. If the release stopped part way, include the undo for what was done:

| Done              | Undo                                                         |
| ----------------- | ------------------------------------------------------------ |
| Version bump only | `git checkout -- . && git clean -n` (review, then `-f`)      |
| Commit            | `git reset --soft HEAD~1`                                     |
| Local tag         | `git tag -d <version>`                                        |
| Pushed tag        | `git push <remote> :refs/tags/<version>` — ask the team first |
