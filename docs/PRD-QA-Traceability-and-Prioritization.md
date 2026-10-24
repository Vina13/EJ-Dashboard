# PRD: QA Traceability & Risk-Based Test Prioritization

Oct 24, 2026 · @Vina

## Overview

This PRD proposes two QA process improvements: a traceability matrix linking the FSD, application modules and test execution, and a risk-based priority tier for every feature so the most critical tests run first when time is short.

### Background

The team manages 5+ application products that are live in production at client sites, plus several new products in development. Test scripts already exist, but there is no structured traceability between specification documents, application modules and test execution. There is no dedicated Business Analyst (BA) or System Analyst (SA), so QA has to update the Functional Specification Document (FSD) retrospectively, after development is finished.

### Problem

- **No link between spec, module and test.** FSDs, application modules and test scripts are kept separately for each of 5+ live products. Nobody can quickly answer "which tests cover this FSD requirement?" or "which requirements are untested?"
- **FSD lags behind the code.** With no BA/SA, QA updates the FSD only after development ends, so tests are written against features that are not yet documented and gaps are found late.
- **Coverage gaps stay hidden.** Untested requirements and orphan scripts (tests tied to nothing) are only found by accident, often after a defect reaches a client's production system.
- **Change impact is guesswork.** When a module changes in a live product, testers cannot reliably pick the scripts that exercise it.
- **No agreed priority.** All tests are treated as equal. When a release window shrinks, testers choose what to run by habit or memory, so critical flows (login, payment, data save) may be skipped while low-risk screens are tested.

### Proposed solution in one line

Build and maintain a Requirement → Module → Test Script traceability matrix, tag each requirement with a priority tier (P1 Critical to P4 Low) from a simple risk score, and use the tiers to select the test set for any given time budget.

## Goals, non-goals and success metrics

Success means every in-scope requirement has a known module, a known priority and at least one linked test, and a P1 regression can be run in a fixed time budget.

### Goals

1. Every requirement is mapped to its module(s) and test script(s) in one shared matrix.
2. Coverage gaps (requirements with no test) and orphan tests (tests with no requirement) are visible at a glance.
3. Every requirement carries a priority tier agreed by QA, Dev and the PM.
4. Testers can build a test run for a given time budget by taking tiers in order: P1, then P2, and so on.

### Non-goals

- Buying or migrating to a new test-management tool (phase 1 uses the team's existing Jira).
- Writing new automated tests; this PRD maps and ranks what exists and lists the gaps.
- Changing the defect workflow or release approval process.

### Success metrics

| Metric | Baseline | Target | Measured |
| --- | --- | --- | --- |
| Requirements mapped to a module | Unknown | 100% of in-scope | End of phase 2 |
| P1 requirements with at least one linked test | Unknown | 100% | End of phase 3 |
| P2 requirements with at least one linked test | Unknown | ≥ 90% | End of phase 3 |
| Orphan test scripts | Unknown | 0 (linked or retired) | End of phase 2 |
| Time to pick tests for a changed module | Ad hoc | ≤ 10 minutes | Per release |
| P1 defects escaping to production | Last 3 releases' count | 50% lower | 2 releases after rollout |

Baselines are filled in during phase 1 discovery.

## Users and use cases

QA engineers are the main users; QA lead, developers and the PM use the matrix to plan and sign off.

| Role | Uses the matrix to | Owns |
| --- | --- | --- |
| QA engineer | Pick tests for a change, log coverage, flag gaps | Test script links, test status |
| QA lead | Plan regression scope by time budget, report coverage | Matrix structure, priority sign-off |
| Developer | See which tests touch the module they changed | Module mapping accuracy |
| Project Manager (PM) | Confirm business criticality of each requirement | Requirement list, business impact score |

### Use cases

- **UC-01 Trace a requirement** — the QA engineer looks up an FSD requirement and sees its module and all linked test scripts.
- **UC-02 Impact analysis** — when a module changes (new development or a change request on a live product), the QA engineer gets the requirements and tests that touch it for targeted regression.
- **UC-03 Gap report** — the QA lead lists requirements with no tests and plans new test work for the riskiest gaps first.
- **UC-04 Time-boxed regression** — with only 1 day in the Testing phase, the QA lead runs all P1 tests and as many P2 as fit.
- **UC-05 Agree priorities** — the PM confirms which features are P1 during Requirement Analysis.

## Requirement 1: Traceability matrix

One shared matrix links each requirement to its module(s) and test script(s), with stable IDs so links survive renames.

### Data model

Each row is one requirement. One requirement can map to many modules and many test scripts; one test script can cover many requirements.

| Field | Example | Notes |
| --- | --- | --- |
| Requirement ID | REQ-AUTH-001 | Stable ID; format `REQ-<MODULE>-<NNN>` |
| Requirement title | User logs in with email and password | One line |
| Source | FSD v2.3 §4.1 / Jira ABC-123 | Link to the original |
| Module | Auth | From a fixed module list |
| Sub-module / screen | Login page | Optional |
| Test script ID(s) | TC-AUTH-001, TC-AUTH-002 | Manual case IDs or automated test file/name |
| Test type | Manual / Automated / Both |  |
| Priority tier | P1 | From Requirement 2 |
| Coverage status | Covered / Partial / Not covered | Derived from linked tests |
| Last run result | Pass / Fail / Not run | Updated each cycle |
| Owner | QA engineer name |  |

### Naming rules

- Module list is fixed and agreed (for example: Auth, User Profile, Dashboard, Reporting, Settings, Integration).
- Test script IDs use `TC-<MODULE>-<NNN>`; automated tests include the ID in the test name so the link can be found by search.
- A requirement that is deleted is marked `Retired`, never removed, so history stays.

### Jira setup (phase 1)

| Matrix element | In Jira |
| --- | --- |
| Requirement | Issue type "Requirement", one per FSD requirement; summary starts with its `REQ-<MODULE>-<NNN>` ID |
| Module | Component (one per EJ Dashboard module) |
| Test script | Issue type "Test", linked to its requirement with "is tested by" |
| Priority tier | Priority field set to P1–P4 |
| Business impact, likelihood | Two number fields; risk score calculated by Jira Automation |
| Gap, orphan and coverage reports | Saved JQL filters shown on one Jira dashboard |

### Functional requirements

1. Look up by requirement: show module, linked tests, priority, coverage and last result.
2. Look up by module: list every requirement and test in that module (impact analysis).
3. Look up by test: list every requirement the test covers.
4. Gap report: requirements with no linked test, sorted by priority (P1 first).
5. Orphan report: test scripts linked to no requirement.
6. Coverage summary: % covered per module and per priority tier.

### Acceptance criteria

- [ ] Module list and ID formats agreed and published
- [ ] 100% of in-scope requirements have an ID and at least one module
- [ ] Every existing test script is linked to a requirement or marked for retirement
- [ ] Gap report and coverage summary can be produced in under 5 minutes
- [ ] Matrix stored in Jira, with change history kept on each issue

## Requirement 2: Risk-based prioritization

Each requirement gets a risk score = Business impact × Likelihood of failure, which sets its tier P1–P4; under time pressure, tests run strictly in tier order.

### Scoring model

**Risk score = Business impact (1–5) × Likelihood of failure (1–5)**

| Score | Business impact (set by PM) | Likelihood of failure (set by QA + Dev) |
| --- | --- | --- |
| 5 | Blocks core business, money, data loss, legal/security | New or heavily changed code, history of defects |
| 4 | Main user flow broken, no workaround | Complex logic, many integrations |
| 3 | Feature broken, workaround exists | Moderate change or moderate complexity |
| 2 | Minor feature, few users affected | Small change, stable area |
| 1 | Cosmetic | Unchanged, never failed |

### Priority tiers

| Tier | Risk score | Meaning | Examples |
| --- | --- | --- | --- |
| P1 Critical | 16–25, or any impact 5 | Must pass before any release | Login, payment, save/submit data, access control |
| P2 High | 10–15 | Run in every regression | Main search, key reports, notifications |
| P3 Medium | 5–9 | Run when time allows / rotate | Secondary settings, filters, exports |
| P4 Low | 1–4 | Run in full regression only | Labels, layout, rarely used screens |

Override rule: any requirement with business impact 5 is P1 regardless of likelihood.

### Time-boxed test selection

1. Always run all P1 tests. If P1 alone does not fit, escalate to QA lead and PM before release.
2. Add P2 tests, starting with modules changed in this release.
3. Add P3, then P4, until the time budget is used.
4. Record which tiers ran in the test report, so the release decision shows what was not tested.

### Acceptance criteria

- [ ] Scoring scale agreed by QA lead, Dev lead and PM
- [ ] Every in-scope requirement has impact, likelihood, score and tier in the matrix
- [ ] Estimated run time recorded per test script, so tier totals are known
- [ ] Test report template shows tiers executed and tiers skipped
- [ ] Tiers reviewed at least once per release

## Process and maintenance

The matrix is updated inside each SDLC phase, and QA starts the FSD update in the Requirement Analysis phase instead of after development.

### Matrix activities per SDLC phase

| SDLC phase | Matrix activity | Owner | Phase exit criterion |
| --- | --- | --- | --- |
| 1. Requirement analysis | Write or update the FSD section; add requirement rows (ID, FSD reference, module); set business impact | QA (acting as SA), PM | Every new requirement has an ID, module and business impact |
| 2. System design | Confirm module mapping; set likelihood from design complexity; assign tier | QA lead, Dev lead | Every requirement has a tier |
| 3. Development | Dev lists changed modules; QA writes or updates test scripts and links them to requirement IDs | Developers, QA engineer | Cannot exit to Testing until its requirements are in the matrix with a tier |
| 4. Testing | Select tests by tier and time budget; record run results; log gaps | QA engineer, QA lead | Only linked tests are executed; test report shows tiers run and skipped |
| 5. Deployment / UAT | Release sign-off with P1/P2 coverage stated | QA lead, PM | All P1 tests passed |
| 6. Maintenance (live products) | Change requests and bug fixes update rows; raise likelihood for changed modules | QA module owner | Change request not closed until the matrix is updated |

### Ownership

- QA lead owns the matrix and runs a monthly clean-up (orphans, retired items, stale results).
- Vina is the QA owner for EJ Dashboard and keeps its rows accurate; each later product gets its own named QA owner.

## Rollout plan

Rollout takes about 8 weeks, mapping critical (P1) modules first so the riskiest areas benefit earliest.

| Phase | When | Work | Gate to exit |
| --- | --- | --- | --- |
| 1. Discovery | Weeks 1–2 | Collect requirements; list modules and tests; agree ID formats and scoring scale; record baselines | Formats agreed |
| 2. Mapping | Weeks 3–5 | Map P1 modules first; link tests to requirement IDs; map remaining modules; resolve orphan tests | All tests linked |
| 3. Prioritize + pilot | Weeks 6–7 | Score all requirements; assign P1–P4 tiers; add test run times; pilot on one release | Pilot report OK |
| 4. Adopt | Week 8 onward | Exit criteria in force; monthly owner review; track success metrics; extend to other apps | — |

Each gate is a QA lead + PM check; a phase does not start until the gate before it passes. Week counts are estimates to confirm once scope (open questions) is set.

## Risks, assumptions and open questions

The biggest risk is the matrix going stale; tying updates to SDLC phase exit criteria and a monthly owner review is the main control.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Matrix goes out of date | Wrong tests chosen, false confidence | Phase exit criteria, module owners, monthly clean-up |
| Initial mapping takes longer than planned | Rollout slips | Start with P1 modules; map the rest in later phases |
| Too many features rated P1 | Tiers stop helping | PM signs off P1 list; cap P1 at about 20% of requirements |
| Requirements are vague or missing | Hard to map tests | QA writes a short requirement statement and gets PM or Dev lead confirmation |
| Extra admin load on testers | Low adoption | Simple template, ID in test names, review effort after phase 2 |
| EJ Dashboard repository not yet handed over by developers | Module list and automated test inventory delayed | Build the module list from the FSD and a developer walkthrough; link code once the repository arrives |

### Assumptions

- Existing requirements can be found in specs or tickets.
- Existing test scripts have, or can be given, unique IDs.
- PM is available to score business impact.

### Decisions

| Question | Decision |
| --- | --- |
| Tool for the matrix in phase 1 | Jira |
| First application in scope | EJ Dashboard |
| QA owner | Vina |

### Open questions

- [ ] When will developers hand over the EJ Dashboard repository? Phase 1 needs it to list modules and existing automated tests.
- [ ] Which modules does EJ Dashboard have? Until the repository arrives, take them from the FSD and a developer walkthrough.
- [ ] Plain Jira issue links, or a test-management add-on such as Xray or Zephyr?
- [ ] Is a 20% cap on P1 acceptable to the PM?

---

Source: https://claude.ai/artifact/XaLunsY8emBe9voW2sGV2M
