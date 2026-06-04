# Stable v0.1 UI Smoke Backlog

## Purpose

Record the UI smoke findings package status for the Stable v0.1 Workbench
surface. This is a status/backlog note only. It does not add product behavior,
frontend code, backend APIs, storage, runtime execution, or validation
requirements beyond the listed follow-up smoke scenario.

Status values:

- `implemented`: source-level fix is present and ready for manual smoke
  confirmation.
- `pending`: finding still needs implementation or a broader recovery pass.
- `blocked`: follow-up cannot proceed without a separate decision, dependency,
  or external condition.

## Findings Package Status

| Area | Finding | Status | Notes |
| --- | --- | --- | --- |
| Workspace Agent | Title should present the current surface as Workspace Agent rather than legacy Coordinator/Chat terminology. | implemented | Catalog/frame/product text uses Workspace Agent while retaining `interactive-agent` as compatibility identity. |
| Workspace Agent | Prompt examples should be available without adding persistent clutter to the header. | implemented | Examples are behind a compact Workspace Agent examples toggle. |
| Workspace Agent | Queue tools should remain visible, explicit, and review-oriented rather than hidden execution. | implemented | Workspace Agent Queue paths create/review/update explicit Queue drafts and do not run or dispatch work from chat. |
| Workspace Agent | Thread UX should show current Codex thread state and allow an explicit new-thread action without noisy controls. | implemented | Current-thread state, compact thread copy behavior, and New thread controls are present. |
| Shell | Workspace rename should be explicit from the top bar and not require leaving the Workbench. | implemented | Top-bar Rename opens an inline workspace-name form with Save/Cancel. |
| Shell | Workspace selector/status should make the current Workspace and Workbench readable without duplicating product hierarchy. | implemented | Top bar shows separate Workspace and Workbench pills. |
| Shell | View controls should group theme, layout lock, and grid controls instead of spreading them across the top bar. | implemented | Theme, Layout Lock, and Grid are grouped under the View control. |
| Widget Catalog | Catalog header should be compact and focused on catalog identity and Close. | implemented | Drawer header contains the Widget Catalog title and Close action only. |
| Widget surface | Widget surfaces should avoid heavy opacity/shadow effects that make the canvas feel layered or decorative. | implemented | Widget frames use solid theme surfaces and no frame shadow by default; popout/docked frames also avoid added shadow. |
| Widget layout | Widget edge resize should support all edges/corners with active-edge affordance, not only right/bottom handles. | implemented | Top, right, bottom, left, and corner resize handles are present and covered by focused shell tests. |
| Notes | Notes header should avoid duplicated widget/action information and keep the widget frame as the meta zone. | implemented | Notes uses the shared WidgetFrame action/status area plus a focused Notes body. |
| Notes | Notes layout should remain usable when the list competes with editor space. | implemented | Notes has a collapsible list rail and a two-pane editor/list layout. |
| Notes | Ctrl+S/Cmd+S should save only from note editor inputs when the selected note has unsaved changes. | implemented | NotesEditor intercepts Ctrl+S/Cmd+S from title/body inputs and calls the explicit save path only when dirty and not saving. |
| App recovery | App refresh/OOM recovery should preserve operator orientation after renderer reload or crash-like refresh. | pending | Last-open Workspace recovery exists for renderer reloads. Real OOM/crash hardening still needs manual smoke and possible broader recovery requirements. |

## Remaining Work

- Manually smoke the implemented UI fixes in the Tauri desktop shell.
- Define the expected behavior for true OOM/crash recovery separately from
  normal renderer reload recovery before marking the app recovery item
  implemented.

No item is currently marked `blocked`.

## Next Recommended Smoke Scenario

Run a single desktop manual smoke pass from a fresh default Workspace:

1. Create/open a Workspace with Workspace Agent plus Notes.
2. Rename the Workspace from the top bar, then open View and verify theme,
   layout lock, and grid controls are grouped there.
3. Open Widget Catalog and verify the compact header and product-facing widget
   entries.
4. In layout editing mode, resize a widget from left, top, bottom, right, and a
   corner; verify active handles are visible and layout persists after reload.
5. In Workspace Agent, open examples, run/review the thread controls, draft a
   Queue task through visible Queue tooling, and verify no hidden execution
   starts.
6. In Notes, collapse/expand the list, edit title/body, save with Ctrl+S or
   Cmd+S from the editor, and verify no agent context is created.
7. Refresh the app/renderer and verify the last active Workspace recovery path
   restores orientation or shows a clear recovery failure notice.
