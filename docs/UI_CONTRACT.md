# UI Contract

## Core Rules

- No clutter.
- No duplicated information.
- Show only information needed right now.
- Every UI block has one responsibility.
- Every visible UI block is a widget.
- Each UI block must be self-contained.

## Operator Awareness

The operator must always understand:

- where they are
- what they are working on
- what the agent is doing
- what needs approval

This awareness must come from the workbench surface itself, not from hidden logs or scattered state.

## Responsibility Boundaries

Each widget should own one clear responsibility. A widget may summarize adjacent context, but it must not duplicate another widget's primary responsibility. Visible grouping must serve operator understanding, not decoration. Avoid unnecessary internal subdivision.

Examples:

- Agent Activity shows what the agent is doing.
- Terminal shows shell interaction and terminal state.
- Agent CLI shows agent conversation or command interaction.
- Shared State shows selected shared state objects.
- Decision Request surfaces show approval needs.

## Approval Visibility

Actions that need approval must be explicit and visible. The UI must show the action purpose, risk, expected output, and available operator decisions.

## Design System Reference

UI work must also follow `DESIGN_SYSTEM_CONTRACT.md`.

This UI contract defines behavioral clarity. The design system contract defines visual consistency.
