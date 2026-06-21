import { describe, expect, it } from "vitest";

import {
  classifyWorkspaceAgentActionProtocolOutput,
  formatWorkspaceAgentActionProtocolRepairPrompt,
  HOBIT_AGENT_FINAL_ANSWER_ENVELOPE_TYPE,
  readHobitAgentFinalAnswerEnvelope,
} from "./workspaceAgentActionProtocol";
import { HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE } from "./agents/broker";

describe("WorkspaceAgentActionProtocol", () => {
  it("classifies valid Hobit action envelopes without prose inference", () => {
    const outcome = classifyWorkspaceAgentActionProtocolOutput({
      mode: "typed_capability_action",
      text: JSON.stringify({
        capabilityId: "queue.items.list",
        dryRun: false,
        input: { limit: 10 },
        requestId: "request-list",
        type: "hobit.action.request",
      }),
    });

    expect(outcome).toMatchObject({
      envelopeRead: {
        envelope: {
          capabilityId: "queue.items.list",
          requestId: "request-list",
        },
        status: "valid",
      },
      kind: "structured_action_request",
    });
  });

  it("classifies malformed Hobit action envelopes as invalid_action_request", () => {
    const outcome = classifyWorkspaceAgentActionProtocolOutput({
      mode: "typed_capability_action",
      text: JSON.stringify({
        capabilityId: "queue.items.list",
        dryRun: false,
        type: "hobit.action.request",
      }),
    });

    expect(outcome).toMatchObject({
      envelopeRead: {
        reasons: ["input is required."],
        status: "invalid",
      },
      kind: "invalid_action_request",
    });
  });

  it("classifies workflow request envelopes distinctly from action requests and final answers", () => {
    const outcome = classifyWorkspaceAgentActionProtocolOutput({
      mode: "typed_capability_action",
      text: JSON.stringify({
        grant: {},
        inputs: {},
        moduleId: "queue",
        requestId: "workflow-request-1",
        type: HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
        workflowId: "dependency_acceptance_smoke",
      }),
    });

    expect(outcome).toMatchObject({
      kind: "workflow_request",
      workflowRead: {
        envelope: {
          moduleId: "queue",
          requestId: "workflow-request-1",
          workflowId: "dependency_acceptance_smoke",
        },
        status: "valid",
        validation: {
          ok: false,
          reasonCode: "workflow_not_declared",
          status: "workflow_not_declared",
        },
      },
    });
    expect(outcome).not.toMatchObject({
      kind: "final_answer",
    });
    expect(outcome).not.toMatchObject({
      kind: "structured_action_request",
    });
  });

  it("classifies invalid workflow request envelopes as invalid_workflow_request", () => {
    const outcome = classifyWorkspaceAgentActionProtocolOutput({
      mode: "typed_capability_action",
      text: JSON.stringify({
        inputs: {},
        moduleId: "queue",
        type: HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
        workflowId: "dependency_acceptance_smoke",
      }),
    });

    expect(outcome).toMatchObject({
      kind: "invalid_workflow_request",
      workflowRead: {
        reasons: ["$.requestId: requestId is required."],
        status: "invalid",
      },
    });
  });

  it("rejects mixed action and workflow envelopes before action execution classification", () => {
    const outcome = classifyWorkspaceAgentActionProtocolOutput({
      mode: "typed_capability_action",
      text: [
        JSON.stringify({
          moduleId: "queue",
          requestId: "workflow-request-mixed",
          type: HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
          workflowId: "dependency_acceptance_smoke",
        }),
        JSON.stringify({
          capabilityId: "queue.items.list",
          dryRun: false,
          input: { limit: 10 },
          requestId: "action-request-mixed",
          type: "hobit.action.request",
        }),
      ].join("\n"),
    });

    expect(outcome).toMatchObject({
      kind: "invalid_workflow_request",
      workflowRead: {
        issues: [
          expect.objectContaining({
            code: "envelope_mixed_request_types",
          }),
        ],
      },
    });
  });

  it("does not route awaiting Queue prose into a capability call", () => {
    const outcome = classifyWorkspaceAgentActionProtocolOutput({
      mode: "typed_capability_action",
      text: "Awaiting `queue.items.list` result.",
    });

    expect(outcome).toMatchObject({
      kind: "protocol_stall",
    });
    expect(outcome).not.toMatchObject({
      kind: "structured_action_request",
    });
  });

  it("keeps ordinary non-action chat as final prose outside action mode", () => {
    const outcome = classifyWorkspaceAgentActionProtocolOutput({
      mode: "normal",
      text: "Normal assistant response without app action.",
    });

    expect(outcome).toEqual({
      finalAnswer: "Normal assistant response without app action.",
      kind: "final_answer",
    });
  });

  it("requires an explicit final-answer marker in typed-capability action mode", () => {
    const message = "Queue dogfooding smoke is blocked: no runnable task id.";
    const finalAnswer = JSON.stringify({
      message,
      type: HOBIT_AGENT_FINAL_ANSWER_ENVELOPE_TYPE,
    });

    expect(readHobitAgentFinalAnswerEnvelope(finalAnswer)).toEqual({
      envelope: {
        message,
        type: HOBIT_AGENT_FINAL_ANSWER_ENVELOPE_TYPE,
      },
      message,
      status: "valid",
    });
    expect(
      classifyWorkspaceAgentActionProtocolOutput({
        mode: "typed_capability_action",
        text: finalAnswer,
      }),
    ).toEqual({
      finalAnswer: message,
      kind: "final_answer",
    });
  });

  it("classifies empty action-mode output as no_action_output", () => {
    expect(
      classifyWorkspaceAgentActionProtocolOutput({
        mode: "typed_capability_action",
        text: "   ",
      }),
    ).toEqual({ kind: "no_action_output" });
  });

  it("keeps the repair prompt bounded and capability-agnostic", () => {
    const prompt = formatWorkspaceAgentActionProtocolRepairPrompt();

    expect(prompt.length).toBeLessThanOrEqual(1600);
    expect(prompt).toContain("hobit.action.request");
    expect(prompt).toContain("hobit.workflow.request");
    expect(prompt).toContain("hobit.final.answer");
    expect(prompt).toContain("No broker action was executed");
    expect(prompt).toContain("Intermediate prose is not a capability call");
    expect(prompt).not.toContain("awaiting capability result");
    expect(prompt).not.toContain("queue.items.list");
    expect(prompt).not.toContain("I saw");
  });
});
