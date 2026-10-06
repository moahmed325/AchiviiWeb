# Achivii Missed Sessions — FEATURE DEFINITION

**Status:** IMPLEMENTATION IN PROGRESS (M1.1, M1.1b and M1.2 complete, M1.3 next)
**Version:** 1.1 (updated 2026-10-03 with M1.1 findings and ND-1 to ND-7 decisions)
**Date:** 2026-10-03
**Builds on:** docs/architecture/plan-v2.md (Missed sessions, Week call, Weekly update), docs/product/redesign-blueprint.md (sections 18-19, Encouraging Intelligence / Adaptive System)

## 1. Overview

### Feature
A consistent, session-type-aware way for Achivii to detect a missed session and help the user recover from it.

### Problem
Plan v2 defines the core carry-forward rule, but several situations are undefined: how a miss is detected, what happens on key-session and test days, what a full missed week or a long gap looks like, how partial days count, and how physical goals avoid stacking load. Without a rule for each, recovery will feel inconsistent or punitive.

### Desired outcome
Every kind of session has one predictable recovery path. The user always gets one clear way forward. The plan adapts, the person is never blamed, and no day ever gets longer because of a miss.

### Target user
An authenticated Achivii user with an active plan v2 goal (custom or preset).

### Motivation
Blueprint principle: **Adapt the journey, don't punish the person.**

## 2. User Goal

As an Achivii user, when I miss a session, I want a short, kind, clear way back into my plan, so that one bad day does not derail my 12 weeks.

## 3. Core User Actions

- **Mark today missed** (decided in plan v2; no implementation found in the repository, verify in the phase): the user declares today missed.
- **Swap today with another day this week** (decided in plan v2; no implementation found, verify): moves a session within the week.
- **Do the 10-minute version** (the `minimumVersion` data and focus-mode UI exist; the Today entry point is verified in the phase): the minimum version is always available.
- **Take the test late:** log the weekly test after test day, until the next week opens.
- **Resume after a gap:** return after 3+ missed practice days and restart gently.
- **Accept a checkpoint offer** (decided in plan v2; the weekly update that produces it is not yet built): lower goal or 1-week extension at weeks 4 and 8.

## 4. Primary User Journey

```text
Session day closes with nothing done (or user taps "Mark today missed")
    ↓
On next app open, Achivii recognises the miss
    ↓
One short, neutral line states what happened and what moved
    ↓
Recovery rule for that session type is applied
    ↓
User sees today's plan, no longer than normal
    ↓
Weekly update (weekly) reads the week's completion honestly
```

## 5. Entry Points

| ID | Entry point | Required behavior |
|---|---|---|
| EP-1 | Today | Primary place the miss message and recovery appear. |
| EP-2 | First open of a new week | Closes the previous week; runs the weekly update if the test was never logged. |
| EP-3 | Test-day card | Offers "Take the test now" until the next week opens. |
| EP-4 | Return after a gap | Shows the gentle-return day. |

Reminders and push notifications are a later phase and are out of scope. Misses are detected when the app is opened.

## 6. Core Concepts

**Session:** the planned work for one practice day.
**Missed session:** a practice day that closes with no step and no 10-minute version done, or one the user marks missed.
**Done session:** a practice day with at least one completed step or the 10-minute version.
**Carry-forward:** the missed day's priority-1 step moves to the next eligible practice day, replacing that day's lowest-priority step.
**Eligible day:** a practice day that is not the test day.
**Gap:** 3 or more practice days missed in a row.
**Gentle-return day:** the first session after a gap, shown as the 10-minute version by default.

## 7. Lifecycle

```text
Planned → Done
Planned → Swapped → Done
Planned → Missed → Carried / Dropped
```

| State | Meaning | Entered | Exited |
|---|---|---|---|
| Planned | Session scheduled. | Week call writes the week. | Done, swapped, or day closes. |
| Done | At least one step or the 10-minute version done. | User completes work. | Final. |
| Missed | Day closed with nothing done, or user marked missed. | Detection on app open, or user action. | Carried or dropped. |
| Carried | Priority-1 step moved to an eligible day. | Carry-forward rule applies. | Done on the new day. |
| Dropped | Nothing moves. | No eligible day, or a high-load step. | Final. |

Rest days have no missed state.

## 8. Experiences / Screens

| ID | Experience | Purpose | Required |
|---|---|---|---|
| UX-1 | Today: miss notice | One neutral line saying what moved. | Yes |
| UX-2 | Today: short-on-time prompt | Offer the 10-minute version prominently after 2 missed days in a week. | Yes |
| UX-3 | Today: late test card | "Take the test now" until the next week opens. | Yes |
| UX-4 | Today: gentle-return day | 10-minute version by default after a gap, full session one tap away. | Yes |
| UX-5 | Weekly update message | One sentence, plainly saying if the target is held or lowered. | Depends on plan v2 weekly update (not yet built) |
| UX-6 | Checkpoint offer | Lower goal or extension at weeks 4 and 8. | Depends on plan v2 weekly update (not yet built) |

## 9. States

- No miss (default Today)
- Miss carried forward
- Miss dropped (no eligible day or high-load step)
- Key session missed (swap offered)
- Test not logged (late card available)
- Test not logged and week closed
- Gap detected / gentle-return day
- Whole week missed
- Two far_behind weeks (re-test first)
- Rest day (never shows a miss)

## 10. Edge Cases

- The missed day is the day before the test day: nothing carries onto the test day, so the step is dropped.
- A key session day is missed: swap is offered first. If not swapped, the key session is recorded as skipped for the weekly status.
- The user completes only the 10-minute version: the day counts as done, but a key session does not count as done.
- The P1 step was done but later steps were not: nothing carries.
- Multiple missed days before one eligible day: only one P1 step carries per eligible day. The rest are dropped. A day never gets longer.
- The user returns after weeks away: apply the gap rule, then the weekly update rules for each closed week.
- A step is high-load (running, strength): it is dropped, never carried.
- Old goals (not plan v2): behavior unchanged. Copy only may adopt the new tone.
- Time zone change or travel: day boundaries follow `User.timezone` (ND-1), not device local time. Travel must not create phantom misses. If the user updates their timezone, the new zone applies going forward.

## 11. Rules

**RULE-1 — No pile-up.** A missed day never makes any day longer.
**RULE-2 — Only P1 carries.** Only the missed day's priority-1 step moves, replacing the lowest-priority step on the next eligible day.
**RULE-3 — Never onto test day.** Test day is never padded.
**RULE-4 — 10-minute version always available** and always counts as a done session.
**RULE-5 — Rest days are never missed.** Optional rest-day steps never count either way.
**RULE-6 — Key session handling.** Offer a swap first, then carry as normal. A key session skipped feeds the weekly status.
**RULE-7 — Test grace.** A late test can be logged until the next week opens. If still unlogged, the weekly update runs with the test marked missing. Target held, sessions decide the status. A missing test is not a failure of the person.
**RULE-8 — Gap handling.** After 3+ missed practice days in a row, the next session defaults to the 10-minute version.
**RULE-9 — Escalation.** 1 miss: carry-forward plus one line. 2 misses in a week: surface the 10-minute version. far_behind week: target held. Two far_behind weeks: re-test first and daily-time check. Weeks 4 and 8: checkpoint offer.
**RULE-10 — High-load steps are dropped, not carried.**

## 12. Tone and Copy

Neutral and encouraging, never firm. One line that moves forward. Never ask why. Never use the word "missed" in user-facing copy. Never show a status label such as "behind" or "failed".

| Situation | Direction |
|---|---|
| Carried step | "Yesterday's session didn't happen. We moved the most important step to [day], so today stays the same length." |
| Short on time | "The 10-minute version still counts toward this week." |
| Test not logged | "Last week's test wasn't logged, so we're holding your target. Take it now (about N minutes) and we'll adjust." |
| Return after gap | "Welcome back. Today's a short one to ease in." |
| Two weak weeks | "The last two weeks were hard to fit in. Let's re-test to find your real level and check your daily time still works." |

## 13. Scope

### In scope
- Miss detection on app open.
- The recovery rules in section 11.
- Late-test card and gentle-return day.
- Copy in section 12.
- One schema migration: `DailyTask.usedMinimumVersion Boolean @default(false)` (ND-3).
- One new endpoint: `POST /api/goal/reconcile` (ND-6).
- One new endpoint: log weekly test without closing the week (ND-4).
- Preset copy honesty: either implement "shifts into weekend buffer" or soften the prose (ND-5/M5.2).

### Out of scope
- Push notifications and reminders (later phase).
- Asking the user why they missed.
- Partner, coach, or accountability escalation.
- Penalties, shame mechanics, or punitive language.
- Changing how old (pre-v2) goals work.
- Changes to prompts 1-5 beyond the missed-session inputs they already receive.
- Editing target numbers by the user.

### Must remain unchanged
- The weekly status guide (on_track, a_bit_behind, far_behind) and the checkpoint/extension caps, as decided in plan v2.
- Code, not the model, decides practice, rest, and test days.
- The existing Today "yesterday not completed" recovery callout may be replaced by this feature, but its tone (no punitive copy, no doubling up) must be preserved.

## 14. Decisions (all closed)

| ID | Decision | Resolution |
|---|---|---|
| OD-1 | When does a day close? | The user's `sleepTime` plus a 2-hour buffer, capped at 04:00 local time, evaluated in the user's IANA timezone (`User.timezone`). Local midnight is not used. See ND-1. |
| OD-2 | Does the 10-minute version count toward the 50% rule? | Yes for sessions done. No for key-session done. Requires `DailyTask.usedMinimumVersion` (ND-3). |
| OD-3 | Pause plan for illness or travel? | Yes, but as a separate future feature. Until then, long breaks are handled as a gap (RULE-8). Out of scope here. |
| OD-4 | Is a streak shown? | No streak is currently shown, so none is introduced. If one is ever added: rest days and 10-minute versions keep it alive, and a miss never resets it to zero. |
| OD-5 | How are high-load steps identified? | A new per-step flag, since `safety` is per plan, not per step. For presets (`run10k`, `recomp`), all steps are high-load by goal type. For custom goals, the model emits the flag (ND-5). |

## 15. Acceptance Criteria

- **AC-1** A practice day that closes with nothing done is recognised as missed on the next app open.
- **AC-2** Marking today missed applies the same recovery as automatic detection.
- **AC-3** Only the priority-1 step of the missed day moves, and the receiving day's total minutes do not increase.
- **AC-4** Nothing is ever carried onto the test day.
- **AC-5** Rest days never show a miss message.
- **AC-6** A key session miss offers a swap before carry-forward.
- **AC-7** The 10-minute version is available on every practice day and counts as done.
- **AC-8** A test not logged by the end of test day shows a late-test card until the next week opens.
- **AC-9** An unlogged test at week close runs the weekly update with the test marked missing, and the target is held.
- **AC-10** After 3+ missed practice days in a row, the next session defaults to the 10-minute version.
- **AC-11** Two far_behind weeks in a row start the next week with a re-test and the daily-time check.
- **AC-12** User-facing copy never uses "missed", "behind", "failed", or asks why.
- **AC-13** High-load steps are dropped, not carried.
- **AC-14** Old goals behave exactly as before.

## 16. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Wrong day boundary creates false misses. | Resolved by ND-1: use `User.timezone` as the single clock. Fallback to UTC when no timezone is stored. M1.1b implements. |
| R-2 | Dropped steps hide real skipped work from the weekly update. | Weekly update receives missed-day and dropped-step counts. |
| R-3 | Long absences exhaust the 12 weeks. | OD-3 pause plan; gap rule meanwhile. |
| R-4 | Copy sounds punitive. | Follow section 12 and the blueprint tone rules. |

## Handoff Contract

This Feature Definition defines **what missed-session handling must do and how it should feel**. The Phase Definition decides implementation order, repository areas, dependencies, and verification. The implementation must not invent new requirements.

**Core principle:**
> **Adapt the journey, don't punish the person.**

**Status:** IMPLEMENTATION IN PROGRESS
