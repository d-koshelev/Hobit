import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  buttonByText,
  clickFirstButton,
  detailsBySummary,
  editController,
  executionPlanController,
  latestRunController,
  renderDetailsPanel,
  renderPanel,
  resetRenderedPanel,
  runController,
  runHistoryController,
  sectionText,
} from "./AgentQueueTaskRunPanel.test-utils";
import {
  executorSlots,
  planPreview,
  queueTask,
  runLink,
} from "./AgentQueueTaskRunPanel.test-fixtures";

describe("AgentQueueTaskRunPanel settings and readiness", () => {
  it("renders a generated plan preview without starting execution", () => {
    const onGenerate = vi.fn();

    renderPanel({
      executionPlan: executionPlanController(planPreview(), onGenerate),
    });

    expect(document.body.textContent).toContain("Plan preview");
    expect(document.body.textContent).toContain("Plan ready");
    expect(document.body.textContent).toContain("Approx. 1,000-2,000 tokens");
    expect(document.body.textContent).toContain("Inspect the current implementation");
    expect(document.body.textContent).toContain(
      "npm.cmd run test --prefix apps/desktop/frontend",
    );

    clickFirstButton("Refresh plan");

    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("shows a no-run state when the selected task has no run link", () => {
    renderPanel({
      latestRun: latestRunController(null),
      runHistory: runHistoryController([]),
    });

    expect(document.body.textContent).toContain("Latest run");
    expect(document.body.textContent).toContain("Run history");
    expect(document.body.textContent).toContain("No runs yet.");
  });

  it("shows a compact disabled reason when the owning Executor is not visible", () => {
    const onOpenAgentExecutorRun = vi.fn();

    renderPanel({
      executorSlots: [],
      hasExecutorSlots: false,
      latestRun: latestRunController(runLink({
        executorWidgetId: "executor_missing",
      })),
      runHistory: runHistoryController([
        runLink({
          executorWidgetId: "executor_missing",
          linkId: "link_missing",
        }),
      ]),
      onOpenAgentExecutorRun,
    });

    expect(document.body.textContent).toContain(
      "Owning local executor is not visible on this Workbench.",
    );
    expect(document.body.textContent).toContain("Local executor not visible");

    const openButtons = Array.from(document.querySelectorAll("button")).filter(
      (button) => button.textContent === "Open run detail",
    );

    expect(openButtons).toHaveLength(2);
    expect(openButtons.every((button) => button.disabled)).toBe(true);
    act(() => {
      openButtons.forEach((button) =>
        button.dispatchEvent(new MouseEvent("click", { bubbles: true })),
      );
    });
    expect(onOpenAgentExecutorRun).not.toHaveBeenCalled();
  });

  it("warns and prevents assignment when the selected worker scope does not match the task tag", () => {
    const onAssign = vi.fn();

    renderPanel({
      onAssign,
      selectedTask: {
        ...queueTask(),
        assignedExecutorWidgetId: null,
        queueTagId: "default",
        queueTagName: "Default",
      },
      workers: [
        {
          currentItemId: null,
          displayOrder: 0,
          enabled: true,
          lastReportSummary: null,
          name: "Local executor visible",
          scope: {
            kind: "queue_tag",
            queueTagId: "review",
            queueTagName: "Review",
          },
          status: "idle",
          workerId: "executor_visible",
        },
      ],
    });

    expect(document.body.textContent).toContain(
      "Selected worker is scoped to Review.",
    );
    clickFirstButton("Assign");

    expect(onAssign).not.toHaveBeenCalled();
  });

  it("shows danger_full_access as an explicit unsafe Queue run sandbox", () => {
    renderPanel({
      run: {
        ...runController(),
        readinessMessage: null,
        sandbox: "danger_full_access",
      },
    });

    expect(document.body.textContent).toContain("danger_full_access");
    expect(document.body.textContent).toContain("Unsafe local dev mode.");
    expect(detailsBySummary("Developer details")?.open).toBe(false);
    expect(document.body.textContent).toContain(
      "danger_full_access is unsafe",
    );
    expect(document.body.textContent).toContain(
      "disables Codex sandbox restrictions",
    );
    expect(document.body.textContent).toContain("will still not auto-commit");
  });

  it("shows compact selected-run blocker rows", () => {
    renderPanel({
      currentSelection: "",
      executorSlots: [],
      hasExecutorSlots: false,
      run: {
        ...runController(),
        codexExecutableDraft: "",
        readinessMessage: null,
        repoRootDraft: "",
        sandbox: "read_only",
      },
      selectedTask: {
        ...queueTask(),
        assignedExecutorWidgetId: null,
        status: "draft",
      },
    });

    expect(document.body.textContent).toContain("Before run");
    expect(document.body.textContent).toContain("Run task");
    expect(document.body.textContent).toContain("Local executor unavailable");
    expect(document.body.textContent).toContain("Set task workspace");
    expect(document.body.textContent).toContain("Set Codex executable");
    expect(document.body.textContent).toContain("read_only");
    expect(document.body.textContent).toContain("Promote to queued");
    expect(document.body.textContent).not.toContain("Enable queue");
    expect(document.body.textContent).not.toContain("Select danger_full_access");
    expect(document.body.textContent).not.toContain(
      "Click Enable before running the selected task.",
    );

    const advancedSettings = detailsBySummary("Execution settings");

    expect(advancedSettings?.open).toBe(true);
    expect(detailsBySummary("Developer details")?.open).toBe(false);
  });

  it("exposes draft promotion without starting execution", () => {
    const onPromoteDraftToQueued = vi.fn();

    renderPanel({
      canPromoteDraftToQueued: true,
      onPromoteDraftToQueued,
      selectedTask: {
        ...queueTask(),
        assignedExecutorWidgetId: null,
        status: "draft",
      },
    });

    clickFirstButton("Promote to queued");

    expect(onPromoteDraftToQueued).toHaveBeenCalledTimes(1);
  });

  it("shows automatic executor selection without requiring visible Assign", () => {
    renderPanel({
      currentSelection: "executor_visible",
      run: {
        ...runController(),
        executorSelectionMessage:
          "Local executor selected automatically: Local executor visible.",
        readinessMessage: null,
        repoRootDraft: "C:\\repo",
        sandbox: "danger_full_access",
        usesDefaultExecutorOnStart: true,
      },
      selectedTask: {
        ...queueTask(),
        assignedExecutorWidgetId: null,
        status: "ready",
      },
    });

    expect(document.body.textContent).toContain(
      "Local executor selected automatically: Local executor visible.",
    );
    expect(document.body.textContent).toContain(
      "Ready to run once the operator starts it explicitly.",
    );
    expect(document.body.textContent).toContain("Advanced executor override");

    const assignButton = buttonByText("Assign");

    expect(assignButton).not.toBeUndefined();
    expect(
      assignButton?.closest("details")?.querySelector("summary")?.textContent,
    ).toBe("Advanced executor override");
  });

  it("shows expanded header metadata, prompt, and expected plan without starting execution", () => {
    const onGenerate = vi.fn();
    const onStartAssignedTask = vi.fn();
    const selectedTask = {
      ...queueTask(),
      description: "Implementation details",
      executionPlanPreview: planPreview(),
      queueTagId: "implementation",
      queueTagName: "Implementation",
      title: "Expanded queue detail",
    };

    renderDetailsPanel({
      executionPlan: executionPlanController(
        selectedTask.executionPlanPreview,
        onGenerate,
      ),
      run: {
        ...runController(),
        onStartAssignedTask,
      },
      selectedTask,
      tasks: [selectedTask],
    });

    expect(document.body.textContent).toContain("Overview");
    expect(document.body.textContent).toContain("Expanded queue detail");
    expect(document.body.textContent).toContain("Implementation");
    expect(document.body.textContent).toContain("Priority P1");
    expect(document.body.textContent).toContain("Executor");
    expect(document.body.textContent).toContain("Submitted metadata");
    expect(document.body.textContent).toContain("Prompt");
    expect(document.body.textContent).toContain("Expected plan of work");
    expect(document.body.textContent).toContain("Approx. 1,000-2,000 tokens");
    expect(document.body.textContent).toContain(
      "Structured metadata only; never appended to the prompt.",
    );

    clickFirstButton("Refresh plan");

    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onStartAssignedTask).not.toHaveBeenCalled();
  });

  it("orders the selected rail as overview, prompt, actions, agent activity, evidence, then developer details", () => {
    renderDetailsPanel();

    const text = document.body.textContent ?? "";
    const overviewIndex = text.indexOf("Overview");
    const promptIndex = text.indexOf("Prompt");
    const actionsIndex = text.indexOf("Actions and settings");
    const activityIndex = text.indexOf("Agent activity");
    const evidenceIndex = text.indexOf("Result / Evidence");
    const developerIndex = text.indexOf("Developer details");

    expect(overviewIndex).toBeGreaterThanOrEqual(0);
    expect(promptIndex).toBeGreaterThan(overviewIndex);
    expect(actionsIndex).toBeGreaterThan(promptIndex);
    expect(activityIndex).toBeGreaterThan(actionsIndex);
    expect(evidenceIndex).toBeGreaterThan(activityIndex);
    expect(developerIndex).toBeGreaterThan(evidenceIndex);
    expect(detailsBySummary("Developer details")?.open).toBe(false);
  });

  it("explains that a new draft prompt item needs a ready state before execution", () => {
    const onStartEdit = vi.fn();
    const selectedTask = {
      ...queueTask(),
      assignedExecutorWidgetId: null,
      executionPlanPreview: null,
      status: "draft" as const,
      title: "Prompt implementation draft",
    };

    renderDetailsPanel({
      editTask: editController({ onStart: onStartEdit }),
      run: {
        ...runController(),
        readinessMessage:
          "Draft tasks can stay in planning without an execution workspace. Set status to queued, ready, or review needed before configuring execution.",
      },
      selectedTask,
      tasks: [selectedTask],
    });

    expect(document.body.textContent).toContain("Next action");
    expect(document.body.textContent).toContain("Promote to queued");
    expect(document.body.textContent).toContain("Draft task.");
    expect(document.body.textContent).toContain("No run evidence attached.");

    clickFirstButton("Edit status");

    expect(onStartEdit).toHaveBeenCalledTimes(1);
  });

  it("does not show a Ready badge when run settings are missing", () => {
    const selectedTask = {
      ...queueTask(),
      assignedExecutorWidgetId: "executor_visible",
      status: "ready" as const,
    };

    renderDetailsPanel({
      run: {
        ...runController(),
        preconditionMessages: ["Set workspace."],
        readinessMessage: null,
      },
      selectedTask,
      tasks: [selectedTask],
    });

    const nextActionText = sectionText("Next action");

    expect(nextActionText).toContain("Set run settings");
    expect(nextActionText).toContain("Set workspace.");
    expect(nextActionText).toContain("Not configured");
    expect(nextActionText).not.toContain("Ready");
  });

  it("shows stale and no-plan expected plan states", () => {
    const staleTask = {
      ...queueTask(),
      executionPlanPreview: planPreview({ status: "stale" }),
    };

    renderDetailsPanel({
      executionPlan: executionPlanController(staleTask.executionPlanPreview),
      selectedTask: staleTask,
      tasks: [staleTask],
    });

    expect(document.body.textContent).toContain("Plan stale");
    expect(document.body.textContent).toContain("This plan is stale.");

    resetRenderedPanel();

    const noPlanTask = queueTask();
    renderDetailsPanel({
      executionPlan: executionPlanController(null),
      selectedTask: noPlanTask,
      tasks: [noPlanTask],
    });

    expect(document.body.textContent).toContain("No expected plan has been generated.");
    expect(document.body.textContent).toContain("Generate plan preview");
  });
});
