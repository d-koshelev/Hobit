# Widget Contract Template

Use this template before implementing a new widget or a major widget change.
The completed contract should be approved before implementation starts.

This template is docs-only process guidance. It does not make any Planned,
Deferred, Compatibility, or future example behavior current.

Finder examples in this template are future/reference examples only. Finder is
not a current catalog widget unless a future task explicitly implements it.

## 1. Purpose

Describe what the widget or major change exists to accomplish.

Include:

- the operator problem;
- the Workspace capability provided;
- the current/planned/deferred status;
- the contracts that govern current behavior.

Example:

- Agent Queue organizes Workspace-scoped async task records and Executor run
  history references.
- Finder would provide approved Workspace/project navigation and bounded file
  selection, not shell access.

## 2. Primary user

Name the primary user and their decision point.

Template:

```text
Primary user:
Primary decision:
What they need to see:
What they must control:
```

## 3. Product scenario

Describe the concrete scenario this widget supports.

Template:

```text
Scenario:
Starting condition:
User intent:
Expected outcome:
Why this belongs in a widget:
```

## 4. Happy path

List the normal path from entry to accepted outcome.

Template:

1. User opens or focuses the widget.
2. User provides or selects required context.
3. Widget exposes a safe state snapshot.
4. User or Workspace Agent requests an app-native action.
5. Widget emits events and updates state.
6. User reviews evidence/result.
7. User accepts, finalizes, or creates follow-up work.

## 5. Out of scope

List explicit non-goals.

Include:

- behavior not implemented in this block;
- future behavior not made current;
- runtime paths not allowed;
- data access not allowed;
- mutations not allowed.

Example:

- Agent Queue does not auto-accept completed Executor output.
- Finder does not perform unbounded filesystem scans or arbitrary file writes.

## 6. Widget identity

Define how the widget is identified.

Template:

```text
widgetDefinitionId:
widgetInstanceId:
workspaceId:
workbenchId:
user-facing title:
compatibility ids:
singleton or multiple:
provider status:
```

Example:

```text
Agent Queue:
widgetDefinitionId: agent-queue
workspaceScopedResource: canonical-agent-queue
singleton: true per Workspace
```

Example:

```text
Finder:
widgetDefinitionId: finder
scope: workspace-approved-root-or-project
status: future/reference only
```

## 7. State snapshot

Define the safe bounded state the widget can expose.

Include:

- revision/version;
- lifecycle status;
- selected safe fields;
- current focus or selection;
- visible errors;
- compact counts and summaries;
- redaction/capping notes.

Do not include secrets, raw large logs, full diffs, full SQL results, full
Terminal transcripts, or hidden state by default.

Example:

- Agent Queue snapshot: queue revision, task counts by state, selected task
  id, assignment summary, safe latest-run references.
- Finder snapshot: approved root label, current directory, bounded entry list,
  selected item, cap/redaction metadata.

## 8. Capabilities

List the capabilities the widget exposes.

Template for each capability:

```text
capabilityId:
display name:
description:
input shape:
output shape:
risk level:
action level:
requires confirmation:
requires selected context:
enabled/unsupported state:
```

Example:

- `queue.task.create`
- `queue.task.update`
- `queue.task.start_assigned`
- `finder.directory.list`
- `finder.file.read_selected_preview`

## 9. Actions

Define app-native action requests.

Template for each action:

```text
actionId:
target capability:
typed input:
requester:
purpose:
required approval:
idempotency/revision rule:
expected events:
expected state result:
output cap:
```

Actions must go through Workspace/widget APIs. They must not be implemented as
shell strings, DOM clicks, direct storage edits, localStorage mutation, or
private component calls.

## 10. Events

Define observable events.

Template for each event:

```text
event kind:
cause/action id:
previous state:
next state:
summary:
evidence/log refs:
timestamp:
```

Example Queue events:

- task created;
- task updated;
- assignment changed;
- assigned task start requested;
- run link attached;
- coordinator decision applied.

Example Finder events:

- root selected;
- directory listed;
- item selected;
- preview loaded;
- search capped.

## 11. Evidence and logs

Define what evidence/log information supports review.

Include:

- safe evidence references;
- bounded log summaries;
- selected excerpts;
- result/report summaries;
- redaction and truncation metadata.

Define what is not exposed by default.

Example:

- Agent Queue may show safe run-link metadata and report references, but not
  raw Executor stdout/stderr by default.
- Finder may show selected path references and bounded previews, but not
  secret files or unbounded recursive scan output.

## 12. State machine

Define the state machine before UI implementation.

Template:

```text
States:
Initial state:
Terminal/final states:
Allowed transitions:
Invalid transitions:
Transition events:
Who can request each transition:
Failure states:
Blocked states:
Review/finalization semantics:
```

Queue example states:

- `Draft`
- `Queued`
- `Running`
- `Execution complete`
- `Report ready`
- `Awaiting coordinator review`
- `Finalized`
- `Failed`
- `Blocked`

Required Queue semantics:

- Execution complete is not Accepted.
- Report ready is not Finalized.
- Awaiting coordinator review is not Done.

Finder example states:

- `No approved root`
- `Root selected`
- `Listing`
- `Listed`
- `Item selected`
- `Preview ready`
- `Capped`
- `Unsupported`
- `Failed`

## 13. UI composition

Name the UI sections before implementation.

Template:

```text
Target display level: Minimal | Operational | Full / Expert
Sections:
Primary action:
Secondary actions:
Collapsed details:
Raw/debug details:
Empty state:
Error state:
```

Example Queue right rail sections:

- Overview
- Prompt
- Agent activity / Result
- Coordinator decision
- Timeline
- Developer details

Example Finder sections:

- Root / scope
- Directory listing
- Selection details
- Preview
- Search / filters
- Developer details

## 14. Safety policy

Define safety boundaries.

Include:

- safe reads;
- sensitive reads;
- local mutations;
- external/database actions;
- command/Terminal actions;
- async Queue/Executor actions;
- destructive actions;
- secrets and credential-adjacent data;
- AI-readable context rules;
- confirmation requirements.

Example:

- Agent Queue task create/update is a local mutation.
- Starting an assigned task is async execution and requires explicit approval
  or a future approved policy.
- Finder listing is a safe read only inside approved scope.
- Finder preview can become a sensitive read and must be selected, capped, and
  redacted.

## 15. Semantic tests

List semantic tests before implementation.

Each test should use app-native actions, events, safe state snapshots, and
evidence/report assertions.

Template:

```text
Test name:
Fixture/setup:
Action(s):
Expected events:
Expected state:
Expected evidence/report:
Safety assertions:
Cleanup:
```

Example Queue semantic tests:

- create task;
- run task;
- read report;
- assert state;
- apply coordinator decision.

Example Finder semantic tests:

- select test root;
- list fixture directory;
- select fixture file;
- read capped preview;
- assert cap/redaction metadata.

## 16. File/component plan

Plan file boundaries before implementation.

Template:

```text
Primary component:
Section components:
Controller/view-model files:
API/type files:
Test files:
CSS files:
Expected line budget:
Warning thresholds:
Split trigger:
```

Default budgets:

- React component target: 300-500 lines.
- React component warning: 700 lines.
- React component hard stop: 1000 lines.
- View-model/helper target: 400-600 lines.
- Test file warning: 900 lines.
- CSS surface warning: 600 lines.

## 17. Validation plan

List validation commands and when they are expected to run.

Template:

```text
Iteration validation:
Final validation:
Semantic tests:
Smoke/manual checks:
Expected environment limitations:
```

Use Hobit Toolbelt validation profiles when possible and do not silently
weaken final validation.

## 18. Acceptance criteria

Define reviewable criteria.

Template:

- behavior matches this contract;
- state transitions match the state machine;
- actions/events match the action/event contract;
- UI sections match the composition plan;
- semantic tests pass or are explicitly deferred;
- file/component budget is respected;
- validation passes or failures are reported;
- no out-of-scope behavior is implemented.

## 19. Future compatibility notes

Document future considerations without implementing them.

Include:

- multi-Workspace or multi-Workbench implications;
- future multi-coordinator compatibility;
- future capability extensions;
- compatibility ids or persistence aliases;
- future schema/API migration notes;
- Deferred behavior that must remain out of scope.

Example:

- Agent Queue should remain one canonical Queue per Workspace even if multiple
  Queue views or future Coordinators exist.
- Finder should remain app-native and scoped to approved roots; future write
  actions require a separate file/code capability policy.
