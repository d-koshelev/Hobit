import { useEffect, useId, useState } from "react";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { AgentQueueTask } from "../workspace/types";
import { AgentQueueFlowMap } from "./AgentQueueFlowMap";
import { AgentQueueLayout } from "./AgentQueueLayout";
import {
  AgentQueueNewTaskDialog,
  type AgentQueueNewTaskRunSetup,
} from "./AgentQueueNewTaskDialog";
import { AgentQueueSidebar } from "./AgentQueueSidebar";
import { AgentQueueTaskDetailsPanel } from "./AgentQueueTaskDetailsPanel";
import { AgentQueueWidgetStatusBadge } from "./AgentQueueWidgetStatusBadge";
import {
  emptyDraft,
  MAX_PRIORITY,
  MIN_PRIORITY,
  normalizeQueueTag,
  queueSingleState,
  taskPreview,
  validateDraft,
  type TaskDraft,
} from "./agentQueueTaskUiModel";
import type {
  AgentQueueController,
  AgentQueueRunController,
  QueueTaskInsertPosition,
} from "./queue/useAgentQueueController";
import {
  agentQueueTaskRunSettingsDefaultsFromRun,
  defaultAgentQueueTaskRunSettings,
} from "./queue/agentQueueRunSettingsDefaults";
import type { WidgetRenderProps } from "./types";

export const DEFAULT_AGENT_QUEUE_VIEW_MODE = "flow";

export function AgentQueuePlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  agentQueueItemOpenRequest,
  agentExecutorSlots = [],
  agentQueueController,
  onLoadLogs,
  onAttachContextToCoordinator,
  onCreateKnowledgeDocument,
  onCreateSkill,
  onListKnowledgeDraftReviews,
  onRecordKnowledgeDraftReview,
  onShowQueueReportInWorkspaceChat,
  onOpenAgentExecutorRun,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  const titleInputId = useId();
  const descriptionInputId = useId();
  const promptInputId = useId();
  const statusInputId = useId();
  const priorityInputId = useId();
  const executionPolicyInputId = useId();
  const assignmentInputId = useId();
  const createTitleInputId = useId();
  const createDescriptionInputId = useId();
  const createPromptInputId = useId();
  const createPriorityInputId = useId();
  const createExecutionPolicyInputId = useId();
  const createExecutionStateInputId = useId();
  const createRunWorkspaceInputId = useId();
  const createRunCodexExecutableInputId = useId();
  const createRunSandboxInputId = useId();
  const createRunApprovalPolicyInputId = useId();
  const createDialogTitleId = useId();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<TaskDraft>(() =>
    newTaskDialogDraft(),
  );
  const [createInsertPosition, setCreateInsertPosition] =
    useState<QueueTaskInsertPosition>("bottom");
  const [createRunSetup, setCreateRunSetup] =
    useState<AgentQueueNewTaskRunSetup>(() => defaultCreateRunSetup());
  const [createDialogError, setCreateDialogError] = useState<string | null>(
    null,
  );
  const queue = agentQueueController as AgentQueueController;
  const queueOwnedExecutorSlots = agentQueueController?.agentExecutorSlots ?? agentExecutorSlots;

  const {
    apiAvailable,
    createTask,
    isCreating,
    isDirty,
    isLoading,
    isSaving,
    isSelecting,
    loadError,
    refreshTasks,
    selectedTask,
    selectTask,
    tasks,
  } = queue;

  useEffect(() => {
    if (
      !agentQueueItemOpenRequest ||
      agentQueueItemOpenRequest.targetQueueWidgetInstanceId !== instance.id
    ) {
      return;
    }

    void selectTask(agentQueueItemOpenRequest.queueItemId);
  }, [agentQueueItemOpenRequest?.id]);

  const queueFrameActions = (
    <>
      <Button
        disabled={isLoading || isSaving || !apiAvailable}
        onClick={() => void refreshTasks()}
        variant="ghost"
      >
        Refresh
      </Button>
      <Button
        disabled={isCreating || isLoading || !apiAvailable}
        onClick={() => {
          setCreateDraft(newTaskDialogDraft(selectedTask));
          setCreateInsertPosition("bottom");
          setCreateRunSetup(
            selectedTask ? runSetupFromQueueRun(queue.run) : defaultCreateRunSetup(),
          );
          setCreateDialogError(null);
          setIsCreateDialogOpen(true);
        }}
        variant="primary"
      >
        {isCreating ? "Creating" : "New task"}
      </Button>
      {frameActions}
    </>
  );
  const singleState = queueSingleState({
    isLoading,
    loadError,
  });
  const selectedTaskHint = selectedTask ? taskPreview(selectedTask) : "";

  function updateCreateDraft(nextDraft: Partial<TaskDraft>) {
    setCreateDraft((currentDraft) => ({
      ...currentDraft,
      ...nextDraft,
    }));
    setCreateDialogError(null);
  }

  function updateCreatePriority(value: string) {
    const parsedValue = Number.parseInt(value, 10);
    const priority = Number.isFinite(parsedValue)
      ? Math.min(MAX_PRIORITY, Math.max(MIN_PRIORITY, parsedValue))
      : MIN_PRIORITY;

    updateCreateDraft({ priority });
  }

  function updateCreateRunSetup(nextSetup: Partial<AgentQueueNewTaskRunSetup>) {
    setCreateRunSetup((currentSetup) => ({
      ...currentSetup,
      ...nextSetup,
    }));
    setCreateDialogError(null);
  }

  function cancelCreateTask() {
    setIsCreateDialogOpen(false);
    setCreateDialogError(null);
  }

  async function confirmCreateTask(mode: "draft" | "queued") {
    const nextDraft = {
      ...createDraft,
      approvalPolicy: createRunSetup.approvalPolicy,
      codexExecutable: createRunSetup.codexExecutableDraft,
      executionWorkspace: createRunSetup.repoRootDraft,
      sandbox: createRunSetup.sandbox,
      status: mode === "queued" ? "queued" as const : "draft" as const,
    };
    const validationError = validateDraft(nextDraft);

    if (validationError) {
      setCreateDialogError(validationError);
      return;
    }

    if (mode === "queued") {
      const setupError = validateQueuedRunSetup(nextDraft, createRunSetup);

      if (setupError) {
        setCreateDialogError(setupError);
        return;
      }
    }

    if (isDirty) {
      setCreateDialogError("Save current task before creating another task.");
      return;
    }

    const didCreate = await createTask(nextDraft, {
      insertPosition: createInsertPosition,
    });

    if (didCreate) {
      setCreateDraft(newTaskDialogDraft(selectedTask));
      setCreateInsertPosition("bottom");
      setCreateRunSetup(createRunSetup);
      setCreateDialogError(null);
      setIsCreateDialogOpen(false);
    }
  }

  return (
    <WidgetFrame
      actions={queueFrameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      status={
        <AgentQueueWidgetStatusBadge
          apiAvailable={apiAvailable}
          isDirty={isDirty}
          isLoading={isLoading}
          isSaving={isSaving}
          loadError={loadError}
          selectedTask={selectedTask}
        />
      }
      style={frameStyle}
      title={title}
    >
      <div className="agent-queue-product-shell">
        {singleState ? (
          <div
            className="agent-queue-empty-state agent-queue-empty-state-compact"
            role={loadError ? "alert" : undefined}
          >
            <p className="empty-state-title">{singleState.title}</p>
            <p className="empty-state-text">{singleState.text}</p>
          </div>
        ) : (
          <AgentQueueLayout
            isFlowMapView
            layoutKey={instance.id}
            sidebar={
              <AgentQueueSidebar
                autonomous={queue.autonomous}
                foundation={queue.foundation}
              />
            }
            detailsPanel={
              <AgentQueueTaskDetailsPanel
                agentExecutorSlots={queueOwnedExecutorSlots}
                assignmentInputId={assignmentInputId}
                descriptionInputId={descriptionInputId}
                executionPolicyInputId={executionPolicyInputId}
                priorityInputId={priorityInputId}
                promptInputId={promptInputId}
                presentation="full"
                queue={queue}
                onAttachContextToCoordinator={onAttachContextToCoordinator}
                onCreateKnowledgeDocument={onCreateKnowledgeDocument}
                onCreateSkill={onCreateSkill}
                onListKnowledgeDraftReviews={onListKnowledgeDraftReviews}
                onRecordKnowledgeDraftReview={onRecordKnowledgeDraftReview}
                onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
                onOpenAgentExecutorRun={onOpenAgentExecutorRun}
                selectedTaskHint={selectedTaskHint}
                statusInputId={statusInputId}
                titleInputId={titleInputId}
              />
            }
            taskList={
              <AgentQueueFlowMap
                dependencyStates={queue.dependencyStates}
                embeddedExecutor={queue.foundation.embeddedExecutor}
                isSelecting={isSelecting}
                onSelectTask={(queueItemId) => void selectTask(queueItemId)}
                pausedQueueTagIds={queue.foundation.pausedQueueTagIds}
                routingStates={queue.assignedWorkerRoutingStates}
                schedulerPlan={queue.foundation.schedulerPlan}
                selectedTask={selectedTask}
                tasks={tasks}
                queueTags={queue.foundation.queueTags}
                workers={queue.foundation.workers}
              />
            }
          />
        )}
        {isCreateDialogOpen ? (
          <AgentQueueNewTaskDialog
            apiAvailable={apiAvailable}
            createDescriptionInputId={createDescriptionInputId}
            createDialogError={createDialogError}
            createDialogTitleId={createDialogTitleId}
            createDraft={createDraft}
            createExecutionPolicyInputId={createExecutionPolicyInputId}
            createExecutionStateInputId={createExecutionStateInputId}
            createPriorityInputId={createPriorityInputId}
            createPromptInputId={createPromptInputId}
            createRunApprovalPolicyInputId={createRunApprovalPolicyInputId}
            createRunCodexExecutableInputId={createRunCodexExecutableInputId}
            createRunSandboxInputId={createRunSandboxInputId}
            createRunWorkspaceInputId={createRunWorkspaceInputId}
            createTitleInputId={createTitleInputId}
            isCreating={isCreating}
            onCancel={cancelCreateTask}
            onConfirmDraft={() => void confirmCreateTask("draft")}
            onConfirmQueued={() => void confirmCreateTask("queued")}
            onDraftChange={updateCreateDraft}
            onInsertPositionChange={setCreateInsertPosition}
            onPriorityChange={updateCreatePriority}
            onRunSetupChange={updateCreateRunSetup}
            runSetup={createRunSetup}
            insertPosition={createInsertPosition}
          />
        ) : null}
      </div>
    </WidgetFrame>
  );
}

function newTaskDialogDraft(selectedTask?: AgentQueueTask | null): TaskDraft {
  return {
    ...emptyDraft(),
    queueTagName: selectedTask
      ? normalizeQueueTag(selectedTask).queueTagName
      : emptyDraft().queueTagName,
    title: "New task",
  };
}

function defaultCreateRunSetup(): AgentQueueNewTaskRunSetup {
  const defaults = defaultAgentQueueTaskRunSettings();

  return {
    approvalPolicy: defaults.approvalPolicy,
    codexExecutableDraft: defaults.codexExecutable,
    repoRootDraft: defaults.executionWorkspace,
    sandbox: "read_only",
  };
}

function runSetupFromQueueRun(
  run: AgentQueueRunController,
): AgentQueueNewTaskRunSetup {
  const defaults = agentQueueTaskRunSettingsDefaultsFromRun(run);

  return {
    approvalPolicy: defaults.approvalPolicy,
    codexExecutableDraft: defaults.codexExecutable,
    repoRootDraft: defaults.executionWorkspace,
    sandbox: defaults.sandbox,
  };
}

function validateQueuedRunSetup(
  draft: TaskDraft,
  setup: AgentQueueNewTaskRunSetup,
) {
  if (!draft.title.trim()) {
    return "Title is required before creating a queued task.";
  }

  if (!draft.prompt.trim()) {
    return "Prompt is required before creating a queued task.";
  }

  if (!setup.repoRootDraft.trim()) {
    return "Task workspace is required before creating a queued task.";
  }

  if (!setup.codexExecutableDraft.trim()) {
    return "Codex executable is required before creating a queued task.";
  }

  if (!setup.sandbox) {
    return "Sandbox is required before creating a queued task.";
  }

  if (!setup.approvalPolicy) {
    return "Approval policy is required before creating a queued task.";
  }

  return null;
}
