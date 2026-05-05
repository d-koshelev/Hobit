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
