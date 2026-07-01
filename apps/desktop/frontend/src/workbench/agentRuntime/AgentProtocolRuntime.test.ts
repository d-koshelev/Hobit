import agentProtocolRuntimeSource from "./agentProtocolRuntime.ts?raw";

import { describe, expect, it } from "vitest";

import {
  classifyAgentProtocolRuntimeOutput,
  formatAgentProtocolRuntimeRepairPrompt,
} from "./agentProtocolRuntime";
import { HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE } from "../agents/broker";

describe("AgentProtocolRuntime", () => {
  it("classifies ordinary prose as a final answer outside typed action mode", () => {
    expect(
      classifyAgentProtocolRuntimeOutput({
        mode: "normal",
        text: "Normal assistant response.",
      }),
    ).toMatchObject({
      finalAnswer: "Normal assistant response.",
      kind: "final_answer",
    });
  });

  it("classifies explicit final-answer envelopes in typed action mode", () => {
    expect(
      classifyAgentProtocolRuntimeOutput({
        mode: "typed_capability_action",
        text: JSON.stringify({
          message: "No runnable Queue item exists.",
          type: "hobit.final.answer",
        }),
      }),
    ).toMatchObject({
      finalAnswer: "No runnable Queue item exists.",
      kind: "final_answer",
    });
  });

  it("classifies valid Hobit action request envelopes", () => {
    expect(
      classifyAgentProtocolRuntimeOutput({
        mode: "typed_capability_action",
        text: JSON.stringify({
          capabilityId: "queue.items.list",
          dryRun: false,
          input: { limit: 10 },
          requestId: "request-list",
          type: "hobit.action.request",
        }),
      }),
    ).toMatchObject({
      actionRequest: {
        capabilityId: "queue.items.list",
        requestId: "request-list",
      },
      actionRequestRead: {
        requestIdSource: "explicit",
        status: "valid",
      },
      kind: "action_request",
    });
  });

  it("normalizes missing dryRun for read-only Hobit action request envelopes", () => {
    expect(
      classifyAgentProtocolRuntimeOutput({
        mode: "typed_capability_action",
        text: JSON.stringify({
          capabilityId: "workbench.widgets.list",
          input: {
            definitionIdFilter: "agent-run",
          },
          requestId: "request-widgets",
          type: "hobit.action.request",
        }),
      }),
    ).toMatchObject({
      actionRequest: {
        capabilityId: "workbench.widgets.list",
        dryRun: false,
        requestId: "request-widgets",
      },
      actionRequestRead: {
        dryRunSource: "default_read",
        status: "valid",
      },
      kind: "action_request",
    });
  });

  it("classifies valid workflow request envelopes without executing workflows", () => {
    expect(
      classifyAgentProtocolRuntimeOutput({
        mode: "typed_capability_action",
        text: JSON.stringify(workflowRequest()),
      }),
    ).toMatchObject({
      kind: "workflow_request",
      workflowRequest: {
        moduleId: "queue",
        requestId: "workflow-request-1",
        workflowId: "dependency_acceptance_smoke",
      },
      workflowRequestRead: {
        status: "valid",
        validation: {
          ok: true,
          status: "workflow_valid_not_executable",
          workflowMetadata: {
            backingStatus: "validation_only",
            workflowId: "dependency_acceptance_smoke",
          },
        },
      },
    });
  });

  it("classifies malformed action request envelopes as invalid action requests", () => {
    expect(
      classifyAgentProtocolRuntimeOutput({
        mode: "typed_capability_action",
        text: JSON.stringify({
          capabilityId: "queue.items.list",
          dryRun: false,
          type: "hobit.action.request",
        }),
      }),
    ).toMatchObject({
      errors: [
        {
          message: "input is required.",
          reasonCode: "invalid_action_request",
          source: "action_request",
        },
      ],
      kind: "invalid_action_request",
    });
  });

  it("rejects non-read Hobit action request envelopes that omit dryRun", () => {
    expect(
      classifyAgentProtocolRuntimeOutput({
        mode: "typed_capability_action",
        text: JSON.stringify({
          capabilityId: "queue.item.startRun",
          input: {
            executorWidgetId: "executor-1",
            taskId: "task-1",
          },
          type: "hobit.action.request",
        }),
      }),
    ).toMatchObject({
      errors: [
        {
          message:
            "dryRun is required for non-read capability queue.item.startRun.",
          reasonCode: "invalid_action_request",
          source: "action_request",
        },
      ],
      kind: "invalid_action_request",
    });
  });

  it("classifies malformed workflow request envelopes as invalid workflow requests", () => {
    expect(
      classifyAgentProtocolRuntimeOutput({
        mode: "typed_capability_action",
        text: JSON.stringify(
          workflowRequest({
            grant: { runSettings: { sandbox: "workspace_write" } },
          }),
        ),
      }),
    ).toMatchObject({
      errors: [
        {
          fieldPath: "$.grant.runSettings",
          reasonCode: "product_input_in_grant",
          source: "workflow_request",
        },
      ],
      kind: "invalid_workflow_request",
    });
  });

  it("classifies mixed action and workflow envelopes distinctly", () => {
    expect(
      classifyAgentProtocolRuntimeOutput({
        mode: "typed_capability_action",
        text: [
          JSON.stringify(workflowRequest()),
          JSON.stringify({
            capabilityId: "queue.items.list",
            dryRun: false,
            input: { limit: 10 },
            requestId: "action-request-1",
            type: "hobit.action.request",
          }),
        ].join("\n"),
      }),
    ).toMatchObject({
      errors: [
        {
          fieldPath: "$.type",
          reasonCode: "envelope_mixed_request_types",
        },
      ],
      kind: "mixed_action_and_workflow_request",
    });
  });

  it("rejects action lists instead of classifying them as action requests", () => {
    const result = classifyAgentProtocolRuntimeOutput({
      mode: "typed_capability_action",
      text: JSON.stringify([
        {
          capabilityId: "queue.items.list",
          dryRun: false,
          input: { limit: 10 },
          requestId: "request-list",
          type: "hobit.action.request",
        },
      ]),
    });

    expect(result.kind).toBe("invalid_workflow_request");
    expect(result.kind).not.toBe("action_request");
  });

  it("keeps prose-only action mode output as a protocol stall", () => {
    expect(
      classifyAgentProtocolRuntimeOutput({
        mode: "typed_capability_action",
        text: "Awaiting `queue.items.list` result.",
      }),
    ).toMatchObject({
      kind: "protocol_stall",
      repairInstruction: {
        required: true,
      },
    });
  });

  it("does not route awaiting queue.items.list prose into success", () => {
    const result = classifyAgentProtocolRuntimeOutput({
      mode: "typed_capability_action",
      text: "Still awaiting queue.items.list result.",
    });

    expect(result.kind).toBe("protocol_stall");
    expect(result.kind).not.toBe("action_request");
    expect(result.kind).not.toBe("final_answer");
  });

  it("preserves empty output as no_action_output", () => {
    expect(
      classifyAgentProtocolRuntimeOutput({
        mode: "typed_capability_action",
        text: "   ",
      }),
    ).toMatchObject({
      kind: "no_action_output",
      repairInstruction: {
        required: true,
      },
    });
  });

  it("exposes the existing bounded repair prompt", () => {
    const prompt = formatAgentProtocolRuntimeRepairPrompt();

    expect(prompt.length).toBeLessThanOrEqual(1600);
    expect(prompt).toContain("hobit.action.request");
    expect(prompt).toContain("hobit.workflow.request");
    expect(prompt).toContain("hobit.final.answer");
    expect(prompt).toContain("No broker action was executed");
  });

  it("stays independent from providers, broker execution, Queue UI, and visual shell", () => {
    expect(agentProtocolRuntimeSource).not.toContain("react");
    expect(agentProtocolRuntimeSource).not.toContain("agentProvider");
    expect(agentProtocolRuntimeSource).not.toContain("codexProviderAdapter");
    expect(agentProtocolRuntimeSource).not.toContain("fakeAgentProvider");
    expect(agentProtocolRuntimeSource).not.toContain(
      "workspaceAgentBrokerActionRuntime",
    );
    expect(agentProtocolRuntimeSource).not.toContain(
      "createHobitAgentActionBroker",
    );
    expect(agentProtocolRuntimeSource).not.toContain("invokeAsync");
    expect(agentProtocolRuntimeSource).not.toContain("AgentQueueV2Board");
    expect(agentProtocolRuntimeSource).not.toContain(
      "AgentQueuePlaceholderWidget",
    );
    expect(agentProtocolRuntimeSource).not.toContain("widgetV2/queueV2");
    expect(agentProtocolRuntimeSource).not.toContain("queue/details");
    expect(agentProtocolRuntimeSource).not.toContain("ModuleShell");
    expect(agentProtocolRuntimeSource).not.toContain("tokens.css");
    expect(agentProtocolRuntimeSource).not.toContain("widget.css");
  });
});

function workflowRequest(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    grant: {
      constraints: {
        noDelete: true,
        noDownstreamAutoStart: true,
        noGit: true,
        noRollback: true,
        noTerminal: true,
        noValidationExecution: true,
      },
      mode: "queue_acceptance_smoke",
    },
    inputs: {
      runSettings: {
        approvalPolicy: "on_request",
        codexExecutable: "codex.cmd",
        executionPolicy: "manual",
        executorWidgetId: "executor-widget-1",
        sandbox: "workspace_write",
        workspaceRoot: "C:/repo",
      },
      tasks: [
        {
          prompt: "Complete upstream dependency smoke work.",
          slot: "upstream",
          title: "Upstream",
        },
        {
          dependsOnSlots: ["upstream"],
          prompt: "Complete downstream dependency smoke work.",
          slot: "downstream",
          title: "Downstream",
        },
      ],
    },
    moduleId: "queue",
    requestId: "workflow-request-1",
    type: HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
    workflowId: "dependency_acceptance_smoke",
    ...overrides,
  };
}
