# Achivii Docs

Seven places, one rule each. If you are unsure where something goes, use the table at the bottom.

```
docs/
├── README.md          this file
├── decisions.md       the one decision log (why we chose X)
├── product/           what Achivii is and how it looks
├── architecture/      how the systems work
├── features/          one folder per feature (all planning and building docs)
├── templates/         blank starting points for a new feature
└── archive/           finished or replaced work. Never current instructions.
```

## product/
What Achivii should be. Changes rarely.
- `redesign-blueprint.md` is the product source of truth.
- `visual-design-system.md` is the visual source of truth.

## architecture/
How a system works today. One file per system, updated when the system changes.
- `custom-goal-engine.md`: custom goal and 90-day execution engine.
- `plan-v2.md`: plan v2 spec (weekly targets, week call, weekly update, missed sessions).

## features/
Every feature gets **one folder** with the same fixed layout. The folder name is the feature name, so file names never repeat it.

```
features/<feature-name>/
├── 01-problem.md        what is wrong, with evidence
├── 02-solution.md       options explored, one chosen
├── 03-feature.md        what it must do (the Feature Definition)
├── 04-phases.md         order of work, milestones, exit criteria
├── 05-prompts.md        instructions handed to the coding agent
├── milestones/          one file per milestone: m1.1-short-name.md
└── reference/           anything else that only this feature needs
```

Not every feature has every file. Numbers show the order work happens in. Skip a number, never renumber.

Current features: `billing`, `information-density`, `infra-migration`, `research-pipeline`, `today-redesign`, `weekly-update`. Archived: `missed-sessions` (`docs/archive/missed-sessions/`).

## templates/
Same numbering as a feature folder, so the match is obvious: `templates/03-feature.md` is the helper for writing a `03-feature.md`.

## archive/
Done, shipped, or replaced. Move a whole feature folder here when it is finished.

## The rules that keep it clean

1. **One home per document.** If it is about one feature, it lives in that feature's folder. Never in a shared folder.
2. **No feature names in file names.** The folder carries the name. Use `03-feature.md`, not `feature-definition-billing.md`.
3. **Fixed file names inside a feature.** Use the numbered names above. Extra material goes in `reference/` or `milestones/`.
4. **No loose files.** Nothing sits at the repo root except `README.md` and `Design.md`. Nothing sits directly in `docs/` except this README and `decisions.md`.
5. **Status lives in the document, not here.** Every `03-feature.md` and `04-phases.md` starts with a `**Status:**` line. This README does not track status, so it cannot go stale.
6. **Finished means archived.** When a feature ships, move its folder to `archive/`.
7. **Link by full path from the repo root**, for example `docs/features/billing/03-feature.md`.
8. **Maximum depth is three folders** under `docs/`. If you need more, you are splitting too much.

## Where does this go?

| I have... | It goes in... |
|---|---|
| A new idea for a feature | `features/<name>/01-problem.md`, copy the helper from `templates/` |
| A description of how a system works | `architecture/` |
| A product or design rule | `product/` |
| A decision with options and a reason | `decisions.md` (append, newest last) |
| Notes, contracts or specs used by one feature | `features/<name>/reference/` |
| A single milestone's instructions | `features/<name>/milestones/` |
| A finished or abandoned feature | move its folder to `archive/` |
| A blank template | `templates/`, numbered like a feature file |

## Source-of-truth order

When documents disagree, trust them in this order:

1. Product behavior: `product/redesign-blueprint.md`
2. Visual decisions: `product/visual-design-system.md`
3. Recorded decisions: `decisions.md`
4. Scope and order of work: the feature's `04-phases.md`
5. Code: authoritative for what is actually implemented

Verify the repository before assuming something is built.

## Start a new feature

1. Create `features/<feature-name>/` (lowercase, hyphens).
2. Use `templates/01-problem.md` through `05-prompts.md` in order, saving each result under the same number.
3. Record any decision that matters in `decisions.md`.
4. When done, move the folder to `archive/`.
