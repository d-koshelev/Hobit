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
        "queue.selfTest",
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
      blocked: 1,
      failed: 0,
      passed: 21,
      skipped: 3,
      total: 25,
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
    expect(result(report, "queue:self-test-dry-run")).toMatchObject({
      capabilityId: "queue.selfTest",
      message: expect.stringContaining("Dry-run only"),
      status: "passed",
    });
    expect(result(report, "queue:safe-mutation-sandbox")).toMatchObject({
      status: "passed",
    });
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
    expect(result(report, "queue:safe-mutation-sandbox")).toMatchObject({
      reason: "Dry-run only",
      status: "skipped",
    });
    expect(report.overallStatus).toBe("passed");
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
    importPromptPack: vi.fn(base.importPromptPack),
    previewCreateItems: vi.fn(base.previewCreateItems),
    supportsSafeMutationSandbox,
  };
}

type SafeFakeQueueAdapter = QueueAgentAdapterApi & {
  createItems: ReturnType<typeof vi.fn>;
  importPromptPack: ReturnType<typeof vi.fn>;
  previewCreateItems: ReturnType<typeof vi.fn>;
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
