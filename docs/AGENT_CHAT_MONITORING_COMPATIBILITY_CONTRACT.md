# Agent Chat / Agent Monitoring Compatibility Contract

Contract status: Compatibility / pending-retirement

Source of truth for:

- Agent Chat / Agent Monitoring / proposal-era API compatibility status
- boundaries for future cleanup tasks

Not source of truth for:

- current preferred widget names
- Coordinator / Queue / Executor naming
- current widget behavior details
- future product roadmap

Related documents:

- `docs/ACTIVE_CONTRACT_INDEX.md`
- `docs/CURRENT_WIDGET_SURFACE.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTRACT_DRIFT_DECISION_MATRIX.md`

## Compatibility Status

Agent Chat is not a preferred current product widget. Agent Monitoring is not
a preferred current product widget.

The current preferred agent-facing surfaces remain the surfaces documented in
`docs/CURRENT_WIDGET_SURFACE.md`: Coordinator Chat, Agent Queue, and Agent
Executor. Compatibility identifiers, API names, DTO names, and modules may
still use older Agent Chat / Agent Monitoring / proposal-era terminology, but
their existence does not make those names current product surfaces.

Proposal-era backend and frontend paths may remain wired as Compatibility /
pending-retirement code paths during Phase 1. They must stay untouched unless
a future task explicitly chooses one of these cleanup directions:

- retire/delete the old backend and frontend modules; or
- keep them explicitly as narrowed compatibility APIs with updated contracts.

## Known Retained Commands And Modules

Targeted repository searches during this alignment found these retained
commands, identifiers, and modules.

Tauri commands:

- `generate_agent_chat_ai_proposal`
- `persist_agent_chat_proposal`
- `get_agent_monitoring_snapshot`
- `create_agent_queue_item_from_proposal`

Frontend API modules:

- `apps/desktop/frontend/src/workspace/tauriAgentChatAiApi.ts`
- `apps/desktop/frontend/src/workspace/tauriAgentChatProposalPersistenceApi.ts`
- `apps/desktop/frontend/src/workspace/tauriAgentMonitoringApi.ts`
- `apps/desktop/frontend/src/workspace/tauriAgentQueueApi.ts`

Backend modules and DTO identifiers:

- `apps/desktop/src-tauri/src/agent_chat_ai_dto.rs`
- `apps/desktop/src-tauri/src/agent_chat_ai_provider.rs`
- `apps/desktop/src-tauri/src/workspace_commands.rs`
- `agent_chat_ai_dto`
- `AgentMonitoringSnapshotDto`
- `PersistAgentChatProposalRequest`
- `GenerateAgentChatAiProposalRequest`
- `GenerateAgentChatAiProposalResponseDto`

Frontend facade and type identifiers:

- `apps/desktop/frontend/src/workspace/workspaceApiAgentChat.ts`
- `apps/desktop/frontend/src/workspace/types/agentChat.ts`
- `apps/desktop/frontend/src/workspace/workspaceApiTypes.ts`
- `PersistAgentChatProposalRequest`
- `GenerateAgentChatAiProposalRequest`

## Phase 1 Boundaries

Allowed in Phase 1:

- document compatibility status
- keep existing wired paths untouched
- use current preferred surfaces for new work
- defer removal until an explicit code-removal task

Not allowed in this task and not allowed by default:

- remove Tauri commands
- remove frontend API modules
- rename Coordinator / Queue / Executor surfaces
- rename `interactive-agent` or `agent-run` IDs
- treat Agent Chat / Agent Monitoring as preferred current widgets
- add new Agent Chat / Agent Monitoring features
- create new proposal-era flows
- let old proposal-era APIs drive new product behavior

## Relationship To Current Agent Surfaces

This contract does not create a Coordinator / Queue / Executor naming
contract. Coordinator / Queue / Executor cleanup remains Deferred until after
current codebase cleanup and Notes stabilization, unless a future task
explicitly targets only inventory or deferral notes.

New work should prefer the current documented surfaces:

- Coordinator Chat for operator conversation and planning
- Agent Queue for manual task organization
- Agent Executor for explicit Direct Work execution

Existing Agent Chat / Agent Monitoring compatibility APIs do not define the
future Coordinator architecture. They also do not authorize hidden context
access, automatic Queue creation, Agent Executor launch, Terminal control, Git
mutation, JDBC execution, or broad widget capability execution.
