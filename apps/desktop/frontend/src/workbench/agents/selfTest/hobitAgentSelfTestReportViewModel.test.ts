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
    expect(report.overallStatus).toBe("passed");
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
    expect(row(report, "widget-contract:skill-library")).toMatchObject({
      message: "Knowledge / Skills contract is available.",
      status: "passed",
      widgetId: "skill-library",
    });
    expect(row(report, "widget-contract:notes")).toMatchObject({
      message: "Notes contract is available.",
      status: "passed",
      widgetId: "notes",
    });
    expect(row(report, "widget-contract:terminal")).toMatchObject({
      message: "Terminal contract is available.",
      status: "passed",
      widgetId: "terminal",
    });
    expect(row(report, "widget-contract:finder-active-scope")).toMatchObject({
      message: "Finder excluded.",
      reason: "Finder excluded",
      status: "skipped",
    });
  });

  it("shows Knowledge, Notes, and Terminal adapter execution as skipped or blocked", async () => {
    const report = await runWorkspaceAgentSelfTestReport({
      reportId: "adapter-report",
      widgetInstanceId: "workspace-agent-1",
      workspaceId: "workspace_1",
    });

    expect(row(report, "widget-contract:skill-library:adapter")).toMatchObject({
      message:
        "Knowledge / Skills adapter execution is not implemented yet. Self-test metadata only.",
      reason:
        "Adapter not implemented yet. Dry-run unavailable for real Knowledge / Skills APIs.",
      status: "skipped",
      widgetId: "skill-library",
    });
    expect(row(report, "widget-contract:notes:adapter")).toMatchObject({
      message:
        "Notes adapter execution is not implemented yet. Self-test metadata only.",
      reason: "Adapter not implemented yet. Dry-run unavailable for real Notes APIs.",
      status: "skipped",
      widgetId: "notes",
    });
    expect(row(report, "widget-contract:terminal:adapter")).toMatchObject({
      message:
        "Terminal adapter execution is restricted and not implemented yet. Self-test does not execute commands.",
      reason:
        "Restricted capability. Runtime execution not implemented yet. Dry-run unavailable for Terminal execution.",
      status: "blocked",
      widgetId: "terminal",
    });
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
      message: "No hidden side effects",
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
