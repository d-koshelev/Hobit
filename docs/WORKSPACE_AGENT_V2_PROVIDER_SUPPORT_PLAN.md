# Workspace Agent V2 Provider Support Plan

## Purpose

This document defines a docs-only provider support plan for Workspace Agent V2.
It does not add runtime behavior, frontend UI, backend/Tauri commands,
storage/schema changes, provider adapters, provider settings, CLI invocation,
tool execution, Queue dispatch, Terminal control, Git mutation, or hidden
Workspace context access.

Workspace Agent V2 provider work must preserve Hobit's current product boundary:
the Workbench is the product surface, Workspace Agent is the foreground
operator-facing AI surface, and the operator controls context, tools, execution,
approval, and acceptance.

## Current Boundary

Current Workspace Agent provider behavior is text/proposal oriented and uses
only visible current-session context with `allowed_tools: []`. Provider output
may become visible assistant text or validated safe proposal drafts. Provider
output is not execution authority.

Direct Work currently exists as explicit operator-controlled Agent Executor /
Queue-started Codex CLI execution infrastructure. It is supporting runtime
detail, not a hidden Workspace Agent tool path. Future provider support must not
turn Direct Work into automatic Workspace Agent execution, hidden Queue
dispatch, or implicit tool use.

## Provider Targets

### Codex

Codex is the first production provider target for Workspace Agent V2 provider
support.

The first Codex block should extract and normalize the existing Codex Direct
Work behavior behind a provider adapter boundary rather than inventing a second
execution model. The adapter should preserve the current Direct Work rules:
explicit operator prompt, explicit execution workspace, visible sandbox and
approval policy, observable streaming/log/result state, cancellation where
available, no auto-commit, no auto-push, no hidden background execution, and no
unapproved Workspace or widget context.

The Codex provider adapter should initially model existing capabilities, not
expand them. It should make the current behavior pluggable and comparable
against future local CLI providers while keeping Codex as the production-ready
baseline.

### Claude Code

Claude Code support should start with a local CLI audit only. There should be no
implementation until the audit confirms the local command shape and the product
boundary is updated deliberately.

The audit should inspect local CLI behavior for:

- installation and version detection
- authentication status if detectable without exposing secrets
- headless or non-interactive execution support
- JSON or machine-readable output support
- streaming event support
- tool permission controls
- session/thread continuation behavior
- sandbox or working-directory controls
- cancellation behavior
- resume behavior
- token or usage reporting

No syntax assumptions should be made before the audit. The audit must not run a
real modifying task, create provider settings UI, add a Tauri command, add a
schema, or expose Claude Code as a Workspace Agent provider.

### Amp

Amp support should also start with a local CLI audit only. Review mode is likely
the first useful target, but the audit must not assume syntax, command shape, or
machine-readable output format in advance.

The audit should inspect local CLI behavior for:

- installation and version detection
- authentication status if detectable without exposing secrets
- headless or non-interactive review support
- JSON or machine-readable output support
- streaming event support
- tool permission controls
- session/thread continuation behavior
- sandbox or working-directory controls
- cancellation behavior
- resume behavior
- token or usage reporting

No implementation should happen until the audit identifies a safe first slice.
Amp must not be added as a hidden code reviewer, automatic Queue worker, Git
mutation path, or broad repository scanner.

## Capability Detection Model

Provider support should use capability detection instead of hard-coded product
claims. Detection should be explicit, visible where relevant, and safe to run.

Capability detection should cover:

- `installed`: whether the local provider CLI or runtime is available.
- `authenticated`: whether authentication appears usable, only when detectable
  without reading or exposing secret values.
- `streaming`: whether incremental events or output can be observed.
- `json`: whether the provider can emit a stable machine-readable format.
- `tools`: whether tool calling or local tool execution exists, and whether it
  can be disabled. Workspace Agent provider slices should keep tools disabled
  unless a later approved contract explicitly changes that boundary.
- `sandbox`: whether working-directory, filesystem, shell, or network access can
  be constrained and described to the operator.
- `cancel`: whether an active run can be cancelled cleanly.
- `resume`: whether a previous session/thread can be continued safely and
  explicitly.
- `tokens`: whether token or usage information is available without exposing
  raw secrets or unsafe provider metadata.

Detection should not execute modifying tasks. It should avoid broad filesystem
reads, hidden repository scans, provider credential disclosure, or network calls
unless the provider requires a safe documented status probe and the operator has
made provider configuration explicit.

## Recommended Implementation Blocks

1. Codex adapter extraction.
   - Define a provider adapter boundary around the existing Codex Direct Work
     runner and streaming behavior.
   - Normalize request, event, cancellation, result, and capability metadata.
   - Preserve current Agent Executor and Queue-started Direct Work behavior.
   - Do not add new tools, hidden context, Git mutation, schema changes, or
     provider settings UI unless the block explicitly scopes them.

2. Claude Code local CLI audit.
   - Produce an inspect-only report covering install/auth/headless/JSON/tools/
     session/sandbox/cancel/resume/tokens capabilities.
   - Record unknowns and blockers without implementing an adapter.
   - Avoid syntax assumptions and avoid modifying tasks.

3. Amp local CLI audit.
   - Produce an inspect-only report covering install/auth/review/headless/JSON/
     tools/session/sandbox/cancel/resume/tokens capabilities.
   - Treat review mode as a hypothesis, not a contract.
   - Avoid syntax assumptions and avoid modifying tasks.

4. Claude Code adapter plan.
   - Start only after the audit proves a safe first slice.
   - Prefer text/review output normalization before any execution-like behavior.
   - Keep tools disabled unless a later tool/capability contract explicitly
     approves tool use.

5. Amp adapter plan.
   - Start only after the audit proves a safe first slice.
   - Prefer review/report normalization before any execution-like behavior.
   - Keep tools disabled unless a later tool/capability contract explicitly
     approves tool use.

6. Multi-provider Workspace Agent V2 selection.
   - Add only after at least Codex adapter extraction and one non-Codex audit
     have clarified the common capability model.
   - Provider selection must be explicit and visible.
   - Provider selection must not imply hidden context access, automatic Queue
     creation, automatic execution, or tool permission changes.

## Out Of Scope

This plan does not implement:

- new provider adapters
- Claude Code execution
- Amp execution or review
- provider settings UI
- storage/schema changes
- new Tauri commands
- direct frontend provider calls
- provider tool calling
- hidden context access
- Workspace Agent widget tool execution
- Agent Executor launch from Workspace Agent
- Queue auto-dispatch
- Terminal control
- Git mutation
- automatic commit or push
