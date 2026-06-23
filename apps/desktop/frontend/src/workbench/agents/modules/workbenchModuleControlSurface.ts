import type { ModuleControlSurface } from "./moduleControlSurface";

export type WorkbenchCapabilityRiskClass = "read";

const WORKBENCH_CONTEXT_CAPABILITY_IDS = [
  "workspace.context.get",
  "workbench.widgets.list",
] as const;

export const WORKBENCH_MODULE_CONTROL_SURFACE: ModuleControlSurface<WorkbenchCapabilityRiskClass> =
  {
    actorContextPolicy: {
      defaultActor: "workspace_agent",
      notes: [
        "Workspace Agent live context reads use only visible/current app state supplied by the Workbench runtime.",
        "The model must not infer ids from UI text, DOM order, titles, file paths, transcript text, or prose.",
      ],
      trustedContextFields: [
        "workspaceId",
        "workbenchId",
        "widgetInstanceIds from live widget state",
      ],
    },
    apiPort: {
      name: "WorkspaceAgentLiveContextSource",
      notes: [
        "The Workspace Agent broker receives this source from the current Workbench runtime.",
        "It is a bounded read adapter, not DOM scraping, localStorage truth, hidden context access, or Queue mutation.",
      ],
      owner: "frontend_bridge",
      path: "apps/desktop/frontend/src/workbench/agents/adapters/workspaceAgentLiveContextCapabilities.ts",
    },
    backendBackedCapabilityIds: [],
    backingStatus: "mixed",
    capabilities: [
      {
        actorPolicy: {
          defaultActor: "workspace_agent",
          trustedContextFields: ["workspaceId", "workbenchId"],
        },
        autoContinuationSafe: true,
        backingStatus: "bridge_backed",
        capabilityId: "workspace.context.get",
        confirmation: { required: false },
        confirmationRequirement: "none",
        notes: [
          "Reads the current Workspace/Workbench ids, runtime mode, optional Queue control summary, and optional widget counts from explicit live context.",
        ],
        readOnly: true,
        riskClass: "read",
        uiDependencyPolicy: "none",
      },
      {
        actorPolicy: {
          defaultActor: "workspace_agent",
          trustedContextFields: ["workbenchId", "widgetInstanceIds"],
        },
        autoContinuationSafe: true,
        backingStatus: "bridge_backed",
        capabilityId: "workbench.widgets.list",
        confirmation: { required: false },
        confirmationRequirement: "none",
        notes: [
          "Lists bounded live widget instance summaries and identifies Agent Executor widgets only by definitionId.",
        ],
        readOnly: true,
        riskClass: "read",
        uiDependencyPolicy: "none",
      },
    ],
    capabilityIds: [...WORKBENCH_CONTEXT_CAPABILITY_IDS],
    compatibilityNotes: [
      "The capability id workspace.context.get is retained while the policy module is workbench because this runtime reads Workbench-owned live context.",
      "These reads do not add a hidden Workspace context API or new backend/Tauri command.",
    ],
    confirmationRequirements: [
      {
        capabilityId: "workspace.context.get",
        requirement: "none",
      },
      {
        capabilityId: "workbench.widgets.list",
        requirement: "none",
      },
    ],
    contractTestRequirements: [
      "Workbench live context capabilities are registered in the global capability manifest.",
      "Workbench live context capabilities have broker handlers.",
      "Workbench live context capabilities resolve moduleId workbench and riskClass read for BrokerContinuationRuntime.",
      "Workbench live context capabilities remain read-only and require no confirmation or active grant.",
      "Workbench live context capabilities do not import Queue UI, visual shell, shell, Git, Terminal, validation, or rollback modules.",
    ],
    displayName: "Workbench Context",
    moduleId: "workbench",
    riskClasses: ["read"],
    serviceOwner: "Workspace Agent broker live context adapter",
    summary:
      "Agent-facing Workbench context module for bounded live Workspace/Workbench discovery reads used by Queue smoke setup.",
    tauriSurface: {
      commands: [],
      notes: [
        "Current live context reads are frontend broker reads over already visible/current app state.",
      ],
    },
    transitionalCapabilityIds: [...WORKBENCH_CONTEXT_CAPABILITY_IDS],
    uiDependencyPolicy: "none",
    unavailableCapabilityIds: [],
    version: "module-control-surface.workbench.v0",
    workflowIds: [],
    workflows: [],
  } as const;

