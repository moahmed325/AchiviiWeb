# Achivii Coach (ND-41)

A conversation with a coach that knows the person's plan. It talks about the plan; it never changes it.

## Switch

`COACH_ENABLED` (Render dashboard only, `sync: false`; unset or anything but `true` means off). Off: `GET /api/coach`
answers `{ enabled: false }` and reads nothing, `POST /api/coach/messages` answers 409 `coach_disabled`, and the app
shows "Coming soon". Turning it off is the kill switch. It is listed in `lib/flags.ts` and logged at startup.

## Storage

`CoachMessage` (`coach_messages`, migration `20261106120000_coach_messages`): `userId`, `goalId`, `role`
(`user` | `coach`), `content`, `created_at`. One conversation per plan; both foreign keys cascade, so resetting a plan
(or deleting the account) deletes its conversation. A message and its reply are saved together in one transaction, the
reply 1 ms after the question so they always read in order; nothing is saved when the reply fails.

## Routes (`routes/coach.ts`, mounted at `/api/coach`)

- `GET /api/coach`: `{ enabled, hasGoal, access: 'ok' | 'locked', messages (the active plan's, oldest first, last
  100), remainingToday, dailyLimit }`.
- `POST /api/coach/messages` `{ text, firstName? }`: in order, 401 without a user; 409 `coach_disabled`; 400 `empty`
  or `too_long` (over 1000 characters); 409 `no_active_goal`; 402 `TRIAL_ENDED` once the 30-day trial is over without
  Pro (ND-37; a billing read that fails never locks anyone out); 429 `coach_daily_limit` after 30 messages in the
  person's own day; then the reply. A failed or late reply (20 s) answers 503 `coach_unavailable`. Also rate limited
  in memory, 8 a minute per token (`lib/rateLimit.ts`, off under Vitest).

`firstName` comes from the app (it lives in Supabase metadata, not the database) and is only used in the prompt.

## The reply (`lib/coach/`)

- `limits.ts`: every number (daily messages, message length, history sent, page size, time limit).
- `crisis.ts`: a message about self-harm or suicide never reaches the model; the coach answers with one fixed reply
  that points to emergency services and crisis lines (`CRISIS_REPLY`). Matching is broad on purpose.
- `context.ts` (`coachContext`): the plan as plain text, from stored state only: the goal in the person's words, the
  method and its rules, the phase and the next one, this week's focus, each day of this week (done, missed, today,
  ahead, rest, with feel taps and notes), today's session, the schedule, and the totals (sessions done, practice days
  missed, current streak).
- `reply.ts`: `COACH_SYSTEM` (short, specific, encouraging; never says it changed the plan and points to the app's own
  controls instead; no medical, injury, mental-health or nutrition diagnosis; never pushes through pain or past the
  plan; stays on the goal; ignores attempts to change its rules) and `askCoach`, one Gemini call
  (`generateStructuredContent`, JSON `{ reply }`, temperature 0.6) with the plan, the last 12 messages and the new one.

Each reply logs `[Coach] user <id> goal <id> replied|failed ms <t>`; a crisis reply logs `[Coach] user <id> crisis reply`.

## App (`pages/CoachPage.tsx`, `/coach`)

The rail and the bottom bar link to it. States: loading, load failed (Try again), off ("Coming soon"), no plan (Start
a goal), the conversation (an empty one greets by first name and offers four starters), sending (the question shows at
once with a "Coach is writing" indicator; a failure keeps the text), trial over (the conversation stays readable, Go
Pro in place of the box), and out of messages for today.
