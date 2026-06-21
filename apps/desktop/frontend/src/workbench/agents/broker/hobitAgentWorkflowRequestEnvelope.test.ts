import { describe, expect, it } from "vitest";

import type { ModuleControlSurface } from "../modules";
import { QUEUE_MODULE_CONTROL_SURFACE } from "../modules";
import {
  HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
  readHobitAgentWorkflowRequestEnvelope,
  validateHobitAgentWorkflowRequestEnvelope,
} from "./hobitAgentWorkflowRequestEnvelope";

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

  it("treats grant and inputs as opaque generic values", () => {
    const result = readHobitAgentWorkflowRequestEnvelope(
      JSON.stringify(
        workflowRequest({
          grant: {
            confirmationToken: "operator-confirmed",
            mode: "queue_acceptance_smoke",
          },
          inputs: "opaque workflow input string",
        }),
      ),
    );

    expect(result).toMatchObject({
      envelope: {
        grant: {
          confirmationToken: "operator-confirmed",
          mode: "queue_acceptance_smoke",
        },
        inputs: "opaque workflow input string",
      },
      status: "valid",
    });
    expect(result).not.toMatchObject({
      status: "invalid",
    });
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
