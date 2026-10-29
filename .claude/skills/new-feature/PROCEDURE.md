# New feature procedure

## 1. Read the FSD

1. For a `.docx`, extract the text (works while the file is open in Word):

   ```
   powershell -NoProfile -File .claude/skills/new-feature/extract-docx.ps1 -Source "<fsd.docx>" -Out "<scratchpad>/fsd.txt"
   ```

   Do the same for the previous FSD (second argument) if given. Write the `.txt` to the
   scratchpad, never into the repo: the FSD is confidential to the bank.
2. Read the extracted text in full. Images (flowcharts, ERD, screens) are not extracted;
   rely on their captions and the surrounding text, and say in the report which figures
   could not be read.
3. Collect from the FSD, keeping the section number of each item:
   - Tabel 6.1 Authorization: menu, role, action type
   - Tabel 7.1 Requirement: aplikasi, type (New/Change), requirement
   - 6.2 Proposed Solutions: authentication, input validation, session, credentials
   - 3.1.2 flowcharts and 5.1 ERD: screens, fields, entities
   - 6.4 and other Gap Resolutions: commitments such as audit trail

## 2. Find what is new or changed

- **With a previous FSD:** diff the two collections. New rows in Tabel 6.1 or 7.1, changed
  roles or action types, new figures (flowchart, ERD, screen) and changed numbers (timeout,
  lengths) are the change set.
- **Without one:** compare each collected item with [PRD.md](../../../docs/ej-dashboard/PRD.md)
  § 4 (roles) and § 6 (requirements). Anything the PRD lacks or states differently is the
  change set.

For each item in the change set decide: new requirement, change to an existing `REQ-*`, or
FSD revision (technology conflicts with an ADR; see the rules in SKILL.md).

## 3. Check against the ADRs

Read every file in [docs/ej-dashboard/adr/](../../../docs/ej-dashboard/adr/). For each
change, note the ADR it touches and whether it fits, needs an amendment, or needs a new
ADR. Known constraints:

| ADR | Constraint a feature must respect |
| --- | --- |
| 0001 | Data in SQLite on the bank's server; no external database or cloud |
| 0002 | Session is an httpOnly HMAC cookie; changing TTL or adding session state needs an amendment |
| 0003 | EJ workspaces stay separate (`apps/ej-*`) from the older `apps/api` and `apps/web` |
| 0004 | Pages are hash routes (`#/<route>`) |
| 0005 | EJ files are pulled via SFTP, not pushed |
| 0006 | The MCP server is read-only |

## 4. Map each change to files

Every EJ Dashboard feature touches the same layers. Use Grep to find the exact lines.

| Layer | Where | Typical change |
| --- | --- | --- |
| Shared types and validation | `packages/shared/src/ej.ts`, `ejData.ts` | Roles, input types, validation, menu access |
| Database | `apps/ej-api/src/db.ts` | Tables, CHECK constraints, migrations (SQLite cannot alter CHECK: copy to a new table) |
| Seed | `apps/ej-api/src/seed.ts` | Default data |
| Auth and access | `apps/ej-api/src/auth/` | Session, role and menu guards |
| API endpoints | `apps/ej-api/src/app.ts` (auth, users), `ejRoutes.ts` (EJ menus) | New route, guard, response |
| MCP tools | `apps/ej-mcp/src/server.ts` | Read-only tools that expose the new data |
| Menu and routing | `apps/ej-web/src/menu.ts`, `App.tsx` | Menu entry, route, landing page |
| Page | `apps/ej-web/src/pages/<Name>Page.tsx` | Screen from FSD § 7.5 |
| API client | `apps/ej-web/src/api.ts`, `useApiData.ts` | Calls to the new endpoint |
| Unit and API tests | `*.test.ts` next to the code | One `[REQ-ID]` per test |
| Component tests | `apps/ej-web/src/App.test.tsx` | Menu, form, validation |
| E2E | `apps/ej-e2e/tests/ej-dashboard.spec.ts` | Next free `TC-E2E-NNN` |
| Docs | `docs/ej-dashboard/design.md`, `testing-strategy.md` | Data model, API, traceability matrix |

Size each requirement S (1 layer or a few lines), M (2–3 layers), L (new table, new ADR,
or 4+ layers). Set its risk tier with [testing-strategy.md § 2](../../../docs/ej-dashboard/testing-strategy.md):
security and data correctness are P1.

## 5. Write the documents

Pick a short kebab-case slug for the change (for example `v1.2-export-report`).

1. **Impact analysis:** `docs/ej-dashboard/changes/<slug>.md` from
   [templates/impact-analysis.md](templates/impact-analysis.md).
   [v1.1-fsd-alignment.md](../../../docs/ej-dashboard/changes/v1.1-fsd-alignment.md) is a
   finished example.
2. **PRD:** edit [PRD.md](../../../docs/ej-dashboard/PRD.md):
   - add or change rows in § 6 with status `Belum dibuat` or `Perlu diubah`
   - add a row per change to the "Perubahan" table at the top (create the table for a new
     version)
   - add ambiguities to § 8 Open questions, and technology conflicts to "Revisi yang
     diusulkan untuk FSD"
   - bump the Status line to the new draft version
3. **Test script:** `docs/ej-dashboard/test-scripts/<slug>.md` from
   [templates/test-script.md](templates/test-script.md):
   - at least one positive and one negative case per requirement
   - one case per role for every access rule (allowed role sees it, other roles get
     hidden menu and HTTP 403)
   - test data uses the seed accounts and the sample EJ files, never real customer data
   - Status column left as `Belum dijalankan`
4. **Testing strategy:** add the new requirements to
   [testing-strategy.md § 4](../../../docs/ej-dashboard/testing-strategy.md) with the
   planned automated test names, and to § 5 Gap until the tests exist.

## 6. Report

Tell the user, in the language they wrote in:

- the change set (new, changed, FSD revision), each with its FSD section
- the three files written or edited, as links
- open questions that block a requirement
- figures that could not be read from the `.docx`
- that no application code was changed, and the suggested order of work from the impact
  analysis
