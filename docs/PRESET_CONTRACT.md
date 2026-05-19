# Preset Contract

## Definition

A Preset is a saved composition of widget instances, layout, configuration, and initial context rules.

Presets make workbench setups reusable. They are not hardcoded product modes.

## Current Implementation Status

The current product intentionally supports one start preset: **Empty
Workbench**. Creating a Workspace starts with no default widget instances; the
operator adds Agent Executor, Git, Terminal, Notes, Agent Queue, Coordinator
Chat, Database / JDBC, or Runbook from the Widget Catalog after opening the
Workspace.

Preset construction, preset editing, preset persistence UI, template libraries,
marketplaces, default multi-widget templates, and AI-generated presets are
backlog/deferred work. The start screen should present Empty Workbench as an
intentional start mode, not as a broken preset selector.

## Preset Contents

A preset may define:

- widget instances
- widget configuration
- layout regions
- initial shared state rules
- available tool capabilities
- default context bindings

## Rules

- A preset must remain editable by the operator.
- A preset must not bypass approval requirements.
- A preset must not make optional capabilities mandatory for the whole product.
- A preset should compose existing widget definitions and templates.
- Choosing a preset instantiates or copies it into a Workspace.
- Workspace layout changes do not mutate the original preset unless the user explicitly chooses Save as Preset or Update Preset.
- A Workspace owns the actual widget instances created from a preset.

## Examples

- Empty Workbench: no default widgets; the operator composes the surface from the catalog.
- Starter Workbench: Terminal Widget + Agent CLI Widget when those widgets are implemented.
- Codebase Workbench: Agent CLI, Terminal, Git, Agent Activity, Shared State.
- Database Workbench: Agent CLI, Database/JDBC, SQL Results, Shared State.
- Design Workbench: Agent CLI, Image Edit, Agent Activity, Shared State.
