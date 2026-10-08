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
6. **Checks** lists the `R-` items from `03-phases.md` section 4 and today's baseline numbers (test counts, lint warnings), so the chat can tell whether it broke something.
7. **Stop if** lists only what is special to this milestone. The general stop rules are in `CLAUDE.md`.
8. Aim for 60 to 120 lines. If it needs much more, the milestone is probably two milestones.

### Starting the work (launcher)

Give the implementing chat a short message like this:

```text
Do milestone M3.2 of the <feature> feature.
Your instructions: docs/features/<feature>/milestones/m3.2-short-on-time.md (the Prompt section).
Branch: m3.2-short-on-time, from main. Push to that branch, never to main.
Other chats are working on: <files or areas not to touch>.
```

### Writing the report (implementing chat)

Fill in the Report section of the same file. Every requirement gets evidence (a test name, a command result, a screenshot). Never claim a check that was not run; say why it was not run.

### Reviewing (main chat)

Check the report against the code and CI. Then fill in the Review section and fold the results back:

- set the milestone's row in `03-phases.md` to DONE (or what is true) with the date;
- record any new decision in the feature's `decisions.md`, then edit the feature or plan files it changes;
- if the report changes later milestones, edit them in `03-phases.md` now.

---

## Part B: skeleton (copy from here)

```markdown
# M<X.Y> — <name>

**Feature:** docs/features/<feature>/02-feature.md
**Status:** READY | IN PROGRESS | DONE | PARTIAL | BLOCKED
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
- Baseline: <today's numbers: backend tests, frontend tests, lint warnings, build, CI>

### Done when
<What can be shown: the behavior, the tests, the checks passing.>

### Stop if
<Only what is special to this milestone.>

## Report

**Final state:** DONE | PARTIAL | BLOCKED
**Date:** YYYY-MM-DD

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

### Differences from the docs, open questions, carry-overs
<Anything the docs got wrong, anything left undone, anything a later milestone must know.>

## Review

**Reviewed:** YYYY-MM-DD
**Verdict:** ACCEPTED | CHANGES NEEDED
<What was checked, what was fixed, and what was folded back: the status row, decisions recorded, later milestones changed.>
```
