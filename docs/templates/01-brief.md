# Template: 01-brief.md

The brief is the first file of a feature. It answers two questions: **what is wrong, and which way are we going to fix it?** The feature definition (`02-feature.md`) then says exactly what to build.

This file has two parts. Part A is for the chat that writes the brief. Part B is the empty skeleton to copy into `docs/features/<name>/01-brief.md`.

---

## Part A: how to write a brief

### When to write one

- Write a brief when the problem or the direction is not settled yet.
- **Skip it** when the direction is already decided somewhere else, for example in `docs/architecture/` or `docs/decisions.md`. The feature definition then links to that place instead.
- Work handed over from another feature (a moved milestone, a carried-over item) goes in the "Handed over" section. A brief can start as only that section, marked `Status: STUB`.

### How to work

1. **Ask Mo first.** Get the problem in their words: what they saw, where, and what bothers them about it. Ask follow-up questions until you could explain it back.
2. **Check the code.** Open the screens, routes and files involved. Write down what actually exists today, with file paths. Do not trust older docs over the code.
3. **Keep facts and guesses apart.** Every line in "What we know" is marked **Fact** (with its source: a file, a test, a report, Mo's words) or **Guess**.
4. **Don't jump to the fix.** Sections 1 to 5 describe the problem only. Ideas for fixes go in section 6.
5. **Look at 2 to 4 real options**, including "do nothing" or "a small fix" when it is honest to. Say plainly why each one lost.
6. **Ask Mo to choose.** Recommend one option. The direction is chosen only when Mo agrees.

### Rules

- **Short.** Aim for under 150 lines. Plain English, short sentences.
- **No filler.** If a section has nothing real to say, leave it out. Never write "none reported" just to fill a heading.
- **No ID labels** (no P-1, REQ-3, SOL-2). Numbered rules and acceptance criteria start in the feature definition.
- **No build plan.** No phases, files to change or prompts. That comes later.
- **Link, don't copy.** Point to `docs/product/`, `docs/architecture/` and `docs/decisions.md` instead of restating them.

### Ready for the feature definition when

- [ ] Mo would describe the problem the same way.
- [ ] Every claim is marked Fact or Guess, and every Fact has a source.
- [ ] At least two options were compared, and Mo agreed the chosen direction.
- [ ] "Out of scope" and "Must not break" are filled in.
- [ ] The open questions are ones the feature definition can actually answer.

---

## Part B: skeleton (copy from here)

```markdown
# <Feature name> — Brief

**Status:** DRAFT | DIRECTION CHOSEN | STUB
**Date:** YYYY-MM-DD
**Links:** <related product, architecture or decision docs>

## 1. The problem
<One short paragraph: what is wrong, in plain words.>

> "<Mo's or a user's own words, if there are any>"

## 2. Who and when
<Which people hit this, on which screens, at which moments.>

## 3. What we know
- **Fact:** <...> (source: `path/to/file.tsx`, test, report, or Mo)
- **Guess:** <...>

## 4. How bad it is, and why now
<A few lines: how often, how much it hurts, and why it matters now.>

## 5. What good looks like
<The outcome we want, described from the user's side. No solution yet.>

## 6. Options we looked at
### Option A: <name>
<A few lines: what it is, what it fixes, what it costs or risks.>

### Option B: <name>
<...>

## 7. Chosen direction
<Which option (or mix), and why. One paragraph.>
Agreed by Mo on YYYY-MM-DD.

## 8. Limits
**In scope:** <...>
**Out of scope:** <...>
**Must not break:** <...>

## 9. Open questions for the feature definition
1. <...>

## 10. Handed over from other features
<Only if there is any: what moved here, from where (link), and why.>
```
