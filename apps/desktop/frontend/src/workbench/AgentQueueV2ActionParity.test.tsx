import { act, useMemo } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentQueueTask } from "../workspace/types";
import { AgentQueuePlaceholderWidget } from "./AgentQueuePlaceholderWidget";
import { workerReport } from "./AgentQueueTaskRunPanel.test-fixtures";
import { useAgentQueueController } from "./queue/useAgentQueueController";
import type { WidgetRenderProps } from "./types";
import {
  AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
  AGENT_QUEUE_WIDGET_DEFINITION_ID,
} from "./widgetRegistry";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("Agent QueueV2 action parity", () => {
  it("runs a selected task only from the QueueV2 details action", async () => {
    const onStartAssignedAgentQueueTask = vi.fn(async (request) => ({
      executorWidgetInstanceId: request.executorWidgetInstanceId ?? "executor-1",
      queueItemId: request.queueItemId,
      runId: "run-from-v2",
      status: "running" as const,
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
    }));
    const task = queueTask({
      approvalPolicy: "never",
      assignedExecutorWidgetId: "executor-1",
      codexExecutable: "codex.cmd",
      executionWorkspace: "C:\\repo",
      prompt: "Run through QueueV2 details only.",
      sandbox: "workspace_write",
      status: "ready",
    });

    renderQueueWidget({
      onGetAgentQueueTask: async () => task,
      onListAgentQueueTasks: async () => [task],
      onStartAssignedAgentQueueTask,
    });
    await flushRender();

    await clickCardAsync("queue-1");
    await flushRender();

    expect(onStartAssignedAgentQueueTask).not.toHaveBeenCalled();
    expect(dialogByName("Selected runnable task")).not.toBeNull();

    clickButton("Details");
    await flushRender();
    await clickQueueV2ActionAsync("Run task");

    expect(onStartAssignedAgentQueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalPolicy: "never",
        codexExecutable: "codex.cmd",
        queueItemId: "queue-1",
        repoRoot: "C:\\repo",
        sandbox: "workspace_write",
      }),
    );
  });

  it("opens task details from Details and renders popup tabs", async () => {
    renderQueueWidget({
      onGetAgentQueueTask: async () => queueTask({ title: "Details task" }),
      onListAgentQueueTasks: async () => [
        queueTask({
          prompt: "Prompt tab text",
          title: "Details task",
          workerExecutionReports: [
            workerReport({
              changedFiles: ["src/queue-v2.ts"],
              rawReportPreview: "raw developer preview",
              summary: "Result summary",
            }),
          ],
        }),
      ],
    });
    await flushRender();

    clickButton("Details");
    await flushRender();

    expect(dialogByName("Details task")).not.toBeNull();
    await clickButtonAsync("Prompt");
    expect(activePanel()?.textContent).toContain("Prompt tab text");
    await clickButtonAsync("Result");
    expect(activePanel()?.textContent).toContain("Result / Evidence");
    await clickButtonAsync("Agent Log");
    expect(activePanel()?.textContent).toContain("High-level task timeline");
    await clickButtonAsync("Context");
    expect(activePanel()?.textContent).toContain("Context");
    await clickButtonAsync("Files / Validation");
    expect(activePanel()?.textContent).toContain("Validation");
    expect(dialogByName("Details task")?.textContent).not.toContain("Raw / developer details");
  });

  it("card click opens details without running or mutating the task order", async () => {
    const onStartAssignedAgentQueueTask = vi.fn();
    const onUpdateAgentQueueTask = vi.fn(async () => queueTask());

    renderQueueWidget({
      onListAgentQueueTasks: async () => [
        queueTask({ queueItemId: "first", title: "First task" }),
        queueTask({ queueItemId: "second", title: "Second task" }),
      ],
      onStartAssignedAgentQueueTask,
      onUpdateAgentQueueTask,
    });
    await flushRender();

    const orderBefore = visibleCardOrder();
    await clickCardAsync("second");
    await flushRender();

    expect(dialogByName("Second task")).not.toBeNull();
    expect(visibleCardOrder()).toEqual(orderBefore);
    expect(onStartAssignedAgentQueueTask).not.toHaveBeenCalled();
    expect(onUpdateAgentQueueTask).not.toHaveBeenCalled();
  });

  it("caps large intake lanes with overflow and keeps Closed collapsed by default", async () => {
    const intakeTasks = Array.from({ length: 10 }, (_, index) =>
      queueTask({
        queueItemId: `intake-${index.toString()}`,
        status: "draft",
        title: `Intake task ${index.toString()}`,
      }),
    );
    const closedTask = queueTask({
      closureState: "no_change_accepted",
      queueItemId: "closed-task",
      status: "completed",
      title: "Closed task",
    });

    renderQueueWidget({
      onListAgentQueueTasks: async () => [...intakeTasks, closedTask],
    });
    await flushRender();

    expect(sectionByName("Intake / Draft lane")?.textContent).toContain("+ 4 more");
    expect(card("intake-9")).toBeNull();
    expect(sectionByName("Closed lane")?.textContent).toContain("Closed");
    expect(sectionByName("Closed lane")?.textContent).toContain("1");
    expect(laneToggle("Closed")?.getAttribute("aria-expanded")).toBe("false");
    expect(sectionByName("Closed lane")?.dataset.queueV2HistoryBlock).toBe(
      "collapsed",
    );
    expect(sectionByName("Closed lane")?.textContent).not.toContain(
      "No closed tasks.",
    );
    expect(card("closed-task")).toBeNull();

    await clickButtonAsync("+ 4 more");
    expect(card("intake-9")).not.toBeNull();

    await clickLaneToggleAsync("Closed");
    expect(sectionByName("Closed lane")?.dataset.queueV2HistoryBlock).toBe(
      "expanded",
    );
    expect(card("closed-task")).not.toBeNull();
  });

  it("renders every lane affordance and collapses active lanes without mutating order", async () => {
    renderQueueWidget({
      onListAgentQueueTasks: async () => [
        queueTask({ queueItemId: "intake", status: "draft", title: "Intake task" }),
        queueTask({
          assignedExecutorWidgetId: null,
          queueItemId: "ready",
          status: "ready",
          title: "Ready task",
        }),
        queueTask({ queueItemId: "running", status: "running", title: "Running task" }),
        queueTask({ queueItemId: "review", status: "review_needed", title: "Review task" }),
        queueTask({
          coordinatorStatus: "blocked",
          queueItemId: "blocked",
          status: "queued",
          title: "Blocked task",
        }),
        queueTask({
          closureState: "no_change_accepted",
          queueItemId: "closed",
          status: "completed",
          title: "Closed task",
        }),
      ],
    });
    await flushRender();

    for (const label of [
      "Intake / Draft",
      "Ready",
      "Running",
      "Review",
      "Blocked",
      "Closed",
    ]) {
      expect(laneToggle(label)).not.toBeNull();
    }
    for (const label of ["Intake / Draft", "Ready", "Running", "Review", "Blocked"]) {
      expect(laneToggle(label)?.getAttribute("aria-expanded")).toBe("true");
    }
    expect(laneToggle("Closed")?.getAttribute("aria-expanded")).toBe("false");

    const orderBefore = visibleCardOrder();

    for (const [label, queueItemId] of [
      ["Intake / Draft", "intake"],
      ["Running", "running"],
      ["Review", "review"],
      ["Blocked", "blocked"],
    ] as const) {
      const countBeforeCollapse = laneCount(label);

      await clickLaneToggleAsync(label);
      expect(laneToggle(label)?.getAttribute("aria-expanded")).toBe("false");
      expect(laneCount(label)).toBe(countBeforeCollapse);
      expect(card(queueItemId)).toBeNull();
      await clickLaneToggleAsync(label);
      expect(card(queueItemId)).not.toBeNull();
    }

    expect(visibleCardOrder()).toEqual(orderBefore);
  });

  it("bounds expanded Closed history and exposes overflow", async () => {
    const closedTasks = Array.from({ length: 7 }, (_, index) =>
      queueTask({
        closureState: "no_change_accepted",
        queueItemId: `closed-${index.toString()}`,
        status: "completed",
        title: `Closed task ${index.toString()}`,
      }),
    );

    renderQueueWidget({
      onListAgentQueueTasks: async () => closedTasks,
    });
    await flushRender();

    expect(sectionByName("Closed lane")?.textContent).toContain("Closed");
    expect(sectionByName("Closed lane")?.textContent).toContain("7");
    expect(card("closed-0")).toBeNull();

    await clickLaneToggleAsync("Closed");

    expect(card("closed-0")).not.toBeNull();
    expect(card("closed-3")).not.toBeNull();
    expect(card("closed-6")).toBeNull();
    expect(sectionByName("Closed lane")?.textContent).toContain("+ 3 more");

    await clickButtonAsync("+ 3 more");

    expect(card("closed-6")).not.toBeNull();
    expect(sectionByName("Closed lane")?.querySelector(
      ".agent-queue-v2-closed-history",
    )).not.toBeNull();
  });

  it("groups running tasks by worker in the saved Agent Queue surface", async () => {
    renderQueueWidget({
      agentExecutorSlots: [
        {
          label: "Worker A",
          widgetInstanceId: "worker-a",
        },
        {
          label: "Worker B",
          widgetInstanceId: "worker-b",
        },
      ],
      onListAgentQueueTasks: async () => [
        queueTask({
          assignedExecutorWidgetId: "worker-a",
          queueItemId: "run-a",
          status: "running",
          title: "Running A",
        }),
        queueTask({
          assignedExecutorWidgetId: "worker-b",
          queueItemId: "run-b",
          status: "running",
          title: "Running B",
        }),
      ],
    });
    await flushRender();

    expect(sectionByName("Worker A running group")?.textContent).toContain(
      "Online / 1/1 active",
    );
    expect(sectionByName("Worker B running group")?.textContent).toContain(
      "Online / 1/1 active",
    );
  });

  it("exposes review and closure actions through existing callbacks", async () => {
    const updateRequests: unknown[] = [];
    const selectedTask = queueTask({
      coordinatorStatus: "awaiting_coordinator_review",
      status: "completed",
      validationStatus: "needs_review",
      workerExecutionReports: [
        workerReport({
          changedFiles: [],
          summary: "No-change report ready for review.",
          validationResult: "passed",
        }),
      ],
    });

    renderQueueWidget({
      onGetAgentQueueTask: async () => selectedTask,
      onListAgentQueueTasks: async () => [selectedTask],
      onUpdateAgentQueueTask: async (request) => {
        updateRequests.push(request);
        return queueTask({
          ...selectedTask,
          queueItemId: request.queueItemId,
          status: request.status,
          validationStatus: request.validationStatus,
        });
      },
    });
    await flushRender();

    clickButton("Details");
    await flushRender();

    expect(queueV2ActionButton("View report")).not.toBeNull();
    expect(queueV2ActionButton("Accept without commit")).not.toBeNull();
    expect(queueV2ActionButton("Finalize / Accept")).not.toBeNull();
    expect(queueV2ActionButton("Request changes")).not.toBeNull();

    clickQueueV2Action("View report");
    expect(document.querySelector("[role='tabpanel']")?.textContent).toContain(
      "Result / Evidence",
    );
    expect(document.querySelector("[role='tabpanel']")?.textContent).toContain(
      "No-change report ready for review.",
    );

    await clickQueueV2ActionAsync("Accept without commit");
    await flushRender();

    expect(updateRequests).toHaveLength(1);
    expect(updateRequests[0]).toMatchObject({
      queueItemId: "queue-1",
      status: "completed",
      validationStatus: "passed",
    });
    expect(dialogByName("Selected runnable task")).toBeUndefined();
    expect(sectionByName("Review lane")?.textContent).not.toContain(
      "Selected runnable task",
    );
    expect(sectionByName("Closed lane")?.textContent).toContain("Closed");
    expect(sectionByName("Closed lane")?.textContent).toContain("1");
    expect(laneToggle("Closed")?.getAttribute("aria-expanded")).toBe("false");
    expect(card("queue-1")).toBeNull();

    await clickLaneToggleAsync("Closed");

    expect(card("queue-1")).not.toBeNull();
  });

  it("creates follow-up and attaches reports without starting work", async () => {
    const onCreateAgentQueueTask = vi.fn(async (request) =>
      queueTask({
        description: request.description,
        itemType: request.itemType,
        prompt: request.prompt,
        queueItemId: "follow-up-created",
        status: request.status,
        title: request.title,
      }),
    );
    const onStartAssignedAgentQueueTask = vi.fn();
    const updateRequests: unknown[] = [];
    const selectedTask = queueTask({
      coordinatorStatus: "awaiting_coordinator_review",
      status: "completed",
      validationStatus: "needs_review",
      workerExecutionReports: [
        workerReport({
          followUpRecommendation: "Split a smaller fix.",
          summary: "Follow-up is required.",
        }),
      ],
    });

    renderQueueWidget({
      onCreateAgentQueueTask,
      onGetAgentQueueTask: async () => selectedTask,
      onListAgentQueueTasks: async () => [selectedTask],
      onStartAssignedAgentQueueTask,
      onUpdateAgentQueueTask: async (request) => {
        updateRequests.push(request);
        return queueTask({
          ...selectedTask,
          queueItemId: request.queueItemId,
          status: request.status,
          validationStatus: request.validationStatus,
        });
      },
    });
    await flushRender();

    clickButton("Details");
    await flushRender();
    await clickQueueV2ActionAsync("Attach report");

    expect(document.body.textContent).toContain("Worker report received");
    expect(updateRequests).toHaveLength(0);
    expect(onStartAssignedAgentQueueTask).not.toHaveBeenCalled();

    await clickQueueV2ActionAsync("Create follow-up");

    expect(onCreateAgentQueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        itemType: "follow_up",
        status: "queued",
        title: "Follow-up: Selected runnable task",
      }),
    );
    expect(updateRequests[0]).toMatchObject({
      queueItemId: "queue-1",
      status: "review_needed",
      validationStatus: "needs_review",
    });
    expect(onStartAssignedAgentQueueTask).not.toHaveBeenCalled();
  });

  it("shows disabled action reasons and opens the shared New task popup shell", async () => {
    renderQueueWidget({
      onGetAgentQueueTask: async () =>
        queueTask({
          prompt: "",
          status: "ready",
        }),
      onListAgentQueueTasks: async () => [
        queueTask({
          prompt: "",
          status: "ready",
        }),
      ],
    });
    await flushRender();

    clickButton("Details");
    await flushRender();

    const runButton = queueV2ActionButton("Run task");

    expect(runButton?.disabled).toBe(true);
    expect(runButton?.parentElement?.textContent).toContain(
      "Add a task prompt before configuring execution.",
    );

    await clickQueueV2ActionAsync("New task");

    expect(document.body.textContent).toContain("Run setup");
    expect(document.body.textContent).toContain("Create draft");
    const popup = dialogByName("New task");
    expect(popup?.className).toContain("popup-shell");
    expect(popup?.querySelector("[data-popup-drag-handle]")).not.toBeNull();
    expect(popup?.querySelector(".popup-shell-resize-se")).not.toBeNull();
    expect(document.querySelector(".agent-queue-create-dialog-body")).not.toBeNull();
    expect(document.body.textContent).not.toContain(
      "Create a draft, or create a queued task with task run settings already saved.",
    );
  });

  it("enables the saved QueueV2 surface through the typed Queue control without starting dependent work", async () => {
    const onStartAssignedAgentQueueTask = vi.fn();
    const firstTask = queueTask({
      assignedExecutorWidgetId: "executor-1",
      codexExecutable: "codex.cmd",
      executionWorkspace: "C:\\repo",
      queueItemId: "queue-001",
      status: "ready",
      title: "001 Ready task",
    });
    const dependentTask = queueTask({
      assignedExecutorWidgetId: "executor-1",
      codexExecutable: "codex.cmd",
      dependsOn: ["queue-001"],
      executionWorkspace: "C:\\repo",
      queueItemId: "queue-002",
      status: "ready",
      title: "002 Dependent task",
    });
    const tasks = [firstTask, dependentTask];

    renderQueueWidget({
      onGetAgentQueueTask: async (queueItemId) =>
        tasks.find((task) => task.queueItemId === queueItemId) ?? firstTask,
      onListAgentQueueTasks: async () => tasks,
      onStartAssignedAgentQueueTask,
    });
    await flushRender();

    expect(card("queue-001")?.getAttribute("data-queue-v2-lane")).toBe("blocked");
    expect(card("queue-001")?.textContent).toContain("Queue disabled");
    expect(card("queue-002")?.getAttribute("data-queue-v2-lane")).toBe("blocked");
    expect(card("queue-002")?.textContent).toContain("Queue disabled");
    expect(onStartAssignedAgentQueueTask).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Disabled");
    expect(buttonByText("Enable Queue")?.disabled).toBe(false);

    clickButton("Details");
    await flushRender();

    const enableButton = queueV2ActionButton("Enable Queue");
    expect(enableButton?.disabled).toBe(false);
    expect(onStartAssignedAgentQueueTask).not.toHaveBeenCalled();

    await clickQueueV2ActionAsync("Enable Queue");
    await flushRender();

    expect(onStartAssignedAgentQueueTask).not.toHaveBeenCalled();
    expect(card("queue-001")?.getAttribute("data-queue-v2-lane")).toBe("ready");
    expect(card("queue-001")?.textContent).not.toContain("Queue disabled");
    expect(card("queue-002")?.getAttribute("data-queue-v2-lane")).toBe(
      "waiting_dependency",
    );
    expect(card("queue-002")?.textContent).toContain("Waiting for: 001 Ready task");
  });

  it("keeps disabled Enable Queue visible with a short product reason", async () => {
    renderQueueWidget({
      onGetAgentQueueTask: async () =>
        queueTask({
          codexExecutable: "",
          status: "ready",
        }),
      onListAgentQueueTasks: async () => [
        queueTask({
          codexExecutable: "",
          status: "ready",
        }),
      ],
    });
    await flushRender();

    const enableQueue = buttonByText("Enable Queue");

    expect(enableQueue).not.toBeNull();
    expect(enableQueue?.disabled).toBe(true);
    expect(document.body.textContent).toContain(
      "Queue needs a Codex executable on at least one task.",
    );
    expect(buttonByText("Set Codex executable")).not.toBeNull();
    expect(document.body.textContent).not.toContain("callbacks");
    expect(document.body.textContent).not.toContain("runtime bridge");
  });

  it("shows Draft readiness blockers on the active QueueV2 path without starting work", async () => {
    const onStartAssignedAgentQueueTask = vi.fn();
    const onUpdateAgentQueueTask = vi.fn(async () => queueTask());
    const draftTask = queueTask({
      approvalPolicy: null,
      codexExecutable: "",
      executionWorkspace: null,
      prompt: "",
      queueItemId: "draft-blocked",
      sandbox: null,
      status: "draft",
      title: "Blocked draft",
    });

    renderQueueWidget({
      onGetAgentQueueTask: async () => draftTask,
      onListAgentQueueTasks: async () => [draftTask],
      onStartAssignedAgentQueueTask,
      onUpdateAgentQueueTask,
    });
    await flushRender();

    expect(card("draft-blocked")?.textContent).toContain("StatusDraft");
    expect(card("draft-blocked")?.textContent).toContain("Not runnable yet");

    clickButton("Details");
    await flushRender();

    const dialogText = dialogByName("Blocked draft")?.textContent ?? "";
    expect(dialogText).toContain("Draft task");
    expect(dialogText).toContain("Not runnable yet");
    expect(dialogText).toContain("Missing prompt");
    expect(dialogText).toContain("Missing workspace");
    expect(dialogText).toContain("Missing Codex executable");
    expect(dialogText).toContain("Missing sandbox");
    expect(dialogText).toContain("Missing approval policy");
    expect(dialogText).not.toContain("missing_codex_executable");
    expect(dialogText).not.toContain("run_settings_invalid");

    const queueButton = queueV2ActionButton("Queue for run");
    expect(queueButton?.disabled).toBe(true);
    expect(queueButton?.parentElement?.textContent).toContain(
      "Complete draft before queuing",
    );

    await clickButtonAsync("Queue for run");
    await flushRender();

    expect(onUpdateAgentQueueTask).not.toHaveBeenCalled();
    expect(onStartAssignedAgentQueueTask).not.toHaveBeenCalled();
  });

  it("queues a valid Draft from active QueueV2 details without enabling or running", async () => {
    const onStartAssignedAgentQueueTask = vi.fn();
    const updateRequests: unknown[] = [];
    const draftTask = queueTask({
      approvalPolicy: "never",
      assignedExecutorWidgetId: "executor-1",
      codexExecutable: "codex.cmd",
      executionWorkspace: "C:\\repo",
      prompt: "Queue this valid draft.",
      queueItemId: "draft-ready",
      sandbox: "workspace_write",
      status: "draft",
      title: "Ready draft",
    });
    const onUpdateAgentQueueTask = vi.fn(async (request) => {
      updateRequests.push(request);
      return queueTask({
        approvalPolicy: request.approvalPolicy ?? null,
        assignedExecutorWidgetId: "executor-1",
        codexExecutable: request.codexExecutable ?? null,
        executionWorkspace: request.executionWorkspace ?? null,
        prompt: request.prompt,
        queueItemId: request.queueItemId,
        sandbox: request.sandbox ?? null,
        status: request.status,
        title: request.title,
      });
    });

    renderQueueWidget({
      onGetAgentQueueTask: async () => draftTask,
      onListAgentQueueTasks: async () => [draftTask],
      onStartAssignedAgentQueueTask,
      onUpdateAgentQueueTask,
    });
    await flushRender();

    expect(card("draft-ready")?.textContent).toContain("Ready to queue");
    expect(onUpdateAgentQueueTask).not.toHaveBeenCalled();
    expect(onStartAssignedAgentQueueTask).not.toHaveBeenCalled();

    clickButton("Details");
    await flushRender();

    const queueButton = queueV2ActionButton("Queue for run");
    expect(queueButton?.disabled).toBe(false);
    expect(dialogByName("Ready draft")?.textContent).toContain("Ready to queue");

    await clickQueueV2ActionAsync("Queue for run");
    await flushRender();

    expect(updateRequests).toHaveLength(1);
    expect(updateRequests[0]).toMatchObject({
      approvalPolicy: "never",
      codexExecutable: "codex.cmd",
      executionWorkspace: "C:\\repo",
      queueItemId: "draft-ready",
      sandbox: "workspace_write",
      status: "queued",
    });
    expect(onStartAssignedAgentQueueTask).not.toHaveBeenCalled();
    expect(buttonByText("Enable Queue")?.disabled).toBe(false);
    expect(card("draft-ready")?.textContent).not.toContain("StatusDraft");
  });

  it("sets Codex executable on an existing draft without enabling Queue or starting work", async () => {
    const onStartAssignedAgentQueueTask = vi.fn();
    const onUpdateAgentQueueTask = vi.fn(async (request) =>
      queueTask({
        approvalPolicy: request.approvalPolicy ?? null,
        assignedExecutorWidgetId: "executor-1",
        codexExecutable: request.codexExecutable ?? null,
        executionWorkspace: request.executionWorkspace ?? null,
        prompt: request.prompt,
        queueItemId: request.queueItemId,
        sandbox: request.sandbox ?? null,
        status: request.status,
        title: request.title,
      }),
    );
    const draftTask = queueTask({
      assignedExecutorWidgetId: "executor-1",
      approvalPolicy: "never",
      codexExecutable: "",
      executionWorkspace: "C:\\repo",
      prompt: "Keep this draft in planning.",
      queueItemId: "draft-codex",
      sandbox: "workspace_write",
      status: "draft",
      title: "Draft needs Codex",
    });

    renderQueueWidget({
      onGetAgentQueueTask: async () => draftTask,
      onListAgentQueueTasks: async () => [draftTask],
      onStartAssignedAgentQueueTask,
      onUpdateAgentQueueTask,
    });
    await flushRender();

    expect(buttonByText("Enable Queue")?.disabled).toBe(true);
    expect(buttonByText("Set Codex executable")).not.toBeNull();

    await clickButtonAsync("Set Codex executable");
    await flushRender();

    expect(dialogByName("Draft needs Codex")).not.toBeNull();
    setInputByLabel("Codex executable", "codex.cmd");
    await clickButtonAsync("Save Codex executable");
    await flushRender();

    expect(onUpdateAgentQueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        codexExecutable: "codex.cmd",
        queueItemId: "draft-codex",
        status: "draft",
      }),
    );
    expect(buttonByText("Enable Queue")?.disabled).toBe(false);
    expect(card("draft-codex")?.textContent).toContain("Draft");
    expect(card("draft-codex")?.textContent).toContain("Ready to queue");
    expect(card("draft-codex")?.textContent).not.toContain("Queued");
    expect(onStartAssignedAgentQueueTask).not.toHaveBeenCalled();
  });

  it("submits and cancels New task from the shared popup footer", async () => {
    const onCreateAgentQueueTask = vi.fn(async (request) =>
      queueTask({
        queueItemId: "created-draft",
        status: request.status,
        title: request.title,
      }),
    );

    renderQueueWidget({ onCreateAgentQueueTask });
    await flushRender();

    clickButton("New task");
    await flushRender();

    const firstPopup = dialogByName("New task");
    expect(firstPopup?.className).toContain("popup-shell");
    await clickButtonAsync("Cancel");
    expect(dialogByName("New task")).toBeUndefined();

    clickButton("New task");
    await flushRender();
    setInputByLabel("Title", "Popup created task");
    await clickButtonAsync("Create draft");
    await flushRender();

    expect(onCreateAgentQueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "draft",
        title: "Popup created task",
      }),
    );
    expect(dialogByName("New task")).toBeUndefined();
  });
});

function renderQueueWidget(overrides: Partial<WidgetRenderProps> = {}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(<AgentQueueWidgetHarness {...widgetProps(overrides)} />);
  });
}

function AgentQueueWidgetHarness(props: WidgetRenderProps) {
  const queueOwnedExecutorSlots = useMemo(
    () => [
      {
        label: "Local executor ready",
        ownerKind: "agent_queue" as const,
        widgetInstanceId: props.instance.id,
      },
      ...(props.agentExecutorSlots ?? []).map((slot) => ({
        ...slot,
        ownerKind: slot.ownerKind ?? ("agent_executor" as const),
      })),
    ],
    [props.agentExecutorSlots, props.instance.id],
  );
  const controller = useAgentQueueController({
    agentExecutorSlots: queueOwnedExecutorSlots,
    onAssignAgentQueueTaskToExecutor: props.onAssignAgentQueueTaskToExecutor,
    onClearAgentQueueTaskAssignment: props.onClearAgentQueueTaskAssignment,
    onCreateAgentQueueTask: props.onCreateAgentQueueTask,
    onDeleteAgentQueueTask: props.onDeleteAgentQueueTask,
    onGetAgentQueueTask: props.onGetAgentQueueTask,
    onListAgentQueueTasks: props.onListAgentQueueTasks,
    onStartAssignedAgentQueueTask: props.onStartAssignedAgentQueueTask,
    onUpdateAgentQueueTask: props.onUpdateAgentQueueTask,
    queueWidgetInstanceId: props.instance.id,
  });

  return (
    <AgentQueuePlaceholderWidget
      {...props}
      agentExecutorSlots={queueOwnedExecutorSlots}
      agentQueueController={controller}
    />
  );
}

function widgetProps(overrides: Partial<WidgetRenderProps>): WidgetRenderProps {
  return {
    agentExecutorSlots: [
      {
        label: "Local executor",
        widgetInstanceId: "executor-1",
      },
    ],
    config: {},
    definition: {
      category: "workflow",
      componentKey: AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
      defaultConfig: {},
      defaultTitle: "Agent Queue",
      description: "Queue",
      id: AGENT_QUEUE_WIDGET_DEFINITION_ID,
      title: "Agent Queue",
    },
    frameActions: null,
    frameMoveEnabled: false,
    instance: {
      config: {},
      definitionId: AGENT_QUEUE_WIDGET_DEFINITION_ID,
      id: "queue-widget-1",
      layout: {
        area: "main",
        height: 680,
        mode: "docked",
        order: 0,
        width: 1160,
        x: 0,
        y: 0,
      },
      state: {},
      title: "Agent Queue",
      visible: true,
    },
    logRefreshToken: 0,
    onAssignAgentQueueTaskToExecutor: async () => queueTask(),
    onClearAgentQueueTaskAssignment: async () =>
      queueTask({ assignedExecutorWidgetId: null }),
    onCreateAgentQueueTask: async () => queueTask({ queueItemId: "created" }),
    onDeleteAgentQueueTask: async () => true,
    onGetAgentQueueTask: async () => queueTask(),
    onListAgentQueueTasks: async () => [queueTask()],
    onStartAssignedAgentQueueTask: async () => ({
      executorWidgetInstanceId: "executor-1",
      queueItemId: "queue-1",
      runId: "run-1",
      status: "running",
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
    }),
    onUpdateAgentQueueTask: async () => queueTask(),
    title: "Agent Queue",
    ...overrides,
  } as WidgetRenderProps;
}

async function flushRender() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function clickButton(text: string) {
  const button = buttonByText(text);

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function clickButtonAsync(text: string) {
  const button = buttonByText(text);

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

function buttonByText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

function inputByLabel(label: string) {
  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>("label"));
  const labelElement = labels.find((item) => item.textContent === label);
  const inputId = labelElement?.getAttribute("for");

  return inputId
    ? document.getElementById(inputId) as HTMLInputElement | HTMLTextAreaElement | null
    : null;
}

function setInputByLabel(label: string, value: string) {
  const input = inputByLabel(label);

  if (!input) {
    throw new Error(`Input not found: ${label}`);
  }

  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(input),
      "value",
    )?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function queueV2ActionButton(text: string) {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      ".queue-v2-task-details-actions button",
    ),
  ).find((button) => button.textContent === text);
}

function clickQueueV2Action(text: string) {
  const button = queueV2ActionButton(text);

  if (!button) {
    throw new Error(`QueueV2 action not found: ${text}`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function clickQueueV2ActionAsync(text: string) {
  const button = queueV2ActionButton(text);

  if (!button || button.disabled) {
    throw new Error(`Enabled QueueV2 action not found: ${text}`);
  }

  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

async function clickCardAsync(queueItemId: string) {
  const card = document.querySelector<HTMLElement>(
    `[data-queue-item-id="${queueItemId}"]`,
  );

  if (!card) {
    throw new Error(`Card not found: ${queueItemId}`);
  }

  await act(async () => {
    card.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

async function clickLaneToggleAsync(label: string) {
  const toggle = laneToggle(label);

  if (!toggle) {
    throw new Error(`Lane toggle not found: ${label}`);
  }

  await act(async () => {
    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

function activePanel() {
  return document.querySelector<HTMLElement>("[role='tabpanel']");
}

function card(queueItemId: string) {
  return document.querySelector<HTMLElement>(
    `[data-queue-item-id="${queueItemId}"]`,
  );
}

function dialogByName(name: string) {
  return Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']")).find(
    (dialog) => dialog.textContent?.includes(name),
  );
}

function sectionByName(name: string) {
  return Array.from(document.querySelectorAll<HTMLElement>("section")).find(
    (section) => section.getAttribute("aria-label") === name,
  );
}

function laneToggle(label: string) {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      ".queue-v2-collapsible-lane-header",
    ),
  ).find((button) =>
    button.getAttribute("aria-label")?.includes(`${label} lane`),
  );
}

function laneCount(label: string) {
  return laneToggle(label)?.querySelector("strong")?.textContent ?? null;
}

function visibleCardOrder() {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-task-order-id]"))
    .map((element) => element.dataset.taskOrderId);
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: "executor-1",
    createdAt: "2026-05-22T10:00:00.000Z",
    description: "Selected runnable Queue task",
    executionPolicy: "manual",
    priority: 1,
    prompt: "Run the selected task from Queue.",
    queueItemId: "queue-1",
    status: "ready",
    title: "Selected runnable task",
    updatedAt: "2026-05-22T10:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
