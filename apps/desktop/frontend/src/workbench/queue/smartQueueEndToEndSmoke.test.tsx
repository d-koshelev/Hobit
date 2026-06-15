import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../workspace/types";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
} from "./agentQueueWidgetApiTypes";
import type { WorkspaceAgentQueueBridge } from "../workspaceAgentQueueBridge";
import { AgentQueueV2Board } from "../AgentQueueV2Board";
import { QueueV2Widget } from "../widgetV2/queueV2/QueueV2Widget";
import { AGENT_QUEUE_WIDGET_DEFINITION_ID } from "../widgetRegistry";
import {
  activeQueueProductSurface,
  queueV2SmokeCompatSurface,
} from "./queueSurfaceOwnership";
import {
  computeDuplicateQueueViewRepair,
  resolveSingletonWidgetCreate,
} from "../workspaceSingletonWidgets";
import { buildPromptPackImportPreview } from "../promptPack/promptPackImportPreview";
import { materializePromptPackPreviewToQueue } from "../promptPack/promptPackMaterialization";
import { parsePromptPackImportPlan } from "../promptPack/promptPackParser";
import {
  SMART_QUEUE_WORKSPACE_QUEUE_ID,
  materializeSmartQueuePromptPack,
} from "./smartQueuePromptPackMaterialization";
import {
  canStartTaskNow,
  queueExecutionModeFromGlobalState,
} from "./smartQueueExecutionGate";
import {
  computeHumanQueueStatus,
  type SmartQueueBlocker,
  type SmartQueueDependency,
  type SmartQueueTaskInput,
} from "./smartQueueEligibility";
import {
  computeSmartQueueDependencyPropagation,
} from "./smartQueueDependencyPropagation";
import { presentSmartQueueStatus } from "./smartQueueStatusPresentation";
import {
  buildSmartQueueWorkerFailureIntegration,
  parseSmartQueueRetryModifiedPromptPayload,
  parseSmartQueueRetrySamePayload,
  parseSmartQueueWorkerFailurePayload,
  type SmartQueueWorkerFailurePayload,
} from "./smartQueueWorkerReportIntegration";
import {
  applySmartQueueRetrySameActionToTask,
  applySmartQueueRetryWithModifiedPromptActionToTask,
} from "./smartQueueRetrySameAction";
import {
  applySmartQueueAssistanceRequestToTask,
  parseSmartQueueAssistanceRequestPayload,
} from "./smartQueueAssistanceRequest";
import {
  applySmartQueueRollbackProposalToTask,
  parseSmartQueueRollbackProposalPayload,
} from "./smartQueueRollbackProposal";
import {
  proposeSmartQueueRollbackAttemptDecision,
  type SmartQueueCoordinatorDecision,
} from "./smartQueueCoordinatorDecision";
import {
  buttonByText,
  changeTextArea,
  cleanupRender,
  clickButton,
  elementByAriaLabel,
  flushRender,
  openCompatDetails,
  queueController,
  queueTask,
  queueWidget,
  render,
  renderActiveQueueThroughWidgetHost,
  textareaByLabel,
  worker,
  type SmartQueueSmokeSideEffects,
} from "./smartQueueSmokeTestHarness";

afterEach(() => {
  cleanupRender();
  vi.restoreAllMocks();
});

describe("Smart Queue end-to-end frontend smoke", () => {
  it("imports a prompt pack into the singleton Queue without creating views or starting workers", async () => {
    const effects = createSideEffectRecorder();
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "prompt-batch.json",
          text: JSON.stringify({
            id: "smart-queue-e2e",
            items: [
              {
                id: "001-root",
                prompt: "Implement the root task.",
                title: "Root task",
              },
              {
                dependencies: ["001-root"],
                id: "002-dependent",
                prompt: "Implement the dependent task.",
                title: "Dependent task",
              },
              {
                dependencies: ["002-dependent"],
                id: "003-final",
                prompt: "Implement the final task.",
                title: "Final task",
              },
            ],
            name: "Smart Queue E2E",
          }),
        },
      ]),
    );
    const smartPreview = preview.smartQueueMaterialization;
    const harness = createQueueBridgeHarness(effects);

    expect(smartPreview.queue).toEqual({
      queueId: SMART_QUEUE_WORKSPACE_QUEUE_ID,
      scope: "workspace",
      singleton: true,
      singletonKey: "workspace-queue",
    });
    expect(smartPreview.tasks).toHaveLength(3);
    expect(smartPreview.tasks.map((task) => task.humanStatus.label)).toEqual([
      "Ready",
      "Waiting dependency",
      "Waiting dependency",
    ]);
    expect(smartPreview.dependencies).toMatchObject([
      {
        downstreamTaskId: "queue-task-smart-queue-e2e-002-dependent",
        upstreamTaskId: "queue-task-smart-queue-e2e-001-root",
      },
      {
        downstreamTaskId: "queue-task-smart-queue-e2e-003-final",
        upstreamTaskId: "queue-task-smart-queue-e2e-002-dependent",
      },
    ]);
    expect(smartPreview.wouldStartTasks).toBe(false);
    expect(smartPreview.tasks.every((task) => task.wouldStart === false)).toBe(
      true,
    );
    assertNoHiddenSideEffects(effects);

    const result = await materializePromptPackPreviewToQueue({
      bridge: harness.bridge,
      confirmed: true,
      currentWorkspaceRoot: "C:/repo",
      preview,
    });

    expect(result.ok).toBe(true);
    expect(result.createdTasks).toHaveLength(3);
    expect(result.dependencyLinksCreated).toHaveLength(2);
    expect(harness.bridge.createItem).toHaveBeenCalledTimes(3);
    expect(harness.bridge.updateItem).toHaveBeenCalledTimes(2);
    expect(harness.tasks().map((task) => task.queueItemId).sort()).toEqual([
      "queue-001-root",
      "queue-002-dependent",
      "queue-003-final",
    ]);
    expect(
      harness.tasks().find((task) => task.queueItemId === "queue-002-dependent")
        ?.dependsOn,
    ).toEqual(["queue-001-root"]);
    expect(
      materializeSmartQueuePromptPack({
        prompts: [
          { body: "Root", promptId: "root", title: "Root" },
          {
            body: "Dependent",
            dependencies: ["root"],
            promptId: "dependent",
            title: "Dependent",
          },
        ],
        sourcePackId: "singleton-smoke",
      }).tasks.map((task) => task.humanStatus.label),
    ).toEqual(["Ready", "Waiting dependency"]);
    assertNoHiddenSideEffects(effects);
  });

  it("uses the Active/Pause gate to pick only eligible Ready root tasks", () => {
    const tasks: SmartQueueTaskInput[] = [
      smartTask("root", "ready"),
      smartTask("dependent", "ready"),
      smartTask("blocked", "ready", [
        { kind: "dependency_failed", reason: "dependency failed", taskId: "blocked" },
      ]),
      smartTask("needs-decision", "ready", [
        {
          kind: "validation_requires_decision",
          reason: "validation failed",
          taskId: "needs-decision",
        },
      ]),
    ];
    const dependencies: SmartQueueDependency[] = [
      {
        downstreamTaskId: "dependent",
        kind: "blocks_start",
        upstreamTaskId: "root",
      },
    ];

    expect(queueExecutionModeFromGlobalState("stopped")).toMatchObject({
      mode: "paused",
      queueState: "paused",
    });
    expect(pickStartableTaskIds(tasks, dependencies, "paused")).toEqual([]);
    expect(pickStartableTaskIds(tasks, dependencies, "stopped")).toEqual([]);
    expect(pickStartableTaskIds(tasks, dependencies, "active")).toEqual(["root"]);
    expect(
      canStartTaskNow({
        capacityAvailable: true,
        dependencies,
        queueState: "active",
        task: tasks[1],
        tasks,
      }),
    ).toMatchObject({
      canStartTaskNow: false,
      dependencyReason: "Waiting dependency",
    });
    expect(
      canStartTaskNow({
        capacityAvailable: true,
        dependencies,
        queueState: "active",
        task: tasks[2],
        tasks,
      }).eligibility.humanStatus.label,
    ).toBe("Blocked: dependency failed");
    expect(
      canStartTaskNow({
        capacityAvailable: true,
        dependencies,
        queueState: "active",
        task: tasks[3],
        tasks,
      }).eligibility.humanStatus.label,
    ).toBe("Needs decision: validation failed");
  });

  it("propagates dependency failures, recovers when upstream closes, and keeps product labels clean", () => {
    const dependencies: SmartQueueDependency[] = [
      { downstreamTaskId: "B", kind: "blocks_start", upstreamTaskId: "A" },
      { downstreamTaskId: "C", kind: "blocks_start", upstreamTaskId: "B" },
    ];
    const failedChain = [
      smartTask("A", "failed"),
      smartTask("B", "ready"),
      smartTask("C", "ready"),
    ];
    const failedB = computeSmartQueueDependencyPropagation(
      failedChain[1],
      failedChain,
      dependencies,
    );
    const blockedC = computeSmartQueueDependencyPropagation(
      failedChain[2],
      failedChain,
      dependencies,
    );

    expect(failedB.state).toBe("dependency_failed");
    expect(
      presentSmartQueueStatus({
        blockers: failedB.blockers,
        dependencyGate: failedB.gate,
        humanStatus: computeHumanQueueStatus(failedChain[1], failedB.gate),
      }).label,
    ).toBe("Blocked: dependency failed");
    expect(blockedC.state).toBe("dependency_blocked");
    expect(
      presentSmartQueueStatus({
        blockers: blockedC.blockers,
        dependencyGate: blockedC.gate,
        humanStatus: computeHumanQueueStatus(failedChain[2], blockedC.gate),
      }).label,
    ).toBe("Blocked: dependency blocked");

    const recovered = [
      smartTask("A", "closed"),
      smartTask("B", "ready"),
      smartTask("C", "ready"),
    ];
    expect(
      computeSmartQueueDependencyPropagation(
        recovered[1],
        recovered,
        dependencies,
      ).state,
    ).toBe("satisfied");
    expect(
      computeHumanQueueStatus(
        recovered[1],
        computeSmartQueueDependencyPropagation(
          recovered[1],
          recovered,
          dependencies,
        ).gate,
      ).label,
    ).toBe("Ready");

    const otherUpstream = [
      smartTask("A", "closed"),
      smartTask("A2", "running"),
      smartTask("B", "ready"),
    ];
    const multiDependencies: SmartQueueDependency[] = [
      { downstreamTaskId: "B", kind: "blocks_start", upstreamTaskId: "A" },
      { downstreamTaskId: "B", kind: "blocks_start", upstreamTaskId: "A2" },
    ];
    const waitingB = computeSmartQueueDependencyPropagation(
      otherUpstream[2],
      otherUpstream,
      multiDependencies,
    );
    expect(computeHumanQueueStatus(otherUpstream[2], waitingB.gate).label).toBe(
      "Waiting dependency",
    );

    const taskLocalBlocker = smartTask("B", "ready", [
      {
        kind: "validation_requires_decision",
        reason: "validation failed",
        taskId: "B",
      },
    ]);
    const taskLocalGate = computeSmartQueueDependencyPropagation(
      taskLocalBlocker,
      [smartTask("A", "closed"), taskLocalBlocker],
      [{ downstreamTaskId: "B", kind: "blocks_start", upstreamTaskId: "A" }],
    );
    expect(computeHumanQueueStatus(taskLocalBlocker, taskLocalGate.gate).label).toBe(
      "Needs decision: validation failed",
    );

    const labels = [
      "Ready",
      "Waiting dependency",
      "Blocked: dependency failed",
      "Blocked: dependency blocked",
      "Needs decision: validation failed",
    ];
    for (const label of labels) {
      expect(label).not.toMatch(
        /dependency_failed|dependency_blocked|validation_requires_decision/,
      );
    }
  });

  it("renders worker validation failure as a Coordinator Decision card on the active route only", async () => {
    const effects = createSideEffectRecorder();
    const task = smartFailureTask({
      evidenceSummary: "Validation failed after npm test.",
      failureKind: "validation_failure",
      queueItemId: "decision-task",
      reason: "Validation failed.",
      suggestedActions: ["rollback_attempt_proposal"],
    });
    const payload = parseSmartQueueWorkerFailurePayload(
      task.workerExecutionReports?.[0]?.rawReportPreview,
    );

    expect(payload?.attempt.status).toBe("failed");
    expect(payload?.attempt.validationResult?.status).toBe("failed");
    expect(payload?.workerReport).toMatchObject({
      attemptId: payload?.attempt.attemptId,
      taskId: "decision-task",
    });

    await renderActiveQueueThroughWidgetHost({
      effects,
      queue: queueController({
        selectedTask: task,
        tasks: [task],
      }),
      tasks: [task],
    });
    await flushRender();
    await clickButton("Details");
    await flushRender();

    const card = elementByAriaLabel("Coordinator Decision card");

    expect(activeQueueProductSurface.route).toEqual([
      "WidgetHost",
      "AgentQueuePlaceholderWidget",
      "AgentQueueV2Board",
    ]);
    expect(card?.textContent).toContain("Needs decision: validation failed");
    expect(card?.textContent).toContain("Retry with changes");
    expect(card?.textContent).toContain("Approval required");
    expect(card?.textContent).toContain("Destructive");
    assertNoRawInternalNames(card);
    expect(pickStartableTaskIds([smartTask("decision-task", "ready", [
      {
        kind: "validation_requires_decision",
        reason: "validation failed",
        taskId: "decision-task",
      },
    ])], [], "active")).toEqual([]);
    assertNoHiddenSideEffects(effects);

    cleanupRender();
    await render(
      <QueueV2Widget
        queue={queueController({ selectedTask: task, tasks: [task] })}
        tasks={[task]}
        workers={[worker()]}
      />,
    );
    await flushRender();
    await openCompatDetails("decision-task");

    expect(queueV2SmokeCompatSurface.userCreatable).toBe(false);
    expect(elementByAriaLabel("Coordinator Decision card")).toBeNull();
    expect(document.body.textContent).not.toContain("Ask Workspace Agent");
    expect(document.body.textContent).not.toContain("Prepare rollback proposal");
  });

  it("keeps Retry same explicit, budget-gated, and non-executing", async () => {
    const effects = createSideEffectRecorder();
    const task = smartFailureTask({
      evidenceSummary: "Worker timed out.",
      failureKind: "timeout",
      queueItemId: "retry-same-task",
      reason: "Timed out.",
    });
    const exhaustedTask = smartFailureTask({
      evidenceSummary: "Worker timed out again.",
      failureKind: "timeout",
      queueItemId: "retry-exhausted-task",
      reason: "Timed out.",
      retryCount: 1,
    });

    await render(
      <AgentQueueV2Board
        autorunArmed={false}
        globalExecutionState="stopped"
        isSelecting={false}
        onSelectTask={vi.fn()}
        pausedQueueTagIds={new Set()}
        queue={queueController({
          effects,
          selectedTask: task,
          smartQueueRetry: {
            canRetrySame: true,
            canRetryWithModifiedPrompt: false,
            isRetrying: false,
            message: null,
            error: null,
            onRetrySame: vi.fn(async () => true),
            onRetryWithModifiedPrompt: vi.fn(async () => false),
          },
          tasks: [task],
        })}
        selectedTask={task}
        tasks={[task]}
        workers={[worker()]}
      />,
    );
    await flushRender();
    await clickButton("Details");
    await flushRender();

    expect(buttonByText("Retry")).not.toBeNull();

    cleanupRender();
    await render(
      <AgentQueueV2Board
        autorunArmed={false}
        globalExecutionState="stopped"
        isSelecting={false}
        onSelectTask={vi.fn()}
        pausedQueueTagIds={new Set()}
        queue={queueController({
          selectedTask: exhaustedTask,
          smartQueueRetry: {
            canRetrySame: false,
            canRetryWithModifiedPrompt: false,
            isRetrying: false,
            message: null,
            error: null,
            onRetrySame: vi.fn(async () => false),
            onRetryWithModifiedPrompt: vi.fn(async () => false),
          },
          tasks: [exhaustedTask],
        })}
        selectedTask={exhaustedTask}
        tasks={[exhaustedTask]}
        workers={[worker()]}
      />,
    );
    await flushRender();
    await clickButton("Details");
    await flushRender();

    expect(buttonByText("Retry")).toBeNull();

    const retry = applySmartQueueRetrySameActionToTask({
      acceptedAt: "2026-06-15T11:00:00.000Z",
      task,
    });
    expect(retry.ok).toBe(true);
    if (!retry.ok) {
      throw new Error(retry.reason);
    }
    expect(retry.retryAttempt).toMatchObject({
      attemptNumber: 2,
      retrySource: "retry_same",
      status: "pending",
    });
    expect(retry.task.status).toBe("ready");
    expect(retry.task.workerExecutionReports).toHaveLength(2);
    expect(
      parseSmartQueueWorkerFailurePayload(
        retry.task.workerExecutionReports?.[0]?.rawReportPreview,
      ),
    ).not.toBeNull();
    expect(
      parseSmartQueueRetrySamePayload(
        retry.task.workerExecutionReports?.[1]?.rawReportPreview,
      )?.sideEffects,
    ).toMatchObject({
      wouldCallWorkspaceAgent: false,
      wouldExecuteRetry: false,
      wouldExecuteRollback: false,
      wouldLaunchTerminal: false,
      wouldMutateGit: false,
      wouldStartWorker: false,
    });
    expect(pickStartableTaskIds([smartTask("retry-same-task", "ready")], [], "paused"))
      .toEqual([]);
    expect(pickStartableTaskIds([smartTask("retry-same-task", "ready")], [], "active"))
      .toEqual(["retry-same-task"]);
    assertNoHiddenSideEffects(effects);
  });

  it("queues Retry with changes from an explicit editor without direct worker start", async () => {
    const effects = createSideEffectRecorder();
    const onRetryWithModifiedPrompt = vi.fn(async () => true);
    const task = smartFailureTask({
      evidenceSummary: "Validation failed in smoke.",
      failureKind: "validation_failure",
      queueItemId: "retry-changes-task",
      prompt: "Original runnable prompt.",
      reason: "Validation failed.",
    });

    await render(
      <AgentQueueV2Board
        autorunArmed={false}
        globalExecutionState="stopped"
        isSelecting={false}
        onSelectTask={vi.fn()}
        pausedQueueTagIds={new Set()}
        queue={queueController({
          effects,
          selectedTask: task,
          smartQueueRetry: {
            canRetrySame: false,
            canRetryWithModifiedPrompt: true,
            error: null,
            isRetrying: false,
            message: null,
            onRetrySame: vi.fn(async () => false),
            onRetryWithModifiedPrompt,
          },
          tasks: [task],
        })}
        selectedTask={task}
        tasks={[task]}
        workers={[worker()]}
      />,
    );
    await flushRender();
    await clickButton("Details");
    await flushRender();

    expect(buttonByText("Retry")).toBeNull();
    expect(buttonByText("Retry with changes")).not.toBeNull();
    await clickButton("Retry with changes");
    await flushRender();
    expect(textareaByLabel("Modified retry prompt").value).toBe(
      "Original runnable prompt.",
    );
    await changeTextArea("Modified retry prompt", "");
    await clickButton("Queue retry");
    expect(document.body.textContent).toContain(
      "Enter a modified prompt before queueing retry.",
    );
    expect(onRetryWithModifiedPrompt).not.toHaveBeenCalled();
    await changeTextArea("Modified retry prompt", "Modified runnable prompt.");
    await clickButton("Queue retry");
    expect(onRetryWithModifiedPrompt).toHaveBeenCalledWith(
      "Modified runnable prompt.",
    );

    const retry = applySmartQueueRetryWithModifiedPromptActionToTask({
      acceptedAt: "2026-06-15T11:15:00.000Z",
      modifiedPrompt: "Modified runnable prompt.",
      task,
    });
    expect(retry.ok).toBe(true);
    if (!retry.ok) {
      throw new Error(retry.reason);
    }
    expect(retry.task.status).toBe("ready");
    expect(retry.task.prompt).toBe("Modified runnable prompt.");
    expect(retry.originalPrompt).toBe("Original runnable prompt.");
    expect(retry.retryAttempt.attemptNumber).toBe(2);
    expect(retry.retryAttempt.promptOverride).toMatchObject({
      originalPrompt: "Original runnable prompt.",
      modifiedPrompt: "Modified runnable prompt.",
      runnablePromptField: "task.prompt",
    });
    expect(
      parseSmartQueueRetryModifiedPromptPayload(
        retry.task.workerExecutionReports?.[1]?.rawReportPreview,
      )?.sideEffects.wouldStartWorker,
    ).toBe(false);
    assertNoHiddenSideEffects(effects);
  });

  it("prepares Workspace Agent assistance requests without calling the runtime", async () => {
    const effects = createSideEffectRecorder();
    const task = smartFailureTask({
      dependsOn: ["upstream-task"],
      evidenceSummary: "Required context was missing.",
      failureKind: "missing_context",
      queueItemId: "assistance-task",
      reason: "Missing context.",
      title: "Assistance needed task",
    });
    const assistance = applySmartQueueAssistanceRequestToTask({
      createdAt: "2026-06-15T11:30:00.000Z",
      task,
    });
    expect(assistance.ok).toBe(true);
    if (!assistance.ok) {
      throw new Error(assistance.reason);
    }
    expect(assistance.request).toMatchObject({
      attemptId: expect.any(String),
      coordinatorDecisionId: expect.any(String),
      taskId: "assistance-task",
      taskTitle: "Assistance needed task",
    });
    expect(assistance.request.recommendedPrompt).toContain(
      'Queue task "Assistance needed task"',
    );
    expect(assistance.request.recommendedPrompt).toContain(
      "Required context was missing.",
    );
    expect(assistance.task.status).toBe(task.status);
    expect(
      parseSmartQueueAssistanceRequestPayload(
        assistance.task.workerExecutionReports?.[1]?.rawReportPreview,
      )?.sideEffects,
    ).toMatchObject({
      wouldCallWorkspaceAgent: false,
      wouldExecuteRetry: false,
      wouldExecuteRollback: false,
      wouldLaunchTerminal: false,
      wouldMutateGit: false,
      wouldStartWorker: false,
    });

    await render(
      <AgentQueueV2Board
        autorunArmed={false}
        globalExecutionState="started"
        isSelecting={false}
        onSelectTask={vi.fn()}
        pausedQueueTagIds={new Set()}
        queue={queueController({
          effects,
          selectedTask: task,
          smartQueueAssistance: {
            available: true,
            canAskWorkspaceAgent: true,
            error: null,
            isRequesting: false,
            message: null,
            onAskWorkspaceAgent: vi.fn(async () => assistance.request),
          },
          tasks: [task],
        })}
        selectedTask={task}
        tasks={[task]}
        workers={[worker()]}
      />,
    );
    await flushRender();
    await clickButton("Details");
    await flushRender();

    expect(buttonByText("Ask Workspace Agent")).not.toBeNull();
    await clickButton("Ask Workspace Agent");
    await flushRender();
    expect(elementByAriaLabel("Workspace Agent assistance handoff")?.textContent)
      .toContain("Handoff prompt is ready.");
    expect(textareaByLabel("Workspace Agent handoff prompt").value).toContain(
      "Assistance needed task",
    );
    expect(pickStartableTaskIds([smartTask("assistance-task", "ready", [
      {
        kind: "requires_human_input",
        reason: "assistance requested",
        taskId: "assistance-task",
      },
    ])], [], "active")).toEqual([]);
    assertNoHiddenSideEffects(effects);
  });

  it("prepares rollback proposal metadata only and preserves Queue data", async () => {
    const effects = createSideEffectRecorder();
    const task = smartFailureTask({
      baseRevision: "abc1234",
      changedFiles: ["src/a.ts", "src/b.ts"],
      evidenceSummary: "Validation failed after file changes.",
      failureKind: "validation_failure",
      queueItemId: "rollback-task",
      reason: "Validation failed.",
      rollbackDecision: true,
      title: "Rollback proposal task",
    });
    const beforeReportCount = task.workerExecutionReports?.length ?? 0;
    const rollback = applySmartQueueRollbackProposalToTask({
      createdAt: "2026-06-15T11:45:00.000Z",
      task,
    });
    expect(rollback.ok).toBe(true);
    if (!rollback.ok) {
      throw new Error(rollback.reason);
    }
    expect(rollback.task.status).toBe(task.status);
    expect(rollback.task.workerExecutionReports).toHaveLength(
      beforeReportCount + 1,
    );
    expect(rollback.proposal).toMatchObject({
      approvalRequired: true,
      baseRevision: "abc1234",
      changedFiles: ["src/a.ts", "src/b.ts"],
      destructive: true,
      executableNow: false,
    });
    expect(rollback.proposal.planText).toContain("No rollback executed.");
    expect(
      parseSmartQueueRollbackProposalPayload(
        rollback.task.workerExecutionReports?.[1]?.rawReportPreview,
      )?.sideEffects,
    ).toMatchObject({
      wouldCallWorkspaceAgent: false,
      wouldExecuteRetry: false,
      wouldExecuteRollback: false,
      wouldLaunchTerminal: false,
      wouldMutateFiles: false,
      wouldMutateGit: false,
      wouldStartWorker: false,
    });

    await render(
      <AgentQueueV2Board
        autorunArmed={false}
        globalExecutionState="started"
        isSelecting={false}
        onSelectTask={vi.fn()}
        pausedQueueTagIds={new Set()}
        queue={queueController({
          effects,
          selectedTask: task,
          smartQueueRollback: {
            available: true,
            canPrepareProposal: true,
            error: null,
            isPreparing: false,
            message: null,
            onPrepareProposal: vi.fn(async () => rollback.proposal),
          },
          tasks: [task],
        })}
        selectedTask={task}
        tasks={[task]}
        workers={[worker()]}
      />,
    );
    await flushRender();
    await clickButton("Details");
    await flushRender();

    expect(buttonByText("Prepare rollback proposal")).not.toBeNull();
    await clickButton("Prepare rollback proposal");
    await flushRender();

    const prepared = elementByAriaLabel("Rollback proposal prepared");
    expect(prepared?.textContent).toContain("Approval required");
    expect(prepared?.textContent).toContain("Destructive");
    expect(prepared?.textContent).toContain("Affected files: 2");
    expect(prepared?.textContent).toContain("abc1234");
    expect(prepared?.textContent).toContain("No rollback executed");
    expect(task.queueItemId).toBe("rollback-task");
    assertNoHiddenSideEffects(effects);
  });

  it("keeps Queue view singleton safety separate from Queue domain data and task actions", () => {
    const queueDomainData = {
      tasks: [
        { queueItemId: "task-1", status: "ready" },
        { queueItemId: "task-2", status: "waiting_dependency" },
      ],
    };
    const beforeDomainData = structuredClone(queueDomainData);
    const existingQueue = queueWidget("queue-existing", true, queueDomainData);
    const resolution = resolveSingletonWidgetCreate(
      [existingQueue],
      AGENT_QUEUE_WIDGET_DEFINITION_ID,
    );

    expect(resolution).toMatchObject({
      canCreate: false,
      existingWidgetId: "queue-existing",
      kind: "reuse-existing",
    });
    expect(queueDomainData).toEqual(beforeDomainData);

    const repair = computeDuplicateQueueViewRepair([
      queueWidget("queue-duplicate", true, { selectedTaskId: "task-2" }, 2),
      existingQueue,
    ]);
    expect(repair.repairKind).toBe("hide-duplicates");
    expect(repair.duplicateQueueViewIds).toEqual(["queue-duplicate"]);
    expect(repair.repairedWidgets).toEqual([
      expect.objectContaining({ id: "queue-duplicate", visible: false }),
      expect.objectContaining({ id: "queue-existing", visible: true }),
    ]);
    expect(queueDomainData).toEqual(beforeDomainData);

    const effects = createSideEffectRecorder();
    const task = smartFailureTask({
      evidenceSummary: "Worker timed out.",
      failureKind: "timeout",
      queueItemId: "task-1",
      reason: "Timed out.",
    });
    expect(
      applySmartQueueRetrySameActionToTask({ task }).task.queueItemId,
    ).toBe("task-1");
    expect(
      applySmartQueueAssistanceRequestToTask({
        task: smartFailureTask({
          evidenceSummary: "Missing context.",
          failureKind: "missing_context",
          queueItemId: "task-1",
          reason: "Missing context.",
        }),
      }).task.queueItemId,
    ).toBe("task-1");
    assertNoHiddenSideEffects(effects);
  });
});

function createSideEffectRecorder() {
  return {
    createQueueView: vi.fn(),
    executeRetry: vi.fn(),
    executeRollback: vi.fn(),
    launchTerminal: vi.fn(),
    mutateFiles: vi.fn(),
    mutateGit: vi.fn(),
    startWorker: vi.fn(),
    workspaceAgentRuntimeCall: vi.fn(),
  };
}

function assertNoHiddenSideEffects(
  effects: ReturnType<typeof createSideEffectRecorder>,
) {
  expect(effects.createQueueView).not.toHaveBeenCalled();
  expect(effects.executeRetry).not.toHaveBeenCalled();
  expect(effects.executeRollback).not.toHaveBeenCalled();
  expect(effects.launchTerminal).not.toHaveBeenCalled();
  expect(effects.mutateFiles).not.toHaveBeenCalled();
  expect(effects.mutateGit).not.toHaveBeenCalled();
  expect(effects.startWorker).not.toHaveBeenCalled();
  expect(effects.workspaceAgentRuntimeCall).not.toHaveBeenCalled();
}

function assertNoRawInternalNames(element: Element | null | undefined) {
  expect(element?.textContent).not.toMatch(
    /retry_same|retry_with_modified_prompt|rollback_attempt_proposal|request_workspace_agent_assistance|dependency_failed|dependency_blocked/,
  );
  expect(element?.textContent).not.toContain('"kind"');
  expect(element?.textContent).not.toContain("rawReportPreview");
}

function pickStartableTaskIds(
  tasks: readonly SmartQueueTaskInput[],
  dependencies: readonly SmartQueueDependency[],
  queueState: "active" | "paused" | "stopped",
) {
  return tasks
    .filter((task) =>
      canStartTaskNow({
        capacityAvailable: true,
        dependencies,
        queueState,
        task,
        tasks,
      }).canStartTaskNow,
    )
    .map((task) => task.taskId);
}

function smartTask(
  taskId: string,
  lifecycle: SmartQueueTaskInput["lifecycle"],
  blockers: readonly SmartQueueBlocker[] = [],
): SmartQueueTaskInput {
  return {
    blockers,
    lifecycle,
    taskId,
    title: taskId,
  };
}

function smartFailureTask({
  baseRevision,
  changedFiles = [],
  dependsOn = [],
  evidenceSummary,
  failureKind,
  prompt = "Run the selected task.",
  queueItemId,
  reason,
  retryCount = 0,
  rollbackDecision = false,
  suggestedActions = [],
  title = "Smart Queue failed task",
}: {
  baseRevision?: string;
  changedFiles?: readonly string[];
  dependsOn?: readonly string[];
  evidenceSummary: string;
  failureKind: Parameters<typeof buildSmartQueueWorkerFailureIntegration>[0]["failureKind"];
  prompt?: string;
  queueItemId: string;
  reason: string;
  retryCount?: number;
  rollbackDecision?: boolean;
  suggestedActions?: NonNullable<
    Parameters<typeof buildSmartQueueWorkerFailureIntegration>[0]["stage"]
  > extends never ? never[] : readonly SmartQueueCoordinatorDecision["availableActions"][number][];
  title?: string;
}): AgentQueueTask {
  const baseTask = queueTask({
    assignedExecutorWidgetId: "worker-1",
    codexExecutable: "codex",
    coordinatorStatus: "awaiting_coordinator_review",
    dependsOn: [...dependsOn],
    executionWorkspace: "C:/repo",
    prompt,
    queueItemId,
    status: "review_needed",
    title,
    validationStatus:
      failureKind === "validation_failure" ? "failed" : "needs_review",
  });
  const integration = buildSmartQueueWorkerFailureIntegration({
    changedFiles,
    createdAt: "2026-06-15T10:00:00.000Z",
    evidenceSummary,
    failureKind,
    maxRetries: 1,
    reason,
    retryCount,
    runId: `${queueItemId}-run`,
    task: baseTask,
  });
  const payload = parseSmartQueueWorkerFailurePayload(
    integration.taskPatch.workerExecutionReport.rawReportPreview,
  );

  if (!payload) {
    throw new Error("Smart Queue failure payload missing.");
  }

  const workerReport = {
    ...payload.workerReport,
    suggestedActions,
  };
  const coordinatorDecision = rollbackDecision
    ? proposeSmartQueueRollbackAttemptDecision({
        maxRetries: 0,
        report: workerReport,
      })
    : integration.coordinatorDecision;
  const nextPayload: SmartQueueWorkerFailurePayload = {
    ...payload,
    attempt: {
      ...payload.attempt,
      baseRevision,
      changedFiles,
    },
    coordinatorDecision,
    workerReport,
  };
  const report: AgentQueueWorkerExecutionReport = {
    ...integration.taskPatch.workerExecutionReport,
    changedFiles: [...changedFiles],
    rawReportPreview: JSON.stringify(nextPayload),
  };

  return {
    ...baseTask,
    coordinatorStatus: integration.taskPatch.coordinatorStatus,
    validationStatus: integration.taskPatch.validationStatus,
    workerExecutionReports: [report],
  };
}

function createQueueBridgeHarness(
  effects: ReturnType<typeof createSideEffectRecorder>,
) {
  const taskMap = new Map<string, AgentQueueTask>();
  const bridge: WorkspaceAgentQueueBridge = {
    createItem: vi.fn(async (request) => {
      const task = taskFromCreateRequest(request);
      taskMap.set(task.queueItemId, task);
      return actionResult(task, "queue.createItem");
    }),
    getRunSettingsDefaults: vi.fn(() => ({
      approvalPolicy: "never" as const,
      codexExecutable: "codex",
      executionWorkspace: "C:/repo",
      sandbox: "workspace_write" as const,
    })),
    getSnapshot: vi.fn(async () => {
      effects.startWorker();
      return {
        action: "queue.getSnapshot",
        events: [],
        message: "Unexpected snapshot read",
        ok: false,
        safetyClass: "safe_read",
      } as QueueWidgetActionResult<never>;
    }),
    updateItem: vi.fn(async (request) => {
      const current = taskMap.get(request.itemId);

      if (!current) {
        return {
          action: "queue.updateItem",
          error: { code: "missing_item", message: "Queue item missing." },
          events: [],
          message: "Queue item missing.",
          ok: false,
          safetyClass: "safe_create_update",
        } satisfies QueueWidgetActionResult<QueueWidgetItemSnapshot>;
      }

      const updated = {
        ...current,
        dependsOn: request.patch.dependencies ?? current.dependsOn,
      };
      taskMap.set(updated.queueItemId, updated);
      return actionResult(updated, "queue.updateItem");
    }),
  };

  return {
    bridge,
    tasks: () => Array.from(taskMap.values()),
  };
}

function taskFromCreateRequest(
  request: Parameters<WorkspaceAgentQueueBridge["createItem"]>[0],
): AgentQueueTask {
  const promptId = request.title.split(":")[0]?.trim() || "created";

  return queueTask({
    approvalPolicy: request.approvalPolicy ?? "never",
    codexExecutable: request.codexExecutable ?? "codex",
    dependsOn: request.dependencies ?? [],
    description: request.description ?? "",
    executionPolicy: request.executionPolicy ?? "manual",
    executionWorkspace: request.executionWorkspace ?? "C:/repo",
    itemType: request.itemType ?? "implementation",
    priority: request.priority ?? 3,
    prompt: request.prompt ?? "",
    queueItemId: `queue-${promptId}`,
    sandbox: request.sandbox ?? "workspace_write",
    status: request.status ?? "draft",
    title: request.title,
  });
}

function actionResult(
  task: AgentQueueTask,
  action: "queue.createItem" | "queue.updateItem",
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  return {
    action,
    events: [],
    item: itemSnapshot(task),
    message: "Queue item saved. No task execution started.",
    ok: true,
    safetyClass: "safe_create_update",
  };
}

function itemSnapshot(task: AgentQueueTask): QueueWidgetItemSnapshot {
  return {
    approvalPolicy: task.approvalPolicy ?? null,
    assignedExecutorWidgetId: task.assignedExecutorWidgetId,
    blockers: [],
    codexExecutable: task.codexExecutable ?? null,
    coordinatorStatus: task.coordinatorStatus,
    createdAt: task.createdAt,
    dependencies: task.dependsOn ?? [],
    description: task.description,
    evidenceSummary: { runRefs: [], status: "none" },
    executionPolicy: task.executionPolicy ?? "manual",
    executionStatus: task.status,
    executionWorkspace: task.executionWorkspace,
    id: task.queueItemId,
    itemType: task.itemType,
    priority: task.priority,
    prompt: task.prompt,
    queueId: "agent-queue",
    queueTag: {
      id: task.queueTagId ?? null,
      name: task.queueTagName ?? null,
    },
    reportSummary: { status: "none" },
    runLinks: [],
    sandbox: task.sandbox ?? null,
    status: task.status,
    title: task.title,
    updatedAt: task.updatedAt,
    validationStatus: task.validationStatus,
    workspaceId: task.workspaceId,
  };
}
