# Agent UI Implementation Rules

## Purpose

This contract defines the mandatory workflow for future agent prompts that
touch Hobit UI.

It is a docs/contracts-only agent workflow contract. It does not implement
frontend UI, CSS, shared primitives, runtime behavior, backend commands, Tauri
commands, storage/schema changes, widget behavior, tests, or validation
automation.

These rules apply to any frontend, widget, popup, surface, product overview,
visual polish, component, CSS, layout, action, or responsive behavior task.
They are project-level rules, not a one-off KnowledgeV2 rule.

## Pre-Implementation Requirements

Before changing UI, the agent must:

- Read `docs/UI_DESIGN_SYSTEM_CONTRACT.md`.
- Read the affected widget/domain contract named by
  `docs/ACTIVE_CONTRACT_INDEX.md`.
- Inspect existing shared primitives and patterns before adding local UI.
  Start with `docs/UI_SHARED_PRIMITIVES_INDEX.md` when available, then inspect
  the relevant frontend shared/component folders and nearby surfaces.
- Identify the target surface, target display level when relevant, and the
  current pattern it should follow.
- State whether the new or changed UI uses an existing shared primitive. If it
  does not, state why the existing primitive is insufficient and whether a new
  shared primitive is warranted.
- Keep the smallest relevant context set. Do not broaden the block into a
  visual redesign, new widget, new runtime behavior, or new product capability
  unless the prompt explicitly requests that scope.

## Mandatory UI Acceptance Checks

Before accepting UI work, the agent must verify the affected surface has:

- No zero-padding product surfaces.
- No overflow without a visible, bounded scroll path.
- No clipped footer actions in popups, drawers, forms, panels, or compact
  widget states.
- No touching or overlapping controls.
- No raw/debug text in product overview surfaces.
- No hidden action, hidden context attachment, hidden execution, hidden
  mutation, hidden persistence, hidden dispatch, or hidden network effect.
- No destructive or external-effect action without confirmation.
- No action on render, selection, hover, tab change, details expansion, popup
  open, refresh, or route load.

These checks are required for both normal and constrained sizes when the
surface is resizable or responsive.

## Required Tests And Validation

UI implementation blocks must use the smallest validation set that proves the
change, then report exactly what ran.

Required validation expectations:

- Add or update focused component tests when the current test stack supports
  the changed behavior, state, action availability, or rendering boundary.
- Avoid brittle pixel-perfect tests. Prefer semantic assertions around visible
  labels, actions, disabled states, confirmations, overflow containers,
  accessibility roles, and state transitions.
- Include accessibility and focus checks where the current test stack supports
  them, especially for popups, menus, destructive confirmations, keyboard
  close behavior, and action disabling.
- Run typecheck, build, and diff checks appropriate to the block.
- Run the repo file-size check when available, especially when adding or
  expanding frontend component files.
- Use Hobit Toolbelt validation profiles when they fit the block, and do not
  silently weaken required final validation.

At minimum, UI tasks should report:

- `git status --short --branch`
- `git diff --stat`
- `git diff --check`
- Relevant frontend typecheck/build/test commands, or why they were not run.
- File-size check result when available, or why it was not run.

## Required UI Task Report Section

Final reports for UI tasks must include a UI workflow section covering:

- Shared primitives used.
- Local CSS added and why.
- Responsive behavior.
- Overflow behavior.
- Actions, disabled states, and destructive states.
- Manual smoke checklist results.

The manual smoke checklist must mention the affected surface directly and
state whether each relevant acceptance check passed, failed, or was not
applicable.

## Future Prompt Boilerplate

Future prompt packs that touch UI may include this boilerplate:

```text
UI workflow requirements:
- Read docs/UI_DESIGN_SYSTEM_CONTRACT.md and the affected widget/domain
  contract before implementation.
- Inspect docs/UI_SHARED_PRIMITIVES_INDEX.md and existing shared primitives
  before adding local UI or CSS.
- Identify the target surface, target display level, and current UI pattern.
- State whether the change uses shared primitives; if not, explain why.
- Acceptance checks: no zero padding, no overflow without scroll, no clipped
  footer actions, no touching controls, no raw/debug text in product overview,
  no hidden action, no destructive action without confirmation, and no action
  on render.
- Validation: focused component tests where supported; no brittle
  pixel-perfect tests; accessibility/focus checks where supported;
  typecheck/build/diff check; file-size check if available.
- Final report must include shared primitives used, local CSS added and why,
  responsive behavior, overflow behavior, actions/disabled/destructive states,
  and a manual smoke checklist.
```

## Non-Goals

This contract does not add:

- Frontend implementation.
- CSS implementation.
- New shared primitives.
- Runtime behavior.
- Backend, Tauri, storage, or schema changes.
- New widgets or widget insertion behavior.
- New test runner behavior.
- New validation automation.
