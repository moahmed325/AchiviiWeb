# Achivii — Documentation

All project documentation lives in the four topical subfolders below. Every document is Markdown; cross-references between documents use repo-root paths (e.g. `docs/process/decisions.md`).

## 📁 Folder map

### `architecture/` — What Achivii is and how it's built
| Document | Purpose |
|---|---|
| [redesign-blueprint.md](architecture/redesign-blueprint.md) | Product source of truth — what Achivii is and must become (**BP §n** references) |
| [visual-design-system.md](architecture/visual-design-system.md) | How Achivii looks — the design system (**VDS §n** references) |
| [CUSTOM_GOAL_EXECUTION_ARCHITECTURE.md](architecture/CUSTOM_GOAL_EXECUTION_ARCHITECTURE.md) | Technical architecture of the custom-goal (Golden Rail) execution engine |

### `billing/` — Lemon Squeezy integration (contracts, config, rollback)
| Document | Purpose |
|---|---|
| [lemonsqueezy_billing_configuration.md](billing/lemonsqueezy_billing_configuration.md) | Environment-variable configuration, test/live namespace, pricing, payout readiness |
| [lemonsqueezy_checkout_identity_contract.md](billing/lemonsqueezy_checkout_identity_contract.md) | The checkout `custom_data.user_id` identity contract (M0.3) |
| [lemonsqueezy_provider_contract.md](billing/lemonsqueezy_provider_contract.md) | Provider-facing contract boundaries |
| [lemonsqueezy_provider_state_mapping.md](billing/lemonsqueezy_provider_state_mapping.md) | Lemon Squeezy status → internal subscription state mapping (M0.4) |
| [lemonsqueezy_webhook_idempotency.md](billing/lemonsqueezy_webhook_idempotency.md) | `WebhookEvent.deliveryKey` idempotency model (M1.2) |
| [launch_rollback_readiness.md](billing/launch_rollback_readiness.md) | Launch checklist, checkout kill switch, credential rotation (M6.6) |
| [m2.5_test_mode_verification.md](billing/m2.5_test_mode_verification.md) | Test-mode verification record |

### `process/` — How the project is run (decisions, phases, prompts, templates)
| Document | Purpose |
|---|---|
| [decisions.md](process/decisions.md) | Every decision, its options, choice and consequences — the **why** |
| [phases.md](process/phases.md) | The redesign execution roadmap — **when and in what order** |
| [prompts.md](process/prompts.md) | Phase-by-phase agent instructions for the redesign |
| [feature_definition_payment.md](process/feature_definition_payment.md) | Feature definition for the payment/billing milestone |
| [prompts_payment.md](process/prompts_payment.md) | Agent instructions for the payment milestones |
| [feature_definition_template.md](process/feature_definition_template.md) | Reusable feature-definition template |
| [phases_template.md](process/phases_template.md) | Reusable phases/roadmap template |
| [implementation_prompt_template.md](process/implementation_prompt_template.md) | Reusable implementation-prompt template |
| [archive/phases_redesign_archive.md](process/archive/phases_redesign_archive.md) | Superseded redesign process notes (historical) |

### `migration/` — Infrastructure migration (Render → Supabase)
| Document | Purpose |
|---|---|
| [feature-definition-infrastructure-migration.md](migration/feature-definition-infrastructure-migration.md) | Feature definition for the database + auth migration |
| [MIGRATION_BRIEF_RENDER_TO_SUPABASE.md](migration/MIGRATION_BRIEF_RENDER_TO_SUPABASE.md) | Complete read-only investigation brief: current architecture, database, auth, billing, risks, migration order, verification plan |
| [../infrastructure-migration/phases.md](../infrastructure-migration/phases.md) | Implementation phases roadmap for the infrastructure migration |

### `process/archive/` — Historical
Superseded documents kept for context only. Do not treat as current guidance.

---

## Canonical reading order (for a new contributor)

1. [architecture/redesign-blueprint.md](architecture/redesign-blueprint.md) — the product
2. [architecture/visual-design-system.md](architecture/visual-design-system.md) — the look
3. [process/phases.md](process/phases.md) — the plan
4. [process/decisions.md](process/decisions.md) — the rationale
5. [process/prompts.md](process/prompts.md) — how work is instructed
6. [billing/](billing/) — when touching anything payment-related
7. [migration/MIGRATION_BRIEF_RENDER_TO_SUPABASE.md](migration/MIGRATION_BRIEF_RENDER_TO_SUPABASE.md) — before any infrastructure work

## Source-of-truth precedence

On conflict between framework documents, [process/decisions.md](process/decisions.md) §"Sources of truth" governs: **the blueprint wins on product, the VDS wins on visuals, decisions.md records why.**
