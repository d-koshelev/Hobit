# Hobit Design System Contract

## Purpose

This contract defines the baseline visual language for Hobit's AI Workbench, widgets, presets, and future capability surfaces.

Visual design is not ad-hoc styling. Every UI contribution must comply with `UI_CONTRACT.md`, `WIDGET_CONTRACT.md`, and `DESIGN_SYSTEM_CONTRACT.md`.

The contract exists to keep Hobit simple, coherent, and render-quality as the widget catalog grows.

## Visual Identity

Hobit should feel like:

- a modular AI Workbench
- an operator control surface
- a calm dark desktop UI
- a SuperOverlay-like telemetry and workbench surface
- a product-grade widget system
- precise and technical, but not cluttered

Hobit should not look like:

- an IDE clone
- a terminal-only product
- a dense enterprise admin dashboard
- a generic SaaS dashboard
- a chat app with panels attached
- a colorful analytics toy

## Theme Baseline

Hobit is dark-first.

The baseline theme uses:

- charcoal and graphite backgrounds
- subtle blue/cyan primary accent
- restrained contrast
- soft borders
- restrained shadows
- no random bright colors
- no rainbow dashboard styling

The UI should be readable and high-contrast, but not harsh.

## Locked Theme Palette

The frontend base palette is locked. Raw color values are only allowed in `apps/desktop/frontend/src/styles/hobit-theme.css`.

Base:

- `--hb-bg-app`: `#05080e`
- `--hb-bg-topbar`: `#05080e`
- `--hb-bg-canvas`: `#0b0f19`

Surfaces:

- `--hb-surface-widget`: `#11161d`
- `--hb-surface-widget-raised`: `#171c24`
- `--hb-surface-panel`: `#181e26`
- `--hb-surface-panel-raised`: `#1e232d`
- `--hb-surface-input`: `#12171d`
- `--hb-surface-output`: `#04070d`

Borders:

- `--hb-border-subtle`: `#262b34`
- `--hb-border-default`: `#2b3541`
- `--hb-border-strong`: `#3f4a60`

Text:

- `--hb-text-primary`: `#f4f7fa`
- `--hb-text-secondary`: `#c0cad9`
- `--hb-text-muted`: `#8b95a5`
- `--hb-text-disabled`: `#52636d`

Accent:

- `--hb-accent-primary`: `#4785e2`
- `--hb-accent-primary-hover`: `#3971c0`
- `--hb-accent-primary-subtle`: `#1d3057`
- `--hb-accent-primary-muted`: `#233a69`

Status:

- `--hb-status-success`: `#3db54d`
- `--hb-status-warning`: `#f2a103`
- `--hb-status-error`: `#ef4444`
- `--hb-status-info`: `#4a94c6`
- `--hb-status-neutral`: `#747f90`

Status surfaces:

- `--hb-status-success-bg`: `#1d452a`
- `--hb-status-warning-bg`: `#463518`
- `--hb-status-error-bg`: `#3b1518`
- `--hb-status-info-bg`: `#17254d`
- `--hb-status-neutral-bg`: `#1e232d`

Rules:

- Components and widgets must use semantic CSS variables instead of raw color values.
- Gradients are forbidden in the base UI.
- Any new color requires updating this contract and `hobit-theme.css` before use.

## Color Semantics

Colors communicate meaning. They must not be chosen per-widget arbitrarily.

- Primary / active: blue/cyan
- Success / healthy / connected: green
- Warning / waiting / needs decision: amber/yellow
- Error / failed / destructive: red
- Neutral / idle / disabled / secondary: gray

Future additional colors require explicit semantic assignment before use.

## Density And Spacing

Hobit should be compact but not cramped.

Rules:

- Use enough whitespace for readability.
- Widgets must read as separate panels.
- The current operator decision should be visually obvious.
- Secondary details should be muted, collapsed, or moved to details/history.
- Avoid dense walls of text.

Suggested conceptual spacing scale:

- `xs`: 4px
- `sm`: 8px
- `md`: 12-16px
- `lg`: 20-24px
- `xl`: 32px

Exact values may evolve through design-system tokens, but spacing should remain consistent.

## Surface Hierarchy

Surface levels:

- app background
- workbench canvas
- widget surface
- nested panel/card
- input/output surface
- overlay/popover

Surfaces should be visually distinct but subtle. Nesting should be limited. Deep nesting is a warning sign that the UI may be hiding too many responsibilities in one place.

## Widget Anatomy

Standard widget structure:

- WidgetFrame
- header
  - title
  - optional subtitle/status
  - optional actions
- body
- optional footer

Rules:

- Title is short.
- Status uses badges or dots.
- Actions are on the right.
- Body owns one capability.
- Widget must not duplicate another widget's responsibility.
- Widget content should be scannable.

## Typography

Typography should be functional.

- Use a simple sans-serif for UI.
- Use monospace only for terminal, code, SQL, and log output.
- Headings are short and functional.
- Body copy is concise.
- Long prose should be collapsed or structured.
- Avoid decorative typography.

## Badges, Status Dots, And Activity

Badges and status dots must be semantically meaningful.

Agent activity must be concise and high-level. Avoid raw verbose logs in the primary UI. Activity should answer: what is the agent doing now?

## Inputs And Actions

Actions must be easy to understand.

- Primary action must be visually clear.
- Destructive actions must be visually distinct and approval-aware.
- Disabled actions must look disabled.
- Action labels should be explicit, not cute.
- Prompts and inputs should be clean and focused.

## No-Duplication Rule

No UI block repeats another block's responsibility. Each widget answers one primary question.

Examples:

- Terminal Widget answers: what command/output surface is available?
- Agent CLI Widget answers: how do I interact with the agent?
- Agent Activity Widget answers: what is the agent doing?
- Stages Widget answers: where are we in a structured workflow?
- Knowledge Widget answers: what knowledge/context is available?
- Shared State Widget answers: what durable task/session values exist?

## Preset Visual Rules

Presets compose widgets.

- Preset layouts should show only widgets useful for that mode.
- Do not overload every preset with every widget.
- Minimal Workbench must remain visually simple.
- Codebase, Database, and Design presets should share the same visual language but expose different widgets.

## Render-Quality Target

The visual target is a clean dark modular workbench:

- rounded widget cards
- precise spacing
- calm top bar
- product-grade widget headers
- subtle status chips and dots
- dark high-contrast surfaces that are not harsh
- professional desktop-app feel
- low visual noise

The product should feel like a serious operator workspace, not a generic web dashboard.

## Anti-Patterns

Avoid:

- hardcoded one-off colors
- per-widget custom visual language
- duplicated status/title/content across panels
- large raw agent logs as primary UI
- dense walls of text
- permanent panels that should be optional widgets
- feature-specific screens that bypass the widget/preset model
- styling inside components that should be design-system tokens
- visual changes without updating design-system primitives

## Acceptance Criteria For Future UI Work

Future UI work must:

- use design-system primitives
- use WidgetFrame for widgets
- use semantic badges and status dots
- avoid duplicated information
- keep one clear purpose per widget
- follow color semantics
- keep the primary action visible
- keep secondary information subdued
- remain readable in dark theme
- avoid arbitrary styling
