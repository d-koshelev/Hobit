# Preset Contract

## Definition

A Preset is a saved composition of widget instances, layout, configuration, and initial context rules.

Presets make workbench setups reusable. They are not hardcoded product modes.

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

## Examples

- Minimal Workbench: Terminal Widget + Agent CLI Widget.
- Codebase Workbench: Agent CLI, Terminal, Git, Agent Activity, Shared State.
- Database Workbench: Agent CLI, Database/JDBC, SQL Results, Shared State.
- Design Workbench: Agent CLI, Image Edit, Agent Activity, Shared State.
