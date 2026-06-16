// @ts-expect-error Node types are intentionally absent from the frontend tsconfig; this test reads source in Vitest only.
import { readdirSync, readFileSync, statSync } from "fs";

import { describe, expect, it, vi } from "vitest";

import {
  createDefaultQueueAgentAdapterApi,
  type QueueAgentAdapterApi,
} from "../adapters";
import {
  createHobitAgentSmokeInstruction,
  createHobitAgentSmokePlan,
  createHobitAgentSmokeRequest,
  runHobitAgentSmoke,
  summarizeHobitAgentSmokeResults,
} from "./hobitAgentSmokeRunner";

describe("hobitAgentSmokeRunner instruction and plan", () => {
  it("creates a product-facing smoke instruction for safe agent-executed checks", () => {
    const instruction = createHobitAgentSmokeInstruction();

    expect(instruction.id).toBe("hobit.agent.smoke");
    expect(instruction.body).toContain("Check available agent APIs");
    expect(instruction.body).toContain("widget/module contracts");
    expect(instruction.body).toContain("safe self-tests and dry-runs");
    expect(instruction.body).toContain("Do not perform hidden side effects");
    expect(instruction.body).toContain("Do not run Codex");
    expect(instruction.body).toContain("Do not run shell commands");
    expect(instruction.body).toContain("Do not start Queue workers");
    expect(instruction.body).toContain("Do not create Queue views");
    expect(instruction.body).toContain("Do not launch Terminal");
    expect(instruction.body).toContain("Do not mutate Git");
    expect(instruction.body).toContain("Do not execute rollback");
  });

  it("plans agent runtime APIs widget contracts Queue dry-runs and Finder exclusion", () => {
    const plan = createHobitAgentSmokePlan({
      request: createHobitAgentSmokeRequest({
        requestId: "smoke-plan",
        workspaceId: "workspace_1",
      }),
    });

    expect(capabilityIds(plan.cases)).toEqual(
      expect.arrayContaining([
        "agent.status.read",
        "agent.history.read",
        "agent.message.send",
        "agent.capabilities.read",
        "agent.selfTest.run",
        "queue.targetSingletonQueue",
        "queue.createItems",
        "queue.preparePromptPackPreview",
        "queue.selfTest",
        "queue.lifecycle.agentFinished",
        "queue.review.createMessage",
        "queue.review.ack",
        "queue.coordinator.approveValidation",
        "queue.coordinator.addFollowUpPrompt",
        "queue.item.markDone",
      ]),
    );
    expect(plan.cases.map((item) => item.caseId)).toEqual(
      expect.arrayContaining([
        "queue:singleton-target",
        "queue:create-items-dry-run",
        "queue:dry-run-target-singleton",
        "queue:no-auto-run",
        "queue:no-duplicate-view",
        "queue:prompt-pack-preview-dry-run",
        "queue:no-mutation",
        "queue:no-hidden-side-effects",
        "queue-dogfood-broker:summary",
        "queue-dogfood-broker:agent-finished-awaiting-review",
        "queue-dogfood-broker:review-message-created",
        "queue-dogfood-broker:coordinator-ack-in-review",
        "queue-dogfood-broker:validation-approved",
        "queue-dogfood-broker:mark-done",
        "queue-dogfood-broker:dependent-unblocked-after-done",
        "queue-dogfood-broker:follow-up-running",
        "queue-dogfood-broker:failure-dependent-blocked",
        "queue-dogfood-broker:no-hidden-side-effects",
        "queue-dogfood-broker:backend-durability",
        "queue-dogfood-broker:real-worker-execution",
        "queue-dogfood-broker:real-validation-execution",
        "queue-dogfood-broker:real-git-commit-execution",
      ]),
    );
    expect(widgetIds(plan.cases)).toEqual(
      expect.arrayContaining([
        "agent-queue",
        "interactive-agent",
        "skill-library",
        "notes",
        "terminal",
        "finder",
      ]),
    );
    expect(plan.cases.find((item) => item.caseId === "widget-contract:finder-active-scope")).toMatchObject({
      plannedStatus: "skipped",
      productFacingReason: "Finder excluded",
      required: false,
      safeMode: "excluded",
    });
    expect(plan.cases.find((item) => item.caseId === "widget-contract:skill-library:adapter")).toMatchObject({
      plannedStatus: "skipped",
      productFacingReason: "Adapter not implemented yet",
      required: false,
    });
    expect(plan.cases.find((item) => item.caseId === "widget-contract:notes:adapter")).toMatchObject({
      plannedStatus: "skipped",
      productFacingReason: "Adapter not implemented yet",
      required: false,
    });
    expect(plan.cases.find((item) => item.caseId === "widget-contract:terminal:adapter")).toMatchObject({
      plannedStatus: "blocked",
      productFacingReason: "Restricted capability",
      required: false,
    });
  });
});

describe("hobitAgentSmokeRunner aggregation", () => {
  it("aggregates agent API smoke widget contracts Queue safe checks and hidden side-effect assertions", async () => {
    const adapter = safeFakeQueueAdapter({ supportsSafeMutationSandbox: true });
    const smoke = await runHobitAgentSmoke({
      queueAdapterApi: adapter,
      request: createHobitAgentSmokeRequest({
        createdAt: "2026-06-15T10:00:00.000Z",
        requestId: "aggregate-smoke",
        workspaceId: "workspace_1",
      }),
    });
    const report = smoke.report;

    expect(report.overallStatus).toBe("passed");
    expect(report.summary).toEqual({
      blocked: 4,
      failed: 0,
      passed: 35,
      skipped: 4,
      total: 43,
    });
    expect(summarizeHobitAgentSmokeResults(report)).toEqual(report.summary);
    expect(result(report, "agent.apiSmoke:status.read")).toMatchObject({
      capabilityId: "agent.status.read",
      status: "passed",
    });
    expect(result(report, "agent.apiSmoke:selfTest.run")).toMatchObject({
      componentTitle: "Agent Peer SelfTest",
      status: "passed",
    });
    expect(result(report, "widget-contract:agent-queue")).toMatchObject({
      status: "passed",
      widgetId: "agent-queue",
    });
    expect(result(report, "widget-contract:interactive-agent")).toMatchObject({
      status: "passed",
      widgetId: "interactive-agent",
    });
    expect(result(report, "widget-contract:skill-library")).toMatchObject({
      status: "passed",
      widgetId: "skill-library",
    });
    expect(result(report, "widget-contract:notes")).toMatchObject({
      status: "passed",
      widgetId: "notes",
    });
    expect(result(report, "widget-contract:terminal")).toMatchObject({
      status: "passed",
      widgetId: "terminal",
    });
    expect(result(report, "queue:singleton-target")).toMatchObject({
      capabilityId: "queue.targetSingletonQueue",
      status: "passed",
    });
    expect(result(report, "queue:create-items-dry-run")).toMatchObject({
      capabilityId: "queue.createItems",
      status: "passed",
    });
    expect(result(report, "queue:dry-run-target-singleton")).toMatchObject({
      capabilityId: "queue.createItems",
      message: "Singleton Queue target verified.",
      status: "passed",
    });
    expect(result(report, "queue:no-auto-run")).toMatchObject({
      capabilityId: "queue.createItems",
      message: "No Queue worker start.",
      status: "passed",
    });
    expect(result(report, "queue:no-duplicate-view")).toMatchObject({
      capabilityId: "queue.createItems",
      message: "No Queue view creation.",
      status: "passed",
    });
    expect(result(report, "queue:self-test-dry-run")).toMatchObject({
      capabilityId: "queue.selfTest",
      message: expect.stringContaining("Dry-run only"),
      status: "passed",
    });
    expect(result(report, "queue:prompt-pack-preview-dry-run")).toMatchObject({
      capabilityId: "queue.preparePromptPackPreview",
      message: "Queue dry-run preview prepared.",
      status: "passed",
    });
    expect(result(report, "queue:no-mutation")).toMatchObject({
      capabilityId: "queue.selfTest",
      message: "No Queue mutation.",
      status: "passed",
    });
    expect(result(report, "queue-dogfood-broker:summary")).toMatchObject({
      message: "Queue dogfood broker loop passed.",
      status: "passed",
      widgetId: "agent-queue",
    });
    expect(
      result(report, "queue-dogfood-broker:agent-finished-awaiting-review"),
    ).toMatchObject({
      capabilityId: "queue.lifecycle.agentFinished",
      message: "Agent finished - awaiting review.",
      status: "passed",
    });
    expect(result(report, "queue-dogfood-broker:review-message-created")).toMatchObject({
      capabilityId: "queue.review.createMessage",
      message: "Review message created.",
      status: "passed",
    });
    expect(result(report, "queue-dogfood-broker:coordinator-ack-in-review")).toMatchObject({
      capabilityId: "queue.review.ack",
      message: "Coordinator ACK - in review.",
      status: "passed",
    });
    expect(result(report, "queue-dogfood-broker:validation-approved")).toMatchObject({
      capabilityId: "queue.coordinator.approveValidation",
      message: "Validation approved.",
      status: "passed",
    });
    expect(result(report, "queue-dogfood-broker:mark-done")).toMatchObject({
      capabilityId: "queue.item.markDone",
      message: "Mark done.",
      status: "passed",
    });
    expect(
      result(report, "queue-dogfood-broker:dependent-unblocked-after-done"),
    ).toMatchObject({
      capabilityId: "queue.item.markDone",
      message: "Dependent unblocked after done.",
      status: "passed",
    });
    expect(result(report, "queue-dogfood-broker:follow-up-running")).toMatchObject({
      capabilityId: "queue.coordinator.addFollowUpPrompt",
      message: "Follow-up prompt returns to running.",
      status: "passed",
    });
    expect(
      result(report, "queue-dogfood-broker:failure-dependent-blocked"),
    ).toMatchObject({
      capabilityId: "queue.item.fail",
      message: "Failure keeps dependent blocked.",
      status: "passed",
    });
    expect(result(report, "queue-dogfood-broker:backend-durability")).toMatchObject({
      message: "Backend durability is not covered.",
      reason: "Frontend fake broker self-test only",
      status: "skipped",
    });
    expect(result(report, "queue-dogfood-broker:real-worker-execution")).toMatchObject({
      message: "Real worker execution is not covered.",
      status: "blocked",
    });
    expect(
      result(report, "queue-dogfood-broker:real-validation-execution"),
    ).toMatchObject({
      message: "Real validation execution is not covered.",
      status: "blocked",
    });
    expect(
      result(report, "queue-dogfood-broker:real-git-commit-execution"),
    ).toMatchObject({
      message: "Real Git commit execution is not covered.",
      status: "blocked",
    });
    expect(
      result(report, "queue-dogfood-broker:no-hidden-side-effects"),
    ).toMatchObject({
      message: "No hidden side effects.",
      status: "passed",
    });
    expect(
      result(report, "queue-dogfood-broker:agent-finished-awaiting-review")
        .hiddenSideEffectAssertions,
    ).toHaveLength(0);
    expect(
      result(report, "queue-dogfood-broker:no-hidden-side-effects")
        .hiddenSideEffectAssertions,
    ).toEqual(expect.arrayContaining(["No Codex run", "No Git mutation"]));
    expect(result(report, "hidden-side-effects:no-hidden-side-effects")).toMatchObject({
      message: "No hidden side effects",
      status: "passed",
    });
    expect(report.componentsChecked.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        "Agent API smoke",
        "Agent Peer SelfTest",
        "Widget Agent Contracts",
        "Agent Queue safe checks",
        "Queue dogfood broker loop",
        "Queue dogfood broker runtime gaps",
        "Hidden side-effect assertions",
      ]),
    );
    expect(report.hiddenSideEffectAssertions.every((item) => item.passed)).toBe(
      true,
    );
    expect(report.hiddenSideEffectAssertions.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        "No Codex run",
        "No shell command",
        "No Queue mutation",
        "No Queue worker start",
        "No Queue view creation",
        "No Terminal launch",
        "No Git mutation",
        "No rollback execution",
      ]),
    );
    expect(report.productFacingSummary).toContain("Agent-executed smoke completed");
    expect(report.productFacingSummary).toContain("No hidden side effects");
  });

  it("marks missing widget execution as skipped or blocked instead of false success", async () => {
    const report = (
      await runHobitAgentSmoke({
        request: createHobitAgentSmokeRequest({
          requestId: "adapter-status-smoke",
          workspaceId: "workspace_1",
        }),
      })
    ).report;

    expect(result(report, "widget-contract:skill-library:adapter")).toMatchObject({
      reason:
        "Adapter not implemented yet. Dry-run unavailable for real Knowledge / Skills APIs.",
      status: "skipped",
    });
    expect(result(report, "widget-contract:notes:adapter")).toMatchObject({
      reason: "Adapter not implemented yet. Dry-run unavailable for real Notes APIs.",
      status: "skipped",
    });
    expect(result(report, "widget-contract:terminal:adapter")).toMatchObject({
      reason:
        "Restricted capability. Runtime execution not implemented yet. Dry-run unavailable for Terminal execution.",
      status: "blocked",
    });
    expect(result(report, "widget-contract:finder-active-scope")).toMatchObject({
      reason: "Finder excluded",
      status: "skipped",
    });
  });

  it("does not run unsafe Queue mutation while collecting dry-run smoke", async () => {
    const adapter = safeFakeQueueAdapter();
    const report = (
      await runHobitAgentSmoke({
        queueAdapterApi: adapter,
        request: createHobitAgentSmokeRequest({
          requestId: "queue-dry-run-smoke",
          workspaceId: "workspace_1",
        }),
      })
    ).report;

    expect(adapter.createItems).not.toHaveBeenCalled();
    expect(adapter.importPromptPack).not.toHaveBeenCalled();
    expect(adapter.previewCreateItems).toHaveBeenCalled();
    expect(adapter.previewPromptPack).toHaveBeenCalled();
    expect(result(report, "queue:no-mutation")).toMatchObject({
      message: "No Queue mutation.",
      status: "passed",
    });
    expect(report.overallStatus).toBe("passed");
  });

  it("keeps Queue safe sub-checks visible when target adapter inspection is unavailable", async () => {
    const adapter = safeFakeQueueAdapter();
    adapter.getSingletonQueueTarget = vi.fn(() => ({
      message: "Queue adapter is not available.",
      reasons: ["Workspace Queue bridge is unavailable."],
      status: "unavailable" as const,
    }));

    const report = (
      await runHobitAgentSmoke({
        queueAdapterApi: adapter,
        request: createHobitAgentSmokeRequest({
          requestId: "queue-target-unavailable-smoke",
          workspaceId: "workspace_1",
        }),
      })
    ).report;

    expect(result(report, "queue:singleton-target")).toMatchObject({
      reason: "Adapter not available",
      status: "skipped",
    });
    expect(result(report, "queue:create-items-dry-run")).toMatchObject({
      status: "passed",
    });
    expect(result(report, "queue:no-auto-run")).toMatchObject({
      status: "passed",
    });
    expect(result(report, "queue:no-duplicate-view")).toMatchObject({
      status: "passed",
    });
    expect(result(report, "queue:prompt-pack-preview-dry-run")).toMatchObject({
      status: "passed",
    });
    expect(adapter.createItems).not.toHaveBeenCalled();
    expect(adapter.importPromptPack).not.toHaveBeenCalled();
  });
});

describe("hobitAgentSmokeRunner architecture safety", () => {
  it("keeps smoke execution on structured broker/action requests and avoids prompt regex routing", () => {
    const smokeSource = source("workbench/agents/selfTest/hobitAgentSmokeRunner.ts");
    const selfTestSources = collectSelfTestSources()
      .filter((path) => !path.endsWith(".test.ts"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(smokeSource).toContain("createActionRequest");
    expect(smokeSource).toContain("createHobitAgentActionBroker");
    expect(selfTestSources).not.toContain("new RegExp");
    expect(selfTestSources).not.toContain(".match(");
    expect(selfTestSources).not.toContain("classifyUserIntent");
    expect(selfTestSources).not.toContain(["user text", " -> regex"].join(""));
  });

  it("does not add Knowledge Notes or Terminal execution adapters in this block", () => {
    const adapterFiles = collectFiles(`${frontendRoot()}/workbench/agents/adapters`);

    expect(adapterFiles.some((path) => path.includes("knowledge"))).toBe(false);
    expect(adapterFiles.some((path) => path.includes("notes"))).toBe(false);
    expect(adapterFiles.some((path) => path.includes("terminal"))).toBe(false);
  });
});

type SmokeReport = Awaited<ReturnType<typeof runHobitAgentSmoke>>["report"];

function capabilityIds(cases: readonly { capabilityId?: string }[]) {
  return cases
    .map((item) => item.capabilityId)
    .filter((item): item is string => Boolean(item));
}

function widgetIds(cases: readonly { widgetId?: string }[]) {
  return cases
    .map((item) => item.widgetId)
    .filter((item): item is string => Boolean(item));
}

function result(report: SmokeReport, caseId: string) {
  const item = report.results.find((candidate) => candidate.caseId === caseId);
  if (!item) {
    throw new Error(`Missing smoke result: ${caseId}`);
  }

  return item;
}

function safeFakeQueueAdapter({
  supportsSafeMutationSandbox = false,
}: {
  supportsSafeMutationSandbox?: boolean;
} = {}): SafeFakeQueueAdapter {
  const base = createDefaultQueueAgentAdapterApi();

  return {
    ...base,
    createItems: vi.fn(base.createItems),
    getSingletonQueueTarget: vi.fn(base.getSingletonQueueTarget),
    importPromptPack: vi.fn(base.importPromptPack),
    previewCreateItems: vi.fn(base.previewCreateItems),
    previewPromptPack: vi.fn(base.previewPromptPack),
    supportsSafeMutationSandbox,
  };
}

type SafeFakeQueueAdapter = QueueAgentAdapterApi & {
  createItems: ReturnType<typeof vi.fn>;
  getSingletonQueueTarget: ReturnType<typeof vi.fn>;
  importPromptPack: ReturnType<typeof vi.fn>;
  previewCreateItems: ReturnType<typeof vi.fn>;
  previewPromptPack: ReturnType<typeof vi.fn>;
};

function source(path: string) {
  return readFileSync(`${frontendRoot()}/${path}`, "utf8");
}

function frontendRoot() {
  const cwd = (
    globalThis as unknown as { process: { cwd: () => string } }
  ).process.cwd();

  return `${cwd}/src`;
}

function collectSelfTestSources() {
  return collectFiles(`${frontendRoot()}/workbench/agents/selfTest`);
}

function collectFiles(path: string): string[] {
  return (readdirSync(path) as string[]).flatMap((entry: string) => {
    const fullPath = `${path}/${entry}`;
    const stat = statSync(fullPath);

    return stat.isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}
