# No weekly tests: plan

**Status:** IN PROGRESS (2026-10-30). Mo said yes to all of section 6, and added the feel buttons (section 7).
**Asked by Mo (2026-10-30):** "remove the whole weekly test thing ... next week's plan should just be made based on what tasks the user completed or not." Mo's answers: drop the weekly targets too, drop the final test too, and for goals already running hide tests from the next week written (nothing stored is deleted).

## 1. What changes for people

- **No weekly test, no test day.** Every practice day is an ordinary session. No "log your result", no light test, no late test, no re-test.
- **No weekly targets and no checkpoints.** No "Week 5 target: 8 km", no "at this pace you'll reach..." card at weeks 4 and 8, no "day-90 target" line. The goal stays the destination, and each week has a focus (what it works on) inside the method's phases.
- **Next week follows what they did.** Code reads last week's sessions done and missed and tells the week writer how far to move on:
  - 80% or more done: move on as the method says.
  - 50% to 79%: the same level, a smaller step forward.
  - under 50%: repeat last week's level, a little lighter.
  - In-order steps not done (lessons, chapters, sections) carry into next week first, as today.
- **No final test.** The closing stretch keeps the reflection and "finish my goal". The end screen says what they did ("You finished 11 of 12 weeks: 52 of 60 sessions"). A next plan asks where they are now.
- **Unchanged:** missed-session carry and swaps, key sessions, breaks and the 28-day move limit, "Keep going" and "Do my final week", edit my schedule, shorter plans for a fixed date (they keep their easier last week before the date), the weekly review (now just how it went and a note), the daily-time card (now after two weeks under 50% done).

## 2. What goes, server

| Area | Goes |
|---|---|
| Roadmap call (`lib/ai/roadmap.ts`) | Weekly `target` and `test`, the target climb checks, stated-target checks on week 12, `finalTest`, light weeks (`withPathwayTests`). Keeps: final goal, method, rules, phases, each week's `focus`. |
| Week call (`lib/ai/weekPlan.ts`) | The target and test lines, the test day (the layout's last practice day becomes an ordinary one), the test step rules. Gains: the pace line (section 1). |
| Weekly update (`lib/ai/weeklyUpdate.ts`, `lib/weekClose/update.ts`) | The whole model call: it only set targets. `WEEKLY_UPDATE_ENABLED` then reads nothing; Mo can delete it in Render. |
| Checkpoints (`lib/weekClose/checkpoint*.ts`, `POST /checkpoint`) | All of it. |
| Safety on targets (`lib/safety/targetSteps.ts`, `storedTargets.ts`, `week12Line`) | The safe target climb and the honest week-12 line. **Stays:** the week load limits (running +10% on last week's done running, longest run, lifting caps, rest gap), which check the sessions themselves. |
| Re-tests and late tests (`lib/weekClose/retest.ts`, `PUT /weeks/:n/test-result`) | All of it. |
| Next plan (`lib/nextPlan.ts`) | The measured result and "made it"; the summary is weeks and sessions done. |
| Presets | Their `weeklyTests` and the test wording in their method text sent to the model. |

## 3. What goes, app

Today's test card, test result dialog, late test card, re-test line, checkpoint card; the review's test step and light test entry; targets on the roadmap, progress (the benchmark card) and achievement screens; the day-90 and week-12 lines; the closing stretch's capstone test. About 40 files and 10 e2e specs change.

## 4. Stored data

Nothing is deleted and there is no migration. `RoadmapWeek.target`, `test`, `testResult`, `Goal.roadmap.checkpoints` and `loweredTargets` stay in the database and are no longer read or written. A running goal keeps its stored weeks; from the next week written it has no test day, and the app shows no test or target anywhere. Dropping the unused columns later is a backlog item.

## 5. Order

1. Server: roadmap and week call without targets and tests, the pace line, the week close without the weekly update and checkpoints. Tests updated; the scenario sweep rerun.
2. Server: remove the target safety, re-tests, late tests, the final test, next plan's measured result.
3. App: every screen in section 3.
4. Docs (a `docs/decisions.md` entry: a real product decision), e2e, a code review.

## 6. Mo's choices

a. **The pace rule** (section 1): 80% / 50% bands as above. Recommended as written.
b. **The weekly update's AI call goes entirely** (it only set targets; code's pace line replaces it). Recommended.
c. **The weekly review stays**, without its test step: how it went and a note the week writer reads. Recommended. Alternative: remove the review too and rely on the automatic close.
d. **Physical goals' safety:** without targets, progression comes from the method and the week load limits (which stay). Recommended: accept; the limits that matter check the actual sessions.

Mo (2026-10-30): yes to a to d, with (a) changed by section 7.

## 7. How did it feel? (Mo, 2026-10-30)

- **After each session it's done, one tap:** Too easy, Just right, Too hard. Optional, and a short note can go with it (the day's existing note field).
- **Used when next week is written**, never to rewrite the week that is running (its days may hold moved and swapped steps). The week writer reads, for last week: sessions done and planned, each tap, and each note, and code adds the pace line:
  - most done (80% or more) and mostly "too easy": a bigger step forward;
  - most done otherwise: move on as the method says;
  - half to most done (50% to 79%), or mostly "too hard": the same level, a smaller step;
  - under half done: repeat last week's level, a little lighter.
  Notes ("my knee hurts", "ran out of time") go to the writer word for word, to take into account.
- **Stored:** `DailyTask.feel` (`too_easy`, `just_right`, `too_hard`, or null), one additive column. The note is `DailyTask.notes`, as today.
- **Mid-week changes** (adjust the rest of the running week after two "too hard" taps): an idea, I-32, for later.
