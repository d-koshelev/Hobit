# Template Contract

## Purpose

This contract defines future Hobit product and domain rules for first-class Request Templates and Response Templates.

Hobit currently uses prompt and response formats outside the product flow. This contract defines how reusable templates should eventually become Workspace/Project assets that help operators create consistent agent/tool requests and validate responses without making prompts hidden, automatic, or approval-bypassing behavior.

This is a product/domain contract only. No storage schema, UI implementation, agent runtime behavior, or tool execution behavior exists in this block.

## Current Status

Request Templates and Response Templates are not implemented yet.

The repository currently includes `docs/AGENT_RESPONSE_CONTRACT.md`, which defines the final-response format for project agents working on Hobit tasks. That document is a project agent operating contract. It is not yet a Hobit product feature, editable template asset, validation engine, or persisted Workspace object.

## Definitions

### Template

A Template is a reusable asset that helps create or validate a concrete work request or response.

Templates are not WidgetInstances. They may be selected or edited through future Workbench UI, but the template asset itself is not a visible workbench block.

Templates are reusable across Workspaces and Projects when the future product model supports those scopes. Applying a template to a task creates a concrete snapshot for that task.

### Request Template

A Request Template is a reusable structured request/prompt template for agent, tool, or manual work.

It defines the expected request shape, required context, constraints, safety rules, validation expectations, and optional response-template pairing before a concrete request is sent, copied, exported, or handed to an agent/tool.

### Response Template

A Response Template is a reusable expected response/report format.

It defines the required output structure, validation-reporting rules, warning sections, out-of-scope reporting, git/status expectations when relevant, and rules that prevent success claims when validation or commit steps fail.

### Request Snapshot

A Request Snapshot is the concrete request created by applying a Request Template and filling its variables for a specific task.

Request Snapshots are durable task artifacts when future storage supports them. Edits to the source template after snapshot creation must not silently mutate previous request snapshots.

## Request Template Contract

A Request Template should model:

- `id`: stable template identifier.
- `title`: short operator-facing name.
- `description`: concise purpose and expected use.
- `template_kind`: task category such as `implementation`, `audit`, `docs`, `refactor`, `bugfix`, or `smoke-test`.
- `target`: intended recipient such as `codex`, `agent`, `tool`, or `manual`.
- `variables`: named placeholders with labels, descriptions, default values, required flags, and allowed values when constrained.
- `required_context_sections`: named context blocks that must be supplied before use.
- `scope_section`: explicit boundaries for what the request includes.
- `do_not_change_section`: explicit exclusions and protected files, systems, or behavior.
- `implementation_requirements_section`: concrete requirements the assignee must satisfy.
- `safety_stopping_rules`: conditions that require stopping, asking, or refusing to proceed.
- `validation_commands`: requested commands or checks with ordering, optionality, and expected reporting.
- `manual_check_section`: operator-performed checks that cannot be automated.
- `commit_message_suggestion`: optional suggested commit message.
- `linked_response_template_id`: optional default Response Template to use for final reporting.
- `version`: human-facing template version.
- `revision`: monotonic revision or content hash used to identify the exact template body applied.
- `created_at` / `updated_at`: metadata for future auditability.
- `author` / `owner`: optional future ownership metadata.

Rules:

- A Request Template must make scope and exclusions explicit.
- A Request Template must not hide material instructions from the operator.
- A Request Template must not inject secrets or credentials.
- A Request Template must not bypass approval requirements for tools, actions, file edits, commits, or runtime execution.
- A Request Template may prepare a request for an agent or tool, but applying it must not automatically execute the request unless a future explicit approval-aware flow defines that behavior.
- A Request Template may reference a default Response Template, but the operator must be able to see the selected response expectations.

## Response Template Contract

A Response Template should model:

- `id`: stable template identifier.
- `title`: short operator-facing name.
- `response_kind`: report category such as `implementation`, `audit`, `blocked`, or `validation-only`.
- `required_header_format`: expected first line or header pattern.
- `required_sections`: ordered sections that must appear in the response.
- `validation_reporting_rules`: rules for listing requested commands, pass/fail/not-run status, and failure details.
- `warnings_section`: section for environmental warnings, caveats, and residual risk.
- `out_of_scope_section`: section for intentionally excluded work.
- `final_git_status_section`: section for final working-tree status when repository work is involved.
- `no_success_claim_rule`: explicit rule that success must not be claimed when required validation, implementation, or commit steps failed.
- `version`: human-facing template version.
- `revision`: monotonic revision or content hash used to identify the exact response expectations applied.
- `created_at` / `updated_at`: metadata for future auditability.
- `author` / `owner`: optional future ownership metadata.

Rules:

- A Response Template describes the expected final report shape. It does not prove the underlying work succeeded by itself.
- Response validation must report missing required sections as warnings or errors according to the future validation policy.
- Response validation must distinguish command failures from commands that were not run.
- Response validation must not rewrite the agent's report invisibly.
- Response Templates may be reused across many Request Templates.

## Relationships

- A Request Template may reference one default Response Template.
- A Response Template may be reused by many Request Templates.
- The operator may override the default Response Template before creating a concrete request when future UI supports it.
- Applying a Request Template creates a Request Snapshot containing the rendered request, filled variables, source request template id, source request template revision, selected response template id, and selected response template revision.
- Future edits to Request Templates or Response Templates must not silently mutate previous Request Snapshots or historical response expectations.
- Templates are reusable assets for Workspace/Project flows. They are not WidgetInstances, Workbench layout entries, or Presets.
- A future widget may expose a Template Library or request builder UI, but the template asset remains distinct from the widget instance rendering it.
- For agent block workflow, `docs/AGENT_OPERATING_MODEL.md` defines how a coordinator selects templates and creates concrete executor request snapshots.

## Future UI Behavior

Future Hobit UI may support:

- Template Library / Template Catalog browsing.
- Creating, editing, duplicating, archiving, and versioning templates.
- Selecting a Request Template when creating an agent request, tool request, task, or manual work item.
- Selecting or overriding the linked Response Template.
- Filling variables with validation for required placeholders.
- Showing required context sections before request creation.
- Previewing the generated concrete request before use.
- Copying or exporting the generated request.
- Creating a durable Request Snapshot for a Workspace task.
- Validating a response against the selected Response Template.
- Showing missing required sections, malformed sections, validation-reporting gaps, and warning conditions.

Future UI rules:

- Template controls must be explicit and visible to the operator.
- Generated prompts must be previewable before use.
- Hidden prompt mutation is forbidden.
- Template application must preserve approval-aware tool/action rules.
- Template editing must not change historical request snapshots unless the operator explicitly creates a new snapshot.

## Workspace And Project Scope

Future templates may exist at different reusable scopes:

- system templates shipped with Hobit
- Project templates shared across related Workspaces
- Workspace-local templates created for one piece of work
- user templates available across Workspaces

Scope rules:

- Workspace-local Request Snapshots belong to the Workspace that created them.
- Shared templates may be copied or referenced by Workspaces according to future storage rules.
- Applying a shared template into a Workspace records the source id and revision for auditability.
- Editing a shared template after use does not mutate the concrete request already created inside a Workspace.

## Non-Goals

This contract does not implement:

- storage schema or migrations
- Rust domain types
- TypeScript types
- React UI
- Tauri commands
- template editor UI
- template catalog UI
- response validation engine
- automatic agent execution
- prompt execution or tool execution
- secret injection
- approval bypasses
- hidden mutation of prompts
- changes to `docs/AGENT_RESPONSE_CONTRACT.md` as a product feature

## Architecture Boundary

Future implementation must preserve existing Hobit boundaries:

- `hobit-core` should own pure template domain contracts when implemented.
- Storage implementation must remain outside `hobit-core`.
- Frontend UI must treat visible template management surfaces as widgets or explicit Workbench controls.
- Agent/runtime integration must not make templates an implicit execution path.
- Tool/action execution must remain explicit, visible, and approval-aware.
