# Checkpoints — Logic check (2026-10-24)

Checked `02-feature.md` (draft of 2026-10-23) and `decisions.md` CP-1 to CP-14, rules only, no code read. 14 stories walked through. 9 findings: 3 Silly, 2 Undefined, 1 copy, 3 hidden assumptions. Outcome per finding at the end of each.

## Findings

**1. Silly: someone exactly on plan is told they won't make it.** A run10k beginner starts at 0 km; the plan's week 4 is 2 km and climbs faster later. They run exactly 2 km. The straight-line pace (0.5 km a week) forecasts 6 km, 60%, so they get "At this pace you'll reach about 6 km by day 90" though they did everything asked. Plans curve (slow start, or fast start and a plateau on strength goals). **Outcome:** Mo chose option A, compare with the plan's own shape (CP-15; RULE-3, RULE-4, AC-3).

**2. Silly: lowered, then caught up, stuck with a target that's too easy.** Lowered to 7.5 km at week 4; at week 8 they run 8 km and the forecast is 9.5 km. No raise (only the full goal was offered), and RULE-4 says on track, so weeks 9 to 12 aim at 7.5 km while the weekly update can't raise week 12. **Outcome:** Mo chose option A, a partial raise (CP-16; RULE-9, RULE-10, AC-8).

**3. Undefined: after lowering, the model still sees "Goal: run 10 km".** The weekly update and the week writer read `finalGoal` while week 12 says 7.5 km; the update may try to put week 12 back (refused, retry, fallback) or write about 10 km. **Outcome:** fixed in `02-feature.md`: both prompts get a day-90 line while a choice stands, unchanged otherwise (RULE-12, AC-10).

**4. Silly: "Your goal" can show the wrong number.** Safety had lowered a 10 km goal's week 12 to 7 km (WU-23); the day-90 line would say "Your goal: 7 km" and replace the line that named 10 km. **Outcome:** fixed: "Your goal" is `week12Line`'s goal when there is one (section 3 "Goal shown", RULE-11, AC-9).

**5. Undefined: which card wins on Today.** No rule ordered the checkpoint card against the held test card, the break choice, the re-test line, the daily-time card and the insight line. **Outcome:** fixed: hidden while a close is held, a choice waits or the close failed; otherwise first (RULE-7, AC-5).

**6. Copy: "Your result hasn't moved yet" when it went backwards.** **Outcome:** fixed: "Your result hasn't improved yet." (section 6).

**7. Assumption: one test day shows their real level.** A bad day, a heavy weigh-in or a noisy rating can trigger an offer. **Outcome:** fine as it is; keep is the default and nothing changes unless they choose.

**8. Assumption: the starting point is accurate.** Overstated gives the line-only card; understated means no offer. **Outcome:** fine as it is; the log line shows it.

**9. Assumption: the achievement screen reads week 12 as stored.** After lowering, reaching 7.5 km counts as the benchmark met. **Outcome:** fine for now; the day-90 wording belongs to the later feature (CP-4, I-10), noted in `02-feature.md` section 8.

## Rule against rule
No real clashes: RULE-10 puts the raise check before RULE-4's on track; RULE-9's "never harder" applies to a lower only; RULE-8's expiry runs at a close with no checkpoint of its own (week 5 or 9).

## Stories that were OK
Lower-is-better time (62 → 55 min, 60 at week 4: no offer); body weight (90 → 80 kg, 88 at week 4: offer of 84 kg); ahead of pace (nothing); week 4 test not logged (no checkpoint, re-test, week 8 checks); break or "Keep going" jump over week 4 (none); "Do my final week" (a break, none); kept at 4 and still behind at 8 (one last offer); never opened the app (expires as keep); two tabs (first wins, 409); custom number goal with no family; deliverable goal (none, logged); short gap moved dates (weeks counted by number); week 8 lower on a light-test goal (only week 12 set, light weeks follow).
