import type {
  AgentQueueTaskExecutionPolicy,
  AgentQueueTaskStatus,
} from "../workspace/types";
import type { QueueUpdateItemPatch } from "./queue/agentQueueWidgetApiTypes";
import type { AgentQueueTaskRunSettingsDefaults } from "./queue/agentQueueRunSettingsDefaults";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";

export type WorkspaceAgentQueueCommand =
  | { type: "analyzeQueue" }
  | { type: "explainFailure" }
  | {
      commands: WorkspaceAgentQueueCommand[];
      forceLocal: boolean;
      type: "batch";
    }
  | {
      executionPolicy?: AgentQueueTaskExecutionPolicy;
      prompt: string;
      runSettings?: Partial<AgentQueueTaskRunSettingsDefaults>;
      status?: Extract<AgentQueueTaskStatus, "draft" | "queued">;
      title: string;
      type: "createItem";
    }
  | {
      changedFieldLabels: string[];
      patch: QueueUpdateItemPatch;
      target: string;
      type: "updateItem";
    }
  | { type: "runAutonomousQueue" }
  | { type: "stopAutonomousQueueAfterCurrent" }
  | { type: "unsupportedQueueCommand" };

export type WorkspaceAgentQueueCommandHandlerOptions = {
  bridge?: WorkspaceAgentQueueBridge;
  currentWorkspaceRoot?: string | null;
};

export type WorkspaceAgentQueueCommandResult = {
  body: string;
  handled: boolean;
};
