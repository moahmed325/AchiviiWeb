# Template: decisions.md (one per feature)

Every feature keeps its own decision log in `docs/features/<name>/decisions.md`. It starts on day one, while the brief or feature definition is being written, and it moves to `archive/` with the feature.

## Which log a decision goes in

- **This feature's `decisions.md`:** anything that only changes this feature (a rule, a data choice, the order of work, what moves to another feature).
- **`docs/decisions.md`:** anything that changes the whole product or more than one feature (retiring plan v1, a new provider, a design rule). If unsure, ask Mo.

## IDs

Each feature picks a short prefix when its folder is created, and every decision uses it: `MS-1`, `MS-2` for missed sessions, `WU-1` for weekly update. Never reuse a prefix, and never use the global ones (`D-`, `OD-`, `ND-`, `PAY-`). Other files cite a decision by its full ID, so it is always clear which log it lives in.

## Rules

- **Append, newest last.** Never renumber.
- **Only Mo decides.** A chat may propose; the entry is written once Mo agrees.
- **Apply it right away.** When a decision changes the feature definition or the phases, edit those files in the same change and name the decision there.
- **Changing your mind** is a new entry that says which one it replaces. Mark the old one `Replaced by <ID>`; do not delete it.

---

## Skeleton (copy from here)

```markdown
# <Feature name> — Decisions

**Prefix:** <XX>

### XX-1 — <short title> (YYYY-MM-DD)
**Question:** <what had to be decided>
**Decision:** <what Mo chose>
**Why:** <one or two lines>
**Changes:** <which rules, ACs or milestones this affects>
```
