# Achivii Checkpoints — Phases

**Status:** DONE (2026-10-24); goes live with O1
**Feature:** docs/features/checkpoints/02-feature.md
**Decisions:** docs/features/checkpoints/decisions.md

## 1. Status

| Milestone | What | Covers | Status | Report |
|---|---|---|---|---|
| M1 | Server: the check at the week 4 and 8 close, the stored offer, the answer route with its target changes, the goal response fields, the prompt line, logs | AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-8, AC-9 (server), AC-10, AC-11 (logs) | DONE 2026-10-24 | [m1](milestones/m1-server.md) |
| M2 | App and close: the Today card, the confirmation, the day-90 line, acceptance in the four switch states, docs | AC-5, AC-9, AC-11, all | DONE 2026-10-24 (built in one chat; evidence in `milestones/m2-evidence/`) | |
| O1 | Mo: goes live with weekly-update O2 (turning on `WEEKLY_UPDATE_ENABLED` turns on checkpoints, CP-8) | — | DONE: live with weekly-update O2 (Mo confirmed 2026-10-28) | |

## 2. Order
- **P1 Server (M1):** everything the server decides and stores. Stays dark: it only runs with both switches on (RULE-1), which production doesn't have.
- **P2 App and close (M2):** the screens, then proof of every AC and R row, every problem sorted. Needs M1.

Kept to two milestones on purpose (Mo, 2026-10-24): there is no separate "check the code" milestone. M1 checks the code first and stops and reports if it disagrees with `02-feature.md`.

## 3. Rules for this feature
- Nothing runs, is stored or shown unless `weeklyUpdateEnabled()` is true (RULE-1, CP-8). Never turn a switch on from code or tests.
- No migration: the offer lives in `Goal.roadmap.checkpoints` (CP-11).
- `planV2.ts`, `routes/goal.ts` and `weekClose/` are shared with plan-safety-limits M3.1: a milestone here starts only when no milestone there has an open branch in them.
- With no offer accepted, every prompt stays byte-for-byte unchanged (RULE-12).

## 4. Must not break
| ID | What | How to check |
|---|---|---|
| R-1 | WU-62's four switch states: D equals A; A, B, C unchanged for goals with no offer | `weekCloseR2.test.ts`, the M4.1b matrix tests |
| R-2 | Safety limits: no target past the safe climb | `targetSteps`, `storedTargets` and weekly update tests |
| R-3 | Week prompt and weekly update prompt unchanged without a choice | `weekPrompt.*.txt` fixtures, `weeklyUpdatePromptPin.test.ts` |
| R-4 | Breaks, jumped weeks, the choice card, the re-test, the daily-time card | weekly-update M1.5b, M3.3, M3.4 tests; e2e `today` specs |
| R-5 | `week12Line` where no offer was accepted | `week12Line` tests; Roadmap and review tests |
| R-6 | Goal creation, Pro gating, 503 and 422 paths | goal-create tests |

## 5. Phases

### P1 Server
**M1 Server.** The check (RULE-2 to RULE-6, RULE-10), stored in the close's transaction with the expiry (RULE-8), `POST /api/goal/checkpoint` with the target changes (RULE-9), `checkpoint` and `dayNinetyLine` on the goal response (RULE-11), the prompt line (RULE-12), the logs (RULE-13). Checks R-1 to R-3, R-5, R-6. Done when every case in the prompt is tested and the baselines hold.

### P2 App and close
**M2 App and close.** The Today card with its placement and copy (RULE-7, section 6), the confirmation line, `dayNinetyLine` in place of `week12Line` on every screen (RULE-11), an e2e spec, acceptance in the four switch states, CLAUDE.md and plan-v2 updated, every problem sorted. Checks R-1 to R-6.

## 6. Risks
- **The forecast is new maths on real goals.** Controlled by M1's table of worked examples (AC-3) and the log line; the 75% and 10% numbers are constants that can be tuned.
