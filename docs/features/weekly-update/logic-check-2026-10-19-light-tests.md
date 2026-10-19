# Weekly Update — Logic check, light weekly tests (2026-10-19)

Checked `02-feature.md` and the decision lines in `decisions.md` as of `f6ab67f`, focused on RULE-19 (WU-22) before M2.1's prompt. Code was read to answer three questions: who writes the weekly test today (the roadmap call writes every week's `test`, with a `passIf` naming that week's number; the pathways in `backend/src/lib/ai/presets/` hold none), what a logged result is (`RoadmapWeek.testResult`: a value, a unit, passed, a note) and what the review's result form asks for (a number in the target's unit, `frontend/src/components/review/ReviewTestResultStep.tsx`).

**Summary:** 7 findings: 2 Clash, 4 Undefined, 1 Silly. Mo took option A for F1 and every other recommendation (2026-10-19): WU-43 in `decisions.md`.

## Findings, worst first

1. **A light test can't measure the target (Clash) → WU-43 (1), (2).** Sam is on run10k, week 2: the target is "10K time: 58 min", the test is "log your long run as written", and the result form asks for minutes; Sam enters 70 (the long run). The roadmap says a target is "what they can do on that week's test" in one metric for 12 weeks, so the light test reads as 70 minutes against 58. The same for recomp (weight and waist against a body-fat target), spanish (a 1 to 2 minute voice note can't show "8 minutes of conversation"); speech is fine only if the metric is a filler-word rate. In P3 the update would read light results against the target (RULE-2, RULE-4) and could hold or lower it. *Decided (option A): the target keeps the final goal's metric and is measured only by the big test in weeks 4, 8 and 12; each light week shows the next big-test week's target as what it builds toward; a light test is logged as done plus a note, not a number against the target; in P3 the update moves targets only from big-test results and uses the sessions in between. Option B (the light test's measure becomes the target) was not taken: it breaks week 12 as the final goal.*
2. **What "a hand-written test" means (Undefined) → WU-43 (3).** The model writes each week's test and its `passIf` names that week's number; a fixed sentence can't. *Decided: code puts the pathway's test in place of the model's after the roadmap call; weeks 4, 8 and 12 get the big test with the target filled in, light weeks a fixed pass mark ("Done as written").*
3. **The custom rule against the roadmap prompt; short is not light (Clash) → WU-43 (4).** The prompt prefers tests the app runs, then photo or video, and has a "full mock exam after topic quizzes" and "a harder test keeps the previous week's target"; a mock exam isn't short. A custom half-marathon goal can still get "run 5K as fast as you can" every week: short, part of a session, but all-out. *Decided: the custom rule also says no all-out effort, no max and nothing to failure (WU-41's words), with any big test only in weeks 4, 8 and 12; the prompt's mock-exam and harder-test lines are rewritten to match.*
4. **Which session holds the light test (Undefined) → WU-43 (5).** "Log the week's long run" only works if the long run is on test day, which the week writer picks on its own; the same for recomp's morning weigh-in and speech's section. *Decided: the week writer puts the test day on the session the test belongs to, and code checks the test day holds a step of that kind where it can (if it can't, a backlog row).*
5. **Week 4 or 8 is a high-load first week back (Undefined) → WU-43 (6).** RULE-16 and WU-41 make that week's test light, so its target isn't measured. *Decided: that week's target is not measured; the next big-test week is the next check.*
6. **Week 12's big test or the day-90 final test (Undefined) → WU-43 (7).** The roadmap already writes a `finalTest`. *Decided: they are the same test.*
7. **"Keep going" jumps week 4 or 8 (Silly) → WU-43 (8).** Jumping weeks 3 to 5 leaves up to 7 weeks without a big test. *Decided: fine as it is; the break's update (RULE-16) sets the restart level; revisit in P3 if needed.*

## Stories that were OK
- An existing run10k goal keeps its stored hard tests (B-58); a high-load first week back still gets WU-41's light test.
- Both switches off: a new goal still gets light tests (RULE-19 is behind neither switch).
- book, youtube, saas: deliverable tests are already light; "short" means the check is short.
- guitar, chess, deepwork: the weekly test already measures the target in a normal session.
- speech: counting filler words in a section matches a filler-word-rate target.
- A plan that moves by days keeps its week numbers, so weeks 4, 8 and 12 stay defined.
