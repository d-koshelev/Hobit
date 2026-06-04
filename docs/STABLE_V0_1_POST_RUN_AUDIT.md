# Stable v0.1 Post-Run Audit

## 1. Executive summary

- Stable v0.1 readiness: almost ready.
- Biggest remaining blockers: stale contracts/current-surface docs, manual in-Hobit dogfooding smoke not yet run, one Toolbelt file-size ratchet violation in `TerminalPtySessionPanel.tsx`, and an oversized mixed-responsibility `FinderWidget.tsx`.
- JDBC should be in v0.1: preview-only. It is useful and well-tested as a bounded Database / JDBC Preview, but not a stable completed widget.
- Notes should be in v0.1: yes, as a Stable v0.1 MVP widget, with one P1 frontend coverage/smoke hardening block.

The codebase now matches much of the Stable v0.1 direction: Workspace Agent remains the foreground coordinator, Queue is the singleton task ledger/review surface, Finder exists with column navigation, edit-in-place, and Git review/control, Terminal remains explicit/manual, and Git plus Agent Executor are filtered out of the normal product catalog/canvas. The main release risk is not missing core implementation, but contract/document drift plus smoke/ratchet cleanup.

## 2. Component readiness table

| Component | Expected responsibility | Current state | Readiness | Blockers | Recommended decision |
| --- | --- | --- | --- | --- | --- |
| Workspace Agent | Foreground coordinator using visible context, proposal/review, Queue coordination through APIs | Uses `interactive-agent`; direct Codex surface, visible attachments, Queue command handler/API bridge, no Terminal/JDBC/Git hidden calls found | Almost ready | Needs manual smoke of Queue command path and Direct Work thread/context boundaries | Include in v0.1 |
| Agent Queue | Singleton task ledger, execution/review surface, run links, closure/follow-up decisions | Queue Widget API slice, controller split, embedded local executor lane, workers, run history, closure states, no-change accept, follow-up creation | Almost ready | Some runner/closure state remains frontend/controller-heavy; needs dogfooding smoke | Include in v0.1 core |
| Finder | Explicit-root file navigation, selected preview, edit-in-place | Implemented as catalog widget with column navigation, capped preview, edit/save/cancel, pane states | Almost ready | `FinderWidget.tsx` is 2711 lines and mixed responsibility; catalog copy still says read-only placeholder | Include in v0.1 after smoke/docs cleanup |
| Finder Git plugin | Git status/diff/history/manual commit/manual push inside Finder with explicit root | Uses Workspace Git API for status, selected diff, history, local commit, manual push, and visible attach of bounded diff | Almost ready | Contract docs still say Git push/Finder Git are planned or not implemented; selected commit details lack changed-file/diff details | Include in v0.1 after docs alignment |
| Terminal | Explicit manual command surface only | PTY-first, visible shell/cwd, stop/kill/close, session-only buffer, collapsed one-shot fallback | Almost ready | Toolbelt ratchet: `TerminalPtySessionPanel.tsx`; stricter contract tension around default `~` cwd | Include after ratchet/smoke |
| Workspace Queue API | App-native Queue access for Workspace Agent and tests | `queue.getSnapshot`, `queue.createItem`, `queue.updateItem` implemented over singleton queue id | Ready for first slice | Delete/reorder/dependency/finalization APIs are partial/future | Include first slice |
| Workspace Git API | Explicit-root safe Git API | Status, diff summary, selected diff, log, local commit, manual push exposed through Tauri/app/tools | Almost ready | Docs need update; push must be explicitly accepted as current capability | Include as Finder-owned supporting API |
| JDBC | Database preview over API/service, safe read-only behavior | Non-secret metadata, mock read-only execution, experimental sidecar/profiles/diagnostics, Boundary Finder preview, broad tests | Preview only | UI is complex; real sidecar remains experimental; not a clean stable completed widget | v0.1 preview-only |
| Notes | Workspace-local notes over API/service | Split UI/controller, list/filter/create/select/edit/save/pin, SQLite and memory fallback, backend/storage tests | Ready / MVP | Frontend tests are light; needs manual smoke | Include in v0.1 MVP |

## 3. Contract alignment

- Stable v0.1 contract: mostly aligned. Core loop exists: Workspace Agent, Agent Queue, Agent Activity, Terminal, Notes, Knowledge / Skills, Finder, JDBC Preview, Runbook Preview, with Git and Agent Executor hidden from normal product catalog/canvas.
- Universal widget shell contract: mostly aligned at the product level. Widgets remain registry/WidgetHost rendered with shared WidgetFrame logs/layout/floating behavior. Finder and Queue still hold too much pane/domain code inside large frontend files/controllers.
- Product UI design contract: partially aligned. Catalog/canvas hide deprecated surfaces and default UI avoids raw internals in most primary surfaces. Queue and JDBC still carry dense/advanced sections; Finder catalog copy is stale.
- Finder API/UX contract: implementation now substantially exceeds old planned docs: explicit root, columns, preview, edit, Git status/diff/history/commit/push exist. Docs still label this as planned/not implemented.
- Workspace Widget API contract: first concrete Queue API slice exists and follows app-native action shape. Full Widget API runtime and semantic test hooks remain future.
- Agent Queue contract: aligned on singleton queue, explicit starts, no auto-accept, run links, follow-up/closure states, and no Terminal/Git hidden automation. Some autonomy remains current-session/frontend-controlled.

## 4. Remaining divergences

### P0 blocks stable release

- Manual in-Hobit dogfooding smoke has not been run after the large implementation pass.
- Active docs are inconsistent with current code. `CURRENT_WIDGET_SURFACE`, `FINDER_WIDGET_API_CONTRACT`, `FINDER_UX_CONTRACT`, `HOBIT_STABLE_V0_1_CONTRACT`, `GIT_WIDGET_CONTRACT`, and parts of `ARCHITECTURE` still contain planned/not-implemented or no-push language that conflicts with Finder Git and Workspace Git API implementation.
- Toolbelt file-size ratchet violation: `apps/desktop/frontend/src/workbench/TerminalPtySessionPanel.tsx` is 830 lines vs baseline 809.

### P1 should fix before daily use

- `apps/desktop/frontend/src/workbench/FinderWidget.tsx` is a hard maintainability risk at 2711 lines and owns navigation, preview, edit, Git status, diff attach, commit, push, and history UI in one file.
- Finder catalog copy still says "Read-only selected-file preview placeholder" despite edit/Git behavior.
- Notes frontend coverage is too narrow for a Stable MVP despite good backend/storage coverage.
- Workspace Git manual push is safety-shaped, but needs acceptance docs and smoke around stale branch/upstream/ahead/behind rejection.
- Terminal default `~` is visible and documented, but stricter Terminal contract language says the Terminal should not silently default to home.

### P2 cleanup

- Legacy docs still mention Coordinator Chat, Git Widget as product surface, Agent Executor catalog direction, and older Finder gap wording.
- Several legacy oversized files remain unchanged debt: Queue controller/action files, JDBC query/model files, `workspace_commands.rs`, `terminal_pty.rs`, `git_diff.rs`, and `jdbc_sidecar_protocol.rs`.
- Queue Widget API lacks delete/reorder/dependency/finalization actions as app-native API calls; current UI/controller behavior covers some decisions separately.

## 5. JDBC assessment

- What currently works: workspace-local connector metadata, non-secret connection profiles, SQL validation, bounded mock read-only execution, visible result grid/errors/copy, explicit sidecar diagnostics, explicit experimental sidecar run inputs, Boundary Finder preview UI.
- What is mock/preview only: product query execution defaults to mock; Boundary Finder probing is not wired; real sidecar is experimental/happy-path and opt-in per run.
- What APIs exist: connector CRUD, connection profile CRUD/delete, read-only SQL validation/execution, sidecar health, driver probe, Tauri DTOs, app service adapter boundary.
- What UI exists: connector list/editor, query editor, runtime status, profile selector/editor, diagnostics, result table, Boundary Finder preview.
- What is missing for a clean stable widget: simpler primary UI, stable non-experimental runtime decision, production credential/secret boundary if real DB is desired, reduced debug/experimental prominence, manual smoke with a real operator-chosen driver/database if promoted.
- Include in Stable v0.1? preview-only. It can ship as Database / JDBC Preview, not as a completed stable widget.

## 6. Notes assessment

- What currently works: workspace-local list/filter/create/select/read/edit/save/pin; dirty-state blocking for select/refresh/create; desktop SQLite persistence; dev browser memory fallback.
- What is mock/preview only: browser/Vite memory fallback is dev-only and non-persistent; full Notebook features are deferred.
- What APIs exist: workspace Notes create/list/read/update across app service, Tauri commands/DTOs, frontend Workspace API, storage layer.
- What UI exists: compact list/search, selected note editor, explicit Save, pin, empty/loading/error/dirty/saving states.
- What is missing for a clean stable widget: broader frontend interaction tests and manual smoke; archive/delete/tags/Markdown are intentionally out of scope.
- Include in Stable v0.1? yes, as Notes MVP.

## 7. File-size / code organization risks

- Hard blocker: Toolbelt ratchet violation in `TerminalPtySessionPanel.tsx`.
- Important advisory: `FinderWidget.tsx` is 2711 lines and should be split before more Finder/Git work.
- Important advisory: `JdbcReadOnlyQueryPanel.tsx`, `JdbcConnectorWidget.tsx`, `jdbcConnectorWidgetModel.ts`, Queue controller/action files, and `workspace_commands.rs` remain oversized or mixed-responsibility.

## 8. Stale docs / obsolete surfaces

- `docs/CURRENT_WIDGET_SURFACE.md`: Finder and Git sections are stale; JDBC/Terminal/Notes mostly current.
- `docs/FINDER_WIDGET_API_CONTRACT.md` and `docs/FINDER_UX_CONTRACT.md`: still status planned/docs-only and no implementation, while Finder now implements much of the planned surface plus manual push.
- `docs/HOBIT_STABLE_V0_1_CONTRACT.md`: Git section says no push; Finder section still describes a gap.
- `docs/GIT_WIDGET_CONTRACT.md`: standalone Git compatibility text still says no push and should move current product language to Finder Git / Workspace Git API.
- `docs/ARCHITECTURE.md`: contains both current and stale Finder/Git/JDBC phrasing.
- `docs/WIDGET_CONTRACT.md`: still has older current user-facing set with Agent Executor, Coordinator Chat, and Git wording.
- Catalog copy in `catalogTemplates.ts`: Finder capability summary understates edit/Git behavior.

## 9. Recommended next 10 blocks

1. STABLE-DOCS-01: Align current surface docs. Acceptance: `CURRENT_WIDGET_SURFACE`, Stable contract, Finder contracts, Git contract, Architecture, and Active Index all agree on Finder Git/manual push and hidden Git/Executor product status.
2. TERMINAL-RATCHET-01: Split or reduce `TerminalPtySessionPanel.tsx`. Acceptance: `scripts/hobit/check-file-sizes.py` passes with no ratchet violation.
3. FINDER-SMOKE-01: Manual Finder dogfooding smoke. Acceptance: explicit root, columns, preview, edit save/cancel, Git status, selected diff, commit guardrails, push guardrails verified.
4. FINDER-SPLIT-01: Extract Finder Git panes/actions. Acceptance: `FinderWidget.tsx` drops below the source threshold or has a documented ratchet plan; no behavior changes.
5. WORKSPACE-GIT-SAFETY-01: Add focused manual/semantic smoke for push preconditions. Acceptance: stale branch/upstream/ahead/behind, behind branch, detached HEAD, unknown upstream, and no-ahead cases are proven blocked.
6. QUEUE-DOGFOOD-01: Run the core Queue dogfooding loop. Acceptance: create task, assign/embedded executor lane, run, report, closure required, no-change accept, follow-up created, no auto-finalization.
7. WORKSPACE-AGENT-QUEUE-01: Smoke Workspace Agent Queue commands. Acceptance: analyze/create/update/start-autonomous/stop commands work only through Queue API and do not call Terminal/Git/JDBC directly.
8. NOTES-MVP-TEST-01: Add focused Notes UI tests. Acceptance: list/filter/select/edit/save/pin/dirty blocking covered.
9. JDBC-PREVIEW-DECISION-01: Decide stable catalog posture. Acceptance: JDBC remains Preview with simplified primary copy, or moves post-v0.1; no production DB claim.
10. DOGFOODING-SMOKE-01: Full manual in-Hobit Stable v0.1 smoke. Acceptance: operator can complete one real repo task through Workspace Agent, Queue, Executor, Finder Git, Terminal, Notes, and Activity with no hidden execution or stale product claims.
