# AI model: free limits, costs and upgrades

Written 2026-10-15 for Mo (B-28). Prices and limits change often. Check the two Google pages under "Sources" before deciding anything.

## 1. What Achivii uses today

- One AI provider: Google Gemini (ND-22). No backup provider.
- One model: `gemini-3.5-flash-lite` (`backend/src/lib/ai/gemini.ts`). It can be changed with the `GEMINI_MODEL` setting in Render, with no code change.
- The free tier, on one Google project.

### How many AI calls each action makes

| What the person does | AI calls when all goes well | Worst case (retries) |
|---|---|---|
| Creates a pathway goal (clarify, roadmap, week 1) | 3 | about 9 (each step retries once, and busy errors are retried twice more) |
| Creates a custom goal (clarify, roadmap, recovery profile, week 1) | 4 | about 11 (the profile call retries once; if it still fails the goal uses a template) |
| Closes a week, by review or automatically (next week) | 1 | about 3 (the week call retries once, and busy errors are retried) |
| Anything else (Today, Focus, ticking steps, missed days) | 0 | 0 |

Since 2026-10-28 `CUSTOM_RECOVERY_PROFILES_ENABLED` is on, so a custom goal makes the profile call. The weekly update call went with the weekly tests on 2026-10-30 (ND-33), so a week close makes only the week call. The last week has no week after it, so its close makes no call.

So, roughly: **a new user costs about 3 calls on day 1 (4 for a custom goal), and then about 1 call a week.**

## 2. How far the free tier goes

Google no longer publishes exact free limits. Each project sees its own limits in AI Studio. Recent guides say Flash-Lite's free limits are about:

- **15 calls a minute**
- **about 500 calls a day** (resets at midnight US Pacific time)

These numbers are not confirmed. One recent report measured far less (20 a day) on some models. **Check your real numbers:** AI Studio → your project → Usage / Rate limits.

If the limit really is 500 a day:

| Daily load | Calls a day | Fits? |
|---|---|---|
| 20 new goals a day | about 60 | Yes |
| 500 people with a goal, each closing a week | about 140 a day on average (2 calls each) | Yes |
| 50 new goals and 1,000 active people | about 460 | Only just; retries go past it |
| 100 new goals a day | about 300 for new goals alone | Close to the limit |

**The daily limit is not the first problem. The per-minute limit is.** People tend to act at the same time: Sunday evening reviews, or a post that brings many sign-ups at once. 15 calls a minute means only about **5 goals can be created in the same minute**. The 6th person gets "Couldn't design your roadmap right now. Please try again." This already happened in our own eval: running 26 goals in a row hit the limit (M2.2).

**In short:** free is fine for testing and for a small number of early users, maybe up to a few hundred active people. It breaks first at busy moments, not on an average day.

### Two more things about the free tier

1. **Privacy.** On the free tier, Google may use what we send (people's goals, answers and plans) to improve its products, and people at Google may read it. On the paid tier it does not. Before real users arrive, the privacy policy should say this, or we should move to paid.
2. **No promise.** Google can lower free limits at any time without warning, and has done so before.

## 3. What paying costs

Paying is "pay as you go": no monthly fee. You link a billing account to the Google project (this is Tier 1) and pay only for what is used. You can set a budget alert in Google Cloud so you are emailed before a bill grows.

### Prices (per 1 million tokens; a token is about ¾ of a word)

| Model | Input | Output | Free tier? |
|---|---|---|---|
| Gemini 3.5 Flash-Lite (today's model) | $0.30 | $2.50 | Yes |
| Gemini 3.8 Flash (smarter) | $0.75 now, **$1.50 from 1 Jan 2027** | $3.75 now, **$7.50 from 1 Jan 2027** | Yes |
| Gemini 3.1 Pro Preview (smartest) | $2.00 | $12.00 | No |

### What that means for Achivii (estimates)

My guess at the size of each call: a goal creation sends about 11,000 tokens and gets about 10,000 back; a weekly review sends about 5,000 and gets about 5,000 back. These are estimates, not measurements, and "thinking" models can use 2 to 3 times more output. Treat the numbers below as a rough guide. They were made before the custom profile call was switched on (2026-10-28), so a custom goal costs a little more than shown; a week close is one week call again since the weekly update went (2026-10-30). Their sizes are not measured yet.

| Model | One new goal | One weekly review | One person, a whole 12-week plan | 1,000 active people a month |
|---|---|---|---|---|
| 3.5 Flash-Lite (today's) | about $0.03 | about $0.015 | about **$0.20** | about **$60–90** |
| 3.8 Flash (2027 price) | about $0.09 | about $0.045 | about **$0.60** | about **$200–250** |
| 3.1 Pro | about $0.15–0.30 | about $0.07–0.15 | about **$1–2** | about **$300–600** |

For a small start, say 50 active people, staying on Flash-Lite would cost about **$3–5 a month**.

Compare these numbers with the Pro subscription price. Even the smartest model costs only a dollar or two per person per 12-week plan.

### Paid limits

Paying lifts the limits a lot. Tier 1 allows many more calls a minute than 15 (see your AI Studio page for the exact number). Tier 1 has a $250 spending cap. Google moves you up a tier on its own: Tier 2 after $100 spent and 3 days, Tier 3 after $1,000 spent and 30 days.

## 4. What a better model would give

- **Better plans.** A smarter model follows the method more closely, writes clearer steps and makes fewer mistakes our checks have to catch. Fewer failed checks means fewer retries and fewer "Please try again" screens.
- **Better custom profiles.** Flash-Lite passed the eval's bar on 2026-10-25 (B-56 round 3, actions 90.3%) and custom profiles are on since 2026-10-28; a stronger model would likely agree more often and fall back to a template less.
- **Fewer failures at busy moments**, because of the higher paid limits. This alone is the main reason to pay, and it does not need a bigger model.

What it does not give: the safety rules, the rest gaps and the recovery rules are all in our own code (MR-3). A bigger model does not make the app safer or change how missed days work.

## 5. Suggested path

1. **Now (free):** stay on Flash-Lite. Check your real limits in AI Studio. Mention in the privacy policy that goal text is processed by Google's AI.
2. **When real users arrive, or the first "try again" complaints come in:** turn on billing (Tier 1) and keep Flash-Lite. This costs a few dollars a month at first, and fixes busy-moment failures and the privacy issue in one step.
3. **When Pro subscriptions bring money in:** try Gemini 3.8 Flash for the roadmap and week calls by changing `GEMINI_MODEL` in Render, and rerun the eval (`backend/scripts/recovery-eval/`) to see if plans get better. Keep Pro for later, if ever.

Things the code could do while staying free (not planned; each would be a backlog item): wait and try again a little later when Google says "too busy" (429), so the person waits instead of failing; or add a second free provider as a backup (ND-22).

## Sources

- Google, Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing (read 2026-10-15)
- Google, Gemini API rate limits and tiers: https://ai.google.dev/gemini-api/docs/rate-limits (read 2026-10-15)
- Free-tier numbers for 3.5 Flash-Lite (not confirmed by Google): https://aipromptshub.co/blog/gemini-api-free-tier-rate-limits, https://aiplug.work/en/blog/gemini-free-tier-limits
