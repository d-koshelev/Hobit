# Stable v0.1 UI Follow-Up Status

Status record date: 2026-06-05

## Purpose

Record the consolidated Stable v0.1 UI follow-up status and the remaining
manual smoke checklist.

This is a docs-only status record. It does not add product behavior, frontend
behavior, backend APIs, storage, runtime execution, validation requirements, or
Stable v0.1 acceptance status. Current implemented behavior remains governed by
`docs/CURRENT_WIDGET_SURFACE.md` and task-specific contracts.

Where a source-level UI follow-up is newer than an older contract statement,
this record treats the source work as needing manual smoke and focused contract
reconciliation before it is used as final Stable v0.1 acceptance evidence.

## Source Inputs

- `docs/STABLE_V0_1_UI_SMOKE_BACKLOG.md`
- `docs/STABLE_V0_1_OOM_STABILITY_STATUS.md`
- `docs/KNOWLEDGE_SKILLS_STABLE_V0_1_STATUS.md`
- `docs/STABLE_V0_1_READINESS_AUDIT.md`
- Recent source-level follow-up commits:
  - `e15be2a` - Knowledge draft review actions
  - `019576d`, `cc93a6f` - shared popup/header/widget shell polish
  - `94b291c`, `c69b5b8` - Workspace Agent run controls/activity clarity
  - `279f154` - Notes rail and source-text formatting polish
  - `407983b`, `b09a15a` - Queue panel/sidebar/flow/tag stabilization
  - `3b8e083` - Knowledge catalog IA unification
  - `0626b6a`, `223316a` - Terminal autostart, tabs, and split panes
  - `5b21443` - Finder home/default primary surface
  - `5f37959` - OOM stability status record

Status values:

- `implemented`: source-level follow-up exists and is ready for manual smoke.
- `manual-smoke-pending`: source-level work exists, but no passing desktop
  manual smoke result is recorded in this status document.
- `contract-follow-up`: source-level work should be reconciled with
  authoritative contracts before final acceptance language is updated.
- `pending`: broader implementation or investigation remains.

## Consolidated Follow-Up Status

| Area | Status | Recorded source-level result | Remaining acceptance work |
| --- | --- | --- | --- |
| Knowledge draft review | implemented, manual-smoke-pending | Queue worker report draft packs can surface review actions; accept/reject remains explicit and operator-controlled. Accepted drafts can create Knowledge Documents through the explicit path; rejected drafts remain review-local for Stable v0.1. | Manually smoke Queue result draft review, accept, reject, no hidden activation, and no durable rejected Knowledge/Evidence/audit record claim. |
| Shared popup/header/z-order shell | implemented, manual-smoke-pending | Shared `PopupShell` and widget frame polish exist; widget headers are treated as the top meta zone, and source tests cover popup behavior and widget z-order/focus behavior. | Manually smoke catalog/drawer/popups/logs/remove controls, widget focus ordering, floating/docked headers, and no detached toolbar-like header treatment. |
| Workspace Agent run/activity/working animation | implemented, manual-smoke-pending | Run controls were simplified; run activity copy, working state, thread state, and explicit new-thread controls were clarified without adding hidden execution. | Manually smoke Codex run start, working indicator, activity line, thread copy/new-thread behavior, working-directory isolation, and `allowed_tools: []` visible-context boundary. |
| Notes rail/prettify | implemented, manual-smoke-pending | Notes list rail collapse/expand and source-text formatting helpers exist, with focused tests for Notes layout and formatter behavior. | Manually smoke rail collapse/expand, list/editor usability, Ctrl+S/Cmd+S editor-only save, JSON/source-text formatting controls, save/pin/filter, and no Notebook/rich-rendering overclaim. |
| Queue right rail/sidebar/flow/tags | implemented, manual-smoke-pending | Queue panel structure was simplified; sidebar/detail/right-rail organization, activity/detail sections, Flow Map tag stability, and tag color controls exist in source-level follow-ups. | Manually smoke task create/select/edit, sidebar and details rail scanning, Flow Map item/tag selection, tag pause/color/dependency states, and that clicking flow/list/detail UI never starts execution by itself. |
| Knowledge IA | implemented, manual-smoke-pending | Knowledge / Skills IA was unified across Skills, Documents, catalog preview/detail, utility panels, quick summary/source/scope fields, and attachment review surfaces. | Manually smoke Skill CRUD/attach, Document CRUD/import/search, quick summaries, scope/source labels, Notes promotion, Queue attach/materialization, and no full Knowledge Catalog or hidden memory claim. |
| Terminal autostart/compact/tabs/splits | implemented, manual-smoke-pending, contract-follow-up | Terminal source follow-ups added automatic PTY shell start behavior plus tab and split-pane UI. Older current-surface contracts still describe no Terminal tabs/splits, so acceptance wording needs reconciliation before final Stable language changes. | Manually smoke Terminal start/autostart, tab create/close behavior, split pane behavior, Stop/Kill/Close scoping, session-only output, no persistent transcripts, no Workspace Agent/Queue control, and contract alignment for tabs/splits. |
| Finder home/root/primary surface | implemented, manual-smoke-pending, contract-follow-up | Finder source follow-up makes Home/default Finder orientation the primary surface while preserving explicit root/open-root UI and visible unsupported listing states where handles are unavailable. Some older status/copy may still understate Finder as read-only or root-only. | Manually smoke Home/default orientation, explicit root approval, directory columns, bounded preview, edit save/cancel, dirty selection blocking, Git status/diff/history/commit/push guardrails, and no hidden scanning or Workspace Agent context attach. |
| OOM stability | pending, manual-smoke-pending | Dev-only memory diagnostics and one known Queue run-link refresh loop fix are recorded; APP-RECOVERY-01 and APP-OOM-01 remain separate findings. | Run long-session desktop smoke with diagnostics enabled, capture initial/mid/final snapshots, verify idle heap/DOM/bucket growth, and separately smoke renderer reload/crash-like orientation recovery. |

## Remaining Manual Smoke Checklist

Run one consolidated desktop smoke pass on the candidate commit with an
isolated database and record date, tester, OS/platform, launch method,
database path, and commit under test.

1. Start/reopen a Workspace and confirm the default Workspace Agent plus Notes
   surface, recent Workspace recovery, safe recent summaries, and Workspace
   isolation.
2. Smoke shared shell polish: top-bar Workspace/Workbench identity, View
   controls, catalog drawer, popup stacking, widget focus/z-order, move/resize,
   float/dock, remove confirmation, and widget-local logs.
3. Smoke Workspace Agent: examples, run controls, visible context, working
   animation, activity line, thread state/new thread, Queue/Note/Knowledge/JDBC
   proposal review, separate explicit create actions, and no hidden execution.
4. Smoke Agent Activity: current-session timeline rows, expansion, raw detail
   collapsed by default, auto-follow behavior, and no persistence/execution
   claim.
5. Smoke Queue: create/edit/delete, sidebar/right rail/detail scanning, Flow
   Map, tags, assignment, explicit start, Autorun arming, run links, report
   ready, closure decisions, and no auto-finalization.
6. Smoke Knowledge draft review and IA: draft pack accept/reject, Skill CRUD
   and attach, Document CRUD/import/search, quick summaries, source/scope
   labels, Notes promotion, Queue attach/materialization, and no hidden memory.
7. Smoke Notes: rail collapse/expand, source-text formatting helpers, editor
   Ctrl+S/Cmd+S save, create/select/edit/save/pin/filter, desktop persistence,
   and no hidden Workspace Agent read.
8. Smoke Terminal: autostart, compact shell context, tabs, splits, PTY
   input/output/ANSI/resize, Stop/Kill/Close, one-shot fallback, unsupported
   platform honesty, session-only buffers, and no agent/Queue control.
9. Smoke Finder: Home/default orientation, explicit root approval, columns,
   bounded preview, floating preview states, edit save/cancel, dirty-state
   blocking, capped/binary/permission states, Finder Git status/diff/history,
   selected-file commit, manual push guardrails, and no hidden scanner/context
   attach.
10. Smoke OOM/recovery: enable dev memory diagnostics, capture initial/mid/final
    snapshots during a long session, exercise Queue run-link refresh paths, and
    separately confirm normal renderer reload preserves operator orientation or
    shows a clear recovery failure notice.

## Intentionally Not Changed

- No frontend behavior changes.
- No backend, Tauri, storage, or schema changes.
- No runtime execution changes.
- No Stable v0.1 acceptance result change.
- No contract reconciliation beyond this status record.
