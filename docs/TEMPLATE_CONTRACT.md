# Template Contract

## Purpose

This contract defines Hobit's future product/domain rules for first-class Request Templates and Response Templates.

Hobit currently relies on manually written prompts and manually enforced response formats outside the product flow. That is error-prone, hard to reuse, hard to validate, and easy to drift. Request Templates and Response Templates should eventually become reusable Workspace/Project assets for structured agent, tool, and manual workflows.

This is a documentation and product/domain contract only. It does not implement storage, UI, response parsing, agent runtime behavior, tool execution, or automation.

## Current Status

Request Templates and Response Templates are not implemented yet.

The frontend currently has an insertable static Template Library placeholder widget. It makes the future Request/Response Template surface visible in the Workbench and shows static Request Template, Response Template, and Coordinator Workflow preview examples, but it does not implement template storage, template editing, variable filling, request generation, copy/send behavior, response capture, response parsing, response validation, executor launch or integration, Git-response association, or agent execution.

The repository currently includes `docs/AGENT_RESPONSE_CONTRACT.md`, which defines the final-response format for project agents working on Hobit blocks. That document is a project agent operating contract. It is not yet a Hobit product feature, editable template asset, validation engine, or persisted Workspace object.

Future agent/task run observability is defined in `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md`. Response Templates define the expected Result Report structure, while Raw Log and Overview Log remain separate observability views.

Future Agent Queue behavior is defined in `docs/AGENT_QUEUE_CONTRACT.md`. The Agent Queue may use applied Request Snapshots and selected Response Templates for concrete reviewable blocks, but queue storage, request generation, response capture, response validation, executor launch, and automatic execution are not implemented yet.

## Definitions

### Template

A Template is a reusable asset that helps create or validate a concrete work request or response.

Templates are reusable Workspace/Project assets. They are not WidgetInstances, Workbench layout entries, Presets, or hidden runtime instructions.

### Request Template

A Request Template is a reusable structured request/prompt template for agent, tool, or manual work.

It defines the expected request shape, required context, scope boundaries, exclusions, safety rules, validation expectations, manual checks, and optional response-template pairing before a concrete request is sent, copied, exported, or handed to an executor.

### Response Template

A Response Template is a reusable expected response/report structure for executor results.

It defines the required final report shape, validation-reporting rules, warnings, out-of-scope reporting, commit reporting, final git status reporting, and rules that prevent success claims when validation or commit steps fail.

### Request Snapshot

A Request Snapshot is the concrete request created by applying a Request Template and filling its variables for a specific block/task.

Request Snapshots are durable task artifacts when future Workspace history supports them. Future edits to the source Request Template must not silently mutate previous request snapshots.

### Captured Response

A Captured Response is the executor's final response associated with a Request Snapshot.

Captured Responses may be checked against the selected Response Template when future response validation exists. Future edits to the source Response Template must not silently mutate historical response expectations.

## Request Template Contract

A Request Template should model:

- `id`: stable template identifier.
- `title`: short operator-facing name.
- `description`: concise purpose and expected use.
- `template_kind`: task category such as `implementation`, `audit`, `docs-only`, `refactor`, `bugfix`, `smoke-test`, `investigation`, or `validation-only`.
- `target`: intended recipient such as `codex`, `executor-agent`, `tool`, or `manual-operator`.
- `variables`: named placeholders with labels, descriptions, default values, required flags, and allowed values when constrained.
- `required_context_sections`: named context blocks that must be supplied before use.
- `scope_section`: explicit boundaries for what the request includes.
- `likely_files_section`: expected files or areas that may be relevant.
- `do_not_change_section`: explicit exclusions and protected files, systems, behavior, or contracts.
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
- A Request Template must not bypass approval requirements for tools, actions, file edits, Git operations, commits, or runtime execution.
- A Request Template may prepare a request for an agent, tool, or operator, but applying it must not automatically execute the request.
- A Request Template may reference a default Response Template, but the operator must be able to see and change the selected response expectations when future UI supports that.
- A generated executor prompt is an applied Request Snapshot, not a live view of the template.

## Response Template Contract

A Response Template should model:

- `id`: stable template identifier.
- `title`: short operator-facing name.
- `response_kind`: report category such as `implementation-result`, `no-code-audit-result`, `failed-blocked-result`, or `validation-only-result`.
- `required_header_format`: expected first line or header pattern.
- `required_sections`: ordered sections that must appear in the response.
- `validation_reporting_rules`: rules for listing requested commands, pass/fail/not-run status, warnings, and failure details.
- `warnings_section`: section for environmental warnings, caveats, skipped checks, and residual risk.
- `out_of_scope_section`: section for intentionally excluded work.
- `commit_section`: section for commit hash and commit message when a commit is required or created.
- `final_git_status_section`: section for final working-tree status when repository work is involved.
- `no_success_claim_rule`: explicit rule that success must not be claimed when required validation, implementation, or commit steps failed.
- `version`: human-facing template version.
- `revision`: monotonic revision or content hash used to identify the exact response expectations applied.
- `created_at` / `updated_at`: metadata for future auditability.
- `author` / `owner`: optional future ownership metadata.

Rules:

- A Response Template describes the expected final report shape. It does not prove that the underlying work succeeded.
- Response validation must report missing required sections as warnings or errors according to future validation policy.
- Response validation must distinguish failed commands from commands that were not run.
- Response validation must not hide failed or skipped validation.
- Response validation must not rewrite the executor's report invisibly.
- Response Templates may be reused across many Request Templates.

## Request And Response Relationship

- A Request Template may reference one default Response Template.
- A Response Template may be reused by many Request Templates.
- The operator may override the default Response Template before creating a concrete request when future UI supports it.
- Applying a Request Template creates a Request Snapshot containing the rendered request, filled variables, source request template id, source request template revision, selected response template id, and selected response template revision.
- A captured final response is checked against the selected Response Template when future response validation exists.
- Template edits must not silently mutate already-applied historical requests, captured responses, or historical response expectations.
- Templates are reusable Workspace/Project assets, not widget instances.
- A future widget may expose a Template Library or request builder UI, but the template definition remains distinct from the widget instance rendering it.

## Relation To Coordinator / Executor Workflow

Templates support the coordinator/executor operating model defined in `docs/AGENT_OPERATING_MODEL.md`.

The operating model defines executor thread lifecycle, one-block-per-executor rules, and coordinator validation responsibilities; templates define the reusable request and response structures used by that flow.

Future Workspace-aware Coordinator Agent behavior is defined in `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`. The Coordinator may later use approved context and selected templates to propose generated requests or Queue Items, but generated requests must remain previewable and must not execute automatically.

Expected future workflow:

1. Coordinator chooses a Request Template.
2. Coordinator chooses or accepts the default Response Template.
3. Coordinator fills variables and required context.
4. Coordinator previews the concrete executor prompt.
5. Coordinator creates a Request Snapshot and sends, copies, or exports it.
6. Executor starts in a fresh task/thread for that block.
7. Executor performs the focused block.
8. Executor returns a final response following the selected Response Template and `docs/AGENT_RESPONSE_CONTRACT.md`.
9. Coordinator validates the captured response.
10. Coordinator accepts, asks for a fix, reruns, or creates the next block.

Strategic planning belongs in the coordinator flow unless a Request Template explicitly defines a plan-only block.

## Relation To Agent Run Observability

Request Templates define requested work and required validation. Response Templates define the expected Result Report shape.

`docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md` defines the surrounding run views:

- Raw Log preserves exact runtime trace.
- Overview Log summarizes live progress.
- Result Report captures the final response checked against the selected Response Template.

Template validation must not hide Raw Log failures, skipped validation, or blocked execution states.

## Future UI / Product Behavior

Future Hobit UI may support:

- Template Library / Template Catalog browsing.
- Creating, editing, duplicating, archiving, and versioning templates.
- Viewing version/revision history.
- Selecting a Request Template when creating an agent block, tool request, task, or manual work item.
- Selecting or overriding the linked Response Template.
- Filling variables with validation for required placeholders.
- Showing required context sections before request creation.
- Previewing the generated concrete request before use.
- Copying, exporting, or sending the generated request.
- Capturing executor responses.
- Validating captured responses against the selected Response Template.
- Showing missing required sections.
- Showing warnings, malformed sections, failed validation, and skipped validation.
- Creating follow-up blocks from failed validation, diff review, Git review, or operator notes.
- Creating or updating Agent Queue items from applied template snapshots when future Agent Queue support exists.

Future UI rules:

- Template controls must be explicit and visible to the operator.
- Generated prompts must be previewable before use.
- Hidden prompt mutation is forbidden.
- Template application must preserve approval-aware tool/action rules.
- Template editing must not change historical request snapshots unless the operator explicitly creates a new snapshot.

## Relation To Workspaces

Future Workspaces may store:

- applied Request Snapshots
- selected Response Template id and revision
- captured executor responses
- response validation results
- validation command results
- raw agent/tool/runtime logs when future agent runs exist
- overview run logs when future agent runs exist
- result reports tied to selected Response Templates
- Git commit hashes and messages
- widget logs and activity associated with the block
- artifacts created by the block
- coordinator accept/fix/rerun/next-block decisions

Reusable templates may exist across Workspaces or Projects, but applied snapshots belong to the specific Workspace history where the work happened.

Workspace history should link requests, executor responses, validation results, Git commits, logs, and artifacts when future storage supports those relationships.

Template definitions may be global or reusable, but applied Request snapshots, selected Response Template revisions, captured Responses, and response validation results are Workspace-owned history. They must not leak into unrelated Workspaces unless the operator explicitly copies or links them. For the multi-Workspace and multi-Workbench boundary, see `docs/WORKSPACE_CONTRACT.md`.

## Relation To Widgets

Widgets may use templates to generate structured requests, but template definitions are not owned by widget instances.

Examples:

- A future coordinator/request-builder widget may use Request Templates to generate executor prompts.
- The Git Widget may use response metadata, validation output, commits, and Request Snapshot links for review cards.
- Notes or Notebook widgets may later use templates for AI-assisted writing or review workflows.
- Agent-facing widgets may display the selected Response Template expectations before executor work begins.

All visible template management or request-generation surfaces must follow `docs/WIDGET_CONTRACT.md` and preserve operator control.

## Relation To Agent Queue

Agent Queue is the future review/control surface for concrete agent blocks. Templates define reusable request and response expectations; Queue Items should preserve the applied Request Snapshot and selected Response Template revision used for one block.

Template edits must not silently mutate existing Queue Item request snapshots, captured responses, or historical response expectations. Applying a template into a Queue Item must not automatically launch execution.

## Safety Principles

- No hidden prompt mutation.
- No hidden agent execution.
- No secret injection.
- Generated prompts must be previewable.
- Template variables must be explicit.
- Operator approval remains required for tool actions, Git actions, external effects, file changes, and destructive operations.
- Validation requirements must be visible before the request is sent.
- Response validation must not hide failed or skipped commands.
- Template edits must not silently rewrite historical requests or responses.
- Templates must not create an implicit execution path around the Workbench approval model.

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
- Workspace API changes
- template editor UI
- template catalog UI
- response parser implementation
- response validation engine
- automatic agent execution
- background automation
- prompt execution or tool execution
- secret management implementation
- secret injection
- approval bypasses
- runtime/tool execution changes
- product behavior changes

## Architecture Boundary

Future implementation must preserve existing Hobit boundaries:

- `hobit-core` should own pure template domain contracts when implemented.
- Storage implementation must remain outside `hobit-core`.
- Frontend UI must treat visible template management surfaces as widgets or explicit Workbench controls.
- Agent/runtime integration must not make templates an implicit execution path.
- Tool/action execution must remain explicit, visible, and approval-aware.
- Git review integration must remain explicit and approval-aware under `docs/GIT_WIDGET_CONTRACT.md`.
