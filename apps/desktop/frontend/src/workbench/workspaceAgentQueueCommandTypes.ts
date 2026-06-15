import type {
  AgentQueueTaskItemType,
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
      description?: string;
      itemType?: AgentQueueTaskItemType;
      prompt: string;
      queueTagName?: string;
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
  | {
      reason: "missing_task_content";
      type: "queueCreationNeedsInput";
    }
  | { type: "unsupportedQueueCommand" };

export type WorkspaceAgentQueueCommandHandlerOptions = {
  bridge?: WorkspaceAgentQueueBridge;
  currentWorkspaceRoot?: string | null;
};

export type WorkspaceAgentQueueCommandResult = {
  body: string;
  handled: boolean;
};
