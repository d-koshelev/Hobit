# hobit-core

Pure domain contracts and shared core model types for Hobit.

`hobit-core` now contains minimal canonical Rust contracts for:

- Workspace and WorkspaceSession.
- Workbench surfaces inside a Workspace.
- Workbench presets copied into Workspace state.
- Widget runtime lifecycle: input, command/action, run, local logs, and structured results.
- Widget layout and presentation state, including docked, minimized, popped-out, ghost, resize/reposition, and always-on-top concepts.
- Action proposals, decision requests, Workbench events, agent activity events, and shared state objects.

## Belongs Here

- Workspace, Workbench, and WorkspaceSession identifiers and contract types.
- Widget, preset, event, action, decision, agent activity, and shared state domain contract types.
- Types that can be shared by storage, agent, tools, app, and frontend bridge layers.

## Does Not Belong Here

- Storage schema or persistence implementation.
- Tauri integration.
- Frontend code.
- External agent implementation.
- Real tool execution.
- Product feature logic.
- Concrete widget implementations.
