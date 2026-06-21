import recorderEventFactorySource from "./agentActivityEventFactory.ts?raw";
import recorderSource from "./agentActivityRecorder.ts?raw";
import recorderMessagesSource from "./agentActivityMessages.ts?raw";

import { describe, expect, it } from "vitest";

import type { DirectWorkStreamEvent } from "../../workspace/types";
import { createActionResult } from "../agents/broker";
import { HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE } from "../agents/broker";
import type { WorkspaceAgentRunMetadata } from "../workspaceAgentRunMetadata";
import {
  classifyAgentProtocolRuntimeOutput,
  recordAgentActivity,
  workspaceAgentHobitActionResultMessage,
} from ".";
import type { WorkspaceAgentBrokerPolicyDiagnostics } from "../workspaceAgentBrokerContinuation";

describe("AgentActivityRecorder", () => {
  it("formats provider final answers as the existing assistant transcript intent", () => {
    const recorded = record({
      finalAnswer: "Fake provider final answer.",
      runMetadata: runMetadata(),
      runId: "run-1",
      type: "provider_final_answer",
    });

    expect(recorded.transcriptAppends).toEqual([
      {
        body: "Fake provider final answer.",
        kind: "assistant",
        runMetadata: runMetadata(),
        status: "completed",
        useDirectBody: true,
      },
    ]);
    expect(recorded.activityAppends).toEqual([]);
  });

  it("formats provider error events as error activity and log intents", () => {
    const recorded = record({
      message: "Fake provider failed.",
      runId: "run-error",
      runMetadata: runMetadata({ status: "failed" }),
      type: "provider_error",
    });

    expect(recorded.activityAppends).toEqual([
      expect.objectContaining({
        lifecycleStage: "failed",
        runId: "run-error",
        severity: "error",
        status: "failed",
        summary: "Fake provider failed.",
        title: "Failed run",
      }),
    ]);
    expect(recorded.logAppends).toEqual([
      { kind: "local", text: "Fake provider failed." },
    ]);
    expect(recorded.notices).toEqual(
      expect.arrayContaining([
        { kind: "direct_work_error", value: "Fake provider failed." },
      ]),
    );
  });

  it("maps provider stream final events into the same completed run activity and log", () => {
    const recorded = record({
      streamEvent: streamEvent({
        eventKind: "completed",
        finalStatus: "completed",
        isFinal: true,
      }),
      type: "provider_stream_event",
    });

    expect(recorded.activityAppends).toEqual([
      expect.objectContaining({
        lifecycleStage: "completed",
        severity: "success",
        status: "completed",
        summary: "Agent run completed.",
        title: "Completed run",
      }),
    ]);
    expect(recorded.logAppends).toEqual([
      { kind: "completed", text: "Run ended with completed." },
    ]);
  });

  it("formats invalid action requests as protocol error activity and transcript intents", () => {
    const outcome = classifyAgentProtocolRuntimeOutput({
      mode: "typed_capability_action",
      text: JSON.stringify({
        capabilityId: "queue.items.list",
        dryRun: false,
        type: "hobit.action.request",
      }),
    });

    expect(outcome.kind).toBe("invalid_action_request");
    if (outcome.kind !== "invalid_action_request") {
      throw new Error("Expected invalid action request.");
    }

    const recorded = record({
      actionIndex: 1,
      reasons: outcome.actionRequestRead.reasons,
      runId: "chain-invalid-action",
      runMetadata: runMetadata({ status: "failed" }),
      type: "invalid_action_request",
    });

    expect(recorded.notices).toContainEqual({
      kind: "direct_work_error",
      value: "Invalid Hobit action request. input is required.",
    });
    expect(recorded.activityAppends[0]).toMatchObject({
      severity: "error",
      status: "failed",
      title: "Invalid Hobit action request",
    });
    expect(recorded.transcriptAppends[0]?.body).toContain(
      "Action 1/16: invalid",
    );
    expect(recorded.transcriptAppends[0]?.body).toContain(
      "Stopped: invalid or unsupported action envelope.",
    );
  });

  it("formats invalid workflow requests with existing workflow validation copy", () => {
    const outcome = classifyAgentProtocolRuntimeOutput({
      mode: "typed_capability_action",
      text: JSON.stringify({
        inputs: {},
        moduleId: "queue",
        type: HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
        workflowId: "dependency_acceptance_smoke",
      }),
    });

    expect(outcome.kind).toBe("invalid_workflow_request");
    if (outcome.kind !== "invalid_workflow_request") {
      throw new Error("Expected invalid workflow request.");
    }

    const recorded = record({
      actionIndex: 1,
      reasons: outcome.workflowRequestRead.reasons,
      runId: "chain-invalid-workflow",
      runMetadata: runMetadata({ status: "failed" }),
      type: "invalid_workflow_request",
    });

    expect(recorded.notices).toContainEqual({
      kind: "direct_work_error",
      value: "Invalid Hobit workflow request. $.requestId: requestId is required.",
    });
    expect(recorded.activityAppends[0]).toMatchObject({
      title: "Invalid Hobit workflow request",
    });
    expect(recorded.transcriptAppends[0]?.body).toContain(
      "Action 1/16: workflow",
    );
  });

  it("formats mixed action/workflow requests as rejected workflow activity", () => {
    const outcome = classifyAgentProtocolRuntimeOutput({
      mode: "typed_capability_action",
      text: [
        JSON.stringify(workflowRequest()),
        JSON.stringify({
          capabilityId: "queue.items.list",
          dryRun: false,
          input: { limit: 10 },
          requestId: "action-request-mixed",
          type: "hobit.action.request",
        }),
      ].join("\n"),
    });

    expect(outcome.kind).toBe("mixed_action_and_workflow_request");
    if (outcome.kind !== "mixed_action_and_workflow_request") {
      throw new Error("Expected mixed workflow/action request.");
    }

    const recorded = record({
      actionIndex: 1,
      reasons: outcome.workflowRequestRead.reasons,
      runId: "chain-mixed",
      runMetadata: runMetadata({ status: "failed" }),
      type: "mixed_action_and_workflow_request",
    });

    expect(recorded.activityAppends[0]).toMatchObject({
      severity: "error",
      status: "failed",
      title: "Invalid Hobit workflow request",
    });
    expect(recorded.transcriptAppends[0]?.body).toContain(
      "Mixed hobit.action.request and hobit.workflow.request envelopes are not supported.",
    );
  });

  it("formats successful broker results as existing action result activity", () => {
    const actionResult = createActionResult({
      capabilityId: "queue.createItems",
      message: "Queue items created.",
      output: {
        createdItems: [{ id: "task-1", title: "Task 1" }],
      },
      requestId: "request-create",
      status: "succeeded",
    });
    const recorded = record({
      actionIndex: 1,
      activityRunId: "chain-success",
      capabilityId: "queue.createItems",
      message: workspaceAgentHobitActionResultMessage(actionResult),
      result: actionResult,
      runMetadata: runMetadata(),
      type: "broker_action_result",
    });

    expect(recorded.activityAppends[0]).toMatchObject({
      severity: "success",
      status: "completed",
      title: "Queue items created",
    });
    expect(recorded.transcriptAppends[0]?.body).toBe(
      "Action 1/16: queue.createItems\nQueue items created. Created 1 Queue item. Task id: task-1. Title: Task 1.",
    );
  });

  it("formats blocked_actionable broker results as existing blocked activity", () => {
    const actionResult = createActionResult({
      capabilityId: "queue.review.createMessage",
      message: "task_is_draft",
      output: {
        nextSuggestedCapability: "queue.item.updateRunSettings",
      },
      policyReasons: ["task_is_draft"],
      requestId: "request-review-create",
      status: "blocked_actionable",
    });
    const recorded = record({
      actionIndex: 2,
      activityRunId: "chain-blocked",
      capabilityId: "queue.review.createMessage",
      message: workspaceAgentHobitActionResultMessage(actionResult),
      result: actionResult,
      runMetadata: runMetadata(),
      type: "broker_action_result",
    });

    expect(recorded.activityAppends[0]).toMatchObject({
      severity: "error",
      status: "failed",
      title: "Action blocked with next action",
    });
    expect(recorded.transcriptAppends[0]?.body).toContain(
      "Action blocked with next action. task_is_draft",
    );
  });

  it("formats invalid_input broker results as existing invalid activity", () => {
    const actionResult = createActionResult({
      capabilityId: "queue.createItems",
      message: "title is required.",
      policyReasons: ["title is required."],
      requestId: "request-invalid-input",
      status: "invalid_input",
    });
    const recorded = record({
      actionIndex: 3,
      activityRunId: "chain-invalid-input",
      capabilityId: "queue.createItems",
      message: workspaceAgentHobitActionResultMessage(actionResult),
      result: actionResult,
      runMetadata: runMetadata(),
      stopReason: "invalid_input",
      type: "broker_action_result",
    });

    expect(recorded.activityAppends[0]).toMatchObject({
      lifecycleStage: "completed",
      severity: "error",
      status: "failed",
      title: "Invalid Hobit action request",
    });
    expect(recorded.transcriptAppends[0]?.body).toContain(
      "Invalid Hobit action request. title is required.",
    );
    expect(recorded.transcriptAppends[0]?.body).toContain(
      "Stopped: invalid input.",
    );
  });

  it("includes continuation stop diagnostics in the existing action transcript", () => {
    const actionResult = createActionResult({
      capabilityId: "queue.item.promoteDraft",
      message: "Queue draft promoted.",
      output: { taskId: "task-1" },
      requestId: "request-promote",
      status: "succeeded",
    });
    const recorded = record({
      actionIndex: 5,
      activityRunId: "chain-diagnostics",
      capabilityId: "queue.item.promoteDraft",
      message: workspaceAgentHobitActionResultMessage(actionResult),
      policyDiagnostics: policyDiagnostics(),
      result: actionResult,
      runMetadata: runMetadata(),
      stopReason: "not_allowed_for_auto_continuation",
      type: "broker_action_result",
    });

    expect(recorded.transcriptAppends[0]?.body).toContain(
      "Policy diagnostic: no_next_action.",
    );
    expect(recorded.transcriptAppends[0]?.body).toContain(
      "capabilityId=queue.item.startRun",
    );
    expect(recorded.transcriptAppends[0]?.body).toContain(
      "Stopped: auto-continuation policy blocked.",
    );
  });

  it("preserves the current protocol repair copy", () => {
    const outcome = classifyAgentProtocolRuntimeOutput({
      mode: "typed_capability_action",
      text: "Awaiting `queue.items.list` result.",
    });

    expect(outcome.kind).toBe("protocol_stall");
    if (outcome.kind !== "protocol_stall") {
      throw new Error("Expected protocol stall.");
    }

    const recorded = record({
      outcome,
      runId: "chain-repair",
      runMetadata: runMetadata(),
      type: "protocol_repair_required",
    });

    expect(recorded.logAppends[0]?.text).toBe(
      "Workspace Agent action protocol repair requested. The model produced non-action prose while typed-capability action mode was active. No broker action was executed.",
    );
    expect(recorded.activityAppends[0]).toMatchObject({
      details:
        "Repair asks for exactly one structured hobit.action.request or one explicit hobit.final.answer. No capability is inferred from prose.",
      rawPreview: "Awaiting `queue.items.list` result.",
      title: "Protocol repair requested",
    });
    expect(recorded.transcriptAppends[0]?.body).toBe(recorded.logAppends[0]?.text);
  });

  it("preserves workflow-not-declared compact message", () => {
    const outcome = classifyAgentProtocolRuntimeOutput({
      mode: "typed_capability_action",
      text: JSON.stringify(workflowRequest()),
    });

    expect(outcome.kind).toBe("workflow_request");
    if (outcome.kind !== "workflow_request") {
      throw new Error("Expected workflow request.");
    }

    const recorded = record({
      runId: "chain-workflow",
      runMetadata: runMetadata(),
      type: "workflow_request_recognized",
      workflowRequestRead: outcome.workflowRequestRead,
    });

    expect(recorded.transcriptAppends[0]?.body).toBe(
      "Workflow request recognized, but workflow is not declared/implemented yet. queue does not declare workflows yet.",
    );
    expect(recorded.activityAppends[0]).toMatchObject({
      severity: "warning",
      status: "completed",
      title: "Workflow request recognized",
    });
  });

  it("stays independent from React, Queue UI, visual shell, and execution imports", () => {
    const recorderSources = [
      recorderSource,
      recorderMessagesSource,
      recorderEventFactorySource,
    ].join("\n");
    expect(recorderSources).not.toContain("react");
    expect(recorderSources).not.toContain("AgentQueueV2Board");
    expect(recorderSources).not.toContain("AgentQueuePlaceholderWidget");
    expect(recorderSources).not.toContain("widgetV2/queueV2");
    expect(recorderSources).not.toContain("queue/details");
    expect(recorderSources).not.toContain("ModuleShell");
    expect(recorderSources).not.toContain("tokens.css");
    expect(recorderSources).not.toContain("widget.css");
    expect(recorderSources).not.toContain("createHobitAgentActionBroker");
    expect(recorderSources).not.toContain("invokeAsync");
    expect(recorderSources).not.toContain("createCodexAgentProvider");
    expect(recorderSources).not.toContain("createFakeAgentProvider");
    expect(recorderSources).not.toContain("startTurn");
  });
});

function record(event: Parameters<typeof recordAgentActivity>[0]["event"]) {
  return recordAgentActivity({
    event,
    timestampMs: 1_000,
    widgetInstanceId: "workspace-agent-widget",
    workspaceId: "workspace-1",
  });
}

function runMetadata(
  overrides: Partial<WorkspaceAgentRunMetadata> = {},
): WorkspaceAgentRunMetadata {
  return {
    durationMs: 100,
    status: "completed",
    stepCount: 1,
    threadId: "thread-1",
    tokenUsage: null,
    ...overrides,
  };
}

function streamEvent(
  overrides: Partial<DirectWorkStreamEvent> = {},
): DirectWorkStreamEvent {
  return {
    codexThreadId: null,
    elapsedMs: 100,
    errorMessage: null,
    eventKind: "started",
    exitCode: null,
    failedStage: null,
    finalStatus: null,
    isFinal: false,
    line: null,
    parsedCodexEventType: null,
    runId: "run-stream",
    status: "running",
    stderrPreview: null,
    text: null,
    widgetInstanceId: "workspace-agent-widget",
    workbenchId: "workbench-1",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function workflowRequest(overrides: Record<string, unknown> = {}) {
  return {
    grant: {},
    inputs: {},
    moduleId: "queue",
    requestId: "workflow-request-1",
    type: HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
    workflowId: "dependency_acceptance_smoke",
    ...overrides,
  };
}

function policyDiagnostics(): WorkspaceAgentBrokerPolicyDiagnostics {
  return {
    allowedCapabilities: null,
    allowedRiskClasses: ["read", "review"],
    candidateTaskIds: [],
    capabilityId: "queue.item.startRun",
    confirmationInjected: false,
    confirmationMissing: false,
    deniedCapabilities: [],
    deniedCapabilitiesBlocked: false,
    grantActive: false,
    grantMode: null,
    moduleId: "queue",
    nextActionCapabilityId: null,
    nextActionModuleId: null,
    nextActionPayloadValidated: null,
    nextActionPayloadValidationErrors: [],
    nextActionPresent: false,
    reasonCode: "no_next_action",
    reasonMessage: "No typed nextAction was returned.",
    riskClass: "run_start",
  };
}
