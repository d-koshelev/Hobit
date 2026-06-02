import type {
  AgentExecutorRunDetail,
  AgentQueueTask,
} from "../../workspace/types";
import {
  AUTONOMOUS_REPORT_READY_NOTE,
  DEPENDENCY_BLOCKER,
  NO_ELIGIBLE_TASK_BLOCKER,
  SAVE_TASK_EDITS_SETUP,
  assessAutonomousSuccess,
  autonomousPreflightBlockerMessages,
  autonomousPreconditionMessages,
  buildAutonomousWorkerReport,
  countRemainingAutonomousEligibleTasks,
  selectNextAutonomousTask,
} from "./agentQueueAutonomousRunnerModel";

describe("Autonomous Queue runner model", () => {
  it("disables start only when preflight cannot be performed", () => {
    expect(
      autonomousPreconditionMessages({
        apiAvailable: false,
        isStarting: false,
      }),
    ).toEqual([
      "Autonomous Queue is only available in the Tauri desktop shell.",
    ]);

    expect(
      autonomousPreconditionMessages({
        apiAvailable: true,
        isStarting: true,
      }),
    ).toEqual(["Autonomous Queue is already active."]);
  });

  it("reports runtime setup and task blockers during preflight", () => {
    expect(
      autonomousPreflightBlockerMessages({
        hasOpenTaskEdit: true,
        tasks: [queueTask({ executionWorkspace: null })],
      }),
    ).toEqual([
      SAVE_TASK_EDITS_SETUP,
      "Task Queue task is missing execution workspace.",
    ]);
  });

  it("selects the first eligible task in deterministic Queue order", () => {
    const blocked = queueTask({
      orderIndex: 0,
      prompt: "",
      queueItemId: "blocked",
      title: "Blocked",
    });
    const first = queueTask({
      orderIndex: 1,
      priority: 5,
      queueItemId: "first",
      title: "First",
    });
    const second = queueTask({
      orderIndex: 2,
      priority: 0,
      queueItemId: "second",
      title: "Second",
    });

    expect(selectNextAutonomousTask([second, first, blocked], new Set())).toEqual({
      skippedCount: 0,
      task: first,
    });
  });

  it("counts remaining eligible tasks without including already-started tasks", () => {
    expect(
      countRemainingAutonomousEligibleTasks(
        [
          queueTask({ queueItemId: "first" }),
          queueTask({ queueItemId: "second" }),
          queueTask({ queueItemId: "blocked", prompt: "" }),
        ],
        new Set(["first"]),
      ),
    ).toBe(1);
  });

  it("runs a dependent task only after prerequisite is finalized", () => {
    const prerequisite = queueTask({
      coordinatorStatus: "awaiting_coordinator_review",
      queueItemId: "prereq",
      status: "completed",
    });
    const dependent = queueTask({
      dependsOn: ["prereq"],
      queueItemId: "dependent",
    });

    expect(
      selectNextAutonomousTask([prerequisite, dependent], new Set()).task,
    ).toBeNull();

    expect(
      selectNextAutonomousTask(
        [{ ...prerequisite, coordinatorStatus: "finalized" }, dependent],
        new Set(["prereq"]),
      ).task?.queueItemId,
    ).toBe("dependent");
  });

  it("reports dependency blockers when no task can run", () => {
    const prerequisite = queueTask({
      coordinatorStatus: "awaiting_coordinator_review",
      queueItemId: "prereq",
      status: "completed",
    });
    const dependent = queueTask({
      dependsOn: ["prereq"],
      queueItemId: "dependent",
    });

    expect(
      autonomousPreflightBlockerMessages({
        hasOpenTaskEdit: false,
        tasks: [prerequisite, dependent],
      }),
    ).toEqual([DEPENDENCY_BLOCKER]);
  });

  it("does not accept missing evidence, failed runs, or blocker text", () => {
    expect(assessAutonomousSuccess(null, "completed")).toEqual({
      ok: false,
      reason: "Direct Work result evidence could not be loaded.",
    });
    expect(assessAutonomousSuccess(runDetail(), "failed")).toEqual({
      ok: false,
      reason: "Direct Work run ended with failed.",
    });
    expect(
      assessAutonomousSuccess(
        runDetail({ finalMessage: "Completed but blocked by validation failed." }),
        "completed",
      ),
    ).toEqual({
      ok: false,
      reason: "Direct Work evidence reports blocked, failed, or needs changes.",
    });
  });

  it("builds a report-ready worker report without Git commit fields", () => {
    const report = buildAutonomousWorkerReport({
      detail: runDetail(),
      runId: "run-1",
      task: queueTask(),
    });
    const { createdAt, ...reportWithoutTimestamp } = report;

    expect(typeof createdAt).toBe("string");
    expect(reportWithoutTimestamp).toEqual({
      changedFiles: [],
      commandsRun: [],
      errors: [],
      itemId: "queue-1",
      rawReportPreview: "Done.",
      reportId: "autonomous_run-1",
      reportStatus: "reported",
      summary: AUTONOMOUS_REPORT_READY_NOTE,
      validationCommandsRun: [],
      validationCommandsSuggested: [],
      validationResult: "not_run",
      warnings: [],
      workerId: "agent-queue",
    });
  });
});

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-06-02T10:00:00.000Z",
    dependsOn: [],
    description: "",
    executionPolicy: "auto",
    executionWorkspace: "/repo",
    codexExecutable: "codex",
    sandbox: "read_only",
    approvalPolicy: "never",
    priority: 0,
    prompt: "Run task",
    queueItemId: "queue-1",
    status: "queued",
    title: "Queue task",
    updatedAt: "2026-06-02T10:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function runDetail(
  overrides: Partial<AgentExecutorRunDetail> = {},
): AgentExecutorRunDetail {
  return {
    changedFilesSummary: null,
    errorMessage: null,
    finalMessage: "Done.",
    logs: [],
    resultContent: null,
    resultId: "result-1",
    resultPayload: null,
    resultStatus: "completed",
    resultSummary: null,
    stderrPreview: null,
    stdoutPreview: null,
    summary: {
      commandKind: "codex_direct_work",
      durationMs: 100,
      finishedAt: "2026-06-02T10:01:00.000Z",
      hasResult: true,
      logCount: 1,
      mode: null,
      repoRoot: "C:/repo",
      resultType: "codex_direct_work",
      runId: "run-1",
      startedAt: "2026-06-02T10:00:00.000Z",
      status: "completed",
      title: "Run",
      validationProfile: null,
      validationStatus: null,
    },
    validationProfile: null,
    validationStatus: null,
    ...overrides,
  };
}
