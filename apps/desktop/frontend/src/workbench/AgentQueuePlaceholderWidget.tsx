import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type {
  AgentQueueTask,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../workspace/types";
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
import {
  useAgentQueueController,
  type AgentQueueRunController,
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
  onGetAgentExecutorRunDetail,
  queueTaskAutoRefreshRequest,
  onListenToDirectWorkStreamEvents,
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
  const [pendingSelectedTaskRunSetup, setPendingSelectedTaskRunSetup] =
    useState<AgentQueueNewTaskRunSetup | null>(null);
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
    onGetAgentExecutorRunDetail,
    onGetAgentQueueTask,
    onGetAgentQueueTaskLatestRunLink,
    onListenToDirectWorkStreamEvents,
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

  useEffect(() => {
    if (!pendingSelectedTaskRunSetup || !selectedTask) {
      return;
    }

    applyCreateRunSetupToQueueRun(pendingSelectedTaskRunSetup, queue.run);
    setPendingSelectedTaskRunSetup(null);
  }, [pendingSelectedTaskRunSetup, selectedTask?.queueItemId]);

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
          setCreateRunSetup(runSetupFromQueueRun(queue.run));
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

    if (mode === "queued") {
      applyCreateRunSetupToQueueRun(createRunSetup, queue.run);
    }

    const didCreate = await createTask(nextDraft, {
      insertPosition: createInsertPosition,
    });

    if (didCreate) {
      if (mode === "queued") {
        setPendingSelectedTaskRunSetup({ ...createRunSetup });
      }
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
  return {
    approvalPolicy: "never",
    codexExecutableDraft: "codex.cmd",
    repoRootDraft: "",
    sandbox: "read_only",
  };
}

function runSetupFromQueueRun(
  run: AgentQueueRunController,
): AgentQueueNewTaskRunSetup {
  return {
    approvalPolicy: normalizeApprovalPolicy(run.approvalPolicy),
    codexExecutableDraft: run.codexExecutableDraft.trim() || "codex.cmd",
    repoRootDraft: run.repoRootDraft,
    sandbox: normalizeSandbox(run.sandbox),
  };
}

function applyCreateRunSetupToQueueRun(
  setup: AgentQueueNewTaskRunSetup,
  run: AgentQueueRunController,
) {
  run.onRepoRootDraftChange(setup.repoRootDraft);
  run.onCodexExecutableDraftChange(setup.codexExecutableDraft);
  run.onSandboxChange(setup.sandbox);
  run.onApprovalPolicyChange(setup.approvalPolicy);
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
    return "Execution workspace is required before creating a queued task.";
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

function normalizeSandbox(value: DirectWorkSandbox): DirectWorkSandbox {
  return value === "workspace_write" || value === "danger_full_access"
    ? value
    : "read_only";
}

function normalizeApprovalPolicy(
  value: DirectWorkApprovalPolicy,
): DirectWorkApprovalPolicy {
  return value === "on_request" || value === "untrusted" ? value : "never";
}
