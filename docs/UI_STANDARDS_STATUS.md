# UI Standards Status

Status: docs-only project-level UI standards block record.

## Purpose

This document records the project-level UI standards and hard-rules work
completed in the UI standards block.

It does not implement frontend behavior, CSS, shared primitives, backend
behavior, Tauri commands, Rust changes, storage/schema changes, tests,
validation automation, widget behavior, or runtime behavior.

## Created Documents

- `docs/UI_STANDARDS_CURRENT_STATE_AUDIT.md` records the current UI consistency
  audit, existing shared primitive foundation, high-traffic surface notes,
  one-off patterns to forbid or discourage, and recommended primitive backlog.
- `docs/UI_DESIGN_SYSTEM_CONTRACT.md` defines the project-level UI design
  system contract for dense operator-focused surfaces, spacing, layout,
  popups, lists, actions, status, context attachment, and agent-generated UI.
- `docs/UI_SHARED_PRIMITIVES_INDEX.md` inventories reusable frontend
  primitives and current high-traffic surface patterns that future agents must
  inspect before adding local UI or CSS.
- `docs/AGENT_UI_IMPLEMENTATION_RULES.md` defines the mandatory workflow for
  future UI implementation and polish blocks, including shared primitive
  inspection, acceptance checks, focused validation, and required report fields.
- `docs/UI_STANDARDS_REVIEW_AND_SELF_TEST_BACKLOG.md` records review checklist
  items, self-test candidates, possible future enforcement layers, and manual
  smoke expectations for UI standards.

## Hard Product Decision

UI consistency is a project-level requirement for all future Hobit UI work. It
is not a one-off KnowledgeV2 cleanup rule and must apply across Workspace
Agent, Agent Queue, Terminal, Agent Activity, Notes, Knowledge / Skills,
Finder, Database / JDBC Preview, Runbook Preview, widget chrome, popups,
catalogs, details surfaces, and future approved widget work.

Future agents must use shared primitives, shared theme tokens, and existing
surface patterns before introducing local UI structure or CSS. Local one-off
patterns are allowed only when the domain shape is genuinely unique or a
missing primitive is documented as a follow-up.

Zero-padding and edge-touching product UI are forbidden. Dense operator UI must
still use deliberate spacing, visible gaps, bounded output surfaces, and
readable controls. Controls must not touch or overlap.

Bounded popups are mandatory. Popups, action menus, drawers, details overlays,
and confirmations must stay inside the viewport, use a scrollable body for long
content, keep final actions reachable, and use a visible close path.

Row, destructive, and action patterns are standardized. Row selection or
details opening must not execute or mutate. Multiple row actions should use a
clear row action menu. Destructive or external-effect actions require explicit
confirmation. Disabled or unavailable actions must be explained or omitted
when showing them would imply unimplemented behavior is available.

## Recommended Next Implementation Blocks

1. Shared UI primitive hardening.
   Harden or extract shared primitives for `ActionMenu`, `ConfirmationPopup`,
   `StateBlock`, `DataList` / `DataTable`, `StatusChip`, `FormField`,
   `FactGrid`, `DetailsPanel`, and reusable action groups.

2. Global min spacing implementation.
   If not already implemented in code, enforce baseline spacing rules through
   shared component CSS and shell primitives so normal product surfaces cannot
   collapse into zero-padding or edge-touching controls.

3. Bounded popup guard hardening.
   Strengthen `PopupShell` / `WidgetPopupShell` usage and guards so long popup
   content scrolls in the body, footer actions remain reachable, viewport
   margins are preserved, and risky or unsaved flows do not close silently.

4. Action menu and confirmation primitive consolidation.
   Consolidate local row menus, destructive confirmations, stop/kill/delete/
   discard/push confirmations, and disabled-action reason patterns around
   shared primitives.

5. UI validator and self-test integration.
   Add focused validation only after the accepted enforcement approach is
   chosen. Candidate checks include popup bounds, topbar spacing, row action
   menu behavior, disabled-action reasons, destructive confirmations, no raw
   debug data in primary UI, and narrow/small-widget overflow behavior.

## Manual Review Checklist

Use this checklist when reviewing future UI changes:

- The affected surface uses `WidgetFrame`, `WidgetV2Shell`, `PopupShell`,
  `WidgetPopupShell`, shared controls, shared badges/status primitives, shared
  empty-state patterns, or an explicitly justified local pattern.
- Product surfaces have deliberate padding and gaps; no zero-padding or
  edge-touching controls are present.
- Header, controls, content, and footer read as one continuous product surface,
  without unnecessary box-inside-box composition.
- Popups, menus, drawers, and overlays are bounded to the viewport, have
  scrollable bodies for long content, and keep footer actions reachable.
- Row click, selection, tab change, popup open, details expansion, hover, and
  render do not execute, mutate, persist, attach context, dispatch, delete, or
  trigger external effects.
- Row actions are compact and standardized; multiple actions use one row action
  menu where appropriate.
- Destructive and external-effect actions require explicit confirmation before
  mutation.
- Disabled, unavailable, partial, unsupported, blocked, failed, loading, and
  empty states are distinct, operator-facing, and do not overclaim deferred
  behavior.
- Raw JSON, stack traces, backend command names, internal IDs, raw payloads,
  implementation flags, and developer diagnostics are hidden behind explicit
  developer details.
- Context attachment requires explicit target selection when more than one
  target could receive context, and attach results are visible before any
  send/run path.
- Narrow and small-widget layouts avoid overlap, clipped action labels,
  inaccessible controls, unbounded raw output, and unreachable popup actions.

## Intentionally Not Implemented

This status block intentionally does not implement code, CSS, frontend
components, backend behavior, Tauri commands, Rust changes, storage/schema
changes, tests, validation automation, widget behavior, runtime behavior,
manual commits, or pushes.
