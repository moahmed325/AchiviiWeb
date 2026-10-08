# Template: 02-feature.md

The feature definition is the contract for a feature. It says **exactly what the feature must do and how it should feel**: its rules, what the user sees, the words on screen, and how we know it is done. The phases file (`03-phases.md`) then decides the order of work, and each milestone prompt points back here.

This file has two parts. Part A is for the chat that writes the feature definition. Part B is the empty skeleton to copy into `docs/features/<name>/02-feature.md`.

---

## Part A: how to write a feature definition

### What to read first

- The feature's `01-brief.md`, or the doc that already set the direction (for example `docs/architecture/plan-v2.md`) when the brief was skipped.
- `docs/product/redesign-blueprint.md` and `Design.md` for the product and design rules that apply to every feature.
- The code the feature touches. Write down what exists today, with file paths, before you describe what should change.

### How to work

1. **Start from the user.** Write the journey and the "words we use" first. Rules are much easier to write once the words are fixed.
2. **Write rules you could test.** "A missed day never makes any day longer" is a rule. "Recovery should feel good" is not.
3. **Cover the hard cases.** For every rule, ask: what about rest days, the test day, old goals, a new user, a long absence, two tabs open, another time zone?
4. **Write the real words.** Every message the user sees goes in the copy table, word for word.
5. **Ask Mo about every open question.** Record each answer in the feature's `decisions.md` and write the result straight into the rules. Nothing stays "open" in an approved feature definition.
6. **Write one acceptance criterion for each thing that must be true.** Each one names the rules it checks.

### Rules

- **Aim for under 250 lines.** Plain English, short sentences.
- **Only what is special to this feature.** Do not restate `Design.md`, `CLAUDE.md` or the blueprint. Link to them.
- **No filler.** Leave out a section that has nothing real to say. Section 10 is only for concerns the feature really touches.
- **IDs:** only `RULE-n` and `AC-n`. Decisions use the feature's prefix and live in `decisions.md`.
- **Fix things in place.** When a decision changes a rule, edit the rule and add `(changed YYYY-MM-DD, <decision id>)`. Never add "clarifications", "updated" or "resolved" sections at the bottom. The file always says what is true now.
- **No build plan.** No phases, milestones, file-by-file changes or prompts. A data or system change is described by what it must do, not how to code it.
- **Status is DRAFT or APPROVED.** Build progress is tracked in `03-phases.md`, not here.

### Ready for the phases file when

- [ ] Mo has read it and agreed (status APPROVED).
- [ ] Every rule could be checked by a test or by looking at the screen.
- [ ] Every rule is covered by at least one acceptance criterion.
- [ ] Every message the user sees is in the copy table.
- [ ] No open questions are left; each answer is in `decisions.md` and in the rules.
- [ ] "Out of scope" and "Must not break" are filled in.

---

## Part B: skeleton (copy from here)

```markdown
# <Feature name> — Feature Definition

**Status:** DRAFT | APPROVED (YYYY-MM-DD)
**Date:** YYYY-MM-DD
**Builds on:** <01-brief.md, or the doc that set the direction>
**Decisions:** docs/features/<name>/decisions.md

## 1. Summary
<What the feature is and who it is for, in two or three sentences.>

**Main idea:** <the one principle every choice follows>

## 2. User journey
<The main flow, step by step. Mention where the user starts (which screen or moment).>

## 3. Words we use
**<Term>:** <what it means in this feature>

## 4. Rules
**RULE-1 — <short name>.** <One rule, clear enough to test.>

## 5. States and edge cases
| Situation | What the user sees / what happens |
|---|---|
| <...> | <...> |

## 6. Screens and copy
<Which screens or moments change, and what each one is for.>

**Copy rules:** <tone, words never to use>

| Situation | Exact words |
|---|---|
| <...> | "<...>" |

## 7. Data and system changes
<What changes in the backend, data or APIs, described by what it must do. Or: "Frontend only.">

**Must not break:** <existing behavior that must keep working>

## 8. Scope
**In scope:** <...>
**Out of scope:** <...>
**Later:** <ideas saved for another feature>

## 9. Acceptance criteria
- **AC-1** <A statement that is true when the feature is done.> (RULE-1)

## 10. Other concerns
<Only if the feature really touches them: billing, privacy, notifications, analytics, performance, outside services.>
```
