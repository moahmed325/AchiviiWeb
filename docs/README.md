# Achivii Docs

Eight places, one rule each. If you are unsure where something goes, use the table at the bottom.

```
docs/
├── README.md          this file
├── decisions.md       decisions that affect the whole product (why we chose X)
├── backlog.md         known problems and leftover work no feature owns yet
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
├── 01-brief.md          what is wrong, options, chosen direction (optional)
├── 02-feature.md        what it must do: rules, copy, acceptance criteria
├── 03-phases.md         the plan, and the only status table
├── decisions.md         this feature's decisions, with its own ID prefix (e.g. MS-1)
├── milestones/          one file per milestone: prompt, report and review together
│   ├── m1.1-short-name.md
│   └── m1.1-evidence/   screenshots and other evidence for that milestone
└── reference/           anything else that only this feature needs
```

Skip `01-brief.md` when the direction is already decided in `architecture/` or `decisions.md`; `02-feature.md` then links there. Numbers show the order work happens in.

Features started before 2026-10-08 (now only `billing`) keep the old layout (`01-problem.md`, `02-solution.md`, `03-feature.md`, `04-phases.md`, `05-prompts.md`) until they finish. Current features also include `method-aware-recovery`, `weekly-update` and `checkpoints` (new layout). Archived: `missed-sessions`, `infra-migration`, `research-pipeline`, `information-density`, `today-redesign` (in `docs/archive/`). Where each current feature stands is in the Features table at the top of `docs/backlog.md`.

### How a feature moves
1. Write `01-brief.md` with Mo (or skip it), then `02-feature.md`. Record every decision in the feature's `decisions.md` as it is made.
2. Write `03-phases.md`: phases, milestones and the status table.
3. For each milestone: the main chat writes the Prompt in its milestone file, another chat does the work and writes the Report (including any problems it found), and the main chat reviews it, updates the status table and decisions, and sorts every problem found.
4. When every milestone is done and every problem is sorted, move the folder to `archive/`.

## backlog.md
Two things: a short **Features** table saying where every current feature stands (in progress, paused, waiting, stub), and the one list of known problems that no feature owns yet. Problems found during a milestone are sorted at review: into that milestone, a later milestone of the same feature, or the backlog. Each backlog item is **small** (fixed on the quick-fix track: one short prompt, one branch, one review), **big** (becomes a new feature, starting at `01-brief.md` or `02-feature.md`) or **owner** (something Mo does by hand). The file explains the sizes, statuses and the quick-fix prompt.



## templates/
Same names as the files in a feature folder, so the match is obvious: `templates/02-feature.md` is for writing a `02-feature.md`, `templates/milestone.md` for a milestone file, `templates/decisions.md` for a feature's decision log. Each template has a short guide (Part A) and a skeleton to copy (Part B).

## archive/
Done, shipped, or replaced. Move a whole feature folder here when it is finished.

## The rules that keep it clean

1. **One home per document.** If it is about one feature, it lives in that feature's folder. Never in a shared folder.
2. **No feature names in file names.** The folder carries the name. Use `02-feature.md`, not `feature-definition-billing.md`.
3. **Fixed file names inside a feature.** Use the names above. Extra material goes in `reference/`.
4. **No loose files.** Nothing sits at the repo root except `README.md` and `Design.md`. Nothing sits directly in `docs/` except this README, `decisions.md` and `backlog.md`.
5. **Status lives in one place.** A feature's progress is tracked only in the status table of its `03-phases.md` (and each milestone file's own status line). This README does not track status, so it cannot go stale.
6. **Finished means archived.** When a feature ships, move its folder to `archive/`.
7. **Link by full path from the repo root**, for example `docs/features/weekly-update/01-brief.md`.
8. **Maximum depth is three folders** under `docs/`, plus the `milestones/<id>-evidence/` folders. If you need more, you are splitting too much.

## Where does this go?

| I have... | It goes in... |
|---|---|
| A problem found while building, or any bug or leftover no feature owns | `backlog.md` (append, newest last) |
| A new idea for a feature | `features/<name>/01-brief.md`, copy the skeleton from `templates/01-brief.md` |
| A description of how a system works | `architecture/` |
| A product or design rule | `product/` |
| A decision about one feature | that feature's `decisions.md` (append, newest last) |
| A decision about the whole product | `decisions.md` (append, newest last) |
| Notes, contracts or specs used by one feature | `features/<name>/reference/` |
| A milestone's prompt, report and review | `features/<name>/milestones/mX.Y-name.md` |
| A finished or abandoned feature | move its folder to `archive/` |
| A blank template | `templates/`, numbered like a feature file |

## Source-of-truth order

When documents disagree, trust them in this order:

1. Product behavior: `product/redesign-blueprint.md`
2. Visual decisions: `product/visual-design-system.md`
3. Recorded decisions: `decisions.md` and the feature's `decisions.md`
4. What the feature must do: its `02-feature.md`
5. Scope and order of work: its `03-phases.md`
6. Code: authoritative for what is actually implemented

Verify the repository before assuming something is built.

## Start a new feature

1. Create `features/<feature-name>/` (lowercase, hyphens) and its `decisions.md` with a new ID prefix.
2. Follow the templates in order: `01-brief.md` (optional), `02-feature.md`, `03-phases.md`, then one `milestone.md` per milestone.
3. When done, move the folder to `archive/`.
