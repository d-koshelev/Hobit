import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../../workspace/types";
import type { AgentWorkerSummary } from "../../agentQueueTaskUiModel";
import type { AgentQueueController } from "../../queue/details/agentQueueTaskDetailsTypes";
import type { QueueValidationRunResult } from "../../queue/queueValidationEvidenceService";
import type { ValidationRunner } from "../../validation";
import { QueueV2Board } from "./QueueV2Board";

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
});

describe("QueueV2Board", () => {
  it("renders the required board lanes", async () => {
    await render(
      <QueueV2Board tasks={[task({ queueItemId: "ready", status: "ready" })]} />,
    );

    expect(regionByName("Intake lane")).not.toBeNull();
    expect(regionByName("Ready lane")).not.toBeNull();
    expect(regionByName("Running lane")).not.toBeNull();
    expect(regionByName("Review lane")).not.toBeNull();
    expect(regionByName("Blocked lane")).not.toBeNull();
    expect(regionByName("Closed lane")).not.toBeNull();
  });

  it("renders collapse affordances with active lanes expanded and Closed collapsed", async () => {
    await render(
      <QueueV2Board
        tasks={[
          task({ queueItemId: "intake", status: "draft" }),
          task({ queueItemId: "ready", status: "ready" }),
          task({ queueItemId: "running", status: "running" }),
          task({ queueItemId: "review", status: "completed" }),
          task({
            coordinatorStatus: "blocked",
            queueItemId: "blocked",
            status: "queued",
          }),
          task({
            closureState: "no_change_accepted",
            queueItemId: "closed",
            status: "completed",
          }),
        ]}
        workers={[worker()]}
      />,
    );

    for (const label of ["Intake", "Ready", "Running", "Review", "Blocked"]) {
      expect(laneToggle(label)?.getAttribute("aria-expanded")).toBe("true");
    }
    expect(laneToggle("Closed")?.getAttribute("aria-expanded")).toBe("false");
  });

  it.each([
    ["Intake", "intake", "draft", false],
    ["Ready", "ready", "ready", false],
    ["Running", "running", "running", false],
    ["Review", "review", "review_needed", false],
    ["Blocked", "blocked", "queued", true],
  ] as const)(
    "collapsing %s hides cards but keeps the count and expanding restores cards",
    async (label, queueItemId, status, isBlocked) => {
      await render(
        <QueueV2Board
          tasks={[
            task({
              coordinatorStatus: isBlocked ? "blocked" : "not_reported",
              queueItemId,
              status,
              title: `${label} task`,
            }),
          ]}
          workers={[worker()]}
        />,
      );

      expect(card(queueItemId)).not.toBeNull();
      expect(regionByName(`${label} lane`)?.textContent).toContain("1");

      await click(laneToggle(label));

      expect(laneToggle(label)?.getAttribute("aria-expanded")).toBe("false");
      expect(regionByName(`${label} lane`)?.textContent).toContain("1");
      expect(card(queueItemId)).toBeNull();

      await click(laneToggle(label));

      expect(laneToggle(label)?.getAttribute("aria-expanded")).toBe("true");
      expect(card(queueItemId)).not.toBeNull();
    },
  );

  it("shows tag colors as compact group visual identity", async () => {
    await render(
      <QueueV2Board
        tasks={[
          task({
            queueItemId: "alpha",
            queueTagId: "alpha",
            queueTagName: "Alpha",
            status: "ready",
            title: "Alpha task",
          }),
          task({
            queueItemId: "beta",
            queueTagId: "beta",
            queueTagName: "Beta",
            status: "ready",
            title: "Beta task",
          }),
        ]}
        workers={[worker()]}
      />,
    );

    expect(card("alpha")?.dataset.queueV2TagColor).toMatch(/^queue-flow-tag-/);
    expect(card("beta")?.dataset.queueV2TagColor).toMatch(/^queue-flow-tag-/);
    expect(document.body.textContent).toContain("Alpha");
    expect(document.body.textContent).toContain("Beta");
    expect(document.querySelectorAll(".queue-v2-card-tag-dot")).toHaveLength(2);
  });

  it("shows compact validation markers for passed, failed, and running cards", async () => {
    await render(
      <QueueV2Board
        tasks={[
          task({
            queueItemId: "passed",
            status: "ready",
            title: "Passed task",
            validationStatus: "passed",
            workerExecutionReports: [
              report({ validationResult: "passed", summary: "Validation passed." }),
            ],
          }),
          task({
            queueItemId: "failed",
            status: "ready",
            title: "Failed task",
            validationStatus: "failed",
            workerExecutionReports: [
              report({ reportStatus: "failed", validationResult: "failed" }),
            ],
          }),
          task({
            queueItemId: "running",
            status: "running",
            title: "Running validation task",
            validationStatus: "validating",
          }),
        ]}
        workers={[worker({ currentItemId: "running", status: "running" })]}
      />,
    );

    expect(card("passed")?.dataset.queueV2Validation).toBe("passed");
    expect(card("passed")?.textContent).toContain("Validation passed");
    expect(card("failed")?.dataset.queueV2Validation).toBe("failed");
    expect(card("failed")?.textContent).toContain("Validation failed");
    expect(card("running")?.dataset.queueV2Validation).toBe("running");
    expect(card("running")?.textContent).toContain("Validation running");
  });

  it("groups running tasks by worker with online/offline summaries", async () => {
    await render(
      <QueueV2Board
        tasks={[
          task({
            assignedWorkerId: "worker-a",
            queueItemId: "run-a",
            status: "running",
            title: "Running A",
          }),
          task({
            assignedWorkerId: "worker-b",
            queueItemId: "run-b",
            status: "running",
            title: "Running B",
          }),
        ]}
        workers={[
          worker({
            currentItemId: "run-a",
            name: "Worker A",
            status: "running",
            workerId: "worker-a",
          }),
          worker({
            currentItemId: "run-b",
            enabled: false,
            name: "Worker B",
            status: "paused",
            workerId: "worker-b",
          }),
        ]}
      />,
    );

    expect(regionByName("Worker A running group")?.textContent).toContain(
      "Online / 1/1 active",
    );
    expect(regionByName("Worker B running group")?.textContent).toContain(
      "Offline / 0/1 active",
    );
    expect(card("run-a")).not.toBeNull();
    expect(card("run-b")).not.toBeNull();
  });

  it("handles zero running tasks", async () => {
    await render(
      <QueueV2Board tasks={[task({ queueItemId: "ready", status: "ready" })]} />,
    );

    expect(regionByName("Running lane")?.textContent).toContain(
      "No running tasks",
    );
  });

  it("keeps closed collapsed by default and renders closed cards after expansion", async () => {
    await render(
      <QueueV2Board
        tasks={[
          task({
            closureState: "no_change_accepted",
            queueItemId: "closed",
            status: "completed",
            title: "Closed task",
          }),
        ]}
        workers={[worker()]}
      />,
    );

    expect(regionByName("Closed lane")?.textContent).toContain("Closed");
    expect(regionByName("Closed lane")?.textContent).toContain("1");
    expect(card("closed")).toBeNull();

    await click(laneToggle("Closed"));

    expect(card("closed")).not.toBeNull();
  });

  it("keeps lane overflow bounded and does not mutate task order", async () => {
    const tasks = Array.from({ length: 8 }, (_, index) =>
      task({
        queueItemId: `ready-${index.toString()}`,
        orderIndex: index,
        status: "ready",
        title: `Ready task ${index.toString()}`,
      }),
    );

    await render(<QueueV2Board tasks={tasks} workers={[worker()]} />);

    const orderBefore = visibleCardOrder();
    expect(card("ready-6")).toBeNull();
    expect(regionByName("Ready lane")?.textContent).toContain("+ 2 more");

    await click(buttonWithText("+ 2 more"));

    expect(card("ready-6")).not.toBeNull();
    expect(visibleCardOrder()).toEqual([
      ...orderBefore,
      "ready-6",
      "ready-7",
    ]);
  });

  it("places report-ready tasks in Review and explicit finalized tasks in Closed", async () => {
    await render(
      <QueueV2Board
        tasks={[
          task({
            queueItemId: "report",
            status: "completed",
            title: "Report task",
            workerExecutionReports: [report()],
          }),
          task({
            closureState: "no_change_accepted",
            queueItemId: "final",
            status: "completed",
            title: "Final task",
            workerExecutionReports: [report()],
          }),
        ]}
        workers={[worker()]}
      />,
    );

    expect(regionByName("Review lane")?.textContent).toContain("Report task");
    expect(regionByName("Closed lane")?.textContent).toContain("1");
    expect(regionByName("Review lane")?.textContent).not.toContain("Final task");
    expect(card("final")).toBeNull();
  });

  it("selects a clicked task without reordering cards or exposing raw prompt text", async () => {
    const tasks = [
      task({
        queueItemId: "first",
        prompt: "RAW PROMPT SHOULD NOT RENDER",
        status: "ready",
        title: "First task",
      }),
      task({
        queueItemId: "second",
        prompt: "SECOND RAW PROMPT SHOULD NOT RENDER",
        status: "ready",
        title: "Second task",
      }),
    ];
    await render(<QueueV2Board tasks={tasks} workers={[worker()]} />);
    const orderBefore = visibleCardOrder();

    await click(card("second"));

    expect(visibleCardOrder()).toEqual(orderBefore);
    expect(card("second")?.dataset.queueV2Selected).toBe("true");
    expect(document.body.textContent).not.toContain("RAW PROMPT SHOULD NOT RENDER");
    expect(document.body.textContent).not.toContain(
      "SECOND RAW PROMPT SHOULD NOT RENDER",
    );
  });

  it("opens task details from the card action menu and closes with Escape", async () => {
    await render(
      <QueueV2Board
        tasks={[task({ queueItemId: "ready", status: "ready", title: "Ready task" })]}
        workers={[worker()]}
      />,
    );

    await click(cardActionsButton("ready"));

    const menu = menuByName("Action menu for Ready task");
    expect(menu?.textContent).toContain("Open details");
    expect(dialogByName("Ready task")).toBeNull();

    await click(buttonInRegion(menu, "Open details"));

    expect(dialogByName("Ready task")).not.toBeNull();
    expect(document.querySelector(".queue-v2-task-details-shell")).not.toBeNull();
    expect(document.body.textContent).toContain("Objective");
    expect(document.body.textContent).toContain("Next action");

    await keyDown("Escape");

    expect(dialogByName("Ready task")).toBeNull();
  });

  it("renders details tabs with high-level Agent Log separate from collapsed Developer raw details", async () => {
    await render(
      <QueueV2Board
        tasks={[
          task({
            queueItemId: "reported",
            status: "completed",
            title: "Reported task",
            workerExecutionReports: [
              report({
                changedFiles: ["src/queue.ts"],
                rawReportPreview: '{"raw":"developer payload"}',
                summary: "Worker finished the report.",
                validationResult: "passed",
              }),
            ],
          }),
        ]}
        workers={[worker()]}
      />,
    );

    await openCardDetails("reported");
    await click(buttonWithText("Prompt"));
    expect(activePanel()?.textContent).toContain("Original prompt summary");
    await click(buttonWithText("Result"));
    expect(activePanel()?.textContent).toContain("Changed files");
    expect(activePanel()?.textContent).toContain("passed");
    await click(buttonWithText("Agent Log"));
    expect(activePanel()?.textContent).toContain("High-level task timeline only");
    expect(activePanel()?.textContent).not.toContain("developer payload");
    await click(buttonWithText("Context"));
    expect(activePanel()?.textContent).toContain("Context status");
    await click(buttonWithText("Files / Validation"));
    expect(activePanel()?.textContent).toContain("src/queue.ts");
    await click(buttonWithText("Developer"));

    const developerDetails = document.querySelector<HTMLDetailsElement>(
      ".queue-v2-task-details-developer",
    );
    expect(developerDetails?.open).toBe(false);
    expect(developerDetails?.textContent).toContain("Raw / developer details");
  });

  it("renders validation command evidence with capped output in Files / Validation", async () => {
    await render(
      <QueueV2Board
        tasks={[
          task({
            queueItemId: "validated",
            status: "completed",
            title: "Validated task",
            validationStatus: "passed",
            workerExecutionReports: [
              report({
                createdAt: "2026-01-02T00:00:00.000Z",
                rawReportPreview: validationRawPreview("A".repeat(1_500)),
                validationCommandsRun: ["npm.cmd run test -- --run Validation"],
                validationResult: "passed",
                warnings: ["stdout was capped before Queue review."],
              }),
            ],
          }),
        ]}
        workers={[worker()]}
      />,
    );

    await openCardDetails("validated");
    await click(buttonWithText("Files / Validation"));

    const panelText = activePanel()?.textContent ?? "";
    expect(panelText).toContain("Validation evidence");
    expect(panelText).toContain("Evidence timestamp");
    expect(panelText).toContain("2026-01-02T00:00:00.000Z");
    expect(panelText).toContain("npm.cmd run test -- --run Validation");
    expect(panelText).toContain("Exit");
    expect(panelText).toContain("Duration");
    expect(panelText).toContain("stdout snippet");
    expect(panelText).toContain("stderr snippet");
    expect(panelText).toContain("Preview capped");
    expect(panelText).not.toContain("HUGE_LOG_SENTINEL");
  });

  it("keeps request validation explicit and reports unsupported runner state", async () => {
    const onRequestValidation = vi.fn();

    await render(
      <QueueV2Board
        onRequestValidation={onRequestValidation}
        tasks={[
          task({
            queueItemId: "needs-validation",
            status: "ready",
            title: "Needs validation",
          }),
        ]}
        workers={[worker()]}
      />,
    );

    expect(onRequestValidation).not.toHaveBeenCalled();
    await openCardDetails("needs-validation");
    expect(onRequestValidation).not.toHaveBeenCalled();

    const requestButton = buttonWithText("Request validation");
    expect(requestButton?.disabled).toBe(true);
    expect(requestButton?.parentElement?.textContent).toContain(
      "Validation runner is unavailable in this Queue surface.",
    );
    await click(requestButton);
    expect(onRequestValidation).not.toHaveBeenCalled();
  });

  it("calls request validation only after the explicit details action", async () => {
    const onRequestValidation = vi.fn(
      async (
        _task: AgentQueueTask,
        _runner: ValidationRunner,
      ): Promise<QueueValidationRunResult> => ({
        attachment: {
          summary: {
            summary: "Validation passed: one command passed.",
          },
        } as QueueValidationRunResult["attachment"],
        runnerOutput: {
          summary: { status: "passed" },
          unavailable: false,
        } as QueueValidationRunResult["runnerOutput"],
        started: true,
        startUpdate: null,
        warnings: [],
      }),
    );

    await render(
      <QueueV2Board
        onRequestValidation={onRequestValidation}
        tasks={[
          task({
            queueItemId: "needs-validation",
            status: "ready",
            title: "Needs validation",
            workerExecutionReports: [
              report({
                validationCommandsSuggested: [
                  "npm.cmd run test -- --run Validation",
                ],
              }),
            ],
          }),
        ]}
        validationRunner={validationRunner()}
        workers={[worker()]}
      />,
    );

    expect(onRequestValidation).not.toHaveBeenCalled();
    await openCardDetails("needs-validation");
    expect(onRequestValidation).not.toHaveBeenCalled();

    await click(buttonWithText("Request validation"));
    await flushAsync();
    await click(buttonWithText("Files / Validation"));

    expect(onRequestValidation).toHaveBeenCalledTimes(1);
    const firstCall = onRequestValidation.mock.calls[0];
    expect(firstCall?.[0].queueItemId).toBe("needs-validation");
    expect(activePanel()?.textContent).toContain(
      "Validation passed: one command passed.",
    );
  });

  it("keeps unwired popup action controls disabled and does not call selection again", async () => {
    const onSelectedTaskChange = vi.fn();

    await render(
      <QueueV2Board
        onSelectedTaskChange={onSelectedTaskChange}
        tasks={[task({ queueItemId: "ready", status: "ready", title: "Ready task" })]}
        workers={[worker()]}
      />,
    );

    await openCardDetails("ready");
    expect(onSelectedTaskChange).toHaveBeenCalledTimes(1);

    const primaryAction = buttonWithText("Run task");
    expect(primaryAction?.disabled).toBe(true);
    expect(primaryAction?.parentElement?.textContent).toContain(
      "Queue runtime actions are not wired in this view.",
    );
    await click(primaryAction);

    expect(onSelectedTaskChange).toHaveBeenCalledTimes(1);
  });

  it("exposes imported draft promotion through QueueV2 details and fires only on click", async () => {
    const onPromote = vi.fn();
    const onRun = vi.fn();
    const importedTask = task({
      description: [
        "Prompt pack: Core Pack (core-pack)",
        "Prompt item: build",
      ].join("\n"),
      prompt: promptPackPrompt(),
      queueItemId: "queue-build",
      status: "draft",
      title: "build: Build task",
    });

    await render(
      <QueueV2Board
        queue={queueController({
          onPromote,
          onRun,
          selectedTask: importedTask,
          tasks: [importedTask],
        })}
        tasks={[importedTask]}
        workers={[worker()]}
      />,
    );

    expect(onPromote).not.toHaveBeenCalled();
    expect(onRun).not.toHaveBeenCalled();

    await openCardDetails("queue-build");

    expect(onPromote).not.toHaveBeenCalled();
    expect(onRun).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Queue task");
    expect(document.body.textContent).not.toContain(
      "no Queue runtime action is wired",
    );
    const promoteButton = buttonWithText("Queue for run");
    expect(promoteButton?.disabled).toBe(false);

    await click(promoteButton);

    expect(onPromote).toHaveBeenCalledTimes(1);
    expect(onRun).not.toHaveBeenCalled();
  });

  it("exposes ready task run through QueueV2 details and fires only on click", async () => {
    const onRun = vi.fn();
    const readyTask = task({
      assignedExecutorWidgetId: "worker",
      assignedWorkerId: "worker",
      queueItemId: "ready-run",
      status: "ready",
      title: "Ready run task",
    });

    await render(
      <QueueV2Board
        queue={queueController({
          onRun,
          runCanStart: true,
          selectedTask: readyTask,
          tasks: [readyTask],
        })}
        tasks={[readyTask]}
        workers={[worker()]}
      />,
    );

    expect(onRun).not.toHaveBeenCalled();
    await openCardDetails("ready-run");

    const runButton = buttonWithText("Run task");
    expect(runButton?.disabled).toBe(false);
    expect(onRun).not.toHaveBeenCalled();

    await click(runButton);

    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("keeps dependency-blocked tasks non-runnable in QueueV2 details", async () => {
    const onRun = vi.fn();
    const prerequisite = task({
      queueItemId: "task-001",
      status: "queued",
      title: "Task 001",
    });
    const dependent = task({
      assignedExecutorWidgetId: "worker",
      assignedWorkerId: "worker",
      dependsOn: ["task-001"],
      queueItemId: "task-002",
      status: "ready",
      title: "Task 002",
    });

    await render(
      <QueueV2Board
        queue={queueController({
          onRun,
          readinessMessage: "Dependency is still open.",
          runCanStart: false,
          selectedTask: dependent,
          tasks: [prerequisite, dependent],
        })}
        tasks={[prerequisite, dependent]}
        workers={[worker()]}
      />,
    );

    expect(card("task-002")?.getAttribute("data-queue-v2-lane")).toBe("blocked");
    await openCardDetails("task-002");

    const runButton = buttonWithText("Run task");
    expect(runButton?.disabled).toBe(true);
    expect(runButton?.parentElement?.textContent).toContain(
      "Dependency is still open.",
    );

    await click(runButton);

    expect(onRun).not.toHaveBeenCalled();
  });

  it("shows imported prompt-pack metadata on compact cards and task details without raw JSON", async () => {
    const onSelectedTaskChange = vi.fn();
    const importedTask = task({
      dependsOn: ["queue-setup"],
      description: [
        "Prompt pack: Core Pack (core-pack)",
        "Prompt item: build",
      ].join("\n"),
      prompt: promptPackPrompt(),
      queueItemId: "queue-build",
      status: "draft",
      title: "build: Build task",
    });

    await render(
      <QueueV2Board
        onSelectedTaskChange={onSelectedTaskChange}
        tasks={[importedTask]}
        workers={[worker()]}
      />,
    );

    expect(onSelectedTaskChange).not.toHaveBeenCalled();
    expect(card("queue-build")?.textContent).toContain("build: Build task");
    expect(card("queue-build")?.textContent).toContain("Block build");
    expect(card("queue-build")?.textContent).toContain("Dependency blocked");
    expect(card("queue-build")?.textContent).toContain("Validation required");
    expect(document.body.textContent).not.toContain('"items"');

    await openCardDetails("queue-build");

    expect(onSelectedTaskChange).toHaveBeenCalledTimes(1);
    expect(activePanel()?.textContent).toContain("Prompt-pack import");
    expect(activePanel()?.textContent).toContain("Core Pack (core-pack)");
    expect(activePanel()?.textContent).toContain("build");
    expect(activePanel()?.textContent).toContain("setup");
    expect(activePanel()?.textContent).toContain("queue-setup");
    expect(activePanel()?.textContent).toContain("frontend only");
    expect(activePanel()?.textContent).toContain("backend storage");

    await click(buttonWithText("Files / Validation"));
    expect(activePanel()?.textContent).toContain(
      "npm.cmd run typecheck --prefix apps/desktop/frontend",
    );
    expect(activePanel()?.textContent).toContain(
      "frontend: materialize prompt pack",
    );
    expect(document.body.textContent).not.toContain('"items"');
  });

  it("shows Diff Review not-requested and requested states for implementation task details", async () => {
    await render(
      <QueueV2Board
        tasks={[
          task({
            queueItemId: "source-no-review",
            status: "completed",
            title: "Source without review",
            workerExecutionReports: [
              report({
                changedFiles: ["src/source.ts"],
                validationResult: "passed",
              }),
            ],
          }),
          task({
            queueItemId: "source-with-review",
            status: "completed",
            title: "Source implementation",
            workerExecutionReports: [
              report({
                changedFiles: ["src/impl.ts"],
                warnings: ["Review warning from worker report."],
              }),
            ],
          }),
          task({
            diffReview: {
              reviewMode: "diff_vs_report",
              reviewTargetSummary: "Source implementation; one file",
              sourceItemId: "source-with-review",
              sourceReportId: "report",
            },
            itemType: "diff_review",
            queueItemId: "review-task",
            status: "queued",
            title: "Diff Review - Source implementation",
          }),
        ]}
        workers={[worker()]}
      />,
    );

    expect(card("source-no-review")?.textContent).toContain(
      "Diff review not requested",
    );
    expect(card("source-with-review")?.textContent).toContain(
      "Diff review requested",
    );

    await openCardDetails("source-no-review");
    expect(activePanel()?.textContent).toContain("Diff Review");
    expect(activePanel()?.textContent).toContain("Not requested");
    expect(activePanel()?.textContent).toContain(
      "No linked Diff Review task is recorded",
    );
    await keyDown("Escape");

    await openCardDetails("source-with-review");
    expect(activePanel()?.textContent).toContain("Requested");
    expect(activePanel()?.textContent).toContain(
      "Diff Review - Source implementation",
    );
    expect(activePanel()?.textContent).toContain("Source report");
    expect(activePanel()?.textContent).toContain("Diff / files");
    expect(activePanel()?.textContent).toContain("Review warning from worker report.");
  });

  it("shows Diff Review task source link and read-only badge copy", async () => {
    const onSelectedTaskChange = vi.fn();

    await render(
      <QueueV2Board
        onSelectedTaskChange={onSelectedTaskChange}
        tasks={[
          task({
            queueItemId: "source-task",
            status: "completed",
            title: "Source implementation",
            workerExecutionReports: [
              report({
                changedFiles: ["src/impl.ts"],
                validationResult: "passed",
              }),
            ],
          }),
          task({
            diffReview: {
              reviewMode: "contract_scope",
              reviewTargetSummary: "Source implementation scope",
              sourceItemId: "source-task",
              sourceReportId: "report",
            },
            itemType: "diff_review",
            queueItemId: "review-task",
            status: "queued",
            title: "Diff Review - Source implementation",
          }),
        ]}
        workers={[worker()]}
      />,
    );

    expect(card("review-task")?.textContent).toContain("Source source-task");
    expect(onSelectedTaskChange).not.toHaveBeenCalled();

    await openCardDetails("review-task");
    expect(onSelectedTaskChange).toHaveBeenCalledTimes(1);
    expect(activePanel()?.textContent).toContain("Read-only Diff Review item");
    expect(activePanel()?.textContent).toContain("Source implementation");
    expect(activePanel()?.textContent).toContain("Contract/scope");
    expect(onSelectedTaskChange).toHaveBeenLastCalledWith("review-task");

    await click(buttonWithText("Open source task"));

    expect(onSelectedTaskChange).toHaveBeenCalledTimes(2);
    expect(onSelectedTaskChange).toHaveBeenLastCalledWith("source-task");
    expect(dialogByName("Source implementation")).not.toBeNull();
  });

  it("does not trigger linked Diff Review callbacks until the explicit link click", async () => {
    const onSelectedTaskChange = vi.fn();
    const onRequestValidation = vi.fn();

    await render(
      <QueueV2Board
        onRequestValidation={onRequestValidation}
        onSelectedTaskChange={onSelectedTaskChange}
        tasks={[
          task({
            queueItemId: "source-task",
            status: "completed",
            title: "Source implementation",
            workerExecutionReports: [report({ changedFiles: ["src/impl.ts"] })],
          }),
          task({
            diffReview: {
              reviewMode: "diff_vs_report",
              reviewTargetSummary: "Source implementation",
              sourceItemId: "source-task",
              sourceReportId: "report",
            },
            itemType: "diff_review",
            queueItemId: "review-task",
            status: "completed",
            title: "Diff Review - Source implementation",
            workerExecutionReports: [report({ reportId: "review-report" })],
          }),
        ]}
        workers={[worker()]}
      />,
    );

    expect(onSelectedTaskChange).not.toHaveBeenCalled();
    expect(onRequestValidation).not.toHaveBeenCalled();

    await openCardDetails("source-task");
    expect(onSelectedTaskChange).toHaveBeenCalledTimes(1);
    expect(onSelectedTaskChange).toHaveBeenLastCalledWith("source-task");
    expect(onRequestValidation).not.toHaveBeenCalled();

    await click(buttonWithText("Open Diff Review"));

    expect(onSelectedTaskChange).toHaveBeenCalledTimes(2);
    expect(onSelectedTaskChange).toHaveBeenLastCalledWith("review-task");
    expect(onRequestValidation).not.toHaveBeenCalled();
    expect(buttonWithText("Finalize / Accept")?.disabled).toBe(true);
    expect(buttonWithText("Accept without commit")?.disabled).toBe(true);

    await click(buttonWithText("Finalize / Accept"));
    await click(buttonWithText("Accept without commit"));

    expect(onSelectedTaskChange).toHaveBeenCalledTimes(2);
    expect(onRequestValidation).not.toHaveBeenCalled();
  });

});

async function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
  });
}

async function click(element: Element | null) {
  if (!element) {
    throw new Error("Expected element to click.");
  }

  await act(async () => {
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
}

function card(taskId: string) {
  return document.querySelector<HTMLElement>(
    `[data-queue-item-id='${taskId}']`,
  );
}

function cardActionsButton(taskId: string) {
  return card(taskId)?.querySelector<HTMLButtonElement>(
    ".queue-v2-card-details",
  ) ?? null;
}

async function openCardDetails(taskId: string) {
  await click(cardActionsButton(taskId));
  await click(buttonWithText("Open details"));
}

function buttonWithText(text: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

function dialogByName(name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']")).find(
      (dialog) => dialog.textContent?.includes(name),
    ) ?? null
  );
}

function menuByName(name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[role='menu']")).find(
      (menu) => menu.getAttribute("aria-label") === name,
    ) ?? null
  );
}

function buttonInRegion(
  region: Element | null,
  text: string,
): HTMLButtonElement | null {
  return (
    Array.from(region?.querySelectorAll<HTMLButtonElement>("button") ?? []).find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

function activePanel() {
  return document.querySelector<HTMLElement>("[role='tabpanel']");
}

async function keyDown(key: string) {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
  });
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
  });
}

function visibleCardOrder() {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-task-order-id]"))
    .map((element) => element.dataset.taskOrderId);
}

function regionByName(name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("section")).find(
      (element) => element.getAttribute("aria-label") === name,
    ) ?? null
  );
}

function laneToggle(label: string): HTMLButtonElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        ".queue-v2-collapsible-lane-header",
      ),
    ).find((element) =>
      element.getAttribute("aria-label")?.includes(`${label} lane`),
    ) ?? null
  );
}

function task(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    approvalPolicy: "never",
    assignedExecutorWidgetId: null,
    assignedWorkerId: null,
    closureState: undefined,
    codexExecutable: "codex",
    context: undefined,
    coordinatorStatus: "not_reported",
    createdAt: "2026-01-01T00:00:00.000Z",
    dependsOn: [],
    description: "Description",
    executionPolicy: "manual",
    executionWorkspace: "C:/work",
    itemType: "implementation",
    orderIndex: 0,
    priority: 1,
    prompt: "Do the work",
    queueItemId: "task",
    queueTagId: "default",
    queueTagName: "Default",
    sandbox: "danger_full_access",
    status: "queued",
    title: "Task",
    updatedAt: "2026-01-01T00:00:00.000Z",
    validationStatus: "not_started",
    workerExecutionReports: [],
    workspaceId: "workspace",
    ...overrides,
  };
}

function worker(overrides: Partial<AgentWorkerSummary> = {}): AgentWorkerSummary {
  return {
    currentItemId: null,
    displayOrder: 0,
    enabled: true,
    lastReportSummary: null,
    name: "Worker",
    scope: { kind: "all" },
    status: "idle",
    workerId: "worker",
    ...overrides,
  };
}

function report(overrides: Partial<AgentQueueWorkerExecutionReport> = {}) {
  return {
    ...baseReport(),
    ...overrides,
  };
}

function baseReport() {
  return {
    changedFiles: [],
    commandsRun: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    errors: [],
    itemId: "task",
    reportId: "report",
    reportStatus: "completed" as const,
    summary: "Finished",
    validationCommandsSuggested: [],
    warnings: [],
    workerId: "worker",
  };
}

function validationRawPreview(hugeOutput: string) {
  return [
    "Validation evidence",
    "Run: validation-run-1",
    "Queue item: validated",
    "Suite: queue-validation",
    "Status: passed",
    "Summary: one command passed",
    "",
    "Command: npm.cmd run test -- --run Validation (validation-1)",
    "Status: passed",
    "Exit code: 0",
    "Duration: 42 ms",
    "Cwd: C:/work",
    `Stdout preview:\n${hugeOutput}`,
    "Stderr preview:\nempty",
    "Warnings: stdout was capped before Queue review.",
    "Full log ref: HUGE_LOG_SENTINEL",
  ].join("\n");
}

function validationRunner(): ValidationRunner {
  return {
    available: true,
    run: vi.fn(),
  };
}

function queueController({
  onPromote = vi.fn(),
  onRun = vi.fn(),
  readinessMessage = null,
  runCanStart = false,
  selectedTask,
  tasks,
}: {
  onPromote?: () => void;
  onRun?: () => void;
  readinessMessage?: string | null;
  runCanStart?: boolean;
  selectedTask: AgentQueueTask;
  tasks: AgentQueueTask[];
}): AgentQueueController {
  return {
    apiAvailable: true,
    draftPromotion: {
      canPromote: selectedTask.status === "draft",
      isPromoting: false,
      onPromote,
    },
    foundation: {
      globalExecutionState: "started",
      pausedQueueTagIds: new Set(),
      workers: [worker()],
    },
    run: {
      canStart: runCanStart,
      isStarting: false,
      onStartAssignedTask: onRun,
      preconditionMessages: [],
      readinessMessage,
    },
    selectedTask,
    tasks,
  } as unknown as AgentQueueController;
}

function promptPackPrompt() {
  return [
    "Build prompt body.",
    "",
    "Prompt pack materialization metadata",
    "Pack: Core Pack (core-pack)",
    "Block id: build",
    "Prompt-pack dependencies: setup",
    "Expected commit title: frontend: materialize prompt pack",
    "Validation commands",
    "- npm.cmd run typecheck --prefix apps/desktop/frontend",
    "Allowed scope",
    "- frontend only",
    "Forbidden scope",
    "- backend storage",
    'Raw prompt-pack JSON was {"items":[{"id":"build"}]} and must not be shown as metadata.',
    "Imported Queue items must not auto-run.",
  ].join("\n");
}
