# Desktop Frontend

This directory contains the future Hobit desktop frontend.

## Current State

The current milestone is a static Minimal Workbench shell built with Vite, React, and TypeScript.

It shows two mock widget blocks:

- Terminal Widget
- Agent CLI Widget

The UI is a frontend-only preview. It does not connect to Tauri, a backend, a terminal, or an agent runtime.

## Widget Registry And Preset Model

The workbench is currently rendered from a frontend-local widget registry and preset model.

Registered widgets:

- Terminal
- Agent CLI

Current preset:

- Minimal Workbench

The Minimal Workbench preset defines the visible widget instances and their order. `WidgetHost` resolves each instance through the local registry and maps it to the matching React widget component.

This milestone is still mock/static. There is no persistence, backend integration, or runtime widget loading yet.

## Visual Direction

The Minimal Workbench visuals now follow `docs/DESIGN_SYSTEM_CONTRACT.md`: dark-first surfaces, semantic status badges, shared widget anatomy, and low-noise operator controls.

The current visual milestone simplifies the Minimal Workbench surface so mock/runtime status appears once, while the top bar, canvas context, widget cards, and terminal/agent surfaces read as a polished dark desktop workbench.

Frontend colors are centralized in `src/styles/hobit-theme.css`. Raw colors outside that file are not allowed, and gradients are intentionally forbidden for the base UI.

This is still a static mock. There is no real terminal, agent runtime, Tauri bridge, persistence, or runtime widget loading yet.

## Run Locally

```powershell
npm install
npm run dev
```

## Build

```powershell
npm run build
```

## Intentionally Not Implemented Yet

- Real terminal execution.
- Real agent calls.
- Preset persistence.
- Tauri integration.
- Knowledge, Stages, Runbooks, Git, JDBC, Image Edit, or database UI.
