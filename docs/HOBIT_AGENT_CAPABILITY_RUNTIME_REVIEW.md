# Hobit Agent Capability Runtime Review

## Purpose

Review the current Workspace Agent and Queue action boundaries before adding
the Hobit Agent Capability Runtime foundation. This is an architecture review
only; it does not add backend runtime, Tauri commands, storage schema,
scheduler behavior, workers, Terminal launch, Git mutation, Finder changes, or
full Workspace Agent behavior.

## Current Workspace Agent Architecture

- User prompt entry: `InteractiveAgentPlaceholderWidget.tsx` owns the current
  `interactive-agent` compatibility surface, composer state, transcript state,
  proposal cards, Queue cards, prompt-pack import cards, provider routing, and
  Codex Direct Work controls.
- Product intent routing: regex routing must not be used as the Workspace
  Agent product-action architecture. The old active
  `workspaceAgentProductIntentRouting.ts` and
  `workspaceAgentQueueCommandParser.ts` path has been removed from the active
  Workspace Agent runtime path. Queue item creation must be represented as a
  typed Queue capability selected through the capability manifest and future
  broker boundary, not as `user text -> regex -> Queue action`.
- Codex/direct-run routing: `useWorkspaceAgentDirectWorkController.ts` starts
  Workspace Agent Codex Direct Work through `onStartCodexDirectWorkStream`.
  `WorkspaceAgentDirectModePanel.tsx` exposes explicit working directory and
  sandbox controls.
- Product action cards/actions: proposal and card flows live in
  `WorkspaceAgentProposalList.tsx`, `WorkspaceAgentQueueActionCards.tsx`,
  `WorkspaceAgentQueueCreateDraftCard.tsx`, `WorkspaceAgentQueueTaskStatusCard.tsx`,
  `WorkspaceAgentQueueReportActionCard.tsx`, and prompt-pack cards under
  `workbench/promptPack/`.
- Queue creation actions: typed Queue creation currently lives behind
  `workspaceAgentQueueBridge.ts`, `queue/agentQueueWidgetApi.ts`, visible
  Queue/proposal card apply flows, and prompt-pack materialization in
  `promptPack/promptPackMaterialization.ts`. These remain transitional product
  bridges for the visible Workspace Agent card flows. The Queue Capability
  Adapter MVP is now the architecture source for brokered agent-selected Queue
  product actions, but Workspace Agent UI broker execution is not wired yet.
- Activity/log events: Agent Activity reads Direct Work stream events through
  `agentActivityModel.ts`; Queue widget API returns Queue events; widget
  add/state/layout and Direct Work paths emit widget-local logs through
  existing workbench/widget APIs.

## Existing Reusable Boundaries

- Queue action/controller APIs: `queue/agentQueueWidgetApi.ts`,
  `queue/agentQueueWidgetApiTypes.ts`, `queue/useAgentQueueController.ts`, and
  Queue action hooks under `workbench/queue/`.
- Prompt-pack import/materialization: `promptPack/promptPackImportPreview.ts`,
  `promptPack/promptPackMaterialization.ts`, and
  `queue/smartQueuePromptPackMaterialization.ts`.
- Smart Queue models: eligibility, dependency propagation, coordinator
  decisions, retry, rollback-proposal, assistance, worker report, and smoke
  harness modules under `workbench/queue/`.
- Widget action bridges: `workspaceAgentQueueBridge.ts`,
  `workspaceWidgetActions.ts`, and Workspace API wrappers under
  `workspace/workspaceApi`.
- Activity/audit/log models: `agentActivityModel.ts`, Queue widget events, and
  widget-local log mapping in `widgetLogEntryMapping.ts`.
- Confirmation patterns: proposal approval cards, prompt-pack preview confirm,
  widget removal confirmation, Git local commit confirmation, and rollback
  proposal-only cards.
- Test utilities: Queue API harnesses, Smart Queue smoke tests,
  `InteractiveAgentPlaceholderWidget.test-utils.tsx`, Queue controller test
  helpers, and Workspace Agent routing/card tests.

## Current Runtime Module Layout

The frontend capability runtime foundation now has stable ownership folders
under `apps/desktop/frontend/src/workbench/agents/`: `context/`,
`capabilities/`, `broker/`, `runtime/`, `messaging/`, `selfTest/`, `widgets/`,
and `adapters/`. The old public files
`hobitAgentCapabilityRuntime.ts`, `hobitAgentCapabilityManifest.ts`,
`hobitAgentSelfTestRuntime.ts`, and `workspaceAgentCapabilityContext.ts` are
compatibility re-export facades. The `widgets/` folder now owns the pure Widget
Agent Contract model and initial Agent Queue / Workspace Agent registry
entries. The pure frontend Action Broker MVP now lives under `broker/` with
typed request/result/audit contracts, policy validation, and deterministic
model handlers. Queue-specific behavior is no longer a generic broker
placeholder; the broker composes Queue handlers from the Queue adapter when
supplied. The `adapters/` folder now owns the Queue Capability Adapter MVP
through `createQueueAgentActionHandlers(adapterApi)`. Additional product
adapters, widget contracts, and message-bus work should land in the owned
folders instead of Workspace Agent UI components. The Multi-Agent Runtime MVP
now owns pure frontend agent instance/status models under `runtime/` and typed
bounded message/history models under `messaging/`; peer runtime tests do not
call Codex or shell and do not mutate app state.

## Architectural Problems

- Regex/text intent routing mixes product behavior into the Workspace Agent UI
  and controller path. It should remain temporary compatibility/test fixture
  behavior, not the final decision layer.
- The active Workspace Agent path must not classify Queue phrases such as
  `add example queue items to queue`, `create queue items`, or
  `add tasks to queue` through regex as a product-action decision layer.
- Codex/shell execution is too close to the fallback route for product actions.
  Product actions need typed app capabilities first.
- App capabilities are not exposed as a first-class manifest for the agent.
- Policy, permissions, availability, confirmation, dry-run, and side-effect
  rules are not centralized at the capability boundary.
- Widget-level self-test coverage is only beginning: Agent Queue and Workspace
  Agent have initial contract/self-test metadata, while Knowledge / Skills,
  Notes, Terminal, and other widgets still need complete contracts.
- Agents do not receive app role, current Workspace/surface/widget context,
  capability list, policy constraints, and self-test instructions as structured
  runtime data.

## Proposed Architecture

- `HobitAgentAppContext`: raw prompt plus Hobit app, Workspace, surface/widget,
  role, policy, and runtime context.
- `HobitAgentCapability`: typed metadata for one app capability, including
  schemas, side-effect level, confirmation, dry-run, availability, audit, and
  self-test support.
- `HobitAgentCapabilityRegistry`: deterministic registry and manifest listing
  only available/declared capabilities.
- `HobitAgentActionBroker`: the typed invocation boundary from agent action
  requests to policy-checked handlers and future app APIs.
- `HobitAgentPolicyEngine`: central capability policy for role access,
  availability, side effects, confirmation, dry-run, scope, and restrictions.
- `HobitAgentActionRequest` / `HobitAgentActionResult`: structured request and
  result contract, including unavailable and policy-blocked outcomes.
- `HobitAgentActivity` / audit event contract: every capability call produces
  structured activity/audit events.
- `HobitAgentSelfTest`: safe/dry-run self-test contract over available
  capabilities, without hidden side effects.

## Implementation Sequence

1. Add pure frontend models, initial manifest, docs, and tests.
2. Register Queue capabilities over the existing typed Queue API and
   prompt-pack materialization paths.
3. Provide Workspace Agent with capability manifest, role instructions,
   context, and policy constraints.
4. Add the pure Action Broker MVP with typed request validation, policy
   results, audit/activity events, deterministic test handlers, and Queue
   dry-run preview only. Completed for the frontend model.
5. Wire real Queue adapter invocation behind the broker instead of regex-decided
   UI/controller behavior. Completed for the frontend Queue Capability Adapter
   MVP handler boundary; Workspace Agent UI execution remains later.
6. Add a self-test runner that exercises safe/dry-run capabilities and reports
   passed, failed, skipped, and blocked.
7. Add Knowledge, Notes, and Terminal capabilities only after their boundaries
   are explicit and safe.
8. Evaluate backend, durable runtime, scheduler, audit persistence, and server
   needs after the frontend contract proves useful.
