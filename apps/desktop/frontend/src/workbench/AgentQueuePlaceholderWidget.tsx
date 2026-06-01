import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { AgentQueueTask } from "../workspace/types";
import { AgentQueueFlowMap } from "./AgentQueueFlowMap";
import { AgentQueueLayout } from "./AgentQueueLayout";
import { AgentQueueNewTaskDialog } from "./AgentQueueNewTaskDialog";
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
import {
  useAgentQueueController,
  type QueueTaskInsertPosition,
} from "./queue/useAgentQueueController";
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
  onAssignAgentQueueTaskToExecutor,
  onClearAgentQueueTaskAssignment,
  onCreateAgentQueueTask,
  onCreateAgentQueueWorker,
  onDeleteAgentQueueTask,
  onDeleteAgentQueueWorker,
  onGetAgentQueueTask,
  onGetAgentQueueTaskLatestRunLink,
  onGetAgentQueueRunnerSnapshot,
  onListAgentQueueTaskRunLinks,
  onListAgentQueueTasks,
  onListAgentQueueWorkers,
  onLoadLogs,
  onAttachContextToCoordinator,
  onShowQueueReportInWorkspaceChat,
  onOpenAgentExecutorRun,
  onDirectWorkRunHandoffStarted,
  queueTaskAutoRefreshRequest,
  onStartFrameMove,
  onStartAssignedAgentQueueTask,
  onStartAgentQueueRunnerSession,
  onStopAgentQueueRunnerSession,
  onUpdateAgentQueueTask,
  onUpdateAgentQueueWorker,
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
  const createDialogTitleId = useId();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<TaskDraft>(() =>
    newTaskDialogDraft(),
  );
  const [createInsertPosition, setCreateInsertPosition] =
    useState<QueueTaskInsertPosition>("bottom");
  const [createDialogError, setCreateDialogError] = useState<string | null>(
    null,
  );
  const queueOwnedExecutorSlots = useMemo(
    () => [
      {
        label: "Local executor ready",
        ownerKind: "agent_queue" as const,
        widgetInstanceId: instance.id,
      },
      ...agentExecutorSlots.map((slot) => ({
        ...slot,
        ownerKind: slot.ownerKind ?? ("agent_executor" as const),
      })),
    ],
    [agentExecutorSlots, instance.id],
  );
  const queue = useAgentQueueController({
    agentExecutorSlots: queueOwnedExecutorSlots,
    onAssignAgentQueueTaskToExecutor,
    onClearAgentQueueTaskAssignment,
    onCreateAgentQueueTask,
    onCreateAgentQueueWorker,
    onDeleteAgentQueueTask,
    onDeleteAgentQueueWorker,
    onDirectWorkRunHandoffStarted,
    onGetAgentQueueTask,
    onGetAgentQueueTaskLatestRunLink,
    onGetAgentQueueRunnerSnapshot,
    onListAgentQueueTaskRunLinks,
    onListAgentQueueTasks,
    onListAgentQueueWorkers,
    onStartAssignedAgentQueueTask,
    onStartAgentQueueRunnerSession,
    onStopAgentQueueRunnerSession,
    onUpdateAgentQueueTask,
    onUpdateAgentQueueWorker,
    queueTaskAutoRefreshRequest,
  });
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

  function cancelCreateTask() {
    setIsCreateDialogOpen(false);
    setCreateDialogError(null);
  }

  async function confirmCreateTask() {
    const validationError = validateDraft(createDraft);

    if (validationError) {
      setCreateDialogError(validationError);
      return;
    }

    if (isDirty) {
      setCreateDialogError("Save current task before creating another task.");
      return;
    }

    const didCreate = await createTask(createDraft, {
      insertPosition: createInsertPosition,
    });

    if (didCreate) {
      setCreateDraft(newTaskDialogDraft(selectedTask));
      setCreateInsertPosition("bottom");
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
            sidebar={<AgentQueueSidebar foundation={queue.foundation} />}
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
            createPriorityInputId={createPriorityInputId}
            createPromptInputId={createPromptInputId}
            createTitleInputId={createTitleInputId}
            isCreating={isCreating}
            onCancel={cancelCreateTask}
            onConfirm={() => void confirmCreateTask()}
            onDraftChange={updateCreateDraft}
            onInsertPositionChange={setCreateInsertPosition}
            onPriorityChange={updateCreatePriority}
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
