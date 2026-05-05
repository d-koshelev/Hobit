# Desktop Frontend

This directory contains the future Hobit desktop frontend.

## Current State

The current milestone is a static Minimal Workbench shell built with Vite, React, and TypeScript.

It shows two mock widget blocks:

- Terminal Widget
- Agent CLI Widget

The UI is a frontend-only preview. It does not connect to Tauri, a backend, a terminal, or an agent runtime.

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
- Widget registry.
- Preset persistence.
- Tauri integration.
- Knowledge, Stages, Runbooks, Git, JDBC, Image Edit, or database UI.
