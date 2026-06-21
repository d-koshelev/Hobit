import { describe, expect, it } from "vitest";

import type { ModuleControlSurface } from "../modules";
import { QUEUE_MODULE_CONTROL_SURFACE } from "../modules";
import workflowGrantInputSplitSource from "./workflowGrantInputSplit.ts?raw";
import {
  HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
  readHobitAgentWorkflowRequestEnvelope,
  validateHobitAgentWorkflowRequestEnvelope,
} from "./hobitAgentWorkflowRequestEnvelope";
import { validateWorkflowGrantAndInputsSplit } from "./workflowGrantInputSplit";

describe("hobitAgentWorkflowRequestEnvelope", () => {
  it("parses raw workflow request JSON and reports undeclared Queue workflow availability", () => {
    const result = readHobitAgentWorkflowRequestEnvelope(
      JSON.stringify(workflowRequest()),
    );

    expect(result).toMatchObject({
      envelope: {
        moduleId: "queue",
        requestId: "workflow-request-1",
        type: HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
        workflowId: "dependency_acceptance_smoke",
      },
      source: "direct_json",
      status: "valid",
      validation: {
        fieldPaths: ["$.workflowId"],
        moduleId: "queue",
        ok: false,
        reasonCode: "workflow_not_declared",
        status: "workflow_not_declared",
      },
    });
  });

  it("parses embedded workflow request JSON without inferring fields from prose", () => {
    const result = readHobitAgentWorkflowRequestEnvelope(
      `Please validate this typed request only: ${JSON.stringify(
        workflowRequest({
          requestId: "workflow-embedded",
          workflowId: "dependency_acceptance_smoke",
        }),
      )}. Do not use this prose as input.`,
    );

    expect(result).toMatchObject({
      envelope: {
        requestId: "workflow-embedded",
        workflowId: "dependency_acceptance_smoke",
      },
      source: "embedded_json",
      status: "valid",
    });
  });

  it("parses workflow request JSON from fenced blocks", () => {
    const result = readHobitAgentWorkflowRequestEnvelope(
      [
        "Use this structured workflow request.",
        "```json",
        JSON.stringify(workflowRequest({ requestId: "workflow-fenced" })),
        "```",
      ].join("\n"),
    );

    expect(result).toMatchObject({
      envelope: {
        requestId: "workflow-fenced",
      },
      source: "fenced_json",
      status: "valid",
    });
  });

  it("returns none for prose-only content", () => {
    expect(
      readHobitAgentWorkflowRequestEnvelope(
        "Run the Queue dependency smoke workflow when ready.",
      ),
    ).toEqual({ status: "none" });
  });

  it("rejects malformed and partial workflow JSON", () => {
    expect(
      readHobitAgentWorkflowRequestEnvelope(
        [
          "```hobit-workflow-request",
          '{"type":"hobit.workflow.request","moduleId":',
          "```",
        ].join("\n"),
      ),
    ).toMatchObject({
      reasons: ["Workflow request JSON is invalid."],
      status: "invalid",
    });

    expect(
      readHobitAgentWorkflowRequestEnvelope(
        '{"type":"hobit.workflow.request","moduleId":"queue"',
      ),
    ).toMatchObject({
      reasons: ["Workflow request JSON is invalid."],
      status: "invalid",
    });
  });

  it("rejects multiple workflow requests", () => {
    const result = readHobitAgentWorkflowRequestEnvelope(
      [
        JSON.stringify(workflowRequest({ requestId: "workflow-a" })),
        JSON.stringify(workflowRequest({ requestId: "workflow-b" })),
      ].join("\n"),
    );

    expect(result).toMatchObject({
      issues: [
        expect.objectContaining({
          code: "multiple_workflow_requests",
          fieldPath: "$",
        }),
      ],
      status: "invalid",
    });
  });

  it("rejects mixed action and workflow requests", () => {
    const result = readHobitAgentWorkflowRequestEnvelope(
      [
        JSON.stringify(workflowRequest()),
        JSON.stringify({
          capabilityId: "queue.items.list",
          dryRun: false,
          input: { limit: 10 },
          requestId: "action-request-1",
          type: "hobit.action.request",
        }),
      ].join("\n"),
    );

    expect(result).toMatchObject({
      issues: [
        expect.objectContaining({
          code: "envelope_mixed_request_types",
          fieldPath: "$.type",
        }),
      ],
      status: "invalid",
    });
  });

  it("rejects top-level workflow request arrays", () => {
    const result = readHobitAgentWorkflowRequestEnvelope(
      JSON.stringify([workflowRequest()]),
    );

    expect(result).toMatchObject({
      issues: [
        expect.objectContaining({
          code: "envelope_top_level_array",
          fieldPath: "$",
        }),
      ],
      status: "invalid",
    });
  });

  it("rejects unsupported workflow type values", () => {
    const result = readHobitAgentWorkflowRequestEnvelope(
      JSON.stringify({
        ...workflowRequest(),
        type: "hobit.workflow.unknown",
      }),
    );

    expect(result).toMatchObject({
      reasons: ["$.type: Envelope type must be hobit.workflow.request."],
      status: "invalid",
    });

    expect(
      readHobitAgentWorkflowRequestEnvelope(
        JSON.stringify({
          ...workflowRequest(),
          type: "hobit.queue.workflowRequest",
        }),
      ),
    ).toMatchObject({
      reasons: ["$.type: Envelope type must be hobit.workflow.request."],
      status: "invalid",
    });
  });

  it("rejects missing and empty required envelope fields with field paths", () => {
    expect(
      validateHobitAgentWorkflowRequestEnvelope({
        inputs: {},
        moduleId: "queue",
        requestId: "request-id",
        type: HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
      }),
    ).toMatchObject({
      reasons: ["$.workflowId: workflowId is required."],
      status: "invalid",
    });

    expect(
      validateHobitAgentWorkflowRequestEnvelope({
        moduleId: "",
        requestId: " ",
        type: HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
        workflowId: "",
      }),
    ).toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ fieldPath: "$.requestId" }),
        expect.objectContaining({ fieldPath: "$.moduleId" }),
        expect.objectContaining({ fieldPath: "$.workflowId" }),
      ]),
      status: "invalid",
    });
  });

  it("rejects unknown module ids through the ModuleControlSurface registry", () => {
    const result = readHobitAgentWorkflowRequestEnvelope(
      JSON.stringify(workflowRequest({ moduleId: "unknown-module" })),
    );

    expect(result).toMatchObject({
      issues: [
        expect.objectContaining({
          code: "unknown_module",
          fieldPath: "$.moduleId",
        }),
      ],
      status: "invalid",
    });
  });

  it("validates declared workflow metadata when a module surface declares it", () => {
    const moduleSurfaces = [
      workflowSurface({
        backingStatus: "implemented",
        workflowId: "implemented.workflow",
      }),
    ];

    expect(
      readHobitAgentWorkflowRequestEnvelope(
        JSON.stringify(
          workflowRequest({ workflowId: "implemented.workflow" }),
        ),
        { moduleSurfaces },
      ),
    ).toMatchObject({
      status: "valid",
      validation: {
        ok: true,
        status: "available",
      },
    });
  });

  it("reports declared but unavailable workflow metadata without execution", () => {
    const moduleSurfaces = [
      workflowSurface({
        backingStatus: "planned",
        workflowId: "planned.workflow",
      }),
    ];

    expect(
      readHobitAgentWorkflowRequestEnvelope(
        JSON.stringify(workflowRequest({ workflowId: "planned.workflow" })),
        { moduleSurfaces },
      ),
    ).toMatchObject({
      status: "valid",
      validation: {
        fieldPaths: ["$.workflowId"],
        ok: false,
        reasonCode: "workflow_unavailable",
        status: "workflow_unavailable",
      },
    });
  });

  it("accepts generic permission grant fields and opaque workflow input objects", () => {
    const result = readHobitAgentWorkflowRequestEnvelope(
      JSON.stringify(
        workflowRequest({
          grant: {
            confirmationToken: "operator-confirmed",
            mode: "queue_acceptance_smoke",
            scope: {
              evidenceBundleIds: ["bundle-1"],
              executorWidgetIds: ["executor-1"],
              messageIds: ["message-1"],
              runIds: ["run-1"],
              taskIds: ["task-1"],
            },
          },
          inputs: {
            runSettings: {
              approvalPolicy: "on_request",
              sandbox: "workspace_write",
            },
            tasks: [
              {
                dependsOnSlots: ["upstream"],
                prompt: "Run the workflow.",
                title: "Workflow task",
              },
            ],
          },
        }),
      ),
    );

    expect(result).toMatchObject({
      envelope: {
        grant: {
          confirmationToken: "operator-confirmed",
          mode: "queue_acceptance_smoke",
          scope: {
            evidenceBundleIds: ["bundle-1"],
            executorWidgetIds: ["executor-1"],
            messageIds: ["message-1"],
            runIds: ["run-1"],
            taskIds: ["task-1"],
          },
        },
        inputs: {
          runSettings: {
            approvalPolicy: "on_request",
            sandbox: "workspace_write",
          },
          tasks: [
            {
              dependsOnSlots: ["upstream"],
              prompt: "Run the workflow.",
              title: "Workflow task",
            },
          ],
        },
      },
      status: "valid",
    });
    expect(result).not.toMatchObject({
      status: "invalid",
    });
  });

  it("rejects workflow product input fields inside grant with field paths", () => {
    const productFields = [
      "runSettings",
      "tasks",
      "task",
      "prompt",
      "prompts",
      "title",
      "dependsOn",
      "dependsOnSlots",
      "workflowInputs",
      "inputs",
      "codexExecutable",
      "workspaceRoot",
      "sandbox",
      "approvalPolicy",
    ];

    for (const fieldName of productFields) {
      const result = validateHobitAgentWorkflowRequestEnvelope(
        workflowRequest({
          grant: { [fieldName]: fieldName === "tasks" ? [] : "value" },
          inputs: {},
        }),
      );

      expect(result, fieldName).toMatchObject({
        issues: [
          expect.objectContaining({
            code: "product_input_in_grant",
            fieldPath: `$.grant.${fieldName}`,
          }),
        ],
        reasons: [
          expect.stringContaining(
            `$.grant.${fieldName}: product_input_in_grant:`,
          ),
        ],
        status: "invalid",
      });
    }
  });

  it("rejects direct ids at top-level grant and allows id arrays only under scope", () => {
    const directIdFields = [
      "taskId",
      "runId",
      "messageId",
      "evidenceBundleId",
      "executorWidgetId",
    ];

    for (const fieldName of directIdFields) {
      expect(
        validateHobitAgentWorkflowRequestEnvelope(
          workflowRequest({
            grant: { [fieldName]: `${fieldName}-1` },
            inputs: {},
          }),
        ),
        fieldName,
      ).toMatchObject({
        issues: [
          expect.objectContaining({
            code: "product_input_in_grant",
            fieldPath: `$.grant.${fieldName}`,
          }),
        ],
        status: "invalid",
      });
    }

    const scoped = validateWorkflowGrantAndInputsSplit({
      grant: {
        scope: {
          evidenceBundleIds: ["bundle-1"],
          executorWidgetIds: ["executor-1"],
          messageIds: ["message-1"],
          runIds: ["run-1"],
          taskIds: ["task-1"],
        },
      },
      inputs: {},
    });

    expect(scoped).toMatchObject({
      issues: [],
      valid: true,
    });
  });

  it("allows module and capability ids only as explicit scope arrays", () => {
    expect(
      validateWorkflowGrantAndInputsSplit({
        grant: {
          scope: {
            capabilityIds: ["queue.items.list"],
            moduleIds: ["queue"],
          },
        },
        inputs: {},
      }),
    ).toMatchObject({
      issues: [],
      valid: true,
    });

    expect(
      validateWorkflowGrantAndInputsSplit({
        grant: { taskIds: ["task-1"] },
        inputs: {},
      }),
    ).toMatchObject({
      issues: [
        expect.objectContaining({
          fieldPath: "$.grant.taskIds",
          reasonCode: "invalid_grant_scope",
        }),
      ],
      valid: false,
    });
  });

  it("rejects malformed grant, malformed inputs, and invalid scope fields", () => {
    expect(
      validateWorkflowGrantAndInputsSplit({
        grant: [],
        inputs: {},
      }),
    ).toMatchObject({
      issues: [
        expect.objectContaining({
          fieldPath: "$.grant",
          reasonCode: "malformed_grant",
        }),
      ],
      valid: false,
    });

    expect(
      validateWorkflowGrantAndInputsSplit({
        grant: {},
        inputs: "runSettings belong in an object",
      }),
    ).toMatchObject({
      issues: [
        expect.objectContaining({
          fieldPath: "$.inputs",
          reasonCode: "malformed_inputs",
        }),
      ],
      valid: false,
    });

    expect(
      validateWorkflowGrantAndInputsSplit({
        grant: {
          scope: {
            taskId: "task-1",
            taskIds: ["task-2", ""],
          },
        },
        inputs: {},
      }),
    ).toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "$.grant.scope.taskId",
          reasonCode: "invalid_grant_scope",
        }),
        expect.objectContaining({
          fieldPath: "$.grant.scope.taskIds",
          reasonCode: "invalid_grant_scope",
        }),
      ]),
      valid: false,
    });
  });

  it("accepts workflow data under inputs while generic Queue workflow remains undeclared", () => {
    const result = readHobitAgentWorkflowRequestEnvelope(
      JSON.stringify(
        workflowRequest({
          grant: {
            mode: "queue_acceptance_smoke",
            scope: { taskIds: ["task-1"] },
          },
          inputs: {
            dependsOnSlots: ["upstream"],
            runSettings: {
              approvalPolicy: "on_request",
              codexExecutable: "codex.cmd",
              sandbox: "workspace_write",
              workspaceRoot: "C:/repo",
            },
            tasks: [{ prompt: "Run typed workflow task.", title: "Task" }],
          },
        }),
      ),
    );

    expect(result).toMatchObject({
      status: "valid",
      validation: {
        ok: false,
        reasonCode: "workflow_not_declared",
      },
    });
  });

  it("ignores prose confirmation and prose run settings around workflow JSON", () => {
    const result = readHobitAgentWorkflowRequestEnvelope(
      [
        "I confirm. Use sandbox=danger_full_access.",
        JSON.stringify(
          workflowRequest({
            grant: {
              mode: "queue_acceptance_smoke",
              scope: { taskIds: ["task-1"] },
            },
            inputs: {},
          }),
        ),
      ].join("\n"),
    );

    expect(result).toMatchObject({
      envelope: {
        grant: {
          mode: "queue_acceptance_smoke",
          scope: { taskIds: ["task-1"] },
        },
        inputs: {},
      },
      status: "valid",
    });
    if (result.status !== "valid") {
      throw new Error("Expected workflow request to stay valid.");
    }
    expect(result.envelope.grant?.confirmationToken).toBeUndefined();
    expect(result.envelope.inputs).toEqual({});
  });

  it("keeps split validation helpers independent from Queue UI and visual shell modules", () => {
    expect(workflowGrantInputSplitSource).not.toContain("AgentQueueV2Board");
    expect(workflowGrantInputSplitSource).not.toContain(
      "AgentQueuePlaceholderWidget",
    );
    expect(workflowGrantInputSplitSource).not.toContain("widgetV2/queueV2");
    expect(workflowGrantInputSplitSource).not.toContain("queue/details");
    expect(workflowGrantInputSplitSource).not.toContain("ModuleShell");
    expect(workflowGrantInputSplitSource).not.toContain("tokens.css");
    expect(workflowGrantInputSplitSource).not.toContain("widget.css");
  });
});

function workflowRequest(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
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

function workflowSurface({
  backingStatus,
  workflowId,
}: {
  backingStatus: "implemented" | "planned" | "unavailable";
  workflowId: string;
}): ModuleControlSurface {
  return {
    ...QUEUE_MODULE_CONTROL_SURFACE,
    workflowIds: [workflowId],
    workflows: [
      {
        backingStatus,
        confirmationRequirement: "none",
        riskClasses: ["read"],
        uiDependencyPolicy: "none",
        workflowId,
      },
    ],
  };
}
