import type { QueueCapabilityRiskClass } from "../capabilities/queueCapabilityContracts";
import type { ModuleControlSurface } from "./moduleControlSurface";
import {
  QUEUE_BACKEND_BACKED_MODULE_CAPABILITY_IDS,
  QUEUE_MODULE_CAPABILITIES,
  QUEUE_MODULE_CAPABILITY_IDS,
  QUEUE_MODULE_CONFIRMATION_REQUIREMENTS,
  QUEUE_MODULE_RISK_CLASSES,
  QUEUE_TRANSITIONAL_MODULE_CAPABILITY_IDS,
} from "./queueCapabilityModuleMetadata";
import {
  QUEUE_MODULE_WORKFLOW_IDS,
  QUEUE_MODULE_WORKFLOWS,
} from "./queueWorkflowModuleMetadata";

export {
  QUEUE_BACKEND_BACKED_MODULE_CAPABILITY_IDS,
  QUEUE_TRANSITIONAL_MODULE_CAPABILITY_IDS,
} from "./queueCapabilityModuleMetadata";
export {
  QUEUE_MODULE_WORKFLOW_IDS,
  QUEUE_MODULE_WORKFLOWS,
} from "./queueWorkflowModuleMetadata";

export const QUEUE_MODULE_CONTROL_SURFACE: ModuleControlSurface<QueueCapabilityRiskClass> =
  {
    actorContextPolicy: {
      defaultActor: "runtime_agent",
      notes: [
        "Workspace Agent and broker adapters supply trusted actor context; the model must not invent actor ids.",
        "Review actor overrides are accepted only when an exact typed actor id is already available.",
      ],
      trustedContextFields: [
        "agentId",
        "requestedAt",
        "requestId",
        "coordinatorAgentId default from request agentId when omitted",
      ],
    },
    apiPort: {
      name: "QueueBackendCapabilityPort",
      notes: [
        "Backend-backed Queue capabilities use typed backend/Tauri APIs through this port.",
        "Bridge-backed and transitional capabilities remain explicitly classified until moved behind durable backend ownership.",
      ],
      owner: "backend_domain",
      path: "apps/desktop/frontend/src/workbench/agents/adapters/queueBackendCapabilityPort.ts",
    },
    backendBackedCapabilityIds: QUEUE_BACKEND_BACKED_MODULE_CAPABILITY_IDS,
    backendOwner:
      "Queue backend/domain/storage aggregate, worker evidence, review, accepted completion, and terminal failure services.",
    backingStatus: "mixed",
    capabilities: QUEUE_MODULE_CAPABILITIES,
    capabilityIds: QUEUE_MODULE_CAPABILITY_IDS,
    compatibilityNotes: [
      "Widget Agent Contracts describe widget-readable product boundaries; they are not executable Module Control Surfaces.",
      "Codex Direct Work is a provider/worker implementation detail, not the module integration architecture.",
      "Queue workflow metadata remains non-executable through the generic request path; separate QueueWorkflowRunner helpers exist for explicit read, review, and finalization phases through injected typed ports.",
      "Transitional Queue capabilities must stay labeled until backend/domain commands replace frontend controller overlays.",
    ],
    confirmationRequirements: QUEUE_MODULE_CONFIRMATION_REQUIREMENTS,
    contractTestRequirements: [
      "Queue module capability ids are registered in the global capability manifest.",
      "Queue module capability ids are present in the Queue capability contract inventory.",
      "Backend-backed and transitional capability lists do not overlap.",
      "Backend-backed Queue module capabilities do not import Queue UI files.",
      "No lifecycle-namespaced evidence read alias is present.",
      "Queue workflows must not be marked runtime_available until runtime wiring exists; current runner helpers are explicit read/review/finalization utilities only.",
      "Queue workflow required capabilities must refer to registered Queue module capabilities.",
    ],
    displayName: "Agent Queue",
    moduleId: "queue",
    riskClasses: QUEUE_MODULE_RISK_CLASSES,
    serviceOwner: "Agent Queue module",
    summary:
      "Agent-facing Queue module contract describing typed capabilities, backing status, risks, confirmation, actor context, and UI dependency boundaries.",
    tauriSurface: {
      commands: [
        "agent_queue_aggregate_commands",
        "agent_queue_worker_evidence_commands",
        "agent_queue_review_commands",
        "agent_queue_completion_commands",
        "agent_queue_failure_commands",
      ],
      notes: [
        "Tauri surfaces expose backend aggregate, evidence, review, completion, and failure DTOs for backend-backed capabilities.",
      ],
    },
    transitionalCapabilityIds: QUEUE_TRANSITIONAL_MODULE_CAPABILITY_IDS,
    uiDependencyPolicy: "transitional_controller",
    unavailableCapabilityIds: [],
    version: "module-control-surface.queue.v0",
    workflowIds: QUEUE_MODULE_WORKFLOW_IDS,
    workflows: QUEUE_MODULE_WORKFLOWS,
  } as const;
