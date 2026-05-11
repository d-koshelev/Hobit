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
- Script Runner actions for explicit operator-controlled configured local scripts
- JDBC actions
- Git actions
- JIRA and Confluence read actions, with operator-approved update actions only in later explicit integration work
- Image actions

These examples are future capabilities. They must follow the same approval-aware action model.

Future Script Runner behavior is further defined in `docs/SCRIPT_RUNNER_WIDGET_CONTRACT.md`. It must use explicit script paths, argv arguments, visible working directories, output caps, timeouts, and operator Run actions, with no hidden or automatic execution.

Future Workspace-aware Coordinator Agent proposals are not tool execution by themselves. When an approved Coordinator proposal becomes a tool action, it must still follow this approval-aware Tool Action contract and the approved-context proposal rules in `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`.
