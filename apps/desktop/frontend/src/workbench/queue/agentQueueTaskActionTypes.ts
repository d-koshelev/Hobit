import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type {
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
} from "../../workspace/types";
import type {
  QueueTagPauseState,
  TaskDraft,
  WorkerScope,
} from "../agentQueueTaskUiModel";
import type { WidgetRenderProps } from "../types";
import type { AgentQueueRunnerStatus } from "./agentQueueControllerHelpers";

export type AgentQueueLocalTaskFields = Pick<
  AgentQueueTask,
  | "assignedWorkerId"
  | "closureState"
  | "coordinatorStatus"
  | "dependsOn"
  | "diffReview"
  | "itemType"
  | "orderIndex"
  | "queueTagId"
  | "queueTagName"
  | "validationStatus"
  | "executionPlanPreview"
  | "workerExecutionReports"
  | "workspaceChatReportCardId"
  | "workspaceChatReportCardStatus"
>;

export type TaskActionsContext = Pick<
  WidgetRenderProps,
  | "onClearAgentQueueTaskAssignment"
  | "onCreateAgentQueueTask"
  | "onDeleteAgentQueueTask"
  | "onGetAgentQueueTask"
  | "onUpdateAgentQueueTask"
> & {
  applyUpdatedTask: (
    task: AgentQueueTask,
    options?: { select?: boolean },
  ) => void;
  autorunSnapshot: AgentQueueRunnerSnapshot | null;
  draft: TaskDraft;
  editPauseMessage: string;
  hasOpenTaskEdit: boolean;
  isCreating: boolean;
  isDeleting: boolean;
  isDirty: boolean;
  isEditing: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isSelecting: boolean;
  loadTasks: (
    preferredTaskId?: string | null,
    options?: { preserveCurrentOnError?: boolean },
  ) => Promise<string | null>;
  localTaskFieldsRef: MutableRefObject<Map<string, AgentQueueLocalTaskFields>>;
  mergeTaskFoundation: (task: AgentQueueTask) => AgentQueueTask;
  queueRunnerActiveQueueItemId: string | null;
  queueRunnerStatus: AgentQueueRunnerStatus;
  selectedTask: AgentQueueTask | null;
  setAssignmentError: Dispatch<SetStateAction<string | null>>;
  setAssignmentMessage: Dispatch<SetStateAction<string | null>>;
  setDeleteError: Dispatch<SetStateAction<string | null>>;
  setDeleteMessage: Dispatch<SetStateAction<string | null>>;
  setDraft: Dispatch<SetStateAction<TaskDraft>>;
  setEditorError: Dispatch<SetStateAction<string | null>>;
  setCoordinatorFinalizationMessage: Dispatch<SetStateAction<string | null>>;
  setExecutionPlanMessage: Dispatch<SetStateAction<string | null>>;
  setGlobalMessage: Dispatch<SetStateAction<string | null>>;
  setIsConfirmingDelete: Dispatch<SetStateAction<boolean>>;
  setIsCreating: Dispatch<SetStateAction<boolean>>;
  setIsDeleting: Dispatch<SetStateAction<boolean>>;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  setIsSelecting: Dispatch<SetStateAction<boolean>>;
  setLoadError: Dispatch<SetStateAction<string | null>>;
  setLocalTaskFields: Dispatch<
    SetStateAction<Map<string, AgentQueueLocalTaskFields>>
  >;
  setOrderingMessage: Dispatch<SetStateAction<string | null>>;
  setQueueTagPauseStates: Dispatch<
    SetStateAction<Map<string, QueueTagPauseState>>
  >;
  setSaveStateText: Dispatch<SetStateAction<string>>;
  setSelectedDraft: (task: AgentQueueTask) => void;
  setTasks: Dispatch<SetStateAction<AgentQueueTask[]>>;
  setValidationMessage: Dispatch<SetStateAction<string | null>>;
  setWorkerReportMessage: Dispatch<SetStateAction<string | null>>;
  tasksRef: MutableRefObject<AgentQueueTask[]>;
  workerScopes: Map<string, WorkerScope>;
};
