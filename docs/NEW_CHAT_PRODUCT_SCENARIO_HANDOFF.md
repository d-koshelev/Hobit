# New Chat Product Scenario Handoff

## Current Project Status

Hobit is a modular AI Workbench. The Workbench remains the product center and
every visible product block is a widget.

The current Queue + Workers work has reached a handoff point. Queue is now the
primary orchestration surface for queue items, queue tags, workers, embedded
executor management, reports, validation review, diff reviews, coordinator
decisions, and results. Standalone Agent Executor may remain temporarily as a
compatibility/debug surface, but it is no longer the primary product workflow
surface for Queue work.

Current Queue behavior is frozen in `docs/QUEUE_PRODUCT_HANDOFF.md`.

## Goal Of The Next Chat

The next chat should focus on product scenario design, not immediate coding.

Use a doc-first workflow:

- read `AGENTS.md`, `docs/ACTIVE_CONTRACT_INDEX.md`,
  `docs/CURRENT_WIDGET_SURFACE.md`, and `docs/QUEUE_PRODUCT_HANDOFF.md`;
- design the end-to-end operator scenario before implementation;
- update or create contracts/decisions before changing runtime behavior;
- turn implementation into Queue items/sub-blocks with acceptance criteria.

## Available Tools Assumption

Future Hobit work should be planned through:

- Hobit itself as the Workbench/Queue planning surface;
- ChatGPT in browser for product scenario design and review.

Do not jump straight into code from an underspecified feature idea.

## Expected First Deliverables

The first deliverables in the new chat should be:

- primary product scenario;
- operator workflow;
- Queue acceptance walkthrough;
- contracts/decisions;
- implementation Queue plan.

## Queue Planning Reminder

Future implementation should be planned as Queue items/sub-blocks before code.
Large or risky requests should be split before execution. Incomplete work
should create a follow-up/sub-block, and the original Queue item should remain
not finalized until the coordinator accepts the final state.

No hidden execution, hidden context access, automatic acceptance, rollback
execution, process kill, Git mutation, storage/schema change, or new runtime
behavior should be introduced without an approved product scenario, contract,
Queue plan, and acceptance criteria.
