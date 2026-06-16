import { describe, expect, it } from "vitest";

import {
  assertWidgetContractHasSelfTest,
  createWidgetAgentContract,
  createWidgetCapabilityContract,
  createWidgetSelfTestInstruction,
  createWidgetSelfTestReport,
  listWidgetCapabilities,
  listWidgetSelfTestCases,
  summarizeWidgetSelfTestReport,
  type HobitWidgetSelfTestResult,
} from "./hobitWidgetAgentContract";

describe("hobitWidgetAgentContract model", () => {
  it("creates a widget contract with deterministic capabilities and self-tests", () => {
    const contract = createWidgetAgentContract({
      availability: { status: "available" },
      capabilities: [
        capability("example.write"),
        capability("example.read", "read"),
      ],
      expectedResultDescription: "Example self-test returns structured evidence.",
      hiddenSideEffectAssertions: ["no_hidden_mutation"],
      ownerModule: "workbench/agents/widgets",
      ownerSurface: "Example",
      productDescription: "Example product surface.",
      selfTestCases: [
        {
          capabilityId: "example.selfTest",
          caseId: "example:self-test",
          expectedResultDescription: "Self-test passes with no mutation.",
          hiddenSideEffectAssertions: ["no_hidden_mutation"],
          title: "Example Self-Test",
        },
      ],
      selfTestInstruction: createWidgetSelfTestInstruction({
        body: "Run example self-test in dry-run mode.",
        id: "example.selfTest",
        title: "Example self-test",
      }),
      title: "Example",
      widgetId: "example",
    });

    expect(contract.widgetId).toBe("example");
    expect(listWidgetCapabilities(contract).map((item) => item.capabilityId)).toEqual([
      "example.read",
      "example.write",
    ]);
    expect(listWidgetSelfTestCases(contract)).toHaveLength(1);
    expect(assertWidgetContractHasSelfTest(contract)).toBe(true);
  });

  it("creates a capability contract with policy, schema, audit, and side-effect metadata", () => {
    const created = createWidgetCapabilityContract({
      auditEventNames: ["example.done", "example.requested"],
      availability: { status: "available" },
      capabilityId: "example.create",
      confirmationRequirement: "required",
      description: "Create an example record.",
      forbiddenSideEffects: ["hidden_execution", "duplicate_view"],
      inputSchemaDescription: "Example title and body.",
      outputSchemaDescription: "Created example record and audit id.",
      restricted: false,
      sideEffectLevel: "write",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Create Example",
    });

    expect(created).toMatchObject({
      capabilityId: "example.create",
      confirmationRequirement: "required",
      sideEffectLevel: "write",
      supportsDryRun: true,
      supportsPreview: true,
    });
    expect(created.inputSchemaDescription).toContain("title");
    expect(created.outputSchemaDescription).toContain("audit");
    expect(created.forbiddenSideEffects).toContain("hidden_execution");
    expect(created.auditEventNames).toEqual(["example.done", "example.requested"]);
  });

  it("summarizes passed, failed, skipped, and blocked self-test report results", () => {
    const results: HobitWidgetSelfTestResult[] = [
      result("a", "passed"),
      result("b", "failed"),
      result("c", "skipped"),
      result("d", "blocked"),
    ];
    const report = createWidgetSelfTestReport({
      instruction: createWidgetSelfTestInstruction({
        body: "Run structured tests.",
        id: "example.selfTest",
        title: "Example self-test",
      }),
      results,
      widgetId: "example",
    });

    expect(report.summary).toEqual({
      blocked: 1,
      failed: 1,
      passed: 1,
      skipped: 1,
      total: 4,
    });
    expect(summarizeWidgetSelfTestReport(report)).toEqual(report.summary);
    expect(summarizeWidgetSelfTestReport(results)).toEqual(report.summary);
  });

  it("represents hidden side-effect assertions in cases and evidence", () => {
    const caseAssertions = [
      "no_hidden_context_read",
      "no_hidden_mutation",
    ];
    const report = createWidgetSelfTestReport({
      instruction: createWidgetSelfTestInstruction({
        body: "Check hidden side effects.",
        id: "example.selfTest",
        title: "Example self-test",
      }),
      results: [
        {
          caseId: "example:hidden-effects",
          evidence: ["Dry-run model only."],
          hiddenSideEffectAssertions: caseAssertions,
          message: "No hidden side effects were represented.",
          status: "passed",
        },
      ],
      widgetId: "example",
    });

    expect(report.results[0]?.hiddenSideEffectAssertions).toEqual(caseAssertions);
    expect(report.results[0]?.evidence).toContain("Dry-run model only.");
  });

  it("treats a widget without self-test instruction as incomplete", () => {
    expect(() =>
      createWidgetAgentContract({
        availability: { status: "available" },
        capabilities: [],
        expectedResultDescription: "Missing self-test.",
        hiddenSideEffectAssertions: [],
        ownerModule: "workbench/agents/widgets",
        ownerSurface: "Incomplete",
        productDescription: "Incomplete product surface.",
        selfTestCases: [],
        selfTestInstruction: createWidgetSelfTestInstruction({
          body: "",
          id: "incomplete.selfTest",
          title: "Incomplete self-test",
        }),
        title: "Incomplete",
        widgetId: "incomplete",
      }),
    ).toThrow("missing a self-test instruction");
  });
});

function capability(
  capabilityId: string,
  sideEffectLevel: "read" | "write" = "write",
) {
  return createWidgetCapabilityContract({
    auditEventNames: [`${capabilityId}.requested`],
    availability: { status: "available" },
    capabilityId,
    confirmationRequirement: sideEffectLevel === "read" ? "none" : "recommended",
    description: `${capabilityId} capability.`,
    forbiddenSideEffects: ["hidden_execution"],
    inputSchemaDescription: `${capabilityId} input.`,
    outputSchemaDescription: `${capabilityId} output.`,
    restricted: false,
    sideEffectLevel,
    supportsDryRun: true,
    supportsPreview: true,
    title: capabilityId,
  });
}

function result(
  caseId: string,
  status: HobitWidgetSelfTestResult["status"],
): HobitWidgetSelfTestResult {
  return {
    caseId,
    evidence: [`${caseId} evidence`],
    hiddenSideEffectAssertions: [],
    message: `${caseId} ${status}`,
    status,
  };
}
