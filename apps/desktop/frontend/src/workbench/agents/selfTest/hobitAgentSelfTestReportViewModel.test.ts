import { describe, expect, it, vi } from "vitest";

import {
  createDefaultQueueAgentAdapterApi,
  type QueueAgentAdapterApi,
} from "../adapters";
import {
  runWorkspaceAgentSelfTestReport,
} from "./hobitAgentSelfTestReportViewModel";

describe("hobitAgentSelfTestReportViewModel", () => {
  it("runs safe Workspace Agent self-test checks over agent APIs and widget contracts", async () => {
    const report = await runWorkspaceAgentSelfTestReport({
      createdAt: "2026-06-15T10:00:00.000Z",
      reportId: "self-test-report",
      widgetInstanceId: "workspace-agent-1",
      workspaceId: "workspace_1",
      workspaceRoot: "C:/repo",
    });

    expect(report.summary.total).toBeGreaterThan(10);
    expect(report.summary.failed).toBe(0);
    expect(report.productSummary).toContain("passed");
    expect(report.productSummary).toContain("skipped");
    expect(report.productSummary).toContain("blocked");
    expect(report.hiddenSideEffectSummary).toBe("No hidden side effects");
    expect(report.hiddenSideEffectAssertions.every((item) => item.passed)).toBe(
      true,
    );

    expect(capabilityIds(report)).toEqual(
      expect.arrayContaining([
        "agent.status.read",
        "agent.history.read",
        "agent.message.send",
        "agent.capabilities.read",
        "agent.selfTest.run",
        "queue.selfTest",
        "codex.runTask",
        "workspace.shell.runCommand",
      ]),
    );
    expect(row(report, "app-context:hobit")).toMatchObject({
      message: "App context exists and identifies Hobit.",
      status: "passed",
    });
    expect(row(report, "workspace-agent:capability-context")).toMatchObject({
      status: "passed",
    });
    expect(row(report, "capability-manifest:available")).toMatchObject({
      status: "passed",
    });
    expect(row(report, "widget-contract:agent-queue")).toMatchObject({
      status: "passed",
      widgetId: "agent-queue",
    });
    expect(row(report, "widget-contract:interactive-agent")).toMatchObject({
      status: "passed",
      widgetId: "interactive-agent",
    });
    expect(row(report, "widget-contract:finder-active-scope")).toMatchObject({
      message: "Finder is not in active contract scope.",
      status: "skipped",
    });
  });

  it("shows unavailable placeholder widgets with product-facing skipped reasons", async () => {
    const report = await runWorkspaceAgentSelfTestReport({
      reportId: "placeholder-report",
      widgetInstanceId: "workspace-agent-1",
      workspaceId: "workspace_1",
    });

    for (const widgetId of ["skill-library", "notes", "terminal"]) {
      expect(row(report, `widget-contract:${widgetId}`)).toMatchObject({
        message: "Capability unavailable.",
        reason: "Capability unavailable. Not implemented yet.",
        status: "skipped",
        widgetId,
      });
    }
  });

  it("keeps Queue self-test dry-run free of mutations and restricted execution", async () => {
    const base = createDefaultQueueAgentAdapterApi();
    const createItems = vi.fn(base.createItems);
    const importPromptPack = vi.fn(base.importPromptPack);
    const adapter: QueueAgentAdapterApi = {
      ...base,
      createItems,
      importPromptPack,
    };

    const report = await runWorkspaceAgentSelfTestReport({
      queueAdapterApi: adapter,
      reportId: "safety-report",
      widgetInstanceId: "workspace-agent-1",
      workspaceId: "workspace_1",
    });

    expect(createItems).not.toHaveBeenCalled();
    expect(importPromptPack).not.toHaveBeenCalled();
    expect(row(report, "queue:self-test-dry-run")).toMatchObject({
      capabilityId: "queue.selfTest",
      message: expect.stringContaining("Dry-run only"),
      status: "passed",
    });
    expect(row(report, "capability:codex-restricted")).toMatchObject({
      capabilityId: "codex.runTask",
      message: "Codex capability is restricted.",
      status: "passed",
    });
    expect(row(report, "capability:shell-restricted")).toMatchObject({
      capabilityId: "workspace.shell.runCommand",
      message: "Shell capability is restricted and unavailable.",
      status: "passed",
    });
    expect(row(report, "hidden-side-effects:no-hidden-side-effects")).toMatchObject({
      message: "No hidden side effects.",
      status: "passed",
    });
  });
});

type SelfTestReport = Awaited<ReturnType<typeof runWorkspaceAgentSelfTestReport>>;

function capabilityIds(report: SelfTestReport) {
  return report.rows
    .map((item) => item.capabilityId)
    .filter((item): item is string => Boolean(item));
}

function row(report: SelfTestReport, checkId: string) {
  const result = report.rows.find((item) => item.checkId === checkId);
  if (!result) {
    throw new Error(`Missing self-test row: ${checkId}`);
  }

  return result;
}
