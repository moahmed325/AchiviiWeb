# Template: milestones/mX.Y-name.md (one per milestone)

A milestone file holds everything about one milestone in one place: **the prompt** (written by Mo's main chat just before the work starts), **the report** (written by the chat that does the work) and **the review** (written by the main chat after checking the report). The shared rules every implementing chat follows are in `CLAUDE.md` under "Working on a milestone", so the prompt only says what is special to this milestone.

Name the file after its row in `03-phases.md`: `m3.2-short-on-time.md`. Screenshots and other evidence go in a folder next to it: `m3.2-evidence/`.

---

## Part A: how to use it

### Writing the prompt (main chat)

1. Write it just before the milestone starts, not earlier. Reread the reports of the milestones before it first: they often change what this one needs.
2. **Check the code yourself** before writing "Context". Every fact there must be true today, with file paths. Still tell the implementing chat to verify them.
3. **Requirements are numbered 1, 2, 3.** Each one is a thing that can be shown to work. Name the feature IDs it serves (`RULE-4`, `AC-10`, `MS-12`).
4. **Put exact copy in quotes** and say it is exact.
5. **Out of scope** names the nearby work the chat might be tempted to do, and which milestone owns it.
6. **Checks** lists the `R-` items from `03-phases.md` section 4 and the commands to run. Do not copy test counts into the prompt: they change with every merge. The implementing chat measures the baseline on its starting commit before changing anything.
7. **Stop if** lists only what is special to this milestone. The general stop rules are in `CLAUDE.md`.
8. Aim for 60 to 120 lines. If it needs much more, the milestone is probably two milestones.
9. Set the milestone's row in `03-phases.md` to READY and link this file.

### Starting the work (launcher)

Give the implementing chat a short message like this:

```text
Do milestone M3.2 of the <feature> feature.
Your instructions: docs/features/<feature>/milestones/m3.2-short-on-time.md (the Prompt section).
Branch: m3.2-short-on-time, from main. Push to that branch, never to main.
Other chats are working on: <files or areas not to touch>.
```

### Writing the report (implementing chat)

Before changing anything, run the checks on your starting commit and keep the numbers: that is your baseline. Then fill in the Report section of the same file. Every requirement gets evidence (a test name, a command result, a screenshot). Never claim a check that was not run; say why it was not run.

If your change makes `CLAUDE.md`, `Design.md` or a doc in `docs/architecture/` wrong, update it in the same branch and list it under "Files changed".

List every problem you noticed under "Problems found", even small ones and ones outside this milestone, with where you would put it. Do not fix problems outside the milestone, and do not edit the backlog; the review sorts them.

### Reviewing (main chat)

When the report comes in, set the milestone's row in `03-phases.md` to IN REVIEW. Check the report against the code and CI, and check that `CLAUDE.md`, `Design.md` and the architecture docs still match what the code now does. Then fill in the Review section and fold the results back:

- set the milestone's row in `03-phases.md` to DONE (or what is true) with the date;
- if an owner step comes next (a switch to turn on, a production check), tell Mo, and record its result in its row when it is done;
- record any new decision in the feature's `decisions.md`, then edit the feature or plan files it changes;
- if the report changes later milestones, edit them in `03-phases.md` now;
- **sort every problem found.** Each one goes to exactly one place:

| The problem is... | It goes to... |
|---|---|
| needed for this milestone to be done, or caused by it | this milestone: verdict CHANGES NEEDED, fixed on the same branch before merge |
| part of this feature, but later | a milestone in `03-phases.md` (an existing one, or a new one) |
| urgent: users are hitting it now | a quick fix right away (see `docs/backlog.md`), then a DONE line in the backlog |
| anything else | `docs/backlog.md`, sized small, big or owner |

Nothing stays only in a report.

---

## Part B: skeleton (copy from here)

```markdown
# M<X.Y> — <name>

**Feature:** docs/features/<feature>/02-feature.md
**Branch:** <branch name>
**Prompt written:** YYYY-MM-DD

## Prompt

### Context
<What exists today that this milestone builds on, with file paths. Say: verify these, do not trust this prompt.>

### Goal
<One or two sentences: what is true when this milestone is done.>

### Read first
- docs/features/<feature>/02-feature.md: <sections, RULE and AC ids>
- docs/features/<feature>/decisions.md: <ids>
- <earlier milestone reports this builds on>

### Requirements
1. **<short name>.** <What must be true. Exact copy in quotes.> (<ids>)
2. **Tests.** <Which cases must be tested, unit and e2e.>

### Out of scope
<Nearby work not to do, and which milestone owns it.>

### Checks
- Must not break: <R ids from 03-phases.md section 4>
- Run: <the commands, e.g. backend `npm test`, frontend `npm test`, `npm run lint`, `npm run build`, the e2e specs that matter>. Measure them on your starting commit first; that is the baseline.

### Done when
<What can be shown: the behavior, the tests, the checks passing.>

### Stop if
<Only what is special to this milestone.>

## Report

**Final state:** DONE | PARTIAL | BLOCKED
**Date:** YYYY-MM-DD
**Started from:** <commit>

### Summary
<What now works, in a few bullets.>

### Files changed
| File | Change |
|---|---|

### Evidence
| Requirement | Evidence |
|---|---|
| 1 | <test name, command result or screenshot> |

### Commands and results
| Command | Result | Baseline |
|---|---|---|

### Differences from the docs
<Anything the docs or the prompt got wrong, and what you did about it. Anything left undone.>

### Problems found
| Problem | Where | Suggested place |
|---|---|---|
| <what is wrong> | <file, screen or test> | this milestone / later in this feature / backlog small / backlog big / urgent |

## Review

**Reviewed:** YYYY-MM-DD
**Verdict:** ACCEPTED | CHANGES NEEDED
<What was checked (code, CI, and that CLAUDE.md, Design.md and the architecture docs still match), what was fixed, and what was folded back: the status row, decisions recorded, later milestones changed.>
**Problems sorted:** <each problem and where it went, e.g. "B-9 (backlog, small)", "added to M3.4". Or: none found.>
```
