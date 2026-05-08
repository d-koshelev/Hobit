# Roadmap

This roadmap defines the intended foundation order for Hobit. Early phases establish product contracts and repository structure, and current implementation work continues to exercise those contracts through the Workbench shell.

## Phase 0: Contracts And Repository Foundation

- Define the AI Workbench product contract.
- Define widget, preset, UI, runtime, tool action, and event contracts.
- Establish repository hygiene with `.gitignore` and documentation structure.

## Phase 1: Clean Monorepo Skeleton

- Create the initial repository layout for staged product implementation.
- Establish workspace boundaries for desktop app, core crates, storage, agent runtime, tools, app orchestration, and frontend modules.
- Keep the desktop shell and core crates in the root validation path.

## Phase 2: Design System

- Define the visual and interaction rules for workbench UI.
- Create reusable components for panels, toolbars, approvals, activity, and widget containers.
- Keep UI simple, readable, and non-duplicative.

## Phase 3: Workbench Shell

- Implement the base workbench surface.
- Support visible widget regions, current task context, operator awareness, and approval surfaces.
- Keep the shell independent from any single capability.

## Phase 4: Widget Registry And Presets

- Define widget registration and instantiation.
- Support reusable widget templates and rules.
- Save and load presets as compositions of widget instances and layout.

## Phase 5: Minimal Workbench With Terminal + Agent CLI

- Implement the minimal valid product.
- Provide a Terminal Widget and Agent CLI Widget.
- Prove that the workbench can host an agent-facing and operator-facing task surface without overbuilding optional capabilities.

## Phase 6: Shared State And Event Model

- Add shared workbench state.
- Route widget events, agent activity, action proposals, decision requests, and tool results through a common event model.
- Keep widgets decoupled from each other.

## Phase 7: Agent Runtime Integration

- Connect the agent runtime to workbench context, available capabilities, activity events, proposals, tool requests, and results.
- Preserve the rule that the agent does not own the UI.
- Make approval requirements explicit.

## Phase 8: Optional Capability Widgets

- Add capability widgets as needed:
  - Stages
  - Knowledge
  - Runbooks
  - Git
  - Database/JDBC
  - SQL Results
  - Image Edit
  - Agent Activity
  - Shared State

## Early Non-Goals

- No real JDBC integration yet.
- No real image editing yet.
- No full drag-and-drop layout editor yet.
- No Knowledge Catalog implementation yet.
- No Runbook engine yet.
- No attempt to make Knowledge, Stages, or Runbooks the product center.
