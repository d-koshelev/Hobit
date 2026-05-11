# Tool Action Contract

## Definition

Tools are structured capabilities, not random text commands.

A Tool Action is a typed request to use a capability within a Workbench Session. It must be visible to the operator when it affects workbench state, external systems, files, data, or generated outputs.

## Action Shape

A Tool Action should define:

- type
- purpose
- risk
- approval requirement
- expected output
- result

## Approval

Dangerous actions require explicit approval before execution.

Dangerous actions include actions that may alter files, execute commands, change databases, modify external systems, spend money, publish data, delete data, or produce irreversible results.

## Future Examples

- Terminal actions
- JDBC actions
- Git actions
- JIRA and Confluence read actions, with operator-approved update actions only in later explicit integration work
- Image actions

These examples are future capabilities. They must follow the same approval-aware action model.
