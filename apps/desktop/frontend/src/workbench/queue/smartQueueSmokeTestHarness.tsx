import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { expect, vi, type Mock } from "vitest";

import type { AgentQueueTask } from "../../workspace/types";
import type { AgentWorkerSummary } from "../agentQueueTaskUiModel";
import type { AgentQueueController } from "./details/agentQueueTaskDetailsTypes";
import { activeQueueProductSurface } from "./queueSurfaceOwnership";
import type { WorkspaceQueueApi } from "./useWorkspaceQueueApi";
import type { WidgetInstance } from "../types";
import { WidgetHost } from "../WidgetHost";
import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";
import {
  AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
  AGENT_QUEUE_WIDGET_DEFINITION_ID,
} from "../widgetRegistry";

type SmartQueueSmokeSpy = Mock<() => void>;

export type SmartQueueSmokeSideEffects = {
  createQueueView: SmartQueueSmokeSpy;
  executeRetry: SmartQueueSmokeSpy;
  executeRollback: SmartQueueSmokeSpy;
  launchTerminal: SmartQueueSmokeSpy;
  mutateFiles: SmartQueueSmokeSpy;
  mutateGit: SmartQueueSmokeSpy;
  startWorker: SmartQueueSmokeSpy;
  workspaceAgentRuntimeCall: SmartQueueSmokeSpy;
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function noopSideEffects(): SmartQueueSmokeSideEffects {
  return {
    createQueueView: vi.fn<() => void>(),
    executeRetry: vi.fn<() => void>(),
    executeRollback: vi.fn<() => void>(),
    launchTerminal: vi.fn<() => void>(),
    mutateFiles: vi.fn<() => void>(),
    mutateGit: vi.fn<() => void>(),
    startWorker: vi.fn<() => void>(),
    workspaceAgentRuntimeCall: vi.fn<() => void>(),
  };
}

export function queueController({
  effects = noopSideEffects(),
  selectedTask,
  smartQueueAssistance,
  smartQueueRetry,
  smartQueueRollback,
  tasks,
}: {
  effects?: SmartQueueSmokeSideEffects;
  selectedTask: AgentQueueTask;
  smartQueueAssistance?: Record<string, unknown>;
  smartQueueRetry?: Record<string, unknown>;
  smartQueueRollback?: Record<string, unknown>;
  tasks: readonly AgentQueueTask[];
}): AgentQueueController {
  return {
    apiAvailable: true,
    autorun: { snapshot: null },
    autonomous: {
      apiAvailable: true,
      canStart: false,
      error: null,
      message: null,
      onStart: () => effects.startWorker(),
      onStopAfterCurrent: vi.fn(),
      preconditionMessages: [],
      remainingEligibleCount: 0,
      status: "idle",
    },
    coordinatorFinalization: {
      canAct: false,
      message: null,
      onAcceptWithoutCommit: vi.fn(),
      onCommitResult: vi.fn(),
      onCreateFollowUp: vi.fn(),
      onFinalize: vi.fn(),
      onMarkBlocked: vi.fn(),
      onMarkFailedRejected: vi.fn(),
      onMarkFollowUpRequired: vi.fn(),
      onMarkNeedsChanges: vi.fn(),
      onMarkReadyForFinalization: vi.fn(),
      onMarkRollbackRequired: vi.fn(),
      status: selectedTask.coordinatorStatus ?? "not_reported",
    },
    createTask: vi.fn(async () => false),
    deleteTask: vi.fn(async () => false),
    diffReview: {
      canCreate: false,
      linkedReviewTasks: [],
      message: null,
      onCreate: vi.fn(),
    },
    draft: selectedTask,
    draftPromotion: {
      canPromote: false,
      isPromoting: false,
      onPromote: vi.fn(),
    },
    editorError: null,
    foundation: {
      globalExecutionState: "started",
      onStartWorkers: () => effects.startWorker(),
      onStopAndKillRunning: vi.fn(),
      pausedQueueTagIds: new Set(),
      workers: [worker()],
    },
    isCreating: false,
    isDirty: false,
    isEditing: false,
    isLoading: false,
    isSaving: false,
    isSelecting: false,
    loadError: null,
    refreshAfterExternalMutation: vi.fn(),
    refreshTasks: vi.fn(),
    run: {
      canStart: false,
      isStarting: false,
      onStartAssignedTask: () => effects.startWorker(),
      preconditionMessages: [],
      readinessMessage: null,
    },
    saveDraft: vi.fn(async () => false),
    saveStateText: "",
    selectedTask,
    selectTask: vi.fn(async () => true),
    setDraft: vi.fn(),
    smartQueueAssistance: {
      available: false,
      canAskWorkspaceAgent: false,
      error: null,
      isRequesting: false,
      message: null,
      onAskWorkspaceAgent: vi.fn(async () => null),
      ...smartQueueAssistance,
    },
    smartQueueRetry: {
      canRetrySame: false,
      canRetryWithModifiedPrompt: false,
      error: null,
      isRetrying: false,
      message: null,
      onRetrySame: vi.fn(async () => false),
      onRetryWithModifiedPrompt: vi.fn(async () => false),
      ...smartQueueRetry,
    },
    smartQueueRollback: {
      available: false,
      canPrepareProposal: false,
      error: null,
      isPreparing: false,
      message: null,
      onPrepareProposal: vi.fn(async () => null),
      ...smartQueueRollback,
    },
    tasks: [...tasks],
    updateDraft: vi.fn(),
    validationMessage: null,
    workerReport: {
      canAttach: false,
      latestReport: null,
      message: null,
      onAttachDemoReport: vi.fn(),
    },
    workers: [worker()],
  } as unknown as AgentQueueController;
}

export async function renderActiveQueueThroughWidgetHost({
  effects,
  queue,
  tasks,
}: {
  effects: SmartQueueSmokeSideEffects;
  queue: AgentQueueController;
  tasks: readonly AgentQueueTask[];
}) {
  await render(
    <WidgetHost
      agentActivityEvents={[]}
      agentExecutorRunOpenRequest={null}
      agentExecutorSlots={[]}
      agentQueueItemOpenRequest={null}
      coordinatorAttachedContextRequest={null}
      directWorkGitReview={{} as never}
      directWorkRunHandoff={{} as never}
      hasGitWidget={false}
      instance={queueWidget("queue-widget-1")}
      layoutMode="locked"
      onDockBack={vi.fn()}
      onOpenAgentExecutorRun={vi.fn()}
      onPopOut={vi.fn()}
      onPublishAgentActivityEvents={vi.fn()}
      onStartDockedDrag={vi.fn()}
      onStartPopoutDrag={vi.fn()}
      presentationMode="docked"
      queueReportActionCardRequest={null}
      queueTaskStatusCardRequest={null}
      widgetActions={widgetActions()}
      workspaceId="workspace-1"
      workspaceQueueApi={{
        controller: queue,
        createItem: vi.fn(),
        getSnapshot: vi.fn(),
        queueExecutorSlots: [],
        queueId: "workspace-queue",
        requestValidation: vi.fn(),
        runAutonomousQueue: () => {
          effects.startWorker();
          return Promise.resolve({
            action: "queue.runAutonomousQueue",
            message: "Unexpected worker start.",
            ok: false,
          });
        },
        stopAutonomousQueueAfterCurrent: vi.fn(),
        updateItem: vi.fn(),
        validationRunner: null,
      } as unknown as WorkspaceQueueApi}
    />,
  );
  expect(tasks).toHaveLength(1);
  expect(AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY).toBe(
    activeQueueProductSurface.componentKey,
  );
  expect(AGENT_QUEUE_WIDGET_DEFINITION_ID).toBe(
    activeQueueProductSurface.widgetDefinitionId,
  );
}

export function queueWidget(
  id: string,
  visible = true,
  state: WidgetInstance["state"] = {},
  order = 0,
): WidgetInstance {
  return {
    config: {},
    definitionId: AGENT_QUEUE_WIDGET_DEFINITION_ID,
    id,
    layout: {
      area: "main",
      height: 680,
      mode: "docked",
      order,
      width: 1160,
      x: 0,
      y: order * 24,
    },
    state,
    title: "Agent Queue",
    visible,
  };
}

export function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: "worker-1",
    assignedWorkerId: null,
    closureState: undefined,
    codexExecutable: "codex",
    coordinatorStatus: "not_reported",
    createdAt: "2026-06-15T10:00:00.000Z",
    dependsOn: [],
    description: "Smart Queue smoke task",
    executionPolicy: "manual",
    executionWorkspace: "C:/repo",
    itemType: "implementation",
    orderIndex: 0,
    priority: 1,
    prompt: "Run the selected task.",
    queueItemId: "queue-task",
    queueTagId: "default",
    queueTagName: "Default",
    sandbox: "workspace_write",
    status: "ready",
    title: "Smart Queue task",
    updatedAt: "2026-06-15T10:00:00.000Z",
    validationStatus: "not_started",
    workerExecutionReports: [],
    workspaceId: "workspace-1",
    ...overrides,
  };
}

export function worker(): AgentWorkerSummary {
  return {
    currentItemId: null,
    displayOrder: 0,
    enabled: true,
    lastReportSummary: null,
    name: "Local Queue worker",
    scope: { kind: "all" },
    status: "idle",
    workerId: "worker-1",
  };
}

export async function render(element: ReactNode) {
  cleanupRender();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
    await Promise.resolve();
  });
}

export function cleanupRender() {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
}

export async function flushRender() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

export async function clickButton(text: string) {
  const button = buttonByText(text);

  if (!button || button.disabled) {
    throw new Error(`Enabled button not found: ${text}`);
  }

  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

export function buttonByText(text: string) {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

export async function changeTextArea(label: string, value: string) {
  const textarea = textareaByLabel(label);

  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(textarea),
      "value",
    )?.set;
    valueSetter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
  });
}

export function textareaByLabel(label: string) {
  const textarea =
    Array.from(document.querySelectorAll<HTMLTextAreaElement>("textarea")).find(
      (element) => element.getAttribute("aria-label") === label,
    ) ?? null;

  if (!textarea) {
    throw new Error(`Textarea not found: ${label}`);
  }

  return textarea;
}

export function elementByAriaLabel(label: string) {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[aria-label]")).find(
      (element) => element.getAttribute("aria-label") === label,
    ) ?? null
  );
}

export async function openCompatDetails(taskId: string) {
  const card = document.querySelector<HTMLElement>(
    `[data-queue-item-id="${taskId}"]`,
  );
  const moreButton = card?.querySelector<HTMLButtonElement>(
    ".queue-v2-card-details",
  );

  if (!moreButton) {
    throw new Error(`Compat card More button not found: ${taskId}`);
  }

  await act(async () => {
    moreButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
  await clickButton("Open details");
}

function widgetActions(): WorkbenchWidgetInstanceActions {
  return {
    getWidgetRemovalConfirmation: vi.fn(),
    listWidgetLogs: vi.fn(async () => []),
    logRefreshTokens: {},
    removeWidgetInstance: vi.fn(),
    updateWidgetLayout: vi.fn(),
    updateWidgetState: vi.fn(),
  } as unknown as WorkbenchWidgetInstanceActions;
}
