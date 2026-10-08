# Domain templates

Used by `docs/features/method-aware-recovery/02-feature.md` (RULE-2, RULE-3, RULE-4). Each template is a starting profile: its kinds of step, each kind's action, which kinds are **hard** (need a rest gap) or **in order**, the catch-all, the rest gap, and the return-after-a-break rule. Pathway profiles are these templates adjusted by us; custom goals use them unchanged until the eval passes (MR-14), then adjusted by the profile call.

Actions: **move** (to the first later day that passes the rules), **continue** (the next session of that kind picks up where this one stopped), **let go** (not made up), **fixed** (never moved or swapped).

Every profile also gets two kinds from code: **Weekly test** (fixed) and **Fixed-time session** (fixed: a class, a group run, a call). Rest-day steps have no kind.

**Return rule format** (checked by code, RULE-4): one or two break lengths, each with a restart level and a "first week back" note for the week writer.
- Break lengths: `1-2 weeks` and `3+ weeks`, or one rule for `any` length.
- Restart: `last level`, `back 1 week` or `back 2 weeks` (of targets).

Steps that only work together are written as one step by the week writer (RULE-8), so no template needs a "goes with" rule.

Changes after M1.1 (MR-13, MR-20): Strength's return, Writing's return, Content creation's packaging kind, Language's daily speaking, Building a product's daily sprint, Strategy games' game-and-review step, and template 13.

## 1. Endurance (running, cycling, swimming) — pathway `run10k`
| Kind | Action | Hard | In order |
|---|---|---|---|
| Easy session | let go | | |
| Quality session (intervals, tempo) | move | yes | |
| Long session | move | yes | |
| Strength and mobility | move | | |
| Catch-all | let go | | |
**Rest gap:** 1 day. **Return:** 1-2 weeks: back 1 week; 3+ weeks: back 2 weeks. First week back: easy sessions only, no quality session.

## 2. Strength and body composition — pathway `body_recomposition_90day`
| Kind | Action | Hard | In order |
|---|---|---|---|
| Strength workout | move | yes | yes (A then B) |
| Conditioning (walking, light cardio) | let go | | |
| Nutrition and tracking | let go | | |
| Mobility | move | | |
| Catch-all | move | | |
**Rest gap:** 1 day (the rest gap beats the order, MR-18). **Return:** 1-2 weeks: back 1 week; 3+ weeks: back 2 weeks. First week back: loads about 10% lighter than the restart week.

## 3. Language — pathway `spanish_conversation`
| Kind | Action | Hard | In order |
|---|---|---|---|
| New material (lesson, grammar) | move | | yes |
| Daily speaking (shadowing, voice note) | let go | | |
| Review (flashcards, spaced) | let go | | |
| Conversation or listening practice | move | | |
| Catch-all | move | | |
**Return:** any: last level. First week back: starts with a review of the last two weeks' material.

## 4. Instrument — pathway `guitar5songs`
| Kind | Action | Hard | In order |
|---|---|---|---|
| Technique drills | let go | | |
| New piece or section | move | | yes |
| Play-through or recording | move | | |
| Catch-all | move | | |
**Return:** 1-2 weeks: last level; 3+ weeks: back 1 week. First week back: pieces at a slower tempo first.

## 5. Long-form writing — pathway `book_30k_words`
| Kind | Action | Hard | In order |
|---|---|---|---|
| Drafting | continue | | |
| Outlining and planning | move | | yes |
| Revising | continue | | |
| Reading and research | let go | | |
| Catch-all | continue | | |
**Return:** any: last level. First week back: the first session starts from a short note on what comes next; never reread earlier pages (closed-door drafting).

## 6. Building a product — pathway `saas_first_customer`
| Kind | Action | Hard | In order |
|---|---|---|---|
| Build work | continue | | |
| Customer conversations and outreach | move | | |
| Daily distribution sprint | let go | | |
| Launch or shipping step | move | | yes |
| Learning | let go | | |
| Catch-all | continue | | |
**Return:** any: last level. First week back: starts by re-planning the remaining build.

## 7. Studying for an exam (no pathway)
| Kind | Action | Hard | In order |
|---|---|---|---|
| New topic | move | | yes |
| Practice questions | move | | |
| Review (flashcards, spaced) | let go | | |
| Mock exam | move | | |
| Catch-all | move | | |
**Return:** any: last level. First week back: starts with a review of the last two topics.

## 8. Public speaking — pathway `ted_speech_15min`
| Kind | Action | Hard | In order |
|---|---|---|---|
| Script and structure | move | | yes |
| Rehearsal | move | | |
| Recorded run-through | move | | |
| Voice and delivery drills | let go | | |
| Catch-all | move | | |
**Return:** any: last level. First week back: starts with a recorded run-through.

## 9. Creative skill (drawing, design, photography) (no pathway)
| Kind | Action | Hard | In order |
|---|---|---|---|
| Fundamentals drill | let go | | |
| Study or copy work | move | | |
| Project piece | continue | | |
| Catch-all | continue | | |
**Return:** any: last level. First week back: starts with fundamentals.

## 10. Habit and focus — pathway `deep_work_focus`
| Kind | Action | Hard | In order |
|---|---|---|---|
| Daily focus block | let go | | |
| Weekly planning or review | move | | |
| Catch-all | let go | | |
**Return:** any: last level. First week back: shorter focus blocks.

## 11. Content creation — pathway `youtube_12_videos`
| Kind | Action | Hard | In order |
|---|---|---|---|
| Titles and thumbnails | move | | yes (first) |
| Research and scripting | continue | | yes |
| Filming | move | | yes |
| Editing | continue | | yes |
| Publishing | move | | yes |
| Learning and analytics | let go | | |
| Catch-all | continue | | |
**Return:** any: last level. First week back: finishes the piece in progress.

## 12. Strategy games — pathway `chess_1200_rating`
| Kind | Action | Hard | In order |
|---|---|---|---|
| Tactics puzzles | let go | | |
| Opening or theory study | move | | yes |
| Played game with its review (one step, RULE-8) | move | | |
| Catch-all | move | | |
**Return:** 1-2 weeks: last level; 3+ weeks: back 1 week. First week back: mostly puzzles and game review.

## 13. General practice (no pathway; the default, MR-13)
| Kind | Action | Hard | In order |
|---|---|---|---|
| Practice session | move | | |
| Review or reflection | let go | | |
| Project work | continue | | |
| Catch-all | move | | |
**Return:** 1-2 weeks: last level; 3+ weeks: back 1 week. First week back: starts with a short practice session at the last level.
