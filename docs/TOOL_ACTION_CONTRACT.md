# Tool Action Contract

## Definition

Tools are structured capabilities, not random text commands.

A Tool Action is a typed request to use a capability within a Workbench Session. It must be visible to the operator when it affects workbench state, external systems, files, data, or generated outputs.

For Coordinator-centered widget use, the capability side of this model is
defined in `docs/WIDGET_CAPABILITY_TOOL_CONTRACT.md`. Widgets expose explicit
capabilities with risk, autonomy, context, secrets, and audit boundaries; Tool
Actions are the visible requests or executions of those capabilities.

## Action Shape

A Tool Action should define:

- type
- purpose
- risk
- approval requirement
- expected output
- result

## Coordinator Action Proposals

A Coordinator action proposal is a visible draft that may become a Tool Action
only after operator review and approval. A proposal is not execution by itself.
It must not trigger provider tool calls, widget capability calls, Terminal
commands, Git mutation, JDBC SQL execution, Agent Executor runs, Queue
dispatch, filesystem reads, or hidden context collection.

A Coordinator action proposal should define:

- title
- target widget or widget kind
- target capability
- intent
- required inputs
- visible risk/safety notes
- expected result
- approval status
- execution status
- result summary

The proposal UI should be message-associated in Coordinator Chat and expose
Approve, Reject, Edit, and Copy controls. All target and input values must be
visible before approval. Edits create a new reviewed input state; approval of
one proposal does not approve different future actions.

Initial safe proposal types:

- create Agent Queue task from explicit Coordinator/operator text
- create Note from explicit Coordinator/operator text
- prepare JDBC query suggestion text without execution

Terminal command proposals, Git mutations, JDBC SQL execution, Agent Executor
run launch, Queue auto-dispatch, and hidden context compilation are out of the
first proposal UI slice.

Provider-backed Coordinator proposals follow the same rule. A provider may
return assistant text and proposal drafts, but those drafts are not Tool
Actions and are not execution authority. The first provider slice must use
`allowed_tools: []`; provider output must be parsed and validated before
rendering, and unsupported or unsafe drafts must degrade to plain text or a
visibly rejected draft. Queue task creation, Note creation, JDBC suggestion
copying, and any future widget action remain separate operator-visible actions
after review and approval.

## Approval

Dangerous actions require explicit approval before execution.

Dangerous actions include actions that may alter files, execute commands, change databases, modify external systems, spend money, publish data, delete data, or produce irreversible results.

## Future Examples

- Terminal actions
- Codex Direct Work executor actions
- Script Runner actions for explicit operator-controlled configured local scripts
- JDBC actions
- Git actions
- JIRA and Confluence read actions, with operator-approved update actions only in later explicit integration work
- Image actions

These examples are future capabilities. They must follow the same approval-aware action model.

Future Git commit actions are high-power mutating Tool Actions and must also
follow `docs/GIT_COMMIT_SUPPORT_CONTRACT.md`: visible change set,
operator-approved message, explicit confirmation, and no push in the first
commit slice.

Future Script Runner behavior is further defined in `docs/SCRIPT_RUNNER_WIDGET_CONTRACT.md`. It must use explicit script paths, argv arguments, visible working directories, output caps, timeouts, and operator Run actions, with no hidden or automatic execution.

Future Workspace-aware Coordinator Agent proposals are not tool execution by themselves. When an approved Coordinator proposal becomes a tool action, it must still follow this approval-aware Tool Action contract, the widget capability boundary in `docs/WIDGET_CAPABILITY_TOOL_CONTRACT.md`, and the approved-context proposal rules in `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`.

The first Coordinator provider slice is proposal-only under
`docs/AI_INTEGRATION_READINESS_CONTRACT.md` and must use `allowed_tools: []`.
AI may propose, but it cannot execute Terminal, Git, Notes, File, Script Runner,
Agent Queue, JDBC, or external-system actions directly.

## Relation To Direct Mode

Codex Direct Work is an explicit high-power tool/executor mode defined in
`docs/DIRECT_MODE_AGENT_CONTRACT.md`. The current implementation has frontend
Agent Executor launch/run surfaces plus backend/Tauri one-shot and streaming
run artifact foundations. Agent Monitoring Direct Work display, automatic
Queue dispatch, and broader tool execution remain future work.

Because Direct Work may edit files and run validation commands, it must require:

- explicit operator choice of Direct Work
- explicit approved execution workspace boundary
- explicit operator prompt
- explicit executor kind, starting with `codex_cli`
- explicit sandbox/mode, normally `workspace-write`
- explicit approval policy
- logged command and argv
- visible run status, raw log, final response, changed files when the
  workspace is a Git repository, and validation summary

Direct Work must not be launched silently, run in the background without visible
state, auto-commit, auto-push, mutate Git, automatically dispatch Queue items,
or use
`danger-full-access` as a default or MVP behavior.
