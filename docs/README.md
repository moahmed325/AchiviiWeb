# Achivii Docs — START HERE

This folder is organized so you can find the right document without remembering the old project history.

## Where do I go?

| Folder | Use it for |
|---|---|
| `01-product/` | What Achivii should be — product direction and visual design |
| `02-architecture/` | How important technical systems are structured |
| `03-workflow/` | How we plan, execute, verify, and record work |
| `04-billing/` | Lemon Squeezy billing and subscription documentation |
| `05-migration/` | Render → Supabase migration and infrastructure work |
| `99-archive/` | Old/superseded documents — reference only |

## The documents you will use most

### Product
- `01-product/redesign-blueprint.md` — product source of truth
- `01-product/visual-design-system.md` — visual/design source of truth

### Architecture
- `02-architecture/CUSTOM_GOAL_EXECUTION_ARCHITECTURE.md` — custom-goal execution architecture

### Workflow
- `03-workflow/phases.md` — current payment implementation roadmap
- `03-workflow/decisions.md` — why important decisions were made
- `03-workflow/prompts.md` — implementation prompts for the redesign
- `03-workflow/feature_definition_template.md` — reusable feature-definition template
- `03-workflow/implementation_prompt_template.md` — reusable agent-prompt template

### Billing
- `04-billing/` — use this whenever working on Lemon Squeezy billing

### Migration
- `05-migration/phases.md` — migration execution phases and completion status
- `05-migration/MIGRATION_BRIEF_RENDER_TO_SUPABASE.md` — detailed migration investigation/brief
- `05-migration/feature-definition-infrastructure-migration.md` — migration feature definition

## Simple rule

If you are **building the product**, start with `01-product/`.

If you are **changing technical structure**, check `02-architecture/`.

If you are **doing a task**, check `03-workflow/`.

If you are **touching payments**, check `04-billing/`.

If you are **touching Supabase/Render/auth migration**, check `05-migration/`.

Do not use anything in `99-archive/` as current instructions.

## Source-of-truth order

1. Product behavior → `01-product/redesign-blueprint.md`
2. Visual decisions → `01-product/visual-design-system.md`
3. Recorded project decisions → `03-workflow/decisions.md`
4. Current task scope/order → the relevant roadmap in `03-workflow/` or `05-migration/`
5. Code → authoritative for what is actually implemented

When documents conflict, prefer the newer explicit decision and verify the repository before assuming something is implemented.
