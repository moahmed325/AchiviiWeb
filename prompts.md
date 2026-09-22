# Agent Command System

This file contains the executable prompts for the project's takeover, development, verification, and maintenance process.

The detailed methodology and quality standards are defined in:

`phases.md`

When a prompt references a phase, read the corresponding section of `phases.md` and follow its requirements.

The project's persistent knowledge and state are maintained in:

* `PROJECT.md`
* `REQUIREMENTS.md`
* `ARCHITECTURE.md`
* `DECISIONS.md`
* `DEFINITION_OF_DONE.md`
* `KNOWN_ISSUES.md`
* `PROJECT_AUDIT.md`
* `FEATURE_MATRIX.md`
* `IMPLEMENTATION_PLAN.md`
* `VERIFICATION_REPORT.md`
* `CHANGELOG.md`

These documents are part of the project's operating system and should be treated as persistent project context.

---

# HOW TO USE THIS FILE

The user may instruct you with commands such as:

* `Run prompt 0`
* `Run prompt 1`
* `Run prompt 2`
* `Run prompt 3`
* etc.

When the user says:

`Run prompt X`

execute **that prompt's intended task**, while also following:

1. the applicable methodology in `phases.md`
2. the applicable project requirements
3. `DEFINITION_OF_DONE.md`
4. the project's architectural rules
5. established decisions in `DECISIONS.md`
6. the global rules in this file

---

# PROMPT BOUNDARIES

A prompt should remain within its intended scope.

Do not perform unrelated work merely because you notice it.

However, a prompt may perform **necessary supporting work** when that work is required to:

* safely complete the prompt
* verify the prompt's result
* prevent an obvious regression
* maintain required documentation
* maintain project consistency
* satisfy the Definition of Done
* preserve security or data integrity

For example:

If Prompt 6 asks you to implement a feature and you discover that the existing API contract must be updated for that feature to function correctly, updating the API contract is within scope.

However:

If you discover an unrelated performance issue elsewhere, document it and defer it.

---

# DEPENDENCY RULE

If the requested prompt depends on information or work from an earlier prompt that has not been completed:

Do not blindly proceed.

Determine whether the missing prerequisite can safely be established within the current prompt.

If it cannot:

1. explain what prerequisite is missing
2. document the dependency
3. do not fabricate assumptions
4. ask the user to run the appropriate prerequisite prompt

Never pretend a prerequisite has been completed when it has not.

---

# EVIDENCE RULE

Do not claim something is:

* complete
* fixed
* working
* secure
* tested
* production-ready

without reasonable evidence.

Use evidence such as:

* source inspection
* tests
* integration tests
* end-to-end tests
* manual verification
* build verification
* type checking
* linting
* runtime behavior
* database verification
* API verification

Clearly distinguish:

* VERIFIED
* INFERRED
* UNKNOWN
* NOT TESTED

---

# INSPECT BEFORE CHANGING

Never make significant changes before understanding the relevant code.

Do not:

* guess
* blindly rewrite
* copy patterns without understanding them
* introduce abstractions without justification
* change architecture without understanding its consequences

Prefer:

`inspect → understand → plan → implement → verify`

---

# PRESERVE WORKING FUNCTIONALITY

Do not rewrite functioning code simply because you would personally implement it differently.

Before replacing an existing implementation, understand:

* why it exists
* what depends on it
* what behavior it provides
* what tests cover it
* what hidden assumptions may exist

Make changes when there is a concrete technical, product, security, reliability, maintainability, or performance reason.

---

# FIX ROOT CAUSES

Prefer:

`root cause → coherent fix → verification`

over:

`bug → patch → another bug → another patch`

When a fix reveals a deeper architectural issue, address the underlying issue when appropriate rather than accumulating workarounds.

---

# NO FAKE COMPLETION

Never use:

* fake implementations
* placeholder logic
* hardcoded production data
* temporary mocks in production paths
* TODOs disguised as completed features
* disabled validation
* weakened tests
* ignored errors
* silently swallowed failures

to make a feature appear complete.

If a real implementation cannot yet be completed, clearly document the limitation.

---

# REQUIREMENTS ARE THE SOURCE OF TRUTH

Do not infer that existing behavior is automatically correct.

Distinguish between:

* what the project currently does
* what the project is supposed to do
* what the project documentation says
* what has been explicitly decided
* what is merely inferred

When these conflict:

1. investigate
2. identify the conflict
3. document it
4. resolve it based on the strongest available evidence

Do not silently choose one interpretation.

---

# ARCHITECTURE DISCIPLINE

Before introducing a new:

* framework
* library
* dependency
* architectural pattern
* abstraction
* state-management system
* database technology
* service
* infrastructure component

determine whether the existing project already has an appropriate solution.

Do not introduce technology merely because it is familiar or fashionable.

If a major architectural change is justified, document:

* reason
* alternatives
* tradeoffs
* consequences

in `DECISIONS.md`.

---

# KEEP PERSISTENT DOCUMENTATION UPDATED

Maintain these project documents throughout the process:

* `PROJECT.md`
* `REQUIREMENTS.md`
* `ARCHITECTURE.md`
* `DECISIONS.md`
* `DEFINITION_OF_DONE.md`
* `KNOWN_ISSUES.md`
* `PROJECT_AUDIT.md`
* `FEATURE_MATRIX.md`
* `IMPLEMENTATION_PLAN.md`
* `VERIFICATION_REPORT.md`
* `CHANGELOG.md`

Do not update every file mechanically after every change.

Update the files that are actually affected.

Avoid creating duplicate documentation.

If the project already has an equivalent document, prefer extending the existing source of truth.

---

# TRACK DISCOVERED ISSUES

When you discover an issue outside the current prompt:

1. Do not forget it.
2. Record it in the appropriate project document.
3. Give it an identifier when appropriate.
4. Associate it with the relevant requirement, phase, or prompt.
5. Continue the current task unless the issue blocks it.

Do not repeatedly rediscover the same issue in future sessions.

---

# CHANGE DISCIPLINE

Before changing code:

1. Identify affected files.
2. Understand their role.
3. Understand dependencies.
4. Determine expected behavior.
5. Consider regression risk.

After changing code:

1. Inspect the diff.
2. Run relevant tests.
3. Run relevant type checks.
4. Run linting where applicable.
5. Build where applicable.
6. Verify important behavior.
7. Update relevant documentation.

Do not leave unexplained changes behind.

---

# GIT / CHECKPOINT POLICY

The project should have a recoverable checkpoint after every major phase or meaningful implementation batch.

If the project uses Git:

1. Check the current working tree before starting.
2. Check the current branch.
3. Do not overwrite unrelated user changes.
4. Do not reset or discard work you did not create.
5. Make coherent commits.
6. Run relevant verification before committing.
7. Inspect the diff.
8. Check for secrets.
9. Create the checkpoint.
10. Report the commit hash.

---

# PRE-EXISTING CHANGES

If the working tree already contains uncommitted changes:

* inspect them
* determine whether they predate your work
* preserve them
* do not overwrite them
* do not include them in your commit unless explicitly appropriate

If you cannot safely determine which changes belong to you:

stop before committing and investigate.

Never use destructive commands such as:

```text
git reset --hard
git checkout -- .
git clean -fd
```

to "clean up" the repository unless the user explicitly and knowingly instructs you to do so.

---

# COMMIT QUALITY

Use meaningful commit messages.

Good:

```text
audit: establish project baseline

audit: complete feature inventory

audit: complete architecture review

feat: implement authentication improvements

feat: implement dashboard workflow

test: add end-to-end coverage

refactor: improve service architecture

fix: resolve persistence issues

verify: complete final project audit
```

Bad:

```text
updates
changes
stuff
fixes
final
misc
work
```

Each checkpoint should represent a coherent, recoverable state.

---

# CHECKPOINT TIMING

Do not create a checkpoint merely because a prompt started.

The normal sequence is:

```text
Investigate
    ↓
Plan
    ↓
Implement
    ↓
Test
    ↓
Verify
    ↓
Inspect diff
    ↓
Checkpoint
```

Never:

```text
Implement
    ↓
Commit
    ↓
Hope it works
```

A checkpoint must represent **verified work**, not merely completed work.

---

# SECRETS & SENSITIVE FILES

Before every commit, inspect the changes for:

* API keys
* access tokens
* passwords
* credentials
* private certificates
* secret configuration
* sensitive `.env` files
* personal/private data

Never commit secrets.

If sensitive data is discovered:

1. do not commit it
2. determine whether it was newly introduced
3. address it appropriately
4. document the issue if necessary

---

# TESTING RULE

Do not weaken or remove tests merely to make the project pass.

When a test fails, determine whether:

* the implementation is wrong
* the test is outdated
* the requirement changed
* the environment is incorrect

Then fix the underlying issue.

Tests should protect behavior, not merely produce green output.

---

# FAILURE RULE

If a required operation fails:

Do not hide it.

Do not silently work around it.

Report:

* what failed
* where it failed
* why it appears to have failed
* what was attempted
* what remains unverified

A failed verification is better than a false claim of success.

---

# UNKNOWN INFORMATION

Never invent:

* requirements
* architecture decisions
* business rules
* API behavior
* user expectations
* historical reasoning
* test results

Use:

`UNKNOWN`

or:

`NOT YET DETERMINED`

when necessary.

Then document what would be required to resolve the uncertainty.

---

# "WHAT CAN BE IMPROVED?" RULE

At every meaningful stage, ask:

> What can be improved?

Consider:

* correctness
* architecture
* reliability
* security
* performance
* maintainability
* testing
* accessibility
* UX
* developer experience
* documentation
* observability

But do not make changes merely for the sake of making changes.

Every improvement should have a reason.

---

# DEFINITION OF DONE

Before declaring a task complete, consult:

`DEFINITION_OF_DONE.md`

The Definition of Done is the project's quality gate.

A feature should not be marked complete merely because its implementation exists.

The agent must be able to provide reasonable evidence that the intended behavior works.

---

# FINAL RESPONSE RULE

After completing a prompt, provide a concise report containing:

## Completed

What was actually done.

## Verification

What was tested and the results.

## Documentation

What project documents were updated.

## Issues

Important issues discovered.

## Remaining

Anything intentionally deferred or still unknown.

## Checkpoint

Commit/checkpoint identifier.

Do not produce a long narrative unless the user asks for one.

---

# GOLDEN RULE

At every stage, ask:

> **"If another senior engineer reviewed this work tomorrow, could I defend every important decision with evidence?"**

If the answer is no:

**investigate further.**


# PROMPT -1 — AUDIT & OPTIMIZE THE AGENT OPERATING SYSTEM

## Command

`Run prompt -1`

---

# OBJECTIVE

Before performing any project takeover, audit and improve the project's agent operating system.

The agent operating system consists primarily of:

* `phases.md`
* `prompts.md`

These documents define how the AI agent is expected to investigate, understand, implement, test, verify, document, and maintain the project.

Your job in this prompt is to determine whether these documents are:

* logically consistent
* complete
* non-duplicative
* practical
* sufficiently rigorous
* correctly ordered
* internally consistent
* compatible with each other
* capable of guiding another AI agent reliably
* resistant to scope creep
* resistant to fake completion
* appropriate for long-term project development

If they are not, **fix them before proceeding**.

Do not assume the existing documents are correct merely because they already exist.

---

# IMPORTANT: THIS IS A META-AUDIT

You are not primarily auditing the application yet.

You are auditing the **instructions that will control future agents**.

Think of yourself as reviewing an internal engineering playbook before giving it to a large development team.

Your question is:

> "If a highly capable coding agent followed these documents literally for months, where could the system fail?"

Find those failure modes and fix them.

---

# STEP 1 — READ THE ENTIRE OPERATING SYSTEM

Read completely:

```text id="s9p2o4"
phases.md
prompts.md
```

Do not skim them.

Understand:

* every phase
* every prompt
* dependencies between phases
* expected outputs
* checkpoint requirements
* verification requirements
* documentation requirements
* scope boundaries
* quality gates

Also inspect whether the project already contains:

```text id="5x8x6j"
PROJECT.md
REQUIREMENTS.md
ARCHITECTURE.md
DECISIONS.md
DEFINITION_OF_DONE.md
KNOWN_ISSUES.md
PROJECT_AUDIT.md
FEATURE_MATRIX.md
IMPLEMENTATION_PLAN.md
VERIFICATION_REPORT.md
CHANGELOG.md
```

If they exist, understand how they relate to `phases.md` and `prompts.md`.

---

# STEP 2 — CHECK FOR CONTRADICTIONS

Look for contradictions between:

`phases.md`

and:

`prompts.md`

Examples:

* One says to commit after every phase while another says only after major work.
* One says to fix issues immediately while another says to defer them.
* One says requirements are authoritative while another assumes existing implementation is authoritative.
* One requires tests while another does not account for projects without tests.
* One requires a document that another never creates.
* One assumes a tool or technology that may not exist.
* One phase depends on information that is not established earlier.
* Two prompts perform the same work unnecessarily.
* A later prompt reverses a decision made by an earlier prompt.

Resolve contradictions.

---

# STEP 3 — CHECK THE PHASE ORDER

Determine whether the phases are in the correct dependency order.

The general lifecycle should resemble:

```text id="b4nq3m"
Understand
    ↓
Establish project knowledge
    ↓
Audit
    ↓
Inventory requirements/features
    ↓
Verify current behavior
    ↓
Identify improvements
    ↓
Plan
    ↓
Implement
    ↓
Test
    ↓
Verify
    ↓
Re-audit
    ↓
Final verification
    ↓
Handoff
```

This is a guideline, not a requirement to force the exact structure.

If the existing phases have a better structure, preserve it.

If they do not, improve them.

---

# STEP 4 — CHECK PROMPT COVERAGE

Every important phase should have a corresponding executable prompt.

Determine:

* Does every phase have a way to execute it?
* Are there prompts that have no meaningful phase?
* Are important activities missing?
* Are there redundant prompts?
* Are prompts too broad?
* Are prompts too narrow?
* Are prompts likely to cause unnecessary work?
* Are there gaps between audit → implementation → verification?

Identify missing capabilities.

---

# STEP 5 — CHECK THE AGENT'S DECISION AUTHORITY

This is extremely important.

Determine whether the documents clearly explain:

### What the agent may decide independently

For example:

* implementation details
* test structure
* small refactors
* appropriate file organization
* routine bug fixes

### What requires stronger evidence

For example:

* architectural changes
* database changes
* API contract changes
* security changes
* dependency changes

### What should require user clarification

For example:

* ambiguous product requirements
* conflicting business rules
* destructive migrations
* major product behavior changes
* irreversible decisions
* unclear acceptance criteria

If this distinction is missing, add it.

The goal is to prevent both:

> "The agent asks the user about every tiny decision."

and:

> "The agent makes major product decisions without asking."

---

# STEP 6 — CHECK REQUIREMENT DISCIPLINE

The operating system must clearly distinguish:

```text id="7g7m19"
Requirement
    ↓
Expected behavior
    ↓
Implementation
    ↓
Verification
```

The agent should never assume:

> "The code already does this, therefore this must be the requirement."

Ensure the documents explicitly distinguish:

* confirmed requirements
* inferred requirements
* existing behavior
* technical decisions
* assumptions
* unknowns

---

# STEP 7 — CHECK "DONE" CRITERIA

Determine whether the current system provides a strong definition of completion.

A feature should not become:

`COMPLETE`

simply because:

* code exists
* the page renders
* the endpoint responds
* the build passes
* one happy-path test passes

Ensure the system considers, where applicable:

* functionality
* integration
* persistence
* validation
* authorization
* error handling
* loading states
* empty states
* edge cases
* tests
* regression safety
* security
* performance
* accessibility
* documentation
* verification

If this is better handled by `DEFINITION_OF_DONE.md`, ensure `phases.md` and `prompts.md` explicitly defer to that document rather than duplicating it.

---

# STEP 8 — CHECK FAILURE HANDLING

Ask:

> What happens when the agent cannot complete something?

The operating system must tell the agent not to:

* hide failures
* fabricate results
* weaken tests
* disable validation
* silently skip requirements
* claim something is verified when it isn't
* create fake implementations

It should instead:

1. document the failure
2. explain the reason
3. distinguish verified from unverified
4. identify blockers
5. continue only where safe

Strengthen the instructions if necessary.

---

# STEP 9 — CHECK SCOPE CONTROL

The system should prevent two opposite problems.

### Problem A — Under-engineering

The agent does the minimum possible work and declares success.

### Problem B — Scope explosion

The agent discovers 50 issues and starts rewriting the entire application.

The instructions should establish:

> Complete the requested task properly, including necessary supporting work, but do not pursue unrelated improvements unless explicitly authorized or required for correctness.

If this principle is missing or unclear, add it.

---

# STEP 10 — CHECK DISCOVERED-ISSUE MANAGEMENT

Ensure there is a clear mechanism for issues discovered outside the current task.

The agent should:

```text id="3a6ym5"
Discover issue
     ↓
Classify it
     ↓
Document it
     ↓
Associate it with relevant requirement/phase
     ↓
Continue current task
```

unless the issue blocks safe completion.

This prevents both:

* forgetting discovered problems
* abandoning the current task every time something interesting is found

---

# STEP 11 — CHECK GIT / CHECKPOINT LOGIC

Review all Git instructions.

Ensure they clearly distinguish:

### Before work

* inspect working tree
* inspect branch
* preserve existing changes

### During work

* make coherent changes
* avoid unrelated modifications

### Before commit

* inspect diff
* run relevant verification
* check secrets
* confirm scope

### After commit

* report hash
* document meaningful changes

Ensure the system does not encourage:

* meaningless commits
* committing broken code
* committing secrets
* overwriting user changes
* destructive resets

---

# STEP 12 — CHECK DOCUMENTATION ARCHITECTURE

Make sure the documents have clearly separated responsibilities.

The intended relationship should approximately be:

```text id="ez2yfn"
PROJECT.md
    What is this?

REQUIREMENTS.md
    What should it do?

ARCHITECTURE.md
    How is it structured?

DECISIONS.md
    Why are important decisions the way they are?

DEFINITION_OF_DONE.md
    When is something complete?

phases.md
    How should the project be approached?

prompts.md
    What should the agent execute?

PROJECT_AUDIT.md
    What is the current technical state?

FEATURE_MATRIX.md
    What functionality exists and what is its status?

IMPLEMENTATION_PLAN.md
    What should be worked on next?

KNOWN_ISSUES.md
    What known problems remain?

VERIFICATION_REPORT.md
    What has actually been verified?

CHANGELOG.md
    What has changed over time?
```

If `phases.md` or `prompts.md` duplicates too much of these documents, simplify them.

Do not create multiple competing sources of truth.

---

# STEP 13 — CHECK FOR REDUNDANCY

Identify instructions repeated unnecessarily across:

* `phases.md`
* `prompts.md`
* `DEFINITION_OF_DONE.md`
* other project documents

Duplication is dangerous because the copies can drift apart.

Prefer:

> One authoritative rule + references to it.

For example:

Instead of defining the complete Definition of Done in three places:

```text id="p7z3mg"
prompts.md
phases.md
DEFINITION_OF_DONE.md
```

make:

`DEFINITION_OF_DONE.md`

the authority and have the other documents reference it.

---

# STEP 14 — CHECK FOR AMBIGUITY

Find vague instructions such as:

* "test thoroughly"
* "make it better"
* "ensure quality"
* "fix issues"
* "review the code"
* "optimize where necessary"

Where useful, turn vague instructions into observable behavior.

For example:

Instead of:

> Test thoroughly.

Use:

> Run the relevant automated tests, type checks, linting, build verification, and manual/end-to-end verification appropriate to the feature.

Do not over-specify trivial implementation details.

The goal is clear intent, not bureaucratic instructions.

---

# STEP 15 — CHECK FOR REAL-WORLD PROJECT VARIABILITY

The system should work across different projects.

Make sure instructions account for projects that may not have:

* frontend
* backend
* database
* automated tests
* type checking
* linting
* CI/CD
* Git
* end-to-end testing

The agent should apply applicable checks rather than pretending every project has every technology.

---

# STEP 16 — CHECK SECURITY AND DATA SAFETY

Ensure the operating system protects against:

* secrets being committed
* destructive commands
* destructive migrations
* accidental data deletion
* unsafe production changes
* weakening authorization
* exposing sensitive data
* modifying unrelated user work

Where a potentially destructive action is necessary, require appropriate verification and caution.

---

# STEP 17 — CHECK FOR AGENT FAILURE MODES

Think adversarially.

Ask:

> How could a mediocre agent technically follow these instructions while still producing a bad result?

Examples:

* It marks features complete because tests only cover the happy path.
* It creates tests that merely reproduce the implementation.
* It rewrites code unnecessarily.
* It documents assumptions as facts.
* It ignores requirements because the code already behaves differently.
* It fixes symptoms instead of root causes.
* It commits unrelated changes.
* It endlessly refactors instead of delivering functionality.
* It claims manual verification without actually performing it.
* It repeatedly rediscovers the same issues.
* It optimizes code without evidence.
* It introduces dependencies unnecessarily.
* It treats passing CI as proof the product works.

Strengthen the operating system against these failure modes.

---

# STEP 18 — IMPROVE THE FILES

After completing the audit, modify:

```text id="v4p5u2"
phases.md
prompts.md
```

where necessary.

You have explicit permission to:

* rewrite sections
* reorder sections
* merge redundant instructions
* remove contradictory instructions
* add missing safeguards
* improve prompt wording
* improve phase boundaries
* add missing prompts
* rename prompts where necessary
* change checkpoint rules where justified

However:

**Do not change the underlying project methodology merely for stylistic reasons.**

Every meaningful change should solve a real problem.

---

# STEP 19 — PRESERVE INTENT

Do not "optimize" the system by making it weaker.

The improved system should remain:

* rigorous
* evidence-based
* practical
* maintainable
* autonomous where appropriate
* cautious where appropriate
* resistant to scope creep
* resistant to fake completion
* easy for another agent to follow

---

# STEP 20 — SELF-REVIEW THE REVISED SYSTEM

After editing the files, read the revised versions again from beginning to end.

Do not assume the edits are correct.

Verify:

* phases are logically ordered
* prompts map to phases
* prompts do not contradict one another
* documentation responsibilities are clear
* quality gates are clear
* Git rules are clear
* failure handling is clear
* scope boundaries are clear
* user-clarification boundaries are clear
* requirements are authoritative
* verification is evidence-based
* no important safeguards were accidentally removed

---

# STEP 21 — CREATE A CHANGE REPORT

Create or update:

`AGENT_SYSTEM_AUDIT.md`

Document:

## Initial Assessment

What was wrong or missing.

## Changes Made

What changed in `phases.md`.

What changed in `prompts.md`.

## Important Improvements

Why the changes matter.

## Remaining Concerns

Anything that could not be resolved.

## Recommended Workflow

Explain the final intended sequence.

For example:

```text id="c3b0cw"
Prompt -1
    ↓
Prompt 0
    ↓
Prompt 1
    ↓
Prompt 2
    ↓
Prompt 3
    ↓
Prompt 4
    ↓
Prompt 5
    ↓
Prompts 6–12
    ↓
Prompt 13
    ↓
Prompt 14
    ↓
Prompt 15
    ↓
Prompt 16
    ↓
Prompt 17
    ↓
Prompt 18
```

Adjust this to match the actual revised system.

---

# STEP 22 — CHECKPOINT

After the revised `phases.md`, `prompts.md`, and `AGENT_SYSTEM_AUDIT.md` have been reviewed:

Inspect the Git diff.

Confirm that:

* only intended files changed
* no secrets were introduced
* no unrelated project code was changed
* the documents are internally consistent

Then create a checkpoint.

Suggested commit:

```text id="1i8lkm"
docs: audit and improve agent operating system
```

Report the commit hash.

---

# FINAL COMPLETION CRITERIA

Prompt -1 is complete only when:

* [ ] `phases.md` was read completely
* [ ] `prompts.md` was read completely
* [ ] Their relationship was audited
* [ ] Phase ordering was reviewed
* [ ] Prompt coverage was reviewed
* [ ] Requirements discipline was reviewed
* [ ] Definition of Done was reviewed
* [ ] Failure handling was reviewed
* [ ] Scope control was reviewed
* [ ] Issue tracking was reviewed
* [ ] Git/checkpoint rules were reviewed
* [ ] Documentation responsibilities were reviewed
* [ ] Redundancy was reviewed
* [ ] Ambiguity was reviewed
* [ ] Project variability was considered
* [ ] Security/data safety was reviewed
* [ ] Agent failure modes were considered
* [ ] Necessary improvements were made
* [ ] Revised files were read again
* [ ] `AGENT_SYSTEM_AUDIT.md` was created/updated
* [ ] Changes were verified
* [ ] A checkpoint was created

---

# IMPORTANT

Do **not** start Prompt 0 automatically after completing this prompt.

Prompt -1 ends after the agent operating system has been audited, improved, verified, and checkpointed.

The next action should be explicitly triggered with:

`Run prompt 0`



# PROMPT 0 — INITIAL TAKEOVER & PROJECT KNOWLEDGE SETUP

## Command

`Run prompt 0`

---

# OBJECTIVE

Take complete initial ownership of the project.

Before making substantial code changes, understand:

* what the project is
* why it exists
* who it is for
* what it is supposed to do
* what requirements it has
* how it is architected
* what currently exists
* what currently works
* what currently does not work
* what can be improved
* what decisions have already been made
* what constraints exist
* how the project should be maintained going forward

This is an **investigation and knowledge-establishment phase**.

Do not begin broad implementation or refactoring during this prompt.

The goal is to establish a reliable foundation for every future agent session.

---

# STEP 1 — READ THE AGENT METHODOLOGY

Before doing anything else, read:

* `phases.md`
* `prompts.md`

Understand the project's operating methodology.

These files define how this project should be investigated, implemented, tested, verified, and checkpointed.

If either file is missing:

* do not silently invent a replacement
* report that it is missing
* create it only if the user has explicitly instructed you to do so

---

# STEP 2 — INSPECT THE REPOSITORY

Perform a comprehensive repository reconnaissance.

Inspect:

* directory structure
* applications
* packages
* source code
* configuration
* environment configuration
* package manifests
* scripts
* build configuration
* deployment configuration
* CI/CD
* tests
* database
* migrations
* schemas
* APIs
* frontend
* backend
* authentication
* authorization
* routing
* state management
* business logic
* external integrations
* background jobs
* queues
* storage
* caching
* logging
* monitoring
* documentation

Identify:

* entry points
* critical execution paths
* core domain logic
* important shared utilities
* major dependencies
* high-risk areas
* highly coupled areas
* complex modules
* suspicious or unusual implementations

Read actual source code where necessary.

Do not make architectural conclusions based only on filenames.

---

# STEP 3 — UNDERSTAND THE PRODUCT

Determine what the project actually is.

Answer:

### What is this project?

Describe it clearly.

### What problem does it solve?

Describe the underlying problem.

### Who are the intended users?

Identify the users/personas if they can be determined.

### What are the core user journeys?

Identify the most important workflows.

### What are the project's goals?

Identify explicit and implicit goals.

### What are the project's non-goals?

Identify functionality the project intentionally does not attempt to provide.

### What are the important constraints?

Identify:

* technical constraints
* business constraints
* compatibility requirements
* infrastructure constraints
* external dependencies
* performance requirements
* security requirements
* regulatory requirements where explicitly documented

Do not invent requirements.

If something is uncertain, document it as uncertain.

---

# STEP 4 — ESTABLISH THE PROJECT KNOWLEDGE BASE

The project should have a persistent knowledge layer that future agents can rely on.

Check whether these files already exist:

```text
PROJECT.md
REQUIREMENTS.md
ARCHITECTURE.md
DECISIONS.md
DEFINITION_OF_DONE.md
KNOWN_ISSUES.md
CHANGELOG.md
```

If they exist:

* read them
* determine whether they are accurate
* identify stale or contradictory information
* preserve useful existing information
* update them where appropriate

If they do not exist, create them where appropriate based on the evidence available in the repository.

Do not fabricate information simply to fill sections.

Unknown information should be explicitly marked:

```text
UNKNOWN
```

or:

```text
NOT YET DETERMINED
```

---

# STEP 5 — CREATE/UPDATE PROJECT.md

`PROJECT.md` is the permanent high-level briefing document.

It should contain:

```md
# Project

## What Is This?

## Problem

## Target Users

## Core User Journeys

## Product Goals

## Non-Goals

## Current Status

## Important Constraints

## Technology Stack

## External Services

## Development Workflow

## Important Resources

## Product / Engineering Principles
```

Keep this document concise enough that a new agent can read it quickly.

It should answer:

> "What do I need to know before touching this project?"

---

# STEP 6 — CREATE/UPDATE REQUIREMENTS.md

`REQUIREMENTS.md` is the source of truth for what the software is expected to do.

Extract requirements from:

* existing documentation
* product specifications
* UI
* source code
* tests
* API contracts
* database structure
* configuration
* existing behavior

Do not treat every existing implementation as a requirement.

Distinguish between:

### Confirmed requirements

Explicitly supported by project documentation or clearly established behavior.

### Inferred requirements

Strongly suggested by the project but not explicitly documented.

### Unknown requirements

Cannot currently be determined.

Give important requirements stable IDs:

```text
R-001
R-002
R-003
```

Where possible, define acceptance criteria.

Example:

```md
## R-001 — User Registration

### Requirement

Users must be able to create an account.

### Acceptance Criteria

- ...
- ...
- ...

### Source

...
```

Do not invent acceptance criteria that have no basis.

---

# STEP 7 — CREATE/UPDATE ARCHITECTURE.md

Document how the system works.

Include:

## Architecture Overview

Describe the major components.

## Frontend

Describe:

* framework
* structure
* state
* routing
* important components

## Backend

Describe:

* framework
* services
* routes
* business logic

## Database

Describe:

* database technology
* major entities
* important relationships
* migrations

## Authentication

Describe the authentication architecture.

## Authorization

Describe permissions/access control.

## External Services

Describe important integrations.

## Data Flow

Explain important flows such as:

```text
User
→ Frontend
→ API
→ Business Logic
→ Database
→ Response
→ Frontend
```

## Architectural Rules

Document established patterns such as:

* where business logic belongs
* where database access belongs
* how APIs are structured
* how validation works
* how errors are handled
* how shared functionality is organized

Do not redesign the architecture in this step.

Document the architecture that actually exists.

---

# STEP 8 — CREATE/UPDATE DECISIONS.md

Identify important architectural and engineering decisions that have already been made.

Examples:

* framework choices
* database choice
* state management
* authentication strategy
* API strategy
* deployment strategy
* important abstractions
* deliberate exclusions
* important tradeoffs

For each known decision use:

```md
## DEC-001 — [Decision]

### Status

Accepted

### Decision

...

### Why

...

### Alternatives Considered

...

### Consequences

...
```

If the reason for an existing decision cannot be determined, say so.

Do not invent historical reasoning.

Future agents should use this document to avoid repeatedly reconsidering established decisions without cause.

---

# STEP 9 — CREATE/UPDATE DEFINITION_OF_DONE.md

Establish the project's quality gate.

Unless an existing project-specific standard says otherwise, ensure it covers:

```md
# Definition of Done

A feature is not complete merely because its implementation exists.

A feature is considered complete when appropriate:

- [ ] Requirements are understood
- [ ] Expected behavior is clear
- [ ] Implementation is complete
- [ ] Integration works
- [ ] Persistence works where applicable
- [ ] Authentication is correct
- [ ] Authorization is correct
- [ ] Validation exists
- [ ] Loading states are handled
- [ ] Empty states are handled
- [ ] Error states are handled
- [ ] Important edge cases are handled
- [ ] Tests exist where appropriate
- [ ] Existing tests pass
- [ ] Type checking passes
- [ ] Linting passes
- [ ] Build passes
- [ ] Critical workflows are verified
- [ ] Documentation is updated
- [ ] No known critical issues remain
- [ ] Changes are checkpointed

## Quality Review

Where relevant, also review:

- security
- reliability
- performance
- accessibility
- maintainability
- observability
```

Adapt this to the actual project.

Do not blindly add requirements that are irrelevant to the technology or product.

---

# STEP 10 — CREATE/UPDATE KNOWN_ISSUES.md

Document issues discovered during reconnaissance.

For each issue, record:

```md
## ISSUE-001 — [Short Description]

### Status

Open

### Severity

Critical / High / Medium / Low

### Description

...

### Evidence

...

### Impact

...

### Possible Cause

...

### Related Requirement

R-XXX

### Related Prompt / Phase

...

### Planned Resolution

...
```

Do not immediately fix everything.

This document exists so future agents know what is already known.

Avoid duplicate issues.

If an issue already exists, update it instead of creating another entry.

---

# STEP 11 — CREATE/UPDATE CHANGELOG.md

Record the initial takeover.

Do not create an enormous historical narrative.

Record:

* takeover date
* baseline state
* major discoveries
* documentation established
* checkpoint/commit

Future prompts should append meaningful changes to this file.

---

# STEP 12 — ESTABLISH THE TECHNICAL BASELINE

Determine the current baseline.

Run all appropriate project checks:

* tests
* typecheck
* lint
* formatting checks
* build
* database validation
* integration checks
* other project-specific checks

Record:

### Passing

What works.

### Failing

What fails.

### Unable to run

What could not be verified and why.

Do not hide baseline failures.

Do not modify tests simply to make the baseline pass.

---

# STEP 13 — GIT / CHECKPOINT INSPECTION

Determine whether the project uses Git.

Inspect:

* current branch
* working tree
* recent commits
* remotes if relevant
* ignored files
* untracked files

If there are pre-existing uncommitted changes:

**DO NOT overwrite, discard, reset, or modify them without understanding them.**

Clearly distinguish:

* changes created before this prompt
* changes created during this prompt

Do not commit unrelated user work.

Check for accidental sensitive files before committing.

Never commit:

* API keys
* passwords
* private certificates
* credentials
* sensitive `.env` files
* other secrets

unless the project's explicit workflow requires a safe non-secret representation.

---

# STEP 14 — DO NOT START BROAD IMPLEMENTATION

This prompt is primarily for:

* discovery
* documentation
* baseline verification
* project understanding

Do NOT:

* rewrite architecture
* refactor large sections
* implement unrelated features
* "clean up" the entire codebase
* change product behavior
* delete code merely because it looks unnecessary

If a change is absolutely required to establish the baseline, keep it minimal and document it.

---

# STEP 15 — UPDATE PROJECT AUDIT

Create/update:

`PROJECT_AUDIT.md`

Include:

## Project Overview

## Current Architecture

## Current Technology

## Current Feature Areas

## Current Testing

## Current Build/Deployment

## Current Technical Debt

## Current Risks

## Current Known Issues

## Initial Improvement Opportunities

## Unknowns / Questions Requiring Investigation

## Baseline Verification

Make clear which conclusions are:

* verified
* inferred
* unknown

---

# STEP 16 — IDENTIFY WHAT CAN BE IMPROVED

Even though broad implementation is not part of Prompt 0, explicitly identify improvement opportunities.

Ask:

> What is currently working but could be significantly better?

Look at:

* architecture
* code quality
* reliability
* security
* performance
* UX
* accessibility
* testing
* developer experience
* documentation
* maintainability
* observability
* deployment

Do not implement these improvements yet unless they are necessary for the baseline.

Record them for later phases.

This information will feed into:

`IMPLEMENTATION_PLAN.md`

during the later planning phase.

---

# STEP 17 — VERIFY THE KNOWLEDGE BASE

Before finishing Prompt 0, review all created/updated project documents.

Check for contradictions.

For example:

If `PROJECT.md` says:

> PostgreSQL

but `ARCHITECTURE.md` says:

> MongoDB

resolve the contradiction based on actual evidence.

If something cannot be resolved:

mark it as unknown rather than guessing.

Make sure:

* requirements are distinguishable from implementation
* decisions are distinguishable from assumptions
* known issues are distinguishable from future ideas
* verified facts are distinguishable from inferred information

---

# STEP 18 — FINAL PROMPT 0 REPORT

Before checkpointing, report internally/in the final response:

### Project

What the project is.

### Architecture

High-level architecture.

### Baseline

* tests
* typecheck
* lint
* build

### Feature Areas

Major areas discovered.

### Known Problems

Major known issues.

### Improvement Opportunities

Major areas that could be improved.

### Unknowns

Anything that requires further investigation.

### Documentation Created/Updated

List the project knowledge files.

### Git State

Current branch and working tree state.

---

# STEP 19 — CHECKPOINT

Only after:

1. investigation is complete
2. documentation is updated
3. baseline checks are recorded
4. changes are reviewed
5. accidental changes are removed
6. secrets are checked
7. the working tree is understood

create a checkpoint.

Suggested commit:

```text
audit: establish project baseline and knowledge base
```

If Git is unavailable, use the project's available checkpoint mechanism.

If no checkpoint mechanism exists, clearly report that.

---

# PROMPT 0 COMPLETION CRITERIA

Prompt 0 is complete only when:

* [ ] Repository has been inspected
* [ ] Project purpose is understood
* [ ] Core user journeys are understood
* [ ] Technology stack is understood
* [ ] Architecture is understood
* [ ] Major dependencies are understood
* [ ] Requirements have been documented
* [ ] Existing architectural decisions are documented where known
* [ ] Definition of Done exists
* [ ] Known issues are documented
* [ ] Project audit exists
* [ ] Baseline tests have been run
* [ ] Baseline typecheck has been run where applicable
* [ ] Baseline lint has been run where applicable
* [ ] Baseline build has been run
* [ ] Unknowns are explicitly documented
* [ ] Improvement opportunities are documented
* [ ] Git state has been inspected
* [ ] No unrelated user changes were overwritten
* [ ] Documentation is internally consistent
* [ ] A verified checkpoint has been created

---

# FINAL RULE

Do not finish Prompt 0 by saying:

> "The project looks good."

Instead, finish with an evidence-based understanding of:

**what the project is, what it should do, what it currently does, what is broken, what can be improved, what is unknown, and what should happen next.**

# PROMPT 1 — COMPLETE PROJECT RECONNAISSANCE

## Command

`Run prompt 1`

## Objective

Perform a deeper technical reconnaissance of the entire project.

## Instructions

Follow the relevant methodology in `phases.md`.

Inspect the repository comprehensively.

Map:

* frontend
* backend
* APIs
* database
* authentication
* authorization
* state
* routing
* business logic
* external services
* background jobs
* storage
* caching
* configuration
* deployment
* tests
* scripts
* shared utilities
* important domain modules

Identify:

* architectural boundaries
* critical execution paths
* high-risk areas
* highly coupled modules
* complex modules
* duplicated responsibilities
* suspicious implementations

Do not begin broad refactoring.

Update:

`PROJECT_AUDIT.md`

with the deeper findings.

## Completion criteria

The project's architecture and major technical components should be clearly documented.

## Checkpoint

Verify the documentation and any investigation scripts/checks.

Create:

```text
audit: complete project reconnaissance
```

---

# PROMPT 2 — BUILD THE COMPLETE FEATURE INVENTORY

## Command

`Run prompt 2`

## Objective

Determine what the project is actually supposed to do and what functionality currently exists.

## Instructions

Read:

* project documentation
* UI
* routes
* APIs
* schemas
* tests
* source code
* configuration

Identify every meaningful feature.

For each feature determine:

* intended behavior
* current implementation
* dependencies
* relevant files
* status
* tests
* missing pieces
* bugs
* verification evidence

Use statuses:

* COMPLETE
* PARTIAL
* BROKEN
* STUBBED
* MISSING
* DEAD/UNUSED
* NEEDS REFACTORING
* NEEDS TESTING
* UNKNOWN

Do not mark a feature COMPLETE without evidence.

Create/update:

`FEATURE_MATRIX.md`

## Completion criteria

There should be a comprehensive feature inventory covering the project's meaningful functionality.

## Checkpoint

Verify the feature matrix.

Create:

```text
audit: complete feature inventory
```

---

# PROMPT 3 — END-TO-END FEATURE AUDIT

## Command

`Run prompt 3`

## Objective

Determine whether the features in `FEATURE_MATRIX.md` actually work end-to-end.

## Instructions

For each important feature, trace:

```text
UI
→ state
→ API/client
→ server
→ authentication
→ authorization
→ validation
→ business logic
→ database
→ external services
→ response
→ state update
→ UI
```

Look for:

* fake implementations
* hardcoded data
* placeholders
* incomplete persistence
* incorrect queries
* broken relationships
* missing validation
* authorization problems
* frontend/backend mismatches
* stale state
* race conditions
* missing loading states
* missing empty states
* missing error states
* swallowed errors
* unreachable code
* dead code
* duplicated logic
* incomplete flows
* inaccessible functionality
* happy-path-only implementations

For every feature ask:

1. Does it exist?
2. Does it work?
3. Does it work end-to-end?
4. Does it work for the intended user?
5. Does persistence work?
6. Does failure handling work?
7. Are edge cases handled?
8. Is it secure?
9. Is it tested?
10. Is it maintainable?
11. Does it fit the architecture?
12. What can be improved?

Update:

`FEATURE_MATRIX.md`

and:

`PROJECT_AUDIT.md`

## Important

Do not fix everything yet.

This prompt is primarily for **finding and documenting problems**.

Only make changes required to safely investigate or reproduce issues.

## Checkpoint

Commit the completed audit:

```text
audit: complete end-to-end feature review
```

---

# PROMPT 4 — ARCHITECTURE & IMPROVEMENT AUDIT

## Command

`Run prompt 4`

## Objective

Answer the question:

> What can be improved?

Not only what is broken.

## Instructions

Perform a dedicated improvement audit.

Inspect:

### Architecture

* coupling
* cohesion
* abstractions
* responsibilities
* dependencies
* module boundaries
* circular dependencies
* layering
* architectural inconsistencies

### Code quality

* duplication
* naming
* complexity
* brittle logic
* magic values
* dead code
* outdated patterns
* difficult-to-test code

### Data

* schema quality
* queries
* indexes
* relationships
* integrity
* migrations
* duplication

### Frontend

* component boundaries
* state management
* unnecessary renders
* accessibility
* UX consistency
* forms
* validation
* loading/error/empty states

### Backend

* API design
* validation
* business logic
* transactions
* error semantics
* duplicated logic
* service boundaries

### Performance

* N+1 queries
* unnecessary requests
* expensive computation
* rendering
* payloads
* caching
* repeated work

### Reliability

* race conditions
* retries
* partial failures
* external service failures
* concurrency
* recovery

### Security

* authentication
* authorization
* validation
* data exposure
* injection
* secrets
* unsafe errors
* privilege escalation

### Maintainability

Ask:

> What would make this project painful for another senior engineer to maintain six months from now?

Document concrete improvements.

Do not implement every improvement yet.

Classify improvements by:

* critical
* high
* medium
* low
* optional

Update:

`PROJECT_AUDIT.md`

and:

`IMPLEMENTATION_PLAN.md`

## Checkpoint

Commit:

```text
audit: complete architecture and improvement review
```

---

# PROMPT 5 — CREATE THE IMPLEMENTATION PLAN

## Command

`Run prompt 5`

## Objective

Turn the findings into an executable implementation plan.

## Instructions

Read:

* `PROJECT_AUDIT.md`
* `FEATURE_MATRIX.md`
* `phases.md`

Create/update:

`IMPLEMENTATION_PLAN.md`

Organize work according to dependency and risk.

Prioritize:

1. correctness
2. data integrity
3. security
4. broken core functionality
5. architecture
6. missing functionality
7. reliability
8. tests
9. performance
10. maintainability
11. UX/polish

For each task document:

* task
* reason
* affected areas
* dependencies
* expected result
* verification method
* risk
* priority

Do not create unnecessary work merely to make the code "cleaner."

Distinguish:

* required work
* recommended improvements
* optional improvements

## Completion criteria

There should be a coherent implementation roadmap.

## Checkpoint

Commit:

```text
plan: establish implementation roadmap
```

---

# PROMPT 6 — IMPLEMENT THE NEXT PRIORITY

## Command

`Run prompt 6`

## Objective

Implement the next highest-priority item from `IMPLEMENTATION_PLAN.md`.

## Instructions

Select the next appropriate task.

Before modifying anything:

* understand the relevant code
* identify dependencies
* inspect related tests
* understand expected behavior
* determine regression risk

Implement the solution properly.

Do not use:

* fake functionality
* placeholders
* weakened validation
* production mocks
* shortcuts that create technical debt

Add or update tests.

Run relevant:

* tests
* typecheck
* lint
* build

Manually verify important behavior when appropriate.

Update:

* `FEATURE_MATRIX.md`
* `IMPLEMENTATION_PLAN.md`
* `PROJECT_AUDIT.md`

## Completion criteria

The selected task is genuinely implemented and verified.

## Checkpoint

Inspect the diff and commit:

```text
feat: implement [task]
```

Replace `[task]` with a concise description.

---

# PROMPT 7 — CONTINUE IMPLEMENTATION

## Command

`Run prompt 7`

## Objective

Continue working through the implementation plan.

## Instructions

Repeat the process from Prompt 6.

Select the next highest-priority unfinished item.

Do not skip dependencies.

Do not work on low-priority polish while critical functionality remains broken.

For every completed task:

* implement
* test
* verify
* document
* checkpoint

Continue until the current logical batch is complete.

If a task reveals a larger architectural problem:

1. stop the unsafe implementation
2. document the discovery
3. update the implementation plan
4. determine the correct dependency order
5. continue only when the path is clear

## Checkpoint

Commit coherent completed work:

```text
feat: implement [task]
```

---

# PROMPT 8 — USER JOURNEY / REAL-WORLD QA

## Command

`Run prompt 8`

## Objective

Test the application like a real user rather than merely inspecting code.

## Instructions

Identify the most important user journeys.

For each journey verify:

* entry point
* navigation
* authentication
* permissions
* forms
* validation
* loading
* success
* persistence
* refresh
* errors
* empty states
* repeated actions
* unusual inputs
* boundary conditions

Test both:

### Happy paths

and:

### Failure paths

Record discovered issues.

Fix issues that belong to the current scope.

Update:

`FEATURE_MATRIX.md`

and:

`VERIFICATION_REPORT.md`

## Checkpoint

After verification and fixes, commit:

```text
test: verify critical user journeys
```

---

# PROMPT 9 — SECURITY & RELIABILITY AUDIT

## Command

`Run prompt 9`

## Objective

Perform a dedicated security and reliability review.

## Instructions

Audit:

* authentication
* authorization
* access control
* input validation
* sensitive data
* secrets
* API boundaries
* injection risks
* client trust
* privilege escalation
* file handling
* external integrations
* error handling
* concurrency
* race conditions
* duplicate operations
* data consistency
* retries
* partial failures
* destructive operations
* transaction boundaries

Identify concrete risks.

Fix appropriate issues.

Do not make unsupported claims about security.

Document:

* finding
* severity
* evidence
* impact
* fix
* verification

Update:

`VERIFICATION_REPORT.md`

## Checkpoint

After fixes and verification:

```text
security: audit security and reliability
```

---

# PROMPT 10 — PERFORMANCE & MAINTAINABILITY PASS

## Command

`Run prompt 10`

## Objective

Improve performance and maintainability where there is evidence that improvement is worthwhile.

## Instructions

Inspect:

* database queries
* API requests
* rendering
* computation
* caching
* payload sizes
* unnecessary work
* bundle size where relevant
* dependencies
* duplication
* complexity
* module boundaries

Do not optimize blindly.

Do not introduce unnecessary complexity for theoretical performance gains.

For every significant optimization ask:

> What problem does this solve?

and:

> How will we verify the improvement?

Also address high-value maintainability issues.

Add/update tests as needed.

Update project documentation.

## Checkpoint

Commit:

```text
perf: improve performance and maintainability
```

or use `refactor:` when appropriate.

---

# PROMPT 11 — TEST COVERAGE & REGRESSION PASS

## Command

`Run prompt 11`

## Objective

Ensure important functionality is protected against regression.

## Instructions

Review:

* existing tests
* missing critical tests
* unit coverage
* integration coverage
* API coverage
* database coverage
* end-to-end coverage

Prioritize tests around:

* critical business logic
* important user journeys
* authentication
* authorization
* persistence
* failure handling
* important edge cases
* previously broken functionality

Do not write meaningless tests simply to increase test counts.

Tests should provide real protection.

Run the broader test suite.

Fix regressions discovered.

Update:

`VERIFICATION_REPORT.md`

## Checkpoint

Commit:

```text
test: strengthen regression coverage
```

---

# PROMPT 12 — CLEANUP & DOCUMENTATION

## Command

`Run prompt 12`

## Objective

Prepare the project for long-term maintainability.

## Instructions

Inspect for:

* TODOs
* FIXMEs
* placeholders
* temporary code
* debug code
* dead code
* stale comments
* misleading documentation
* outdated setup instructions
* unnecessary dependencies
* inconsistent naming
* duplicated logic

Remove or resolve items where safe.

Update documentation so it reflects the actual project.

Do not remove TODOs simply to make the search clean.

If a TODO represents legitimate future work, record it appropriately.

Ensure:

* setup instructions work
* development commands are accurate
* environment requirements are clear
* architecture documentation reflects reality
* important decisions are documented

## Checkpoint

Commit:

```text
chore: complete project cleanup and documentation
```

---

# PROMPT 13 — FULL INDEPENDENT RE-AUDIT

## Command

`Run prompt 13`

## Objective

Pretend you are a completely new senior engineer who has never worked on this project.

Audit the entire project again.

Do NOT assume previous conclusions are correct.

Read:

* requirements
* `PROJECT_AUDIT.md`
* `FEATURE_MATRIX.md`
* `IMPLEMENTATION_PLAN.md`
* `VERIFICATION_REPORT.md`

Then independently inspect the implementation.

Ask:

> Can I prove this actually works?

For every major feature verify:

* implementation
* integration
* persistence
* error handling
* permissions
* edge cases
* tests
* real-world behavior

Search again for:

* TODO
* FIXME
* placeholder
* mock
* fake
* stub
* hardcoded
* temporary
* debug
* commented-out implementation
* swallowed errors
* ignored errors
* incomplete branches
* unreachable code
* suspicious shortcuts

Run:

* tests
* typecheck
* lint
* build
* relevant integration checks
* relevant end-to-end checks

Identify anything that was missed.

Do not immediately fix every discovery.

First document the findings.

Update:

`PROJECT_AUDIT.md`

`FEATURE_MATRIX.md`

`IMPLEMENTATION_PLAN.md`

`VERIFICATION_REPORT.md`

## Checkpoint

Commit:

```text
audit: complete independent project re-audit
```

---

# PROMPT 14 — FIX FINAL AUDIT FINDINGS

## Command

`Run prompt 14`

## Objective

Resolve the issues discovered during Prompt 13.

## Instructions

Read the findings from the independent audit.

Prioritize:

1. critical correctness
2. security
3. data integrity
4. broken functionality
5. reliability
6. important tests
7. maintainability
8. performance
9. polish

Implement fixes properly.

For each fix:

* identify root cause
* implement solution
* test
* verify
* update documentation

Do not introduce unrelated changes.

## Checkpoint

Commit:

```text
fix: resolve final audit findings
```

---

# PROMPT 15 — FINAL VERIFICATION

## Command

`Run prompt 15`

## Objective

Perform the final production-readiness verification.

## Instructions

Run the complete available verification suite.

At minimum, where applicable:

* tests
* typecheck
* lint
* formatting checks
* build
* migrations/validation
* integration tests
* end-to-end tests

Verify critical user journeys.

Inspect the final Git diff.

Confirm:

* no accidental changes
* no secrets
* no temporary debugging code
* no unfinished critical functionality
* no misleading documentation
* no unresolved critical issues

Review:

`FEATURE_MATRIX.md`

Every feature must have a defensible status.

Review:

`IMPLEMENTATION_PLAN.md`

Identify what remains and why.

Review:

`VERIFICATION_REPORT.md`

Ensure it accurately describes the current state.

Do not claim "everything is perfect."

Report remaining known limitations honestly.

---

# PROMPT 16 — FINAL PROJECT HEALTH REPORT

## Command

`Run prompt 16`

## Objective

Produce the final project handoff report.

Update:

`VERIFICATION_REPORT.md`

Include:

## Executive Summary

* original state
* major discoveries
* major changes
* current state

## Feature Status

For every major feature:

* status
* implementation
* verification evidence
* remaining issues

## Bugs

For each important bug:

* severity
* root cause
* fix
* verification

## Improvements

Include:

* architecture
* code quality
* security
* reliability
* performance
* UX
* maintainability

## Testing

Include:

* tests added
* tests changed
* tests run
* results
* remaining coverage gaps

## Verification

Include:

* build
* typecheck
* lint
* tests
* integration
* end-to-end
* manual verification

## Remaining Risks

Be explicit about uncertainty.

## Future Work

Separate:

* important future work
* optional improvements
* speculative ideas

Do not inflate the report.

## Final checkpoint

After the final verification succeeds, create:

```text
verify: complete project takeover
```

This is the final checkpoint for the takeover process.

---

# PROMPT 17 — FINAL "WHAT CAN BE IMPROVED?" REVIEW

## Command

`Run prompt 17`

## Objective

Perform one final improvement-oriented review after everything is supposedly complete.

This is intentionally separate from bug hunting.

Ask:

> If this project were handed to a highly experienced engineering team tomorrow, what would they improve?

Review:

* architecture
* developer experience
* maintainability
* user experience
* reliability
* performance
* testing
* security
* observability
* documentation
* deployment
* scalability

Separate findings into:

### Must improve

Things that materially affect correctness, reliability, security, maintainability, or user experience.

### Should improve

High-value improvements that are not blockers.

### Nice to have

Optional improvements.

### Do not change

Existing areas that are already good and should be left alone.

Do not make changes merely for the sake of making changes.

Only implement improvements that are justified.

Update:

`PROJECT_AUDIT.md`

and:

`IMPLEMENTATION_PLAN.md`

If meaningful improvements are identified, implement them only when appropriate and verify them.

## Final checkpoint

If changes were made:

```text
refactor: complete final improvement review
```

If no changes were necessary, create a verification checkpoint only if needed.

---

# PROMPT 18 — FINAL STATUS

## Command

`Run prompt 18`

## Objective

Give the user a concise final status report.

Do not dump the entire audit into the response.

Report:

### Project status

Current overall state based on evidence.

### Features

* complete
* partial
* broken
* missing
* remaining

### Verification

* tests
* typecheck
* lint
* build
* integration
* end-to-end

### Major improvements

List the most important changes.

### Remaining issues

List anything that still requires attention.

### Final checkpoint

Provide the final commit/checkpoint hash.

### Important

Do not say:

> "Everything is perfect."

Do not say:

> "100% complete."

unless there is genuinely objective evidence supporting such a claim.

Instead report the actual state and remaining uncertainty.

---

# QUICK COMMAND REFERENCE

Use these commands during the project takeover:

| Command         | Purpose                          |
| --------------- | -------------------------------- |
| `Run prompt 0`  | Initial takeover                 |
| `Run prompt 1`  | Full reconnaissance              |
| `Run prompt 2`  | Feature inventory                |
| `Run prompt 3`  | End-to-end feature audit         |
| `Run prompt 4`  | Architecture & improvement audit |
| `Run prompt 5`  | Implementation plan              |
| `Run prompt 6`  | Implement next priority          |
| `Run prompt 7`  | Continue implementation          |
| `Run prompt 8`  | Real-world QA                    |
| `Run prompt 9`  | Security & reliability           |
| `Run prompt 10` | Performance & maintainability    |
| `Run prompt 11` | Test & regression pass           |
| `Run prompt 12` | Cleanup & documentation          |
| `Run prompt 13` | Independent re-audit             |
| `Run prompt 14` | Fix final audit findings         |
| `Run prompt 15` | Final verification               |
| `Run prompt 16` | Final health report              |
| `Run prompt 17` | Final improvement review         |
| `Run prompt 18` | Final status                     |

---

# IMPORTANT: HOW TO HANDLE NEW USER REQUESTS

After the initial takeover, the user may give you normal development requests.

For example:

> "Add dark mode."

Do not abandon the project's methodology.

Before implementing the request:

1. Understand the requirement.
2. Inspect the existing architecture.
3. Determine where the feature belongs.
4. Check whether related functionality already exists.
5. Consider effects on existing features.
6. Implement coherently.
7. Add tests where appropriate.
8. Verify.
9. Update the relevant project documentation.
10. Create a checkpoint.

If the request conflicts with the existing architecture, explain the tradeoff before making a major architectural change.

---

# IMPORTANT: CHECKPOINT DISCIPLINE

A checkpoint is not permission to commit broken code.

The sequence is:

```text
Investigate
    ↓
Plan
    ↓
Implement
    ↓
Test
    ↓
Verify
    ↓
Inspect diff
    ↓
Checkpoint
```

Never:

```text
Implement
    ↓
Commit
    ↓
Hope it works
```

Every meaningful checkpoint should represent a coherent, recoverable state.

---

# THE GOLDEN RULE

At every stage, ask yourself:

> **"If another senior engineer reviewed this work tomorrow, could I defend every important decision with evidence?"**

If the answer is no:

**investigate further.**
