# Frontend Design Audit: Module Shell, Boxes, Padding, and Local Styling

Date: 2026-06-17

Scope: audit only. This document inventories the current frontend module shell and style implementation. No UI behavior, component code, CSS, Tauri, storage, queue runtime, natural-language routing, or backend behavior was changed for this audit.

Finder is intentionally treated as low-priority legacy inventory. It is mentioned only where shared shell or style debt affects the broader module system.

## Executive Summary

The frontend currently has a shared widget shell, but the visual architecture is not yet the strict module-canvas model described for the next style pass.

Main findings:

- The current outer shell is `WidgetFrame` in `apps/desktop/frontend/src/design-system/widget/WidgetFrame.tsx`. It is used by most current Workbench widgets through `WidgetHost`.
- A second shell, `WidgetV2Shell` in `apps/desktop/frontend/src/workbench/widgetV2/WidgetV2Shell.tsx`, is active inside the Knowledge / Skills path. Knowledge therefore has a shell-in-shell layout: `WidgetFrame` wraps `KnowledgeWidget`, which renders `WidgetV2Shell`.
- `WidgetFrame` has a left/right header structure, but it is not the target strict module header. The header has padding, wraps, has group gaps, puts status inside the title row, and does not provide the single full-width separator line. `WidgetV2Shell` has the separator line, but still has padding, group gaps, pill status styling, and its own rounded card shell.
- Workspace Agent overloads the `WidgetFrame` status slot with provider/run configuration, debug/self-test controls, import actions, examples, and activity toggles. That mixes module state with body-level and debug actions in the module header.
- Agent Queue V2, Terminal, and Knowledge / Skills are the worst nested-box offenders. They introduce local command bars, panes, panels, card stacks, local shell headers, drawers, and popups inside the shared widget shell.
- The strongest style debt is local spacing, radius, and layout sizing. Raw colors are mostly centralized in theme/token files and theme presets, but semantic module state tokens are incomplete.
- `components.css`, `agent-queue.css`, `widget-v2-queue.css`, `widget-v2-knowledge.css`, `workbench-shell.css`, `terminal.css`, `notes.css`, and `widget-frame.css` are the primary CSS migration hotspots.
- A future `ModuleShell` / `ModuleHeader` primitive should likely be introduced through the existing `WidgetFrame` and `WidgetV2Shell` paths first, not by rewriting each module independently.

Recommended first implementation block: define the module shell/header token contract and migrate one low-risk visible widget, preferably Agent Activity or Notes, while preserving the `WidgetFrame` API. Do not start with Workspace Agent, Agent Queue V2, Knowledge / Skills, or Terminal because they combine layout, behavior, state, and local chrome.

## Audit Method

Files and contracts inspected:

- `AGENTS.md`
- `docs/ACTIVE_CONTRACT_INDEX.md`
- `docs/CURRENT_WIDGET_SURFACE.md`
- `docs/CODE_ORGANIZATION.md`
- `docs/ARCHITECTURE.md`
- `docs/AGENT_UI_IMPLEMENTATION_RULES.md`
- `docs/FRONTEND_STRUCTURE_CONTRACT.md`
- `docs/UI_DESIGN_SYSTEM_CONTRACT.md`
- `docs/PRODUCT_UI_VISUAL_CONTRACT.md`
- `docs/UI_SHARED_PRIMITIVES_INDEX.md`
- `docs/PRODUCT_UI_DESIGN_CONTRACT.md`
- Active frontend widget, shell, and CSS files listed below.

Safe inspection commands used:

```powershell
git status --short --branch
Get-ChildItem scripts/hobit
rg --files apps/desktop/frontend/src
rg -n 'WidgetFrame|WidgetV2Shell|widget-header|widget-content|agent-queue-product-shell|terminal-pty-panel|notes-product-shell' apps/desktop/frontend/src
rg --pcre2 -c --glob '*.css' '^\s*(padding|padding-inline|padding-block|margin|margin-inline|margin-block|gap|row-gap|column-gap|inset|top|right|bottom|left|border-radius|min-height|height|min-width|width|max-width|max-height)\s*:\s*(?!var\()' apps/desktop/frontend/src/styles
rg -n '#(?:[0-9a-fA-F]{3}){1,2}\b|rgba?\(|hsla?\(' apps/desktop/frontend/src --glob '*.css' --glob '*.tsx' --glob '*.ts'
```

Toolbelt note: `scripts/hobit/module-map.py` was checked as a possible deterministic inventory helper, but running it through `python` failed in this environment with a Windows logon-session error. The audit used `rg` and direct file inspection instead.

## Current Frontend Visual Architecture Map

High-level render path:

```text
Preset / Workspace state
  -> WorkbenchCanvas
  -> WidgetHost
  -> registered widget component
  -> WidgetFrame in most current widgets
  -> widget-specific body content
```

Current shared shell paths:

| Layer | Component / file | Current responsibility | Audit note |
| --- | --- | --- | --- |
| Host mapping | `apps/desktop/frontend/src/workbench/WidgetHost.tsx:91` | Resolves registry component, passes frame actions/logs/layout style. | Correct mapping layer to preserve. Inline frame sizing is computed at `WidgetHost.tsx:330`. |
| Primary widget shell | `apps/desktop/frontend/src/design-system/widget/WidgetFrame.tsx:36` | Outer panel, header, title/status/actions/logs popup, content area, optional footer. | Main current shell. Needs future module-header semantics. |
| Shell CSS | `apps/desktop/frontend/src/styles/widget-frame.css` | `.panel`, `.widget-frame`, `.widget-header`, `.widget-content`, logs popup, footer. | Uses tokenized spacing/radius, but current tokens are not strict module shell tokens. |
| Secondary shell | `apps/desktop/frontend/src/workbench/widgetV2/WidgetV2Shell.tsx:42` | V2 shell/header/body plus V2 toolbar and panels. | Active inside Knowledge / Skills and V2 code paths. Creates nested shell risk when used inside `WidgetFrame`. |
| Secondary shell CSS | `apps/desktop/frontend/src/styles/widget-v2.css` | `.widget-v2-shell`, `.widget-v2-header`, `.widget-v2-toolbar`, V2 layout helpers. | Has header separator, but still padded/gapped/rounded. |
| Shared primitives | `apps/desktop/frontend/src/design-system/*` and `apps/desktop/frontend/src/styles/ui/*` | Buttons, badges, forms, feedback, overlays, debug, layout primitives. | Useful base for future primitive work. Not enough module-shell-specific tokens yet. |

Current CSS layering:

```text
theme presets / hobit theme
  -> tokens.css semantic aliases, spacing, radius, control sizes
  -> ui/*.css shared primitive styling
  -> widget-frame.css and widget-v2.css shell styling
  -> module-local CSS files such as agent-queue.css, notes.css, terminal.css
  -> legacy broad components.css rules
```

## Module Shell Structure

### Outer Shell Components

The components that currently define module/widget shell behavior are:

- `WidgetFrame` in `apps/desktop/frontend/src/design-system/widget/WidgetFrame.tsx:36`
- `Panel` as the frame root inside `WidgetFrame` at `apps/desktop/frontend/src/design-system/widget/WidgetFrame.tsx:88`
- `WidgetV2Shell` in `apps/desktop/frontend/src/workbench/widgetV2/WidgetV2Shell.tsx:42`
- `WidgetV2Header` in `apps/desktop/frontend/src/workbench/widgetV2/WidgetV2Shell.tsx:66`
- `WidgetV2Toolbar` in `apps/desktop/frontend/src/workbench/widgetV2/WidgetV2Shell.tsx:119`
- `WidgetHost` in `apps/desktop/frontend/src/workbench/WidgetHost.tsx:91`

`WidgetFrame` is the current product path. `WidgetV2Shell` is a second shell system and should not remain nested under `WidgetFrame` if the target is one module header plus one body.

### Major Module Structure Table

Container count is approximate and counts visible layout containers before or around actual content, not every child `div`.

| Module | Primary component | Shell/header path | Body container chain | Approx. visible containers before content | Duplicate local header? | Audit classification |
| --- | --- | --- | --- | ---: | --- | --- |
| Workspace Agent | `apps/desktop/frontend/src/workbench/InteractiveAgentPlaceholderWidget.tsx:937` | `WidgetFrame` with `WorkspaceAgentHeaderStatus` in status slot. | `widget-content` -> `.interactive-agent-chat` -> transcript/composer/activity pane. | 2-4 before chat content; header slot adds its own control strip. | Yes. Header status is effectively a local toolbar/config strip. | Header overloaded; body still uses broad legacy CSS. |
| Agent Queue / QueueV2 | `apps/desktop/frontend/src/workbench/AgentQueuePlaceholderWidget.tsx:211`, `apps/desktop/frontend/src/workbench/AgentQueueV2Board.tsx:388` | `WidgetFrame` with status badge. | `widget-content` -> `.agent-queue-product-shell` -> `.agent-queue-main-surface` -> `.agent-queue-v2-board-pane` -> command bar/board scroll/lanes/cards. | 5-7 before task card content. | Yes. Queue V2 command bar duplicates module-level chrome inside the body. | Worst nested-box offender. |
| Knowledge / Skills | `apps/desktop/frontend/src/workbench/KnowledgeSkillsV2Widget.tsx:83`, `apps/desktop/frontend/src/workbench/knowledge/KnowledgeWidget.tsx:110` | `WidgetFrame` wraps `KnowledgeWidget`, which renders `WidgetV2Shell`. | `widget-content` -> `WidgetV2Shell` -> `widget-v2-shell-body` -> catalog browser -> catalog panels/cards/popups. | 4-6 before catalog item content. | Yes. Two shell headers exist. | Worst shell duplication offender. |
| Notes | `apps/desktop/frontend/src/workbench/NotesPlaceholderWidget.tsx:200` | `WidgetFrame` with `NotesToolbar` actions and status. | `widget-content` -> `.notes-product-shell` -> list pane/divider/editor pane -> `.notes-editor`. | 3-5 before note text. | Mostly no module-level duplicate header; body has editor toolbar and mode controls. | Medium nesting; safer first module than Queue/Terminal. |
| Terminal | `apps/desktop/frontend/src/workbench/TerminalPlaceholderWidget.tsx:37`, `apps/desktop/frontend/src/workbench/TerminalPtySessionPanel.tsx:200` | `WidgetFrame` with status badge. | `widget-content` -> `.terminal-pty-panel` -> tabs/pane grid -> `.terminal-pane` -> `.terminal-shell` -> output panel. | 5-7 before terminal output. | Yes. Terminal has tabs plus per-pane `.terminal-shell-header`. | High-risk layout/behavior coupling. |
| Agent Activity | `apps/desktop/frontend/src/workbench/AgentActivityWidget.tsx:23` | `WidgetFrame` with frame actions. | `widget-content` -> `.agent-activity-widget` -> local header -> activity panel/list. | 2-3 before event content. | Yes, but small. | Low-risk candidate for first shell migration. |
| Runbook Preview | `apps/desktop/frontend/src/workbench/RunbookPlaceholderWidget.tsx:97` | `WidgetFrame` with preview status. | `widget-content` -> `.runbook-widget` -> `.runbook-layout` -> step panel/detail panel. | 3-5 before step detail content. | Body panel headers. | Preview surface; do not lead with it. |
| Finder | `apps/desktop/frontend/src/workbench/FinderWidget.tsx:932` | `WidgetFrame`. | Large Finder-specific body layout. | Not deeply counted. | Yes, likely. | Low-priority legacy inventory only for this audit. |
| Git / Agent Executor compatibility | `GitPlaceholderWidget`, `AgentRunPlaceholderWidget` | `WidgetFrame`. | Supporting/compat surfaces. | Not deeply counted. | Local panels. | Do not include in Stable v0.1 shell polish unless explicitly requested. |

### Card-In-Card and Panel-In-Panel Modules

Modules with clear card-in-card or panel-in-panel patterns:

- Knowledge / Skills: outer `WidgetFrame` plus inner `WidgetV2Shell`, then catalog panels and cards.
- Agent Queue / QueueV2: outer `WidgetFrame`, product shell, main surface, V2 board pane, lane panels, task cards, details popup, activity drawer.
- Terminal: outer `WidgetFrame`, terminal panel, tab strip, pane grid, terminal pane, terminal shell, local shell header, settings popover.
- Workspace Agent: outer `WidgetFrame`, overloaded header status strip, chat surface, composer panels, activity pane, Direct Work settings/details panels.
- Notes: outer `WidgetFrame`, product shell, list pane, editor pane, editor body, optional promotion/status containers.
- Runbook Preview: outer `WidgetFrame`, preview widget layout, step panel, detail panel.

## Header Structure Audit

### Where Headers Are Implemented

| Header | File | Current structure | Gap from target direction |
| --- | --- | --- | --- |
| Primary widget header | `apps/desktop/frontend/src/design-system/widget/WidgetFrame.tsx:36` and `apps/desktop/frontend/src/styles/widget-frame.css` | `header.widget-header` contains `.widget-heading` and `.widget-actions`. Title row contains title, info popover, and status. | Header has padding, wrap, group gaps, title-row gap, action gap, max-width on actions, and no single full-width body separator. Status is not a simple anchored group. |
| V2 widget header | `apps/desktop/frontend/src/workbench/widgetV2/WidgetV2Shell.tsx:66` and `apps/desktop/frontend/src/styles/widget-v2.css` | `header.widget-v2-header` contains heading/title/status and actions, with border-bottom. | Has separator but also padded/gapped shell, status pill, rounded outer shell, and second shell semantics. |
| Workspace Agent header status | `apps/desktop/frontend/src/workbench/WorkspaceAgentStatusPanel.tsx:8` | Header status area includes run config strip, provider/model display, self-test, import, examples popup, activity toggle. | Strongest violation: mixes module state with task/debug/body actions. |
| Agent Queue V2 command bar | `apps/desktop/frontend/src/workbench/AgentQueueV2Board.tsx:389` | Body-local title, task count, state actions, facts row. | Duplicates module header inside module body. |
| Knowledge V2 header | `apps/desktop/frontend/src/workbench/knowledge/KnowledgeWidget.tsx:110` | Inner `WidgetV2Shell` header inside outer `WidgetFrame`. | Double module header/shell. |
| Notes frame actions | `apps/desktop/frontend/src/workbench/notes/NotesToolbar.tsx` | Refresh/New actions are passed to `WidgetFrame` actions. | Closer to shared header usage, but still inherits padded/gapped frame header. |
| Terminal local shell header | `apps/desktop/frontend/src/workbench/TerminalPtySessionPanelParts.tsx:102` | Per-pane context plus action group inside terminal body. | Local body header duplicates module chrome and adds nested separator/action structure. |
| Agent Activity body header | `apps/desktop/frontend/src/workbench/AgentActivityWidget.tsx:34` | Body title and event count above activity panel. | Small duplicate header; likely easy to fold into a future body/detail pattern. |

### Headers With Padding, Margins, Gaps, Floating Pills, or Toolbar Wrappers

Current shared header styling:

- `apps/desktop/frontend/src/styles/widget-frame.css`
  - `.widget-header` uses `gap: var(--space-xs)` and `padding: var(--widget-header-padding-y) var(--widget-header-padding-x)`.
  - `.widget-title-row`, `.widget-actions`, and logs controls add more gaps.
  - Status and badges generally render as pill-like elements through `Badge` or local classes.
- `apps/desktop/frontend/src/styles/widget-v2.css`
  - `.widget-v2-header` uses `gap: var(--space-sm)`, `border-bottom`, and `padding`.
  - `.widget-v2-header-actions` uses `gap: var(--control-group-gap-min)`.
  - `.widget-v2-status` uses pill styling.

Module-local header or toolbar wrappers:

- Workspace Agent: `.interactive-agent-frame-status`, run config strip, examples popup trigger, activity toggle.
- Agent Queue V2: `.agent-queue-v2-command-bar`, state action group, facts row.
- Knowledge / Skills: `WidgetV2Shell` header and `KnowledgeV2Actions` inside an outer `WidgetFrame`.
- Notes: `NotesToolbar` in frame actions, plus body editor mode/format rows.
- Terminal: `.terminal-tabs`, `.terminal-shell-header`, settings popover.
- Agent Activity: `.agent-activity-widget-header`.
- Runbook Preview: step-panel and detail-panel headers inside the body.

### Left/Right Anchored Group Status

`WidgetFrame` and `WidgetV2Header` use a broad left/right flex structure with `justify-content: space-between`, but neither matches the target strict header:

- The header itself has container padding.
- Header groups have gaps.
- Elements inside groups do not touch each other.
- The status slot is nested with the title area rather than a separate strict group.
- Right-side actions have local gap and max-width behavior.
- Headers wrap, so the empty middle space is not guaranteed to remain a clean flexible void.

No inspected module currently implements the target exactly: left group flush to the left edge, right group flush to the right edge, no group padding, no gap inside groups, and one thin full-width separator.

### Header State Mixed With Body/Debug Actions

Highest priority examples:

- Workspace Agent `WorkspaceAgentHeaderStatus`: provider/model/reasoning display, run state, self-test, import pack, prompt examples, and activity pane toggle all share header space.
- Agent Queue V2 command bar: module/task state, queue control actions, facts, and board title all sit in a body-level header.
- Knowledge V2: module title/actions/status are repeated by the inner V2 shell.
- Terminal: per-pane shell header carries connection/session context and controls below the module header.
- Agent Activity: local body header repeats a module-like title and event count.

Explanatory text that should probably move to info/debug/details UI:

- `WidgetFrame` `info` strings are already routed through `WidgetInfoPopover`, which is the correct direction.
- Workspace Agent header controls expose configuration and disabled reasons directly in header space.
- Queue V2 command facts and board title are body explanations/chrome, not module shell state.
- Knowledge `displaySubtitle` text is passed into `KnowledgeWidget`; if visible in the header/body chrome, it should be moved to info/details during shell cleanup.
- Notes editor privacy/promotional helper text belongs in body details, not future module header.

## Boxes, Blocks, and Wrappers

### Visible Layout Container Classification

| Module | Outer module frame | Header | Body | Toolbar | Card | Panel | Popup | Debug/details container |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Workspace Agent | `WidgetFrame` | `WidgetFrame` plus `WorkspaceAgentHeaderStatus` | `.interactive-agent-chat` | Header status controls, composer controls | Proposal/action cards, message cards | Activity pane, Direct Work panels | Examples/settings/details popups | Self-test, Direct Work details/logs |
| Agent Queue / QueueV2 | `WidgetFrame` | `WidgetFrame` | `.agent-queue-product-shell` and V2 board | V2 command bar, state actions | Task cards | Lanes, worker groups, selected-task details | Create dialog, task details popup | Activity drawer, validation/review details |
| Knowledge / Skills | `WidgetFrame` plus nested `WidgetV2Shell` | Double header | `widget-v2-shell-body` and catalog browser | V2 toolbar / actions | Catalog document/skill items | Catalog panels, optional legacy shell | Debug popup and catalog popups | Debug popup, local status/details |
| Notes | `WidgetFrame` | `WidgetFrame` | `.notes-product-shell` | Frame actions, editor formatting toolbar | Note list rows, promotion panel | List pane, editor pane | None dominant | Save/status/private note details |
| Terminal | `WidgetFrame` | `WidgetFrame` plus terminal shell header | `.terminal-pty-panel` | Tabs, pane actions | Legacy fallback cards | Pane grid, terminal pane, shell, output panel | Settings/more popovers | Notices, one-shot fallback details |
| Agent Activity | `WidgetFrame` | `WidgetFrame` plus small body header | `.agent-activity-widget` | Frame action(s) | Activity events | Activity panel | None dominant | Current-session event details |
| Runbook Preview | `WidgetFrame` | `WidgetFrame` | `.runbook-widget` | None dominant | Step items | Step list/detail panels | None dominant | Step detail/status |

### Worst Nested-Box Offenders

| Rank | Area | Evidence | Why it is a problem for the target shell |
| ---: | --- | --- | --- |
| 1 | Knowledge / Skills | `KnowledgeSkillsV2Widget.tsx:83` wraps `KnowledgeWidget`; `KnowledgeWidget.tsx:110` renders `WidgetV2Shell`. | Two module shells and two header systems exist before the catalog body. This directly conflicts with one module header plus one body. |
| 2 | Agent Queue / QueueV2 | `AgentQueuePlaceholderWidget.tsx:230`, `AgentQueuePlaceholderWidget.tsx:240`, `AgentQueueV2Board.tsx:388`, `AgentQueueV2Board.tsx:389`. | Product shell, main surface, V2 board pane, command bar, lanes, task cards, details popup, and activity drawer create the densest visible box stack. |
| 3 | Terminal | `TerminalPlaceholderWidget.tsx:37`, `TerminalPtySessionPanel.tsx:200`, `TerminalPtySessionPanelParts.tsx:102`. | Shared module header plus tab strip plus per-pane shell header plus panel shells. Layout and runtime controls are tightly coupled. |
| 4 | Workspace Agent | `InteractiveAgentPlaceholderWidget.tsx:937`, `InteractiveAgentPlaceholderWidget.tsx:945`, `InteractiveAgentPlaceholderWidget.tsx:961`. | The outer header status slot is used as a mini control surface. Body panels and activity pane rely on broad legacy CSS. |
| 5 | Notes | `NotesPlaceholderWidget.tsx:200`, `NotesPlaceholderWidget.tsx:223`, `NotesEditor.tsx:166`. | Cleaner than Queue/Terminal, but still has product shell, list pane, editor pane, editor toolbar, and promotion/status containers. |
| 6 | `components.css` legacy styling | `apps/desktop/frontend/src/styles/components.css` contains mixed Workspace Agent, coordinator, activity, executor, runbook, and git-related selectors. | Broad CSS ownership makes safe visual migration harder because unrelated surfaces share one large style file. |

## Padding, Margin, Gap, Size, and Radius Audit

The scan below counts CSS declarations for layout values that are not direct `var(...)` calls. It is a density signal, not a defect count: it includes legitimate values such as `0`, `100%`, grid sizing, and `calc(...)`. It still identifies where local layout literals are concentrated.

Command:

```powershell
rg --pcre2 -c --glob '*.css' '^\s*(padding|padding-inline|padding-block|margin|margin-inline|margin-block|gap|row-gap|column-gap|inset|top|right|bottom|left|border-radius|min-height|height|min-width|width|max-width|max-height)\s*:\s*(?!var\()' apps/desktop/frontend/src/styles
```

### Hardcoded / Local Layout Density by CSS File

| CSS file | Count | Main ownership | Audit note |
| --- | ---: | --- | --- |
| `apps/desktop/frontend/src/styles/components.css` | 541 | Legacy shared/module CSS | Highest-risk mixed file. Contains Workspace Agent, coordinator, Agent Activity, Direct Work, Runbook, Git, and compatibility selectors. |
| `apps/desktop/frontend/src/styles/agent-queue.css` | 353 | Current Queue shell/body | Heavy local layout. Queue should not be first migrated through visual-only changes. |
| `apps/desktop/frontend/src/styles/widget-v2-queue.css` | 208 | Queue V2 | Dense V2 board/card/lane styling. Local module chrome should be reduced after shell decision. |
| `apps/desktop/frontend/src/styles/widget-v2-knowledge.css` | 194 | Knowledge V2 catalog | Heavy local catalog panel/card styling under nested V2 shell. |
| `apps/desktop/frontend/src/styles/workbench-shell.css` | 176 | Workbench canvas/shell | Large layout surface; not module-specific, but affects perceived frame spacing. |
| `apps/desktop/frontend/src/styles/finder.css` | 150 | Finder | Low-priority legacy inventory. Do not spend first polish block here. |
| `apps/desktop/frontend/src/styles/terminal.css` | 148 | Terminal PTY and fallback | Many local panel/tab/pane values; high-risk because visual structure is coupled to session behavior. |
| `apps/desktop/frontend/src/styles/widget-frame.css` | 118 | Shared current widget shell | Important first target for token alignment, but changes affect all widgets. |
| `apps/desktop/frontend/src/styles/notes.css` | 116 | Notes | Moderate density. Safer than Queue/Terminal for first module migration. |
| `apps/desktop/frontend/src/styles/jdbc.css` | 104 | JDBC preview | Out of primary audit scope; relevant as module-local style pattern. |
| `apps/desktop/frontend/src/styles/skills.css` | 86 | Legacy skills | Adds to Knowledge / Skills style split. |
| `apps/desktop/frontend/src/styles/workspace-start.css` | 80 | Start screen | Not module shell scope. |
| `apps/desktop/frontend/src/styles/widget-v2-workspace-agent.css` | 71 | V2 Workspace Agent path | Future/alternate shell path, not the active `interactive-agent` compatibility path. |
| `apps/desktop/frontend/src/styles/ui/overlays.css` | 53 | Shared overlays | Tokenization candidate for popups/details. |
| `apps/desktop/frontend/src/styles/widgets/workspace-agent.css` | 48 | Workspace Agent local CSS | Smaller file but layered with `components.css`. |
| `apps/desktop/frontend/src/styles/widget-v2.css` | 34 | Shared V2 shell | Secondary shell to reconcile with `WidgetFrame`. |
| `apps/desktop/frontend/src/styles/ui/layout.css` | 31 | Shared layout utilities | Expected shared layer. |
| `apps/desktop/frontend/src/styles/responsive.css` | 31 | Responsive overrides | Expected, but needs audit during shell migration. |
| `apps/desktop/frontend/src/styles/shared-actions.css` | 28 | Shared action styling | Should be considered for header group zero-gap behavior. |

### Tokenized vs One-Off Spacing

Central spacing/radius tokens currently exist in `apps/desktop/frontend/src/styles/tokens.css`:

- `--space-2xs: 4px`
- `--space-xs: 4px`
- `--space-sm: 6px`
- `--space-md: 8px`
- `--space-lg: 10px`
- `--space-xl: 12px`
- `--space-2xl: 16px`
- `--radius-xs: 3px`
- `--radius-sm: 5px`
- `--radius-md: 7px`
- `--radius-lg: 8px`
- `--radius-xl: 10px`
- `--radius-pill: 999px`
- `--widget-header-padding-x: calc(6px * var(--ui-scale))`
- `--widget-header-padding-y: calc(3px * var(--ui-scale))`

Current inconsistency:

- The desired header radius is around `2px`, but the smallest radius token is `3px`.
- `WidgetFrame` uses `--radius-lg` / `--radius-xl`, which is much larger than the target strict module shell.
- Header padding is tokenized, but the target says no header container padding.
- Group gaps are tokenized, but the target says no gap between elements inside each header group.
- The spacing scale starts with duplicated `4px` values for `--space-2xs` and `--space-xs`, then 6/8/10/12/16. This is workable, but current module CSS also uses many local fixed values outside the scale.

### Size and Layout Literals in Components

Component-level size/layout behavior to preserve or isolate:

- `apps/desktop/frontend/src/workbench/WidgetHost.tsx:330` computes frame `height`, `minHeight`, and `width` from layout/default widget dimensions. This is product layout behavior, not visual shell chrome.
- Registry default/min sizes are in `apps/desktop/frontend/src/workbench/widgetRegistry.ts`. These should not be changed during visual shell migration unless a task explicitly targets layout.
- Module body files frequently rely on CSS class structure rather than inline style, which is good for future centralization. The issue is mostly that local CSS files define too many panel-specific values.

## Borders, Radius, Separators, and Shadows

### Shared Definitions

| File | Current definitions | Audit note |
| --- | --- | --- |
| `styles/hobit-theme.css` | `--hb-border-subtle`, `--hb-border-default`, `--hb-border-strong`, surface colors, status colors. | Correct central palette layer. |
| `styles/tokens.css` | `--color-border-*`, radius scale, shadow tokens, widget header padding. | Needs module-shell-specific tokens and a 2px radius token. |
| `styles/widget-frame.css` | `.panel` and `.widget-frame` rounded borders; `.widget-content` padding; popups/logs/footer borders. | Main place where multiple rounded panel layers begin. |
| `styles/widget-v2.css` | `.widget-v2-shell` border/radius; `.widget-v2-header` border-bottom; toolbar/panel separators. | Useful separator pattern, but V2 shell creates double borders when nested. |
| Module CSS files | Local panel/card borders, radii, toolbar borders, dividers, popups. | Main source of visual noise and card-in-card appearance. |

### Large Radius / Heavy Card Styling Hotspots

- `WidgetFrame` uses `--radius-lg` / `--radius-xl`, not the target 2px-ish module shell.
- `WidgetV2Shell` uses `--radius-lg` and its own shell border.
- `Badge` and status elements often use pill radius (`999px`). Pills are visually heavy in the strict header model if overused.
- Queue V2 cards/lanes, Knowledge catalog panels, Terminal panes, and Notes editor/list panes all add local borders/radii under the shared shell.
- Popups/details containers use `--radius-md` or local panel radii; this is acceptable for popups but should be separate from module shell radius.

### Multiple-Border Noise

Most visible multi-border stacks:

- Knowledge / Skills: `WidgetFrame` border + `WidgetV2Shell` border + catalog panel/card borders.
- Queue: `WidgetFrame` border + product/main surface borders + V2 pane/lane/card borders + popup/drawer borders.
- Terminal: `WidgetFrame` border + terminal panel/tab/pane/shell/output borders.
- Notes: `WidgetFrame` border + product shell/list/editor/divider/status borders.

The future shell should define one outer frame border and one header/body separator. Body panels should justify any additional border by function, not by default card styling.

## Colors and Theme Tokens

### Hardcoded Color Findings

Raw color literals are mostly centralized:

- `apps/desktop/frontend/src/styles/hobit-theme.css` defines the base theme palette.
- `apps/desktop/frontend/src/theme/themePresets.ts` defines theme preset values.
- `apps/desktop/frontend/src/theme/ThemePicker.test.tsx` and related tests assert those raw theme values.
- `apps/desktop/frontend/src/styles/tokens.css` contains a few theme override literals for Discord-like surface behavior and shadow color mixing.

The audit did not find broad one-off raw color usage in active module TSX/CSS outside theme/preset/test layers. That is a strength of the current frontend.

### Current State Color Categories

Shared primitive state variants:

- `Badge` and `StatusDot` use a compact variant set: `neutral`, `info`, `success`, `warning`, `error`.

Observed product state categories:

| Product category | Current examples | Current mapping pattern |
| --- | --- | --- |
| active | Queue global active, running agent/session states | Usually `info` or local active classes. |
| idle | Workspace Agent idle, no current activity | Usually `neutral`. |
| completed | Agent runs, queue tasks, activity events | Usually `success`. |
| running | Agent runs, queue tasks, terminal sessions | Usually `info`. |
| blocked | Queue coordinator/blocking states, knowledge unavailable/blocked tones | Often `warning` or local `blocked` tone; inconsistent. |
| error | Failed runs/tasks/validation | Usually `error`. |
| draft | Queue draft, Knowledge draft | Usually `neutral` or local status tone. |
| review | Queue `review_needed`, validation `needs_review` | Usually `warning`. |
| disabled | Queue disabled, unavailable actions | Usually `neutral`, disabled control state, or local unavailable tone. |

Local state systems:

- Queue uses task statuses such as `draft`, `queued`, `ready`, `running`, `completed`, `failed`, `cancelled`, and `review_needed`, then maps them into shared badge variants.
- Workspace Agent has run statuses such as `idle`, `preparing`, `materializing_context`, `running`, `completed`, `failed`, `cancelled`, and `unsupported`.
- Knowledge item status uses local tones such as `blocked`, `neutral`, `ok`, `unavailable`, and `warning`.
- Agent Activity uses event statuses/severities and maps them into shared `Badge` / `StatusDot` variants.

### Missing or Inconsistent Semantic State Tokens

Missing design tokens/config values:

- `--module-shell-radius` or `--module-radius` with the target `2px` value.
- `--module-header-radius` for the minimal header corner treatment.
- `--module-header-padding-x: 0` and `--module-header-padding-y` or equivalent explicit no-padding decision.
- `--module-header-separator-width`, likely `1px`.
- `--module-header-separator-color`.
- `--module-header-left-group-gap: 0`.
- `--module-header-right-group-gap: 0`.
- `--module-header-min-height` or compact control height alignment.
- `--module-body-padding` and `--module-body-gap` for body content.
- Semantic state token names for `active`, `idle`, `completed`, `running`, `blocked`, `error`, `draft`, `review`, and `disabled`.
- A mapping contract from product state names to shared visual state tokens.
- A policy token or class for "module state text" versus "task/debug/details text" so header content does not become an action drawer.

## Shared Style and Token Files Currently Used

Primary shared style/token files:

- `apps/desktop/frontend/src/styles/hobit-theme.css`
- `apps/desktop/frontend/src/styles/theme.css`
- `apps/desktop/frontend/src/styles/tokens.css`
- `apps/desktop/frontend/src/styles/ui/actions.css`
- `apps/desktop/frontend/src/styles/ui/debug.css`
- `apps/desktop/frontend/src/styles/ui/feedback.css`
- `apps/desktop/frontend/src/styles/ui/forms.css`
- `apps/desktop/frontend/src/styles/ui/layout.css`
- `apps/desktop/frontend/src/styles/ui/overlays.css`
- `apps/desktop/frontend/src/styles/ui/widget.css`
- `apps/desktop/frontend/src/styles/shared-actions.css`
- `apps/desktop/frontend/src/styles/widget-frame.css`
- `apps/desktop/frontend/src/styles/widget-v2.css`
- `apps/desktop/frontend/src/styles/responsive.css`

Major module-local or mixed style files:

- `apps/desktop/frontend/src/styles/components.css`
- `apps/desktop/frontend/src/styles/agent-queue.css`
- `apps/desktop/frontend/src/styles/widget-v2-queue.css`
- `apps/desktop/frontend/src/styles/widget-v2-knowledge.css`
- `apps/desktop/frontend/src/styles/widgets/workspace-agent.css`
- `apps/desktop/frontend/src/styles/notes.css`
- `apps/desktop/frontend/src/styles/terminal.css`
- `apps/desktop/frontend/src/styles/skills.css`
- `apps/desktop/frontend/src/styles/jdbc.css`
- `apps/desktop/frontend/src/styles/finder.css`

Shared primitive files likely involved in a future shell/header primitive:

- `apps/desktop/frontend/src/design-system/widget/WidgetFrame.tsx`
- `apps/desktop/frontend/src/design-system/widget/WidgetLogsPanel.tsx`
- `apps/desktop/frontend/src/design-system/actions/*`
- `apps/desktop/frontend/src/design-system/feedback/*`
- `apps/desktop/frontend/src/design-system/layout/*`
- `apps/desktop/frontend/src/design-system/overlays/*`
- `apps/desktop/frontend/src/workbench/widgetV2/WidgetV2Shell.tsx`

## Configuration and Design System Readiness

Centralized and reusable today:

- Theme palette and theme presets.
- Common semantic color aliases for success/warning/error/info/neutral.
- Common spacing/radius/control-size tokens.
- Shared `WidgetFrame` shell API.
- Shared action, feedback, form, overlay, debug, and layout primitives.
- `WidgetHost` as the correct component mapping layer.

Scattered locally:

- Module body spacing, panel borders, card radius, toolbar layout, popup layout, and body-level header patterns.
- Workspace Agent style ownership across `components.css` and `styles/widgets/workspace-agent.css`.
- Queue style ownership across `agent-queue.css` and `widget-v2-queue.css`.
- Knowledge style ownership across `widget-v2-knowledge.css`, `skills.css`, and nested V2 shell styles.
- Terminal style ownership in `terminal.css` plus multiple behavior-heavy TSX files.

Components that should probably consume a future shared `ModuleShell` / `ModuleHeader` primitive:

- `WidgetFrame` should be the compatibility-facing entry point for the new primitive.
- `WidgetV2Shell` should either consume the same primitive or be collapsed into it for active product widgets.
- `InteractiveAgentPlaceholderWidget` should stop passing large control clusters into the frame status slot.
- `AgentQueuePlaceholderWidget` and `AgentQueueV2Board` should move module-level chrome out of body command bars after state/action ownership is clarified.
- `KnowledgeSkillsV2Widget` and `KnowledgeWidget` should not both own shells.
- `TerminalPlaceholderWidget` and terminal pane components need a clear distinction between module header and terminal session/pane controls.
- `AgentActivityWidget` and `NotesPlaceholderWidget` are better low-risk consumers for the first migration pass.

Values that should become design tokens before implementation:

- Module shell radius and header radius.
- Header separator width/color.
- Header group gap values, including explicit zero gap.
- Header height/control height alignment.
- Header state text/badge sizing.
- Body padding/gap.
- Panel/card radius distinct from module shell radius.
- Popup/detail radius distinct from module shell radius.
- Semantic state colors for active/idle/completed/running/blocked/error/draft/review/disabled.
- Optional debug/details surface tokens so debug UI does not look like module chrome.

## Risk Assessment

### Safest Areas To Migrate First

1. Agent Activity
   - Small component.
   - Uses `WidgetFrame`.
   - Body-local header is simple.
   - Low behavior coupling.

2. Notes
   - Uses `WidgetFrame` correctly for most header actions.
   - Body nesting is visible but understandable.
   - Good candidate for proving module shell/body padding tokens after Agent Activity.

3. Shared shell documentation/token preparation
   - Define shell/header tokens before broad CSS edits.
   - Keep the `WidgetFrame` API stable.
   - Avoid changing registry sizing or layout persistence.

### Risky Areas

1. Workspace Agent
   - `InteractiveAgentPlaceholderWidget.tsx` is large and behavior-heavy.
   - Header contains provider config, debug/self-test actions, import/examples, and activity toggles.
   - Styling is split between broad `components.css` and local Workspace Agent CSS.
   - Any header cleanup must first decide where those actions live.

2. Agent Queue / QueueV2
   - Queue UI combines board layout, task state, executor assignment, autorun controls, validation/review, details popup, and activity drawer.
   - `AgentQueueV2Board.tsx` and queue CSS are large.
   - Visual changes can easily affect operator-control semantics.

3. Knowledge / Skills
   - Double shell needs an architectural choice before CSS cleanup.
   - `KnowledgeSkillsV2Widget` and `KnowledgeWidget` both participate in shell ownership.
   - Legacy skills styling still exists alongside V2 catalog styling.

4. Terminal
   - Terminal layout is tightly coupled to session/pane controls.
   - Header-like controls inside the body may be functionally necessary, but they should not be visually confused with module chrome.
   - Avoid first-pass shell changes that alter PTY session affordances.

5. `components.css`
   - Too broad for targeted visual rework.
   - It should be reduced or split only through focused module migrations.

### Files Too Large or Too Mixed for Safe Visual-Only Rework

High-risk files by size/responsibility:

- `apps/desktop/frontend/src/workbench/FinderWidget.tsx` - large, low-priority legacy scope for this audit.
- `apps/desktop/frontend/src/workbench/InteractiveAgentPlaceholderWidget.tsx` - active Workspace Agent compatibility surface with many behaviors.
- `apps/desktop/frontend/src/workbench/AgentQueueV2Board.tsx` - queue board/task/action/detail logic and layout together.
- `apps/desktop/frontend/src/workbench/JdbcConnectorWidget.tsx` - out of primary scope, but similarly mixed.
- `apps/desktop/frontend/src/workbench/TerminalPtyPanePanel.tsx`
- `apps/desktop/frontend/src/workbench/TerminalPtySessionPanelParts.tsx`
- `apps/desktop/frontend/src/workbench/TerminalRunCommandPanel.tsx`
- `apps/desktop/frontend/src/workbench/notes/NotesEditor.tsx`
- `apps/desktop/frontend/src/styles/components.css`
- `apps/desktop/frontend/src/styles/agent-queue.css`
- `apps/desktop/frontend/src/styles/widget-v2-queue.css`
- `apps/desktop/frontend/src/styles/widget-v2-knowledge.css`
- `apps/desktop/frontend/src/styles/terminal.css`

## Recommended Migration Order

1. Define module shell/header tokens and acceptance criteria.
   - Add explicit tokens for 2px shell/header radius, header separator, zero header padding, zero group gap, body padding, and state color names.
   - Do this before visual edits so all modules move toward the same target.

2. Align `WidgetFrame` and `WidgetV2Shell` behind the same target semantics.
   - Preserve `WidgetHost`, widget registry, layout persistence, logs, move/resize, float/dock, and current widget APIs.
   - Treat `WidgetV2Shell` as either a consumer of the same primitive or a transitional wrapper.

3. Apply the new shell to Agent Activity.
   - Smallest current widget.
   - Good place to verify one header line plus one body without body complexity.

4. Apply the shell to Notes.
   - Keep list/editor behavior unchanged.
   - Reduce only shell/header/body wrappers and spacing in a focused pass.

5. Resolve Knowledge / Skills double-shell ownership.
   - Decide whether `KnowledgeSkillsV2Widget` owns the module shell and `KnowledgeWidget` becomes body content, or whether `KnowledgeWidget` is inserted directly by the host.
   - Do not polish nested CSS before this decision.

6. Split Workspace Agent header controls.
   - Move debug/actions/details out of the module header into body/details surfaces.
   - Keep only module state in the header.
   - Preserve explicit visible context and proposal boundaries.

7. Reduce Agent Queue body chrome.
   - Separate module-level state from board/task controls.
   - Keep operator approval and queue control semantics intact.

8. Rework Terminal shell/body visual separation.
   - Preserve PTY behavior.
   - Make terminal session/pane controls visually distinct from module header, not a second module header.

9. Defer Finder polish.
   - Only touch Finder when shared shell changes require compatibility work or a future Finder-specific task requests it.

## Explicit Do Not Change Yet Risks

Do not change yet in the first implementation block:

- Workspace Agent provider/routing/action behavior.
- Workspace Agent natural-language routing.
- Queue runtime, scheduler, autorun, assignment, executor, validation, or review behavior.
- Queue task data shape or persistence.
- Terminal PTY runtime behavior, shell execution, session lifecycle, output buffering, fallback command behavior, or storage.
- Knowledge import/retrieval behavior or persistence.
- Notes API behavior, save semantics, note model, or workspace storage.
- Widget registry IDs, widget insertion behavior, default widget set, layout persistence, or `WidgetHost` registry mapping.
- Tauri bridge commands, backend crates, SQLite schemas, or storage migrations.
- Theme preset data except through an explicit theme-token task.
- Finder-specific polish.
- Broad `components.css` rewrites without a module-specific target and test plan.

## Concrete Next Prompt Suggestions

### Prompt 1: Module Shell Token Contract

```text
Implement a focused frontend style foundation block for Hobit modules.

Read docs/FRONTEND_DESIGN_AUDIT.md and the required UI contracts.
Add module-shell/header design tokens only. Do not migrate modules yet.
Define tokens for 2px module radius, zero header padding, header separator, left/right header group gaps, body padding, and semantic module state colors.
No behavior changes, no new widgets, no backend changes.
Validate with git diff --check and frontend typecheck if token imports change.
```

### Prompt 2: Agent Activity Shell Pilot

```text
Using docs/FRONTEND_DESIGN_AUDIT.md, migrate only Agent Activity to the new module shell/header style.

Preserve WidgetFrame, WidgetHost, logs, layout, actions, and runtime behavior.
Goal: one module header line plus one body, no duplicate body header unless it is moved into details/body content.
Do not touch Workspace Agent, Queue, Knowledge, Terminal, Notes, Finder, backend, Tauri, storage, or queue behavior.
```

### Prompt 3: Notes Shell Pilot

```text
Using docs/FRONTEND_DESIGN_AUDIT.md, apply the module shell/header/body style to Notes only.

Preserve Notes list/filter/create/select/edit/save/pin flows and workspace Notes API behavior.
Keep source text as source of truth.
Do not add Markdown rendering, AI-in-Notes, Notebook behavior, new persistence, or broader UI primitives.
```

### Prompt 4: Knowledge Double-Shell Resolution Plan

```text
Audit and propose a no-behavior-change plan to remove Knowledge / Skills shell duplication.

Target files: KnowledgeSkillsV2Widget.tsx, knowledge/KnowledgeWidget.tsx, WidgetV2Shell.tsx, widget-frame.css, widget-v2.css, widget-v2-knowledge.css, skills.css.
Do not implement yet.
The output should decide which component owns the module shell and which component becomes body content.
```

### Prompt 5: Workspace Agent Header Decomposition Audit

```text
Audit Workspace Agent header contents and propose a decomposition plan.

Goal: future module header shows only module state. Provider config, self-test, import, examples, activity toggle, debug/details, and run settings must move to explicit body/details surfaces.
Do not implement. Do not change provider calls, routing, Direct Work, Queue, or proposal behavior.
```

## Final Audit Notes

The current frontend already has good ingredients: a registry-driven host, a shared `WidgetFrame`, a theme/token layer, and reusable UI primitives. The main gap is that the shell contract is not strict enough and module bodies have accumulated local chrome. The safest path is to define the module-shell tokens first, prove them on a small widget, then tackle the high-risk modules only after their header/body ownership is clarified.
