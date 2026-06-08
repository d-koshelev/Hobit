import { describe, expect, it } from "vitest";

import type {
  AgentRunEvent,
  AgentRunMetadata,
  AgentRunRequest,
} from "./agentRuntimeTypes";
import {
  agentRunLifecycleLabel,
  createMockProviderCapabilities,
  groupAgentRunEventsByRun,
  summarizeAgentRunMetadata,
  validateAgentRunRequest,
} from "./agentRuntimeModel";

describe("agentRuntimeModel", () => {
  it("creates safe mock provider capability defaults", () => {
    const capabilities = createMockProviderCapabilities("mock-local");

    expect(capabilities.providerId).toBe("mock-local");
    expect(capabilities.defaultMode).toBe("review");
    expect(capabilities.supportedModes).toEqual(["review", "direct", "queue"]);
    expect(capabilities.toolPolicy).toEqual({
      allowedTools: [],
      mode: "none",
      requiresOperatorApproval: true,
    });
    expect(capabilities.sandboxPolicy.network).toBe("none");
    expect(capabilities.supportsTokenUsage).toBe(false);
  });

  it("formats lifecycle labels", () => {
    expect(agentRunLifecycleLabel("draft")).toBe("Draft");
    expect(agentRunLifecycleLabel("awaiting-review")).toBe("Awaiting review");
    expect(agentRunLifecycleLabel("completed")).toBe("Completed");
    expect(agentRunLifecycleLabel("failed")).toBe("Failed");
  });

  it("groups run events by run and preserves event order", () => {
    const groups = groupAgentRunEventsByRun([
      runEvent({ id: "run-b-2", lifecycle: "completed", runId: "run-b", timestampMs: 20 }),
      runEvent({ id: "run-a-2", lifecycle: "running", runId: "run-a", sequence: 2, timestampMs: 10 }),
      runEvent({ id: "run-a-1", lifecycle: "starting", runId: "run-a", sequence: 1, timestampMs: 10 }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.runId).toBe("run-a");
    expect(groups[0]?.events.map((event) => event.id)).toEqual([
      "run-a-1",
      "run-a-2",
    ]);
    expect(groups[0]?.latestLifecycle).toBe("running");
    expect(groups[1]?.runId).toBe("run-b");
    expect(groups[1]?.latestLifecycle).toBe("completed");
  });

  it("validates request basics without executing anything", () => {
    const capabilities = createMockProviderCapabilities();
    const validRequest = runRequest();

    expect(validateAgentRunRequest(validRequest, capabilities)).toEqual({
      errors: [],
      valid: true,
    });

    const invalidRequest = runRequest({
      prompt: " ",
      toolPolicy: {
        allowedTools: ["shell"],
        mode: "none",
        requiresOperatorApproval: true,
      },
      workspaceId: "",
    });

    expect(validateAgentRunRequest(invalidRequest, capabilities)).toEqual({
      errors: [
        "Workspace id is required.",
        "Prompt is required.",
        "Tool policy cannot allow tools when mode is none.",
      ],
      valid: false,
    });
  });

  it("does not invent token counts when usage is unavailable", () => {
    expect(
      summarizeAgentRunMetadata(
        runMetadata({
          tokenUsage: null,
        }),
      ).tokenUsageLabel,
    ).toBeNull();

    expect(
      summarizeAgentRunMetadata(
        runMetadata({
          tokenUsage: {},
        }),
      ).tokenUsageLabel,
    ).toBeNull();
  });
});

function runEvent(overrides: Partial<AgentRunEvent> = {}): AgentRunEvent {
  return {
    id: "event-1",
    kind: "provider_started",
    lifecycle: "starting",
    runId: "run-1",
    sequence: 1,
    timestampMs: 1_000,
    title: "Started",
    ...overrides,
  };
}

function runMetadata(
  overrides: Partial<AgentRunMetadata> = {},
): AgentRunMetadata {
  return {
    lifecycle: "completed",
    mode: "direct",
    providerId: "mock",
    runId: "run-1",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function runRequest(overrides: Partial<AgentRunRequest> = {}): AgentRunRequest {
  return {
    createdAtMs: 1_000,
    id: "request-1",
    mode: "direct",
    prompt: "Review the visible changes.",
    providerId: "mock",
    sandboxPolicy: {
      filesystem: "visible-context-only",
      network: "none",
      requiresExplicitWorkspace: true,
    },
    toolPolicy: {
      allowedTools: [],
      mode: "none",
      requiresOperatorApproval: true,
    },
    workspaceId: "workspace-1",
    ...overrides,
  };
}
