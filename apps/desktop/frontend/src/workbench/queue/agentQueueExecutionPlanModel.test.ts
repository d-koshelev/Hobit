import type { AgentQueueTask } from "../../workspace/types";
import {
  buildAgentQueueExecutionPlanPreview,
  executionPlanEstimateText,
  staleExecutionPlanPreview,
} from "./agentQueueExecutionPlanModel";

describe("agent queue execution plan model", () => {
  it("creates implementation steps and bounded estimates from a normal prompt", () => {
    const plan = buildAgentQueueExecutionPlanPreview({
      generatedAt: "2026-05-30T10:00:00.000Z",
      task: queueTask({
        prompt:
          "Update apps/desktop/frontend/src/workbench/AgentQueueV2Board.tsx and add focused tests. Run npm.cmd run test --prefix apps/desktop/frontend.",
      }),
      workerId: "worker-1",
    });

    expect(plan.source).toBe("heuristic");
    expect(plan.workerId).toBe("worker-1");
    expect(plan.status).toBe("planned");
    expect(plan.steps[0]?.includes("Inspect the current implementation")).toBe(
      true,
    );
    expect(plan.estimatedTokenMin > 0).toBe(true);
    expect(plan.estimatedTokenMax > plan.estimatedTokenMin).toBe(true);
    expect(plan.estimatedMinutesMax >= plan.estimatedMinutesMin).toBe(true);
    expect(
      plan.likelyFilesOrAreas.includes(
        "apps/desktop/frontend/src/workbench/AgentQueueV2Board.tsx",
      ),
    ).toBe(true);
    expect(
      plan.expectedValidationCommands.includes(
        "npm.cmd run test --prefix apps/desktop/frontend",
      ),
    ).toBe(true);
    expect(executionPlanEstimateText(plan).includes("Approx.")).toBe(true);
  });

  it("marks broad runtime/schema/UI/docs prompts as high risk and high complexity", () => {
    const prompt = [
      "Task 1: change sqlite schema and storage migration.",
      "Task 2: update Tauri DTO runtime and scheduler behavior.",
      "Task 3: rebuild React UI panels and CSS.",
      "Task 4: update docs/contracts.",
      "Task 5: add cargo and npm validation.",
      "Files: crates/hobit-app/src/lib.rs apps/desktop/frontend/src/workbench/AgentQueueTaskRunPanel.tsx docs/CURRENT_WIDGET_SURFACE.md scripts/hobit/validate.ps1",
    ].join("\n");

    const plan = buildAgentQueueExecutionPlanPreview({
      generatedAt: "2026-05-30T10:00:00.000Z",
      task: queueTask({ prompt }),
    });

    expect(plan.complexity).toBe("high");
    expect(plan.risk).toBe("high");
  });

  it("recommends splitting oversized prompts into sub-blocks", () => {
    const oversizedPrompt = Array.from({ length: 950 }, (_, index) =>
      index % 40 === 0 ? "schema runtime UI docs validation" : "implementation",
    ).join(" ");

    const plan = buildAgentQueueExecutionPlanPreview({
      generatedAt: "2026-05-30T10:00:00.000Z",
      task: queueTask({ prompt: oversizedPrompt }),
    });

    expect(plan.status).toBe("needs_split");
    expect(
      plan.splitRecommendation?.includes("Split into smaller queue sub-blocks"),
    ).toBe(true);
  });

  it("detects validation commands when present", () => {
    const plan = buildAgentQueueExecutionPlanPreview({
      generatedAt: "2026-05-30T10:00:00.000Z",
      task: queueTask({
        prompt:
          "Validate with cargo check --workspace and npm.cmd run typecheck --prefix apps/desktop/frontend before final report.",
      }),
    });

    expect(plan.expectedValidationCommands).toEqual([
      "cargo check --workspace",
      "npm.cmd run typecheck --prefix apps/desktop/frontend",
    ]);
  });

  it("creates a review-style plan for diff review items", () => {
    const plan = buildAgentQueueExecutionPlanPreview({
      generatedAt: "2026-05-30T10:00:00.000Z",
      task: queueTask({
        itemType: "diff_review",
        prompt: "Review the changed diff for regression and missing tests.",
      }),
    });

    expect(plan.steps.join(" ").includes("Review the provided diff")).toBe(true);
    expect(plan.steps.join(" ").includes("without mutating files")).toBe(true);
  });

  it("creates a validation-style plan for validation items", () => {
    const plan = buildAgentQueueExecutionPlanPreview({
      generatedAt: "2026-05-30T10:00:00.000Z",
      task: queueTask({
        itemType: "validation",
        prompt: "Run typecheck and tests for the frontend Queue changes.",
      }),
    });

    expect(plan.steps.join(" ").includes("Confirm the validation target")).toBe(
      true,
    );
    expect(
      plan.expectedValidationCommands.includes(
        "npm.cmd run test --prefix apps/desktop/frontend",
      ),
    ).toBe(true);
  });

  it("marks a generated plan stale without changing prompt text", () => {
    const task = queueTask({ prompt: "Keep this prompt unchanged." });
    const plan = buildAgentQueueExecutionPlanPreview({
      generatedAt: "2026-05-30T10:00:00.000Z",
      task,
    });
    const stalePlan = staleExecutionPlanPreview(plan, { workerId: "worker-2" });

    expect(stalePlan.status).toBe("stale");
    expect(stalePlan.workerId).toBe("worker-2");
    expect(task.prompt).toBe("Keep this prompt unchanged.");
  });
});

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-05-30T09:00:00.000Z",
    dependsOn: [],
    description: "",
    executionPolicy: "manual",
    itemType: "implementation",
    priority: 0,
    prompt: "Implement a focused Queue UI change and add tests.",
    queueItemId: "queue-1",
    status: "queued",
    title: "Queue task",
    updatedAt: "2026-05-30T09:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
