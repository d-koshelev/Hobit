import validatorSource from "./queueWorkflowRequestValidation.ts?raw";

import { describe, expect, it } from "vitest";

import {
  QUEUE_MODULE_WORKFLOWS,
  validateQueueWorkflowRequest,
  type QueueWorkflowId,
} from ".";

describe("queueWorkflowRequestValidation", () => {
  it("validates dependency_acceptance_smoke as runner-adapter eligible and non-mutating during validation", () => {
    expect(validateQueueWorkflowRequest(validRequest())).toMatchObject({
      fieldPaths: [],
      issues: [],
      ok: true,
      reasons: expect.arrayContaining([
        expect.stringContaining("Queue workflow request validated"),
        expect.stringContaining("runtime adapter"),
        expect.stringContaining("Validation itself does not call Queue capabilities"),
        expect.stringContaining("create/setup/start"),
      ]),
      status: "workflow_valid_not_executable",
      workflowId: "dependency_acceptance_smoke",
    });
  });

  it("accepts dependency_acceptance_smoke queue_local executionTarget without executorWidgetId", () => {
    expect(
      validateQueueWorkflowRequest(
        validRequest({
          inputs: {
            ...validInputs(),
            runSettings: validRunSettings({
              executorWidgetId: undefined,
              executionTarget: {
                kind: "queue_local",
                providerId: "codex",
                queueOwnerWidgetInstanceId: "agent-queue-widget-id",
              },
            }),
          },
        }),
      ),
    ).toMatchObject({
      ok: true,
      status: "workflow_valid_not_executable",
      workflowId: "dependency_acceptance_smoke",
    });
  });

  it("validates dependency_failure_smoke with an explicit failure reason", () => {
    expect(
      validateQueueWorkflowRequest(
        validRequest({
          grant: validGrant("queue_failure_smoke"),
          inputs: {
            ...validInputs(),
            failureReason: "Simulated terminal failure for smoke validation.",
          },
          workflowId: "dependency_failure_smoke",
        }),
      ),
    ).toMatchObject({
      ok: true,
      status: "workflow_valid_not_executable",
      workflowId: "dependency_failure_smoke",
    });
  });

  it("accepts dependency_failure_smoke queue_local executionTarget without executorWidgetId", () => {
    expect(
      validateQueueWorkflowRequest(
        validRequest({
          grant: validGrant("queue_failure_smoke"),
          inputs: {
            ...validInputs(),
            runSettings: validRunSettings({
              executorWidgetId: undefined,
              executionTarget: {
                kind: "queue_local",
                providerId: "codex",
                queueOwnerWidgetInstanceId: "agent-queue-widget-id",
              },
            }),
          },
          workflowId: "dependency_failure_smoke",
        }),
      ),
    ).toMatchObject({
      ok: true,
      status: "workflow_valid_not_executable",
      workflowId: "dependency_failure_smoke",
    });
  });

  it("rejects queue_local executionTarget without queueOwnerWidgetInstanceId", () => {
    expect(
      validateQueueWorkflowRequest(
        validRequest({
          inputs: {
            ...validInputs(),
            runSettings: validRunSettings({
              executionTarget: {
                kind: "queue_local",
                providerId: "codex",
              },
            }),
          },
        }),
      ),
    ).toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          fieldPath:
            "$.inputs.runSettings.executionTarget.queueOwnerWidgetInstanceId",
          reasonCode: "missing_required_input",
        }),
      ]),
      ok: false,
      status: "missing_required_inputs",
    });
  });

  it("rejects unsupported executionTarget provider", () => {
    expect(
      validateQueueWorkflowRequest(
        validRequest({
          inputs: {
            ...validInputs(),
            runSettings: validRunSettings({
              executionTarget: {
                kind: "queue_local",
                providerId: "other",
                queueOwnerWidgetInstanceId: "agent-queue-widget-id",
              },
            }),
          },
        }),
      ),
    ).toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "$.inputs.runSettings.executionTarget.providerId",
          reasonCode: "invalid_run_settings",
        }),
      ]),
      ok: false,
    });
  });

  it("accepts legacy executorWidgetId without executionTarget", () => {
    expect(
      validateQueueWorkflowRequest(
        validRequest({
          inputs: {
            ...validInputs(),
            runSettings: legacyRunSettings(),
          },
        }),
      ),
    ).toMatchObject({
      ok: true,
      status: "workflow_valid_not_executable",
    });
  });

  it("does not infer execution target from prose fields", () => {
    expect(
      validateQueueWorkflowRequest(
        validRequest({
          inputs: {
            ...validInputs(),
            runSettings: {
              ...validRunSettings({
                executionTarget: {
                  kind: "queue_local",
                  providerId: "codex",
                  targetDescription: "Use the visible Agent Queue widget.",
                },
              }),
              executionTargetText: "Agent Queue widget titled Queue",
            },
          },
        }),
      ),
    ).toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "$.inputs.runSettings.executionTargetText",
          reasonCode: "unsupported_run_settings_field",
        }),
        expect.objectContaining({
          fieldPath:
            "$.inputs.runSettings.executionTarget.targetDescription",
          reasonCode: "unsupported_run_settings_field",
        }),
        expect.objectContaining({
          fieldPath:
            "$.inputs.runSettings.executionTarget.queueOwnerWidgetInstanceId",
          reasonCode: "missing_required_input",
        }),
      ]),
      ok: false,
    });
  });

  it("validates dependency_failure_smoke setup before the failure reason is supplied", () => {
    expect(
      validateQueueWorkflowRequest(
        validRequest({
          grant: validGrant("queue_failure_smoke"),
          workflowId: "dependency_failure_smoke",
        }),
      ),
    ).toMatchObject({
      ok: true,
      status: "workflow_valid_not_executable",
      workflowId: "dependency_failure_smoke",
    });
  });

  it("validates typed dependency_failure_smoke continuations without setup inputs", () => {
    expect(
      validateQueueWorkflowRequest(
        validRequest({
          grant: validGrant("queue_failure_smoke"),
          inputs: {
            phase: "finalization",
            failureReason: "Upstream worker failed during smoke.",
          },
          workflowId: "dependency_failure_smoke",
        }),
      ),
    ).toMatchObject({
      ok: true,
      status: "workflow_valid_not_executable",
      workflowId: "dependency_failure_smoke",
    });
  });

  it("rejects missing runSettings", () => {
    expect(
      validateQueueWorkflowRequest(
        validRequest({ inputs: { tasks: validTasks() } }),
      ),
    ).toMatchObject({
      fieldPath: "$.inputs.runSettings",
      issues: [
        expect.objectContaining({
          fieldPath: "$.inputs.runSettings",
          reasonCode: "missing_required_input",
        }),
      ],
      ok: false,
      status: "missing_required_inputs",
    });
  });

  it("rejects invalid sandbox and approvalPolicy spellings exactly", () => {
    const invalidSpellings = [
      { field: "sandbox", value: "workspace-write" },
      { field: "sandbox", value: "workspaceWrite" },
      { field: "sandbox", value: "default" },
      { field: "approvalPolicy", value: "on-request" },
      { field: "approvalPolicy", value: "onRequest" },
      { field: "approvalPolicy", value: "default" },
    ] as const;

    for (const { field, value } of invalidSpellings) {
      const result = validateQueueWorkflowRequest(
        validRequest({
          inputs: {
            ...validInputs(),
            runSettings: {
              ...validRunSettings(),
              [field]: value,
            },
          },
        }),
      );

      expect(result, `${field}=${value}`).toMatchObject({
        issues: [
          expect.objectContaining({
            fieldPath: `$.inputs.runSettings.${field}`,
          }),
        ],
        ok: false,
      });
    }
  });

  it("rejects missing codexExecutable and workspaceRoot", () => {
    expect(
      validateQueueWorkflowRequest(
        validRequest({
          inputs: {
            ...validInputs(),
            runSettings: {
              ...validRunSettings(),
              codexExecutable: "",
              workspaceRoot: " ",
            },
          },
        }),
      ),
    ).toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "$.inputs.runSettings.codexExecutable",
          reasonCode: "missing_required_input",
        }),
        expect.objectContaining({
          fieldPath: "$.inputs.runSettings.workspaceRoot",
          reasonCode: "missing_required_input",
        }),
      ]),
      ok: false,
      status: "missing_required_inputs",
    });
  });

  it("rejects missing tasks", () => {
    expect(
      validateQueueWorkflowRequest(
        validRequest({ inputs: { runSettings: validRunSettings() } }),
      ),
    ).toMatchObject({
      issues: [
        expect.objectContaining({
          fieldPath: "$.inputs.tasks",
          reasonCode: "missing_required_input",
        }),
      ],
      ok: false,
      status: "missing_required_inputs",
    });
  });

  it("rejects duplicate, missing, and unsupported task slots", () => {
    expect(
      validateQueueWorkflowRequest(
        validRequest({
          inputs: {
            ...validInputs(),
            tasks: [
              validTask({ slot: "upstream" }),
              validTask({
                dependsOnSlots: ["upstream"],
                slot: "upstream",
              }),
            ],
          },
        }),
      ),
    ).toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "$.inputs.tasks[1].slot",
          reasonCode: "duplicate_task_slot",
        }),
      ]),
      ok: false,
    });

    expect(
      validateQueueWorkflowRequest(
        validRequest({
          inputs: {
            ...validInputs(),
            tasks: [
              validTask({ slot: "upstream" }),
              validTask({
                dependsOnSlots: ["upstream"],
                prompt: "Downstream prompt.",
                slot: "downstream",
                taskId: "task-id-not-supported",
              }),
            ],
          },
        }),
      ),
    ).toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "$.inputs.tasks[1].taskId",
          reasonCode: "unsupported_task_field",
        }),
      ]),
      ok: false,
    });
  });

  it("rejects missing upstream and downstream required slots", () => {
    const missingUpstream = validateQueueWorkflowRequest(
      validRequest({
        inputs: {
          ...validInputs(),
          tasks: [
            validTask({
              dependsOnSlots: [],
              prompt: "Downstream prompt.",
              slot: "downstream",
              title: "Downstream",
            }),
          ],
        },
      }),
    );
    expect(missingUpstream).toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "$.inputs.tasks",
          message: expect.stringContaining("upstream"),
          reasonCode: "missing_required_input",
        }),
      ]),
      ok: false,
    });

    const missingDownstream = validateQueueWorkflowRequest(
      validRequest({
        inputs: {
          ...validInputs(),
          tasks: [validTask({ slot: "upstream" })],
        },
      }),
    );
    expect(missingDownstream).toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "$.inputs.tasks",
          message: expect.stringContaining("downstream"),
          reasonCode: "missing_required_input",
        }),
      ]),
      ok: false,
    });
  });

  it("rejects downstream without an explicit upstream dependency slot", () => {
    expect(
      validateQueueWorkflowRequest(
        validRequest({
          inputs: {
            ...validInputs(),
            tasks: [
              validTask({ slot: "upstream", title: "Upstream" }),
              validTask({
                dependsOnSlots: [],
                prompt: "Run after upstream.",
                slot: "downstream",
                title: "Downstream after upstream",
              }),
            ],
          },
        }),
      ),
    ).toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "$.inputs.tasks[1].dependsOnSlots",
          reasonCode: "invalid_task_dependency",
        }),
      ]),
      ok: false,
    });
  });

  it("rejects unknown dependsOnSlots, self dependency, and simple cycles", () => {
    expect(
      validateQueueWorkflowRequest(
        validRequest({
          inputs: {
            ...validInputs(),
            tasks: [
              validTask({ slot: "upstream" }),
              validTask({
                dependsOnSlots: ["upstream", "missing"],
                slot: "downstream",
              }),
            ],
          },
        }),
      ),
    ).toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "$.inputs.tasks[1].dependsOnSlots",
          message: expect.stringContaining("unknown task slot missing"),
          reasonCode: "invalid_task_dependency",
        }),
      ]),
      ok: false,
    });

    expect(
      validateQueueWorkflowRequest(
        validRequest({
          inputs: {
            ...validInputs(),
            tasks: [
              validTask({ dependsOnSlots: ["upstream"], slot: "upstream" }),
              validTask({
                dependsOnSlots: ["upstream"],
                slot: "downstream",
              }),
            ],
          },
        }),
      ),
    ).toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "$.inputs.tasks[0].dependsOnSlots",
          reasonCode: "invalid_task_dependency",
        }),
      ]),
      ok: false,
    });

    expect(
      validateQueueWorkflowRequest(
        validRequest({
          inputs: {
            ...validInputs(),
            tasks: [
              validTask({
                dependsOnSlots: ["downstream"],
                slot: "upstream",
              }),
              validTask({
                dependsOnSlots: ["upstream"],
                slot: "downstream",
              }),
            ],
          },
        }),
      ),
    ).toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          reasonCode: "dependency_cycle",
        }),
      ]),
      ok: false,
    });
  });

  it("does not infer dependencies from title, prompt, prose, or task order", () => {
    expect(
      validateQueueWorkflowRequest(
        validRequest({
          inputs: {
            ...validInputs(),
            tasks: [
              validTask({
                prompt: "This task says it is downstream of upstream.",
                slot: "downstream",
                title: "Downstream after upstream",
              }),
              validTask({
                prompt: "This upstream task appears later in order.",
                slot: "upstream",
                title: "Upstream",
              }),
            ],
          },
        }),
      ),
    ).toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "$.inputs.tasks[0].dependsOnSlots",
          reasonCode: "invalid_task_dependency",
        }),
      ]),
      ok: false,
    });
  });

  it("requires explicit Queue grant modes for dependency workflows", () => {
    expect(validateQueueWorkflowRequest(validRequest({ grant: undefined }))).toMatchObject({
      issues: [
        expect.objectContaining({
          fieldPath: "$.grant",
          reasonCode: "missing_grant",
        }),
      ],
      ok: false,
      status: "invalid_workflow_grant",
    });

    expect(
      validateQueueWorkflowRequest(
        validRequest({ grant: validGrant("queue_failure_smoke") }),
      ),
    ).toMatchObject({
      issues: [
        expect.objectContaining({
          fieldPath: "$.grant.mode",
          reasonCode: "invalid_workflow_grant_mode",
        }),
      ],
      ok: false,
      status: "invalid_workflow_grant",
    });

    expect(
      validateQueueWorkflowRequest(
        validRequest({ grant: validGrant("queue_acceptance_smoke") }),
      ),
    ).toMatchObject({
      ok: true,
      status: "workflow_valid_not_executable",
    });

    expect(
      validateQueueWorkflowRequest(
        validRequest({
          grant: validGrant("queue_failure_smoke"),
          inputs: {
            ...validInputs(),
            failureReason: "Expected failure smoke path.",
          },
          workflowId: "dependency_failure_smoke",
        }),
      ),
    ).toMatchObject({
      ok: true,
      status: "workflow_valid_not_executable",
    });
  });

  it("requires every Queue workflow safety constraint to be exactly true", () => {
    const constraints = [
      "noGit",
      "noValidationExecution",
      "noRollback",
      "noTerminal",
      "noDelete",
      "noDownstreamAutoStart",
    ] as const;

    for (const constraint of constraints) {
      const falseConstraint = validateQueueWorkflowRequest(
        validRequest({
          grant: validGrant("queue_acceptance_smoke", {
            constraints: {
              ...validConstraints(),
              [constraint]: false,
            },
          }),
        }),
      );
      expect(falseConstraint, `${constraint}=false`).toMatchObject({
        issues: expect.arrayContaining([
          expect.objectContaining({
            fieldPath: `$.grant.constraints.${constraint}`,
            reasonCode: "invalid_workflow_constraint",
          }),
        ]),
        ok: false,
      });

      const { [constraint]: _removed, ...missingConstraints } =
        validConstraints();
      const missingConstraint = validateQueueWorkflowRequest(
        validRequest({
          grant: validGrant("queue_acceptance_smoke", {
            constraints: missingConstraints,
          }),
        }),
      );
      expect(missingConstraint, `${constraint}=missing`).toMatchObject({
        issues: expect.arrayContaining([
          expect.objectContaining({
            fieldPath: `$.grant.constraints.${constraint}`,
            reasonCode: "missing_required_constraint",
          }),
        ]),
        ok: false,
      });
    }
  });

  it("marks review_acceptance and terminal_failure input validation deferred", () => {
    expect(
      validateQueueWorkflowRequest(
        validRequest({
          grant: validGrant("queue_operator_flow"),
          workflowId: "review_acceptance",
        }),
      ),
    ).toMatchObject({
      fieldPaths: ["$.inputs"],
      ok: false,
      status: "input_validation_deferred",
      workflowId: "review_acceptance",
    });

    expect(
      validateQueueWorkflowRequest(
        validRequest({
          grant: validGrant("queue_failure_smoke"),
          workflowId: "terminal_failure",
        }),
      ),
    ).toMatchObject({
      fieldPaths: ["$.inputs"],
      ok: false,
      status: "input_validation_deferred",
      workflowId: "terminal_failure",
    });
  });

  it("keeps the validator independent from Queue UI, visual shell, backend, and Tauri APIs", () => {
    const forbiddenFragments = [
      "AgentQueueV2Board",
      "AgentQueuePlaceholderWidget",
      "widgetV2/queueV2",
      "queue/details",
      "ModuleShell",
      "tokens.css",
      "widget.css",
      "invokeAsync",
      "@tauri-apps",
      "workspaceAgentBrokerActionRuntime",
      "createHobitAgentActionBroker",
      "queueAgentCapabilities",
      "startCodexDirectWork",
      "startWorker",
    ];

    for (const fragment of forbiddenFragments) {
      expect(validatorSource).not.toContain(fragment);
    }
  });
});

function validRequest(
  overrides: Partial<{
    grant: Record<string, unknown> | undefined;
    inputs: Record<string, unknown>;
    workflowId: QueueWorkflowId;
  }> = {},
) {
  const workflowId = overrides.workflowId ?? "dependency_acceptance_smoke";
  return {
    grant: validGrant("queue_acceptance_smoke"),
    inputs: validInputs(),
    moduleId: "queue",
    workflowId,
    workflowMetadata: QUEUE_MODULE_WORKFLOWS.find(
      (workflow) => workflow.workflowId === workflowId,
    ),
    ...overrides,
  };
}

function validGrant(mode: string, overrides: Record<string, unknown> = {}) {
  return {
    constraints: validConstraints(),
    mode,
    ...overrides,
  };
}

function validConstraints() {
  return {
    noDelete: true,
    noDownstreamAutoStart: true,
    noGit: true,
    noRollback: true,
    noTerminal: true,
    noValidationExecution: true,
  };
}

function validInputs(overrides: Record<string, unknown> = {}) {
  return {
    runSettings: validRunSettings(),
    tasks: validTasks(),
    ...overrides,
  };
}

function validRunSettings(overrides: Record<string, unknown> = {}) {
  return {
    approvalPolicy: "on_request",
    codexExecutable: "codex.cmd",
    executionPolicy: "manual",
    executionTarget: {
      kind: "queue_local",
      providerId: "codex",
      queueOwnerWidgetInstanceId: "agent-queue-widget-id",
    },
    sandbox: "workspace_write",
    workspaceRoot: "C:/repo",
    ...overrides,
  };
}

function legacyRunSettings(overrides: Record<string, unknown> = {}) {
  return {
    approvalPolicy: "on_request",
    codexExecutable: "codex.cmd",
    executionPolicy: "manual",
    executorWidgetId: "executor-widget-1",
    sandbox: "workspace_write",
    workspaceRoot: "C:/repo",
    ...overrides,
  };
}

function validTasks() {
  return [
    validTask({
      prompt: "Complete the upstream Queue dependency smoke task.",
      slot: "upstream",
      title: "Upstream",
    }),
    validTask({
      dependsOnSlots: ["upstream"],
      prompt: "Complete the downstream Queue dependency smoke task.",
      slot: "downstream",
      title: "Downstream",
    }),
  ];
}

function validTask(overrides: Record<string, unknown> = {}) {
  return {
    prompt: "Complete this Queue dependency smoke task.",
    slot: "upstream",
    title: "Queue task",
    ...overrides,
  };
}
