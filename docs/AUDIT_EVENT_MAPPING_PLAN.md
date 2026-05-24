# Audit Event Mapping Plan

## Purpose

This document maps current Hobit event-like, run, log, result, task, and
proposal surfaces to the future `AuditEventEnvelope` v0 vocabulary.

It is a readiness plan only. It does not implement audit persistence, event
emission, schema changes, DTO changes, Tauri command changes, runtime wiring,
server runtime, organizations, tenants, enterprise permissions, or RBAC.

## Current Status

`crates/hobit-app/src/audit_events/mod.rs` defines `AuditEventEnvelope` v0 and
related refs, actor, approval, artifact, event kind, risk, summary, and error
classification types.

`docs/WORKSPACE_CAPABILITY_BOUNDARY_CONTRACT.md` defines type-only capability
refs and risk, approval, context, execution, mutation, external access, secret
exposure, and artifact policy vocabulary that future audit events may
reference.

`docs/ARTIFACT_REFERENCE_OWNERSHIP_CONTRACT.md` defines metadata-only artifact
refs, source refs, ownership, visibility, sensitivity, AI-context eligibility,
and evidence eligibility vocabulary. It does not add an artifact store,
artifact persistence, artifact resolution, audit emission, evidence store, or
knowledge store.

`docs/KNOWLEDGE_SKILLS_EVIDENCE_CONTRACT.md` defines docs-only Knowledge,
Skills, Evidence, Context Pack, and Runbook boundaries. It does not add
Knowledge or Evidence persistence, automatic context ingestion, Coordinator
context wiring, audit emission, schema changes, runtime behavior, server
runtime, or RBAC.

No current path persists audit events. No current path emits audit events from
Workspace, Widget, Queue, Direct Work, Terminal, Git, JDBC, Coordinator, Notes,
or Runbook behavior. Existing Workspace events, widget logs, widget runs,
widget results, frontend session state, and runtime DTOs are not audit records.

Desktop MVP may keep `organization_id: None`. Local operator events may keep
`actor.actor_id: None` until an explicit identity model exists.

## Mapping Table

| Current surface | Future event mapping | Fields available today | Missing or deferred fields | Artifact safety |
| --- | --- | --- | --- | --- |
| Workspace create/open/delete | `WorkspaceCreated` for create; future open/delete need new or `Unknown` kinds unless v0 expands | `workspace_id`, initial `workbench_id` in event payload for create, session id for open, timestamps in storage | durable actor id, action id, causation/correlation id, first-class delete event kind, parsed event payload refs | Workspace title/description are operator text and should not be copied into audit summaries beyond safe labels |
| Workbench/widget add | `WidgetAdded` | `workspace_id`, `workbench_id`, `widget_instance_id`, `widget_definition_id`, timestamp, safe summary | actor id, action id, causation/correlation id, capability id | Widget title/config/state are artifact or product state; audit summary should stay generic |
| Widget delete/state/layout update | delete/update need v0 expansion or `Unknown`; layout update may be low-risk presentation metadata | `workspace_id`, `workbench_id`, `widget_instance_id`, `widget_definition_id`, event/log timestamps | event kinds for delete/state/layout, actor id, action id, correlation id, structured payload instead of semicolon text | Widget state may contain arbitrary widget data; do not copy state JSON into audit summary |
| Generic widget runs/logs/results | `RuntimeStarted`, `RuntimeEventObserved`, `RuntimeCompleted`, `RuntimeFailed`, `ArtifactCreated` | `widget_instance_id`, `run_id`, command kind/payload, status, result id, result type, timestamps, log level/message/details | workspace/workbench refs require join through widget, widget definition ref requires join, actor/action/correlation ids, artifact ids separate from row ids, redaction status must be derived | `command_payload`, log details, result content, result payload are artifact content and must be referenced, not summarized raw |
| Agent Queue task create/update/assignment | `TaskCreated`, `TaskUpdated`; assignment may need `TaskUpdated` or v0 expansion | `task_id` as `queue_item_id`, `workspace_id`, status, priority, execution policy, assigned executor widget id, timestamps | workbench/widget refs are not on task rows, actor id, action id, correlation id, approval metadata, distinct assignment event kind | title/description/prompt are operator text artifacts; prompt must not enter audit summary |
| Agent Queue assigned task start/completion | `TaskStarted`, `TaskCompleted`, plus Direct Work runtime events | `task_id`, `workspace_id`, executor `widget_instance_id`, executor `workbench_id`, Direct Work `run_id`, status transitions | causation/correlation linking task start to Direct Work run, approval id/status, durable runner/session id for frontend sequential runner | task prompt becomes Direct Work operator prompt artifact; do not duplicate it in audit summary |
| Agent Queue Sequential Queue Runner / Autorun | Not audit events yet, except explicit task assignment/start/completion paths they invoke | current-session runner config, visible operator start/arm, desktop-local Autorun snapshot, and safe Queue run-link metadata exist | no durable runner id, no backend scheduler record, no stable correlation id, no persisted runner lifecycle, no reconnect/resume | runner config may include local paths/prompts; treat as command payload/local path artifact later |
| Direct Work start | `RuntimeStarted` and possibly `CapabilityRequested`/`CapabilityApproved` when capability modeling exists | `workspace_id`, `workbench_id`, `widget_instance_id`, `widget_definition_id=agent-run`, `run_id`, command kind, sandbox, approval policy, timeout/caps | actor/action/correlation id, explicit capability id, explicit approval id/status, artifact ids for operator prompt/repo root/command payload | operator prompt, repo root, codex executable, command payload are artifacts; summary should be status-only |
| Direct Work stream/live events | `RuntimeEventObserved` | `workspace_id`, `workbench_id`, `widget_instance_id`, `run_id`, event kind, elapsed, final marker, parsed event type, status/error fields | durable event id per emitted stream event, redaction classification persisted with event, correlation id | stdout/stderr lines, Codex JSON, text, stderr previews, final message are raw/generated artifacts and must not be copied into summaries |
| Direct Work final result | `RuntimeCompleted` or `RuntimeFailed`, plus `ArtifactCreated` for result/log artifacts | `run_id`, result id, final status, exit code, duration, truncation flags, no-auto-commit/no-auto-push flags | causation from start event, correlation id, stable artifact refs for stdout/stderr/final response/result payload | stdout, stderr, final response, error text, changed files payload are artifact refs only |
| Direct Work cancellation/force kill | v0 lacks specific cancel kinds; use future expansion or `RuntimeEventObserved`/`RuntimeFailed` | `workspace_id`, `workbench_id`, `widget_instance_id`, `run_id`, log message, requested flags | actor/action id, approval id for force kill if required, distinct cancellation event kinds | force-kill payload is mostly metadata; do not include raw prior output |
| Direct Work validation | `RuntimeStarted`, `RuntimeCompleted`, `RuntimeFailed`, `ArtifactCreated` | `workspace_id`, `workbench_id`, `widget_instance_id`, `run_id`, profile, status, exit code, duration, truncation flags | action/correlation ids, artifact refs for profile command, stdout/stderr, error class | validation stdout/stderr and repo root are artifacts, not audit summary text |
| Terminal one-shot fallback | `RuntimeStarted`, `RuntimeCompleted`, `RuntimeFailed`, `ArtifactCreated` | `workspace_id`, `workbench_id`, `widget_instance_id`, `run_id`, command payload, final status, exit code, duration, caps | actor/action/correlation ids, approval metadata, stable artifact refs | program, argv, working directory, stdout, stderr, error message are artifacts and must not be copied into summary |
| Terminal PTY session create/stdin/resize/stop/kill/close | Not durable audit events yet; future mapping likely `RuntimeStarted`, `RuntimeEventObserved`, terminal action events, completion/close | session id, workspace/workbench/widget refs, shell, args, working directory, status, output buffer metadata, timestamps in memory | no persistence, no widget run/result ids, no durable action ids, no correlation id, output artifact refs are session-only | PTY output chunks, stdin, shell args, and working directory are artifacts; bounded buffer is not redaction |
| Git status/diff read | future `CapabilityRequested`/`RuntimeCompleted` or read-only `RuntimeEventObserved`; no audit event yet | workspace/workbench/widget refs for status, explicit repo root, changed file metadata, warnings; diff summaries have repo root and patch previews | no persisted Git action/run id for status/commit, no artifact ids, no correlation id, no approval record for read | repo root, file paths, raw diff/patch previews, warnings are artifacts; status summary can be safe counts only |
| Git selected-file commit | future `CapabilityRequested`, `CapabilityApproved`, `RuntimeStarted`, `RuntimeCompleted`/`RuntimeFailed` | workspace/workbench/widget refs, repo root, included files, commit message, command summary, commit hash, flags proving no push/reset/clean/force-push | no persisted run/action id, no approval id despite operator confirmation UI, no artifact refs | commit message, paths, stdout/stderr are artifacts; commit hash and safety flags can be safe metadata |
| JDBC connector metadata create/update | future `TaskUpdated`/`CapabilityRequested` or v0 expansion for connector metadata; not runtime audit yet | workspace id, connector id, display name, kind, masked URL metadata, read-only default, status, timestamps | workbench/widget refs are not stored with connector, actor/action/correlation ids, capability id | connector notes and masked URL are metadata/operator text; still avoid copying full values into summaries |
| JDBC SQL validation | future read-only `CapabilityRequested`/`RuntimeCompleted`; no durable run today | workspace/workbench/widget refs, connector id, SQL text, row/timeout caps, validation result | no run/action id, no persisted artifact id, no correlation id | SQL text and normalized preview are artifacts; summary may say validation passed/rejected only |
| JDBC bounded mock execution | future `RuntimeStarted`, `RuntimeCompleted`/`RuntimeFailed`, `ArtifactCreated` | workspace/workbench/widget refs, connector id, validation, status, row counts, truncation flags, mock/no-secrets/no-ai-context flags | no durable run/result rows, no action/correlation ids, artifact refs for SQL/result rows | SQL, rows/cells, connector notes, sanitized error are artifact refs; summary should use status/counts only |
| Coordinator provider response | future `RuntimeStarted`, `RuntimeCompleted`/`RuntimeFailed`, `ProposalCreated` for accepted drafts | workspace/workbench/widget refs, request id, provider kind/status, allowed_tools `[]`, no-hidden-context/tools/mutations flags, draft proposal ids | no persistence for current Coordinator provider responses, no actor/provider identity, no action/correlation ids, no artifact refs | operator message, visible conversation, assistant text, provider error, provider drafts are artifacts |
| Coordinator proposal approval/rejection/edit | future `ProposalApproved`/`CapabilityRejected` or v0 expansion for edit/reject; current state is frontend-only | proposal id/type, target widget/capability strings, risk level, approval/execution status in React state | no persistence, no approval id, no backend actor/action/correlation id, target widget is label not durable ref | visible proposal inputs, risk notes, SQL suggestion text, formatted details are artifacts |
| Coordinator approved create Queue task / create Note handoff | `ProposalApproved` followed by `TaskCreated` or `NoteCreated`; create action must be separate from approval | resulting queue task id or note id after explicit create action, workspace id | durable causation/correlation from proposal approval to create action, approval id/status, proposal persistence for current Coordinator Chat | proposal fields become task/note input artifacts; do not copy raw body/prompt into audit summary |
| Retained Agent Chat proposal compatibility | `ProposalCreated`, `RuntimeCompleted`, `ArtifactCreated` when kept | workspace/workbench/widget refs, run/result ids, proposal id, approved context snapshot payload, no-tools/no-mutations flags | compatibility surface is not preferred current product model; audit adoption should wait for cleanup decision | operator prompt, approved context snapshot, raw provider response, proposal payload are artifacts |
| Notes create/update/pin | `NoteCreated`; update/pin need v0 expansion or `Unknown`/`TaskUpdated` until expanded | `note_id`, `workspace_id`, title/body/pinned/archived timestamps | widget/workbench refs are absent for Notes API, actor/action/correlation ids, causation from Coordinator proposal when applicable | note title/body are source text artifacts; audit summary should say note created/updated without body text |
| Notes list/read/filter/select | Should not become audit events yet in desktop MVP | workspace id, note id for reads | no user identity/permission model, no durable read intent/action id | reading note body would create sensitive access logs; defer until permissions/audit policy exists |
| Runbook local step state/notes | Should not become audit events yet | frontend-only step id/title/state/notes in React session | no persistence, workspace/workbench/widget refs only through widget instance, no action/run ids, no artifact refs | runbook notes/evidence text are local session artifacts; do not audit until durable model exists |
| Browser/Vite memory fallbacks | Should not become durable audit events | local in-memory ids and state only | no durable persistence boundary, no audit store, no desktop runtime ownership | dev-only data must not be treated as audit history |

## Field Readiness

Available today:

- `workspace_id` for most persisted Workspace, Queue, Notes, JDBC, and widget
  surfaces.
- `workbench_id` and `widget_instance_id` for widget-owned runtime and
  capability paths.
- `widget_definition_id` by joining a widget instance.
- `task_id` for Agent Queue task rows through `queue_item_id`.
- `run_id` for widget run rows and Direct Work/Terminal one-shot
  persistence.
- result/log ids that could become output artifact refs later.
- timestamps for persisted rows and some session-only runtime snapshots.
- coarse statuses, safe lifecycle summaries, truncation flags, and runtime
  error classes in runtime boundary scaffolding.

Missing or deferred:

- stable `actor_id`; current local operator events usually have no identity.
- `organization_id`; desktop MVP intentionally has none.
- explicit `action_id` for operator commands.
- durable `causation_id` and `correlation_id` across proposal approval,
  create action, Queue task start, Direct Work run, validation, and follow-up
  review.
- explicit `approval_id`/`approval_status`; current UI has confirmations and
  preview approval state, but not durable approval records.
- stable artifact ids for classified runtime artifacts. Current
  `RuntimeArtifactSummary` and `ArtifactRef` vocabulary are metadata-only and
  not persisted as an artifact registry.
- persisted owner refs for Notes APIs, JDBC connector metadata, Git status,
  Git commit result, Coordinator provider response, PTY sessions, and Runbook
  local state where those refs are not already stored.
- event kinds for delete, note update, note pin, widget state/layout update,
  Git commit, cancellation, force kill, connector metadata mutation, and
  read-only status/validation actions.
- redaction status derived and stored per event/artifact rather than inferred
  transiently in helper code.

## Artifact Safety Rules

Audit summaries must remain safe metadata. They must not copy raw:

- operator prompts;
- Queue task prompts, descriptions, or proposal input bodies;
- Notes body text;
- stdout or stderr;
- Terminal PTY output or stdin;
- Codex JSON stream events or final LLM responses;
- provider responses or assistant text;
- Git diffs, patch previews, file contents, repository paths, or commit
  messages;
- SQL text, normalized SQL previews, result rows, cell values, or connector
  notes;
- local filesystem paths;
- secrets, credentials, tokens, environment values, or secret-like errors.

Artifact refs are references only. They should identify separately classified
artifacts and carry artifact class plus redaction status, not raw payloads.
Caps, truncation, and bounded buffers are not redaction.

Safe audit summaries may use generic lifecycle language such as "Direct Work
run started", "JDBC validation rejected SQL", "Git status read completed", or
"Note created", plus safe counts/status flags when derived intentionally.

## Surfaces To Defer

These surfaces should not become audit events in the next audit slice:

- Terminal PTY output polling and stdin, until PTY lifecycle/action refs and
  artifact refs are durable.
- Runbook local step state and notes, until Runbook has durable product state.
- Browser/Vite memory fallbacks, because they are development-only and not
  durable audit history.
- Notes list/read/filter/select, until a permission/read-audit policy exists.
- Coordinator frontend-only proposal edit/approve/reject state, until
  proposal and approval records are durable.
- Agent Queue Sequential Queue Runner / Autorun lifecycle, except the explicit
  assignment/start/completion and safe run-link paths they already invoke.
- Git status/diff refreshes and JDBC validation/execution as audit records
  until action ids, artifact refs, and redaction metadata exist.

## Non-Goals

This plan does not authorize:

- audit persistence or event emission;
- audit tables, migrations, or storage schema changes;
- DTO or Tauri command changes;
- frontend behavior changes;
- changes to Queue, Direct Work, Terminal, Git, JDBC, Coordinator, Notes, or
  Runbook behavior;
- server runtime;
- organization, tenant, user, permission, enterprise, or RBAC behavior;
- event sourcing;
- automatic context capture or hidden tool execution.

## Recommended Future Implementation Order

1. Define Workspace capability/action boundary ids for explicit operator
   actions without changing runtime behavior.
2. Use metadata-only artifact ref vocabulary to point at existing widget
   run/result/log rows and future artifact records without copying raw
   payloads.
3. Add causation/correlation conventions for visible operator action,
   proposal approval, Queue task start, Direct Work run, validation, and final
   result chains.
4. Add approval record vocabulary for preview approval, confirmation, and
   force-kill/destructive confirmations without wiring audit emission.
5. Extend v0 event kind vocabulary only where current surfaces need precise
   names and the product contract is stable.
6. Pilot audit emission later on the narrowest durable path: widget add,
   Direct Work start/final result, and Queue assigned-task start/completion.
7. Defer PTY, Runbook, Coordinator frontend-only proposal state, Notes reads,
   Git/JDBC read actions, and browser memory fallbacks until their ownership,
   action, artifact, and permission boundaries are durable.
