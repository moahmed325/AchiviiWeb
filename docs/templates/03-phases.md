# Template: 03-phases.md

The phases file is the plan for building a feature. It says **in what order the work happens, how it is split into milestones, and where each one stands**. It is the one living file of a feature: it changes as milestones finish.

What it does not hold: the feature's rules and acceptance criteria (those are in `02-feature.md`), decisions (those are in `decisions.md`), and the detailed instructions for each milestone (those are in `milestones/`, written just before the milestone starts).

This file has two parts. Part A is for the chat that writes and updates the plan. Part B is the empty skeleton to copy into `docs/features/<name>/03-phases.md`.

---

## Part A: how to write and keep the plan

### What to read first

- The approved `02-feature.md` and the feature's `decisions.md`.
- `CLAUDE.md` for how the repo builds, tests and deploys.
- The code the feature touches, enough to know what already exists and what order makes sense.

### How to split the work

1. **Phases are groups of milestones that share one goal**, for example "recognise a missed day" or "show it on Today". Usually 2 to 5 phases.
2. **A milestone is one piece of work one chat can finish and prove**, usually in one branch. If it needs two very different kinds of work (a migration and a new screen), split it.
3. **The first milestone checks the code** when the feature touches code nobody has looked at closely yet. Its report lists what exists, what is wrong in the plan, and the questions for Mo. The answers become decisions, and the plan is fixed in place.
4. **Order by what each step needs.** Logic before the screen that shows it. Anything that changes users' data in production ships switched off until the screen that explains it is live.
5. **The last milestone proves the whole feature:** every acceptance criterion checked, every "must not break" item checked.
6. **Only plan the near phases in detail.** Later phases can be a line each until the earlier ones finish. Reports change the plan, so detail written too early gets rewritten.

### How to keep it up to date

- **Status lives in one place:** the status table in section 1. Each milestone file has its own status too. Nothing else in the feature tracks status.
- **When a milestone finishes:** set its row to DONE with the date, and link its report. That is the only change, unless the report changes the plan.
- **When a report changes the plan:** record the decision in `decisions.md`, then edit the plan in place (add, split, move or drop milestones) and name the decision. Never add "corrections" or "findings" sections that contradict text above them.
- **When work moves to another feature:** set the row to MOVED, link where it went, and record the decision.

### Rules

- **Aim for under 200 lines.** Plain English, short sentences.
- **No copies.** Do not restate the feature's rules, `CLAUDE.md`, `Design.md` or the decisions. Cite them by ID (`RULE-3`, `AC-7`, `MS-12`).
- **Feature rules only in section 3.** List only the rules for building this feature that are not already in `CLAUDE.md` (for example "carry writes stay behind the switch").
- **No file lists or step-by-step coding instructions.** They go in the milestone file, written when the milestone starts and checked against the code then.
- **IDs:** phases `P1`, `P2`; milestones `M1.1`, `M1.2` (a milestone added later between two others gets a letter: `M1.1b`); checks `R-1`, `R-2`. Never renumber.

### Statuses

`NOT STARTED` · `IN PROGRESS` · `DONE` · `BLOCKED` (say by what) · `MOVED` (say where) · `DROPPED` (say why)

### Ready to start the first milestone when

- [ ] Every acceptance criterion in `02-feature.md` appears in at least one milestone row.
- [ ] Every item in "Must not break" has a check in section 4.
- [ ] Each near milestone could be finished and proven by one chat.
- [ ] Mo has agreed the order.

---

## Part B: skeleton (copy from here)

```markdown
# <Feature name> — Phases

**Status:** PLANNED | IN PROGRESS | DONE (YYYY-MM-DD)
**Feature:** docs/features/<name>/02-feature.md
**Decisions:** docs/features/<name>/decisions.md

## 1. Status

| Milestone | What | Covers | Status | Report |
|---|---|---|---|---|
| M1.1 | Check the code | — | DONE 2026-10-03 | [m1.1](milestones/m1.1-check-the-code.md) |
| M1.2 | <short name> | AC-1, AC-5 | IN PROGRESS | [m1.2](milestones/m1.2-short-name.md) |
| M2.1 | <short name> | AC-3 | NOT STARTED | |

## 2. Order
<One line per phase: its goal and what it waits for. Add a small diagram only if the order branches.>

- **P1 <name>:** <goal>.
- **P2 <name>:** <goal>. Needs P1.

## 3. Rules for this feature
<Only rules for building this feature that are not already in CLAUDE.md. Leave out if none.>

- <rule> (<decision or RULE id>)

## 4. Must not break
| ID | What | How to check |
|---|---|---|
| R-1 | <existing behavior> | <test, command or screen to look at> |

## 5. Phases

### P1 <name>
**Goal:** <one or two lines>

**M1.1 <name>.** <What it delivers, in a few lines.> Covers <AC/RULE ids>. Checks <R ids>. Done when <what can be shown>.

**M1.2 <name>.** <...>

### P2 <name>
<Near phases in full; later ones can be one line until the earlier phases finish.>

## 6. Risks
<Only real risks to the build, each with what controls it. Leave out if none.>
```
