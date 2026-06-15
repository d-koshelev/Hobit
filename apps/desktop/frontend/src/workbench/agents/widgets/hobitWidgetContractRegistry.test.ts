// @ts-expect-error Node types are intentionally absent from the frontend tsconfig; this test reads source in Vitest only.
import { readdirSync, readFileSync, statSync } from "fs";

import { describe, expect, it } from "vitest";

import {
  findWidgetContract,
  FUTURE_WIDGET_AGENT_CONTRACT_PLACEHOLDERS,
  listWidgetContracts,
} from "./hobitWidgetContractRegistry";

describe("hobitWidgetContractRegistry", () => {
  it("returns Queue and Workspace Agent contracts from the active registry", () => {
    const contracts = listWidgetContracts();
    const ids = contracts.map((contract) => contract.widgetId);

    expect(ids).toEqual(["agent-queue", "interactive-agent"]);
    expect(findWidgetContract("agent-queue").status).toBe("found");
    expect(findWidgetContract("interactive-agent").status).toBe("found");
  });

  it("discovers the Agent Queue / QueueV2 contract honestly", () => {
    const lookup = findWidgetContract("agent-queue");
    expect(lookup.status).toBe("found");
    if (lookup.status !== "found") {
      return;
    }

    const contract = lookup.contract;
    const capabilityIds = contract.capabilities.map(
      (capability) => capability.capabilityId,
    );
    const createItems = requiredCapability(contract, "queue.createItems");
    const promptPackPreview = requiredCapability(
      contract,
      "queue.preparePromptPackPreview",
    );
    const promptPackImport = requiredCapability(
      contract,
      "queue.importPromptPack",
    );

    expect(contract.productDescription).toContain("singleton workspace Queue");
    expect(contract.productDescription).toContain("creates and imports Queue items");
    expect(contract.productDescription).toContain("task states and dependencies");
    expect(contract.productDescription).toContain("Smart Queue status");
    expect(contract.productDescription).toContain("rollback proposal views");
    expect(capabilityIds).toContain("queue.createItems");
    expect(capabilityIds).toContain("queue.preparePromptPackPreview");
    expect(capabilityIds).toContain("queue.importPromptPack");
    expect(capabilityIds).toContain("queue.selfTest");
    expect(promptPackPreview.supportsDryRun).toBe(true);
    expect(promptPackPreview.supportsPreview).toBe(true);
    expect(promptPackImport.confirmationRequirement).toBe("required");
    expect(createItems.sideEffectLevel).toBe("write");
    expect(createItems.forbiddenSideEffects).toContain("duplicate_queue_view");
    expect(createItems.forbiddenSideEffects).toContain("auto_run_workers");
    expect(createItems.forbiddenSideEffects).toContain("queue_autorun");
    expect(contract.capabilities.map((capability) => capability.capabilityId)).not.toContain(
      "queue.rollback.execute",
    );
    expect(contract.productDescription).toContain(
      "rollback execution is not implemented",
    );
    expect(contract.productDescription).toContain(
      "Backend durable scheduler/persistence is not implemented",
    );
  });

  it("discovers the Workspace Agent contract with product-action orchestrator boundaries", () => {
    const lookup = findWidgetContract("interactive-agent");
    expect(lookup.status).toBe("found");
    if (lookup.status !== "found") {
      return;
    }

    const contract = lookup.contract;
    const capabilityIds = contract.capabilities.map(
      (capability) => capability.capabilityId,
    );
    const submit = requiredCapability(contract, "workspaceAgent.message.submit");
    const codex = requiredCapability(contract, "codex.runTask");

    expect(contract.productDescription).toContain("in-app agent surface");
    expect(contract.productDescription).toContain("transcript, composer, and activity");
    expect(contract.productDescription).toContain("Hobit app context");
    expect(contract.productDescription).toContain("capability manifest");
    expect(contract.productDescription).toContain("product-action orchestrator first");
    expect(contract.productDescription).toContain("restricted capabilities");
    expect(contract.productDescription).toContain("Full Action Broker execution is not implemented");
    expect(contract.productDescription).toContain("hard Stop behavior may remain unavailable");
    expect(capabilityIds).toContain("workspaceAgent.selfTest");
    expect(capabilityIds).toContain("workspaceAgent.capabilities.read");
    expect(capabilityIds).toContain("workspaceAgent.context.read");
    expect(capabilityIds).toContain("workspaceAgent.activity.read");
    expect(capabilityIds).toContain("workspaceAgent.message.submit");
    expect(submit.description).toContain("typed capabilities");
    expect(submit.description).toContain("not regex-routed");
    expect(submit.forbiddenSideEffects).toContain("regex_product_action_routing");
    expect(codex.capabilityId).toBe("codex.runTask");
    expect(codex.sideEffectLevel).toBe("execute");
    expect(codex.confirmationRequirement).toBe("required");
    expect(codex.description).toContain("not the default path");
  });

  it("does not claim regex routing as the Workspace Agent architecture", () => {
    const lookup = findWidgetContract("interactive-agent");
    expect(lookup.status).toBe("found");
    if (lookup.status !== "found") {
      return;
    }

    const serialized = JSON.stringify(lookup.contract).toLowerCase();

    expect(serialized).not.toContain(["user text", " -> regex"].join(""));
    expect(serialized).not.toContain(["regex", " classifier"].join(""));
    expect(serialized).not.toContain("phrase route");
    expect(serialized).toContain("not regex-routed");
  });

  it("does not describe Codex or shell as default product-action paths", () => {
    const lookup = findWidgetContract("interactive-agent");
    expect(lookup.status).toBe("found");
    if (lookup.status !== "found") {
      return;
    }

    const serialized = JSON.stringify(lookup.contract).toLowerCase();

    expect(serialized).toContain("restricted explicit codex");
    expect(serialized).toContain("not the default path");
    expect(serialized).not.toContain("shell as default");
    expect(serialized).not.toContain("codex as default");
    expect(serialized).not.toContain("default shell");
    expect(serialized).not.toContain("default codex");
  });

  it("returns unavailable self-test evidence for a missing widget contract", () => {
    const lookup = findWidgetContract("missing-widget");

    expect(lookup).toMatchObject({
      status: "unavailable",
      widgetId: "missing-widget",
    });
    expect(lookup.status).toBe("unavailable");
    if (lookup.status !== "unavailable") {
      return;
    }

    expect(lookup.unavailableReason).toContain("not registered");
    expect(lookup.selfTestReport.summary).toEqual({
      blocked: 0,
      failed: 0,
      passed: 0,
      skipped: 1,
      total: 1,
    });
    expect(lookup.selfTestReport.results[0]?.status).toBe("skipped");
  });

  it("excludes Finder from the current active Widget Agent Contract registry", () => {
    expect(listWidgetContracts().map((contract) => contract.widgetId)).not.toContain(
      "finder",
    );
    expect(findWidgetContract("finder").status).toBe("unavailable");
  });

  it("marks future placeholder widgets as skipped and not implemented", () => {
    expect(FUTURE_WIDGET_AGENT_CONTRACT_PLACEHOLDERS.map((item) => item.widgetId)).toEqual([
      "skill-library",
      "notes",
      "terminal",
    ]);

    for (const placeholder of FUTURE_WIDGET_AGENT_CONTRACT_PLACEHOLDERS) {
      expect(placeholder.availability.status).toBe("unavailable");
      expect(placeholder.availability.unavailableReason).toContain(
        "not implemented",
      );
      expect(placeholder.selfTestCases[0]?.expectedResultDescription).toContain(
        "Skipped",
      );
    }

    const lookup = findWidgetContract("notes", { includePlaceholders: true });
    expect(lookup.status).toBe("unavailable");
    if (lookup.status === "unavailable") {
      expect(lookup.selfTestReport.results[0]?.status).toBe("skipped");
    }
  });

  it("does not introduce regex routing in the agent widgets contract modules", () => {
    const widgetAgentSources = collectAgentWidgetSources()
      .filter((path) => !path.endsWith(".test.ts"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(widgetAgentSources).not.toContain("new RegExp");
    expect(widgetAgentSources).not.toContain("match(");
    expect(widgetAgentSources).not.toContain(["regex", " classifier"].join(""));
    expect(widgetAgentSources).not.toContain(["user text", " -> regex"].join(""));
    expect(widgetAgentSources).not.toContain("product action regex");
  });

  it("does not assert user text to regex to product action behavior", () => {
    const testSources = collectAgentWidgetSources()
      .filter((path) => path.endsWith(".test.ts"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(testSources).not.toContain(
      ["user text", " - regex - ", "product action"].join(""),
    );
    expect(testSources).not.toContain(["regex", " classifier"].join(""));
  });
});

function requiredCapability(
  contract: Extract<ReturnType<typeof findWidgetContract>, { status: "found" }>["contract"],
  capabilityId: string,
) {
  const capability = contract.capabilities.find(
    (candidate) => candidate.capabilityId === capabilityId,
  );
  if (!capability) {
    throw new Error(`Missing capability ${capabilityId}`);
  }
  return capability;
}

function collectAgentWidgetSources() {
  const cwd = (
    globalThis as unknown as { process: { cwd: () => string } }
  ).process.cwd();
  const root = `${cwd}/src/workbench/agents/widgets`;

  return collectFiles(root);
}

function collectFiles(path: string): string[] {
  return (readdirSync(path) as string[]).flatMap((entry: string) => {
    const fullPath = `${path}/${entry}`;
    const stat = statSync(fullPath);

    return stat.isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}
