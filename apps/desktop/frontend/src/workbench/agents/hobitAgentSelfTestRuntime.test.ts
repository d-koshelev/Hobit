import { describe, expect, it } from "vitest";

import {
  createHobitAgentCapabilityRegistry,
  findCapability,
  requiresDryRun,
} from "./hobitAgentCapabilityRuntime";
import {
  createSelfTestCase,
  createSelfTestInstruction,
  createSelfTestReport,
  createSelfTestRequest,
  createSelfTestResultForCapability,
  listAgentSelfTestCapabilityIds,
  summarizeSelfTestReport,
  type HobitAgentSelfTestResult,
} from "./hobitAgentSelfTestRuntime";

describe("hobitAgentSelfTestRuntime", () => {
  it("creates the self-test instruction without shell or Codex permission creep", () => {
    const instruction = createSelfTestInstruction();

    expect(instruction.id).toBe("hobit.agent.selfTest");
    expect(instruction.body).toContain("Check every capability available to you");
    expect(instruction.body).toContain("Use dry-run or safe mode");
    expect(instruction.body).toContain("Do not perform hidden side effects");
    expect(instruction.body).toContain("Do not call shell or Codex");
  });

  it("lists self-test capabilities available to Workspace Agent", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const capabilityIds = listAgentSelfTestCapabilityIds(
      registry,
      "workspace_agent",
    );

    expect(capabilityIds).toContain("queue.selfTest");
    expect(capabilityIds).toContain("workspaceAgent.selfTest");
    expect(capabilityIds).toContain("queue.createItems");
    expect(capabilityIds).not.toContain("codex.runTask");
    expect(capabilityIds).not.toContain("workspace.shell.runCommand");
  });

  it("creates self-test requests and cases for available capabilities", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const request = createSelfTestRequest({
      agentRoleId: "workspace_agent",
      registry,
    });
    const testCase = createSelfTestCase({
      capabilityId: "queue.createItems",
    });

    expect(request.dryRun).toBe(true);
    expect(request.capabilityIds).toContain("queue.createItems");
    expect(request.capabilityIds).toContain("codex.runTask");
    expect(request.capabilityIds).not.toContain("workspace.shell.runCommand");
    expect(testCase).toEqual({
      capabilityId: "queue.createItems",
      caseId: "queue.createItems:self-test",
      dryRun: true,
      expectedAvailable: true,
    });
  });

  it("supports passed, failed, skipped, and blocked self-test results", () => {
    const results: HobitAgentSelfTestResult[] = [
      result("queue.selfTest", "passed"),
      result("workspaceAgent.selfTest", "failed"),
      result("codex.runTask", "skipped"),
      result("queue.importPromptPack", "blocked"),
    ];
    const report = createSelfTestReport({
      request: {
        agentRoleId: "workspace_agent",
        capabilityIds: results.map((item) => item.capabilityId),
        dryRun: true,
        requestId: "self-test-request",
      },
      results,
    });

    expect(report.summary).toEqual({
      blocked: 1,
      failed: 1,
      hiddenSideEffectFlags: 0,
      passed: 1,
      skipped: 1,
      total: 4,
    });
    expect(summarizeSelfTestReport(report)).toEqual(report.summary);
  });

  it("blocks side-effecting self-tests unless dry-run or a safe test sandbox is used", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const capability = findCapability(registry, "queue.createItems");
    if (!capability) {
      throw new Error("Missing queue.createItems");
    }

    const blocked = createSelfTestResultForCapability({
      agentRoleId: "workspace_agent",
      capabilityId: "queue.createItems",
      dryRun: false,
      registry,
    });
    const passed = createSelfTestResultForCapability({
      agentRoleId: "workspace_agent",
      capabilityId: "queue.createItems",
      dryRun: true,
      registry,
    });

    expect(requiresDryRun(capability)).toBe(true);
    expect(blocked).toMatchObject({
      capabilityId: "queue.createItems",
      dryRun: false,
      status: "blocked",
    });
    expect(passed).toMatchObject({
      capabilityId: "queue.createItems",
      dryRun: true,
      hiddenSideEffectFlags: [],
      status: "passed",
    });
  });

  it("represents skipped, blocked, and hidden side-effect flags without app mutation", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const before = JSON.stringify(registry);
    const skipped = createSelfTestResultForCapability({
      agentRoleId: "workspace_agent",
      capabilityId: "codex.runTask",
      dryRun: true,
      registry,
    });
    const unavailable = createSelfTestResultForCapability({
      agentRoleId: "workspace_agent",
      capabilityId: "workspace.shell.runCommand",
      dryRun: true,
      expectedAvailable: false,
      registry,
    });
    const report = createSelfTestReport({
      request: createSelfTestRequest({
        agentRoleId: "workspace_agent",
        capabilityIds: ["codex.runTask", "workspace.shell.runCommand"],
        registry,
      }),
      results: [
        {
          ...skipped,
          hiddenSideEffectFlags: ["restricted_execute_capability"],
        },
        unavailable,
      ],
    });

    expect(skipped.status).toBe("skipped");
    expect(unavailable.status).toBe("skipped");
    expect(report.summary.hiddenSideEffectFlags).toBe(1);
    expect(JSON.stringify(registry)).toBe(before);
  });
});

function result(
  capabilityId: string,
  status: HobitAgentSelfTestResult["status"],
): HobitAgentSelfTestResult {
  return {
    capabilityId,
    caseId: `${capabilityId}:case`,
    dryRun: true,
    hiddenSideEffectFlags: [],
    message: `${capabilityId} ${status}`,
    status,
  };
}
