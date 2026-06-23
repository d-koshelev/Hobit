import {
  QUEUE_RUN_APPROVAL_POLICY_VALUES,
  QUEUE_RUN_SANDBOX_VALUES,
} from "../capabilities/queueCapabilityContracts";
import type {
  WorkflowGrant,
  WorkflowInputs,
} from "../broker/workflowGrantInputSplit";
import type {
  QueueModuleWorkflowMetadata,
  QueueWorkflowId,
} from "./queueWorkflowModuleMetadata";

export type QueueWorkflowRequestValidationStatus =
  | "workflow_valid_not_executable"
  | "input_validation_deferred"
  | "invalid_workflow_input"
  | "invalid_workflow_grant"
  | "missing_required_inputs"
  | "unsupported_workflow";

export type QueueWorkflowRequestValidationReasonCode =
  | "dependency_cycle"
  | "duplicate_task_slot"
  | "input_validation_deferred"
  | "invalid_approval_policy"
  | "invalid_run_settings"
  | "invalid_sandbox"
  | "invalid_task_dependency"
  | "invalid_task_slot"
  | "invalid_workflow_constraint"
  | "invalid_workflow_grant"
  | "invalid_workflow_input"
  | "invalid_workflow_grant_mode"
  | "missing_grant"
  | "missing_required_constraint"
  | "missing_required_input"
  | "unsupported_run_settings_field"
  | "unsupported_task_field"
  | "unsupported_workflow";

export type QueueWorkflowRequestValidationIssue = {
  fieldPath: string;
  message: string;
  reasonCode: QueueWorkflowRequestValidationReasonCode;
};

export type QueueWorkflowRequestValidationResult =
  | {
      fieldPaths: [];
      issues: [];
      ok: true;
      reasons: readonly string[];
      status: "workflow_valid_not_executable";
      workflowMetadata?: QueueModuleWorkflowMetadata;
      workflowId: QueueWorkflowId;
    }
  | {
      fieldPaths: readonly string[];
      issues: [];
      ok: false;
      reasons: readonly string[];
      status: "input_validation_deferred";
      workflowMetadata?: QueueModuleWorkflowMetadata;
      workflowId: QueueWorkflowId;
    }
  | {
      fieldPath: string;
      fieldPaths: readonly string[];
      issues: readonly QueueWorkflowRequestValidationIssue[];
      message: string;
      ok: false;
      reasonCode: Exclude<
        QueueWorkflowRequestValidationReasonCode,
        "input_validation_deferred"
      >;
      reasons: readonly string[];
      status: Exclude<
        QueueWorkflowRequestValidationStatus,
        "workflow_valid_not_executable" | "input_validation_deferred"
      >;
      workflowMetadata?: QueueModuleWorkflowMetadata;
      workflowId: QueueWorkflowId;
    };

type QueueWorkflowRequestValidationInput = {
  grant?: WorkflowGrant;
  inputs?: WorkflowInputs;
  moduleId: string;
  workflowId: string;
  workflowMetadata?: QueueModuleWorkflowMetadata;
};

type ValidatedTaskTemplate = {
  dependsOnSlots: readonly string[];
  index: number;
  slot: string;
};

const QUEUE_MODULE_ID = "queue";
const REQUIRED_SAFETY_CONSTRAINTS = [
  "noGit",
  "noValidationExecution",
  "noRollback",
  "noTerminal",
  "noDelete",
  "noDownstreamAutoStart",
] as const;
const ACCEPTANCE_GRANT_MODES = [
  "queue_acceptance_smoke",
  "queue_operator_flow",
] as const;
const FAILURE_GRANT_MODES = [
  "queue_failure_smoke",
  "queue_operator_flow",
] as const;
const REVIEW_GRANT_MODES = [
  "queue_acceptance_smoke",
  "queue_failure_smoke",
  "queue_operator_flow",
] as const;
const TERMINAL_FAILURE_GRANT_MODES = [
  "queue_failure_smoke",
  "queue_operator_flow",
] as const;
const DEPENDENCY_SMOKE_REQUIRED_SLOTS = ["upstream", "downstream"] as const;
const SUPPORTED_TASK_TEMPLATE_FIELDS = new Set([
  "dependsOnSlots",
  "prompt",
  "slot",
  "title",
]);
const SUPPORTED_RUN_SETTINGS_FIELDS = new Set([
  "approvalPolicy",
  "codexExecutable",
  "executionPolicy",
  "executionTarget",
  "executorWidgetId",
  "sandbox",
  "workspaceRoot",
]);
const SUPPORTED_EXECUTION_TARGET_FIELDS = new Set([
  "executorWidgetId",
  "kind",
  "providerId",
  "queueOwnerWidgetInstanceId",
]);
const SLOT_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

export function validateQueueWorkflowRequest(
  request: QueueWorkflowRequestValidationInput,
): QueueWorkflowRequestValidationResult {
  if (request.moduleId !== QUEUE_MODULE_ID) {
    return invalidResult({
      issues: [
        issue({
          fieldPath: "$.moduleId",
          message: "Queue workflow validation only supports moduleId queue.",
          reasonCode: "unsupported_workflow",
        }),
      ],
      status: "unsupported_workflow",
      workflowId: toQueueWorkflowId(request.workflowId),
      workflowMetadata: request.workflowMetadata,
    });
  }

  switch (request.workflowId) {
    case "dependency_acceptance_smoke":
      return validateDependencySmokeWorkflow({
        grant: request.grant,
        inputs: request.inputs,
        requiredGrantModes: ACCEPTANCE_GRANT_MODES,
        requireFailureReason: false,
        workflowId: request.workflowId,
        workflowMetadata: request.workflowMetadata,
      });
    case "dependency_failure_smoke":
      return validateDependencySmokeWorkflow({
        grant: request.grant,
        inputs: request.inputs,
        requiredGrantModes: FAILURE_GRANT_MODES,
        requireFailureReason: false,
        workflowId: request.workflowId,
        workflowMetadata: request.workflowMetadata,
      });
    case "review_acceptance":
      return validateDeferredWorkflow({
        grant: request.grant,
        requiredGrantModes: REVIEW_GRANT_MODES,
        workflowId: request.workflowId,
        workflowMetadata: request.workflowMetadata,
      });
    case "terminal_failure":
      return validateDeferredWorkflow({
        grant: request.grant,
        requiredGrantModes: TERMINAL_FAILURE_GRANT_MODES,
        workflowId: request.workflowId,
        workflowMetadata: request.workflowMetadata,
      });
    default:
      return invalidResult({
        issues: [
          issue({
            fieldPath: "$.workflowId",
            message: `${request.workflowId} is not a supported Queue workflow id.`,
            reasonCode: "unsupported_workflow",
          }),
        ],
        status: "unsupported_workflow",
        workflowId: toQueueWorkflowId(request.workflowId),
        workflowMetadata: request.workflowMetadata,
      });
  }
}

function validateDependencySmokeWorkflow({
  grant,
  inputs,
  requiredGrantModes,
  requireFailureReason,
  workflowId,
  workflowMetadata,
}: {
  grant?: WorkflowGrant;
  inputs?: WorkflowInputs;
  requiredGrantModes: readonly string[];
  requireFailureReason: boolean;
  workflowId: QueueWorkflowId;
  workflowMetadata?: QueueModuleWorkflowMetadata;
}): QueueWorkflowRequestValidationResult {
  if (isWorkerEvidenceContinuation(inputs)) {
    const issues = [
      ...validateGrant(grant, requiredGrantModes),
      ...validateWorkerEvidenceContinuationInputs(inputs),
    ];
    if (issues.length > 0) {
      return invalidResult({
        issues,
        status: statusForIssues(issues),
        workflowId,
        workflowMetadata,
      });
    }
    return validNotExecutableResult({ workflowId, workflowMetadata });
  }

  if (isDependencySmokeContinuation(inputs)) {
    const issues = validateGrant(grant, requiredGrantModes);
    if (issues.length > 0) {
      return invalidResult({
        issues,
        status: statusForIssues(issues),
        workflowId,
        workflowMetadata,
      });
    }
    return validNotExecutableResult({ workflowId, workflowMetadata });
  }

  const issues = [
    ...validateGrant(grant, requiredGrantModes),
    ...validateCommonDependencyInputs(inputs),
    ...(requireFailureReason ? validateFailureReason(inputs) : []),
  ];

  if (issues.length > 0) {
    return invalidResult({
      issues,
      status: statusForIssues(issues),
      workflowId,
      workflowMetadata,
    });
  }

  return validNotExecutableResult({ workflowId, workflowMetadata });
}

function isWorkerEvidenceContinuation(inputs: WorkflowInputs | undefined): boolean {
  if (!isRecord(inputs)) {
    return false;
  }
  return inputs.phase === "worker_evidence" || isRecord(inputs.workerEvidence);
}

function isDependencySmokeContinuation(inputs: WorkflowInputs | undefined): boolean {
  if (!isRecord(inputs)) {
    return false;
  }
  return inputs.phase === "review" || inputs.phase === "finalization";
}

function validateWorkerEvidenceContinuationInputs(
  inputs: WorkflowInputs | undefined,
): QueueWorkflowRequestValidationIssue[] {
  const issues: QueueWorkflowRequestValidationIssue[] = [];
  if (isRecord(inputs) && inputs.phase === "worker_evidence" && inputs.workerEvidence === undefined) {
    return issues;
  }
  if (!isRecord(inputs) || !isRecord(inputs.workerEvidence)) {
    return [
      issue({
        fieldPath: "$.inputs.workerEvidence",
        message:
          "inputs.workerEvidence is required for Queue worker evidence recording.",
        reasonCode: "missing_required_input",
      }),
    ];
  }

  const evidence = inputs.workerEvidence;
  if (evidence.slot !== "upstream") {
    issues.push(
      issue({
        fieldPath: "$.inputs.workerEvidence.slot",
        message: "inputs.workerEvidence.slot must be upstream.",
        reasonCode: "invalid_workflow_input",
      }),
    );
  }
  if (!nonEmptyString(evidence.taskId)) {
    issues.push(
      issue({
        fieldPath: "$.inputs.workerEvidence.taskId",
        message: "inputs.workerEvidence.taskId must be a non-empty string.",
        reasonCode: "missing_required_input",
      }),
    );
  }
  if (!nonEmptyString(evidence.runId)) {
    issues.push(
      issue({
        fieldPath: "$.inputs.workerEvidence.runId",
        message: "inputs.workerEvidence.runId must be a non-empty string.",
        reasonCode: "missing_required_input",
      }),
    );
  }
  if (
    evidence.outcome !== "completed" &&
    evidence.outcome !== "not_completed" &&
    evidence.outcome !== "failed"
  ) {
    issues.push(
      issue({
        fieldPath: "$.inputs.workerEvidence.outcome",
        message:
          "inputs.workerEvidence.outcome must be completed, not_completed, or failed.",
        reasonCode: "invalid_workflow_input",
      }),
    );
  }
  if (
    evidence.changedFiles !== undefined &&
    (!Array.isArray(evidence.changedFiles) ||
      evidence.changedFiles.some((item) => typeof item !== "string"))
  ) {
    issues.push(
      issue({
        fieldPath: "$.inputs.workerEvidence.changedFiles",
        message: "inputs.workerEvidence.changedFiles must be an array of strings.",
        reasonCode: "invalid_workflow_input",
      }),
    );
  }

  return issues;
}

function validateDeferredWorkflow({
  grant,
  requiredGrantModes,
  workflowId,
  workflowMetadata,
}: {
  grant?: WorkflowGrant;
  requiredGrantModes: readonly string[];
  workflowId: QueueWorkflowId;
  workflowMetadata?: QueueModuleWorkflowMetadata;
}): QueueWorkflowRequestValidationResult {
  const grantIssues = validateGrant(grant, requiredGrantModes);
  if (grantIssues.length > 0) {
    return invalidResult({
      issues: grantIssues,
      status: "invalid_workflow_grant",
      workflowId,
      workflowMetadata,
    });
  }

  return {
    fieldPaths: ["$.inputs"],
    issues: [],
    ok: false,
    reasons: [
      `${workflowId} is declared, but Queue workflow input validation is deferred until the typed runner/input contract is narrowed.`,
      "No Queue workflow phase is executed and no Queue state is mutated.",
    ],
    status: "input_validation_deferred",
    ...(workflowMetadata ? { workflowMetadata } : {}),
    workflowId,
  };
}

function validateGrant(
  grant: WorkflowGrant | undefined,
  requiredGrantModes: readonly string[],
): QueueWorkflowRequestValidationIssue[] {
  const issues: QueueWorkflowRequestValidationIssue[] = [];
  if (!isRecord(grant)) {
    return [
      issue({
        fieldPath: "$.grant",
        message:
          "Queue workflow grant is required and must be a JSON object with permission/scope metadata.",
        reasonCode: "missing_grant",
      }),
    ];
  }

  const mode = typeof grant.mode === "string" ? grant.mode.trim() : "";
  if (!mode) {
    issues.push(
      issue({
        fieldPath: "$.grant.mode",
        message: `Queue workflow grant mode is required. Allowed modes: ${requiredGrantModes.join(", ")}.`,
        reasonCode: "invalid_workflow_grant_mode",
      }),
    );
  } else if (!requiredGrantModes.includes(mode)) {
    issues.push(
      issue({
        fieldPath: "$.grant.mode",
        message: `Queue workflow grant mode must be one of ${requiredGrantModes.join(", ")}.`,
        reasonCode: "invalid_workflow_grant_mode",
      }),
    );
  }

  const constraints = grant.constraints;
  if (!isRecord(constraints)) {
    issues.push(
      issue({
        fieldPath: "$.grant.constraints",
        message:
          "Queue workflow grant constraints are required and must be a JSON object.",
        reasonCode: "missing_required_constraint",
      }),
    );
    return issues;
  }

  for (const constraint of REQUIRED_SAFETY_CONSTRAINTS) {
    const value = constraints[constraint];
    if (value === undefined) {
      issues.push(
        issue({
          fieldPath: `$.grant.constraints.${constraint}`,
          message: `${constraint} must be explicitly true for Queue workflow validation.`,
          reasonCode: "missing_required_constraint",
        }),
      );
      continue;
    }
    if (value !== true) {
      issues.push(
        issue({
          fieldPath: `$.grant.constraints.${constraint}`,
          message: `${constraint} must be exactly true for Queue workflow validation.`,
          reasonCode: "invalid_workflow_constraint",
        }),
      );
    }
  }

  return issues;
}

function validateCommonDependencyInputs(
  inputs: WorkflowInputs | undefined,
): QueueWorkflowRequestValidationIssue[] {
  const issues: QueueWorkflowRequestValidationIssue[] = [];
  if (!isRecord(inputs)) {
    return [
      issue({
        fieldPath: "$.inputs",
        message: "Queue workflow inputs are required and must be a JSON object.",
        reasonCode: "missing_required_input",
      }),
    ];
  }

  issues.push(...validateRunSettings(inputs.runSettings));
  issues.push(...validateTasks(inputs.tasks));

  return issues;
}

function validateRunSettings(
  value: unknown,
): QueueWorkflowRequestValidationIssue[] {
  const issues: QueueWorkflowRequestValidationIssue[] = [];
  if (!isRecord(value)) {
    return [
      issue({
        fieldPath: "$.inputs.runSettings",
        message:
          "inputs.runSettings is required and must contain codexExecutable, workspaceRoot, sandbox, approvalPolicy, executionPolicy, and a typed executionTarget or legacy executorWidgetId.",
        reasonCode: "missing_required_input",
      }),
    ];
  }

  for (const fieldName of Object.keys(value)) {
    if (!SUPPORTED_RUN_SETTINGS_FIELDS.has(fieldName)) {
      issues.push(
        issue({
          fieldPath: `$.inputs.runSettings.${fieldName}`,
          message: `runSettings field ${fieldName} is not supported by Queue workflow validation.`,
          reasonCode: "unsupported_run_settings_field",
        }),
      );
    }
  }

  if (!nonEmptyString(value.codexExecutable)) {
    issues.push(
      issue({
        fieldPath: "$.inputs.runSettings.codexExecutable",
        message: "inputs.runSettings.codexExecutable must be a non-empty string.",
        reasonCode: "missing_required_input",
      }),
    );
  }
  if (!nonEmptyString(value.workspaceRoot)) {
    issues.push(
      issue({
        fieldPath: "$.inputs.runSettings.workspaceRoot",
        message: "inputs.runSettings.workspaceRoot must be a non-empty string.",
        reasonCode: "missing_required_input",
      }),
    );
  }
  if (!QUEUE_RUN_SANDBOX_VALUES.includes(value.sandbox as never)) {
    issues.push(
      issue({
        fieldPath: "$.inputs.runSettings.sandbox",
        message: `inputs.runSettings.sandbox must be one of ${QUEUE_RUN_SANDBOX_VALUES.join(", ")}.`,
        reasonCode: "invalid_sandbox",
      }),
    );
  }
  if (!QUEUE_RUN_APPROVAL_POLICY_VALUES.includes(value.approvalPolicy as never)) {
    issues.push(
      issue({
        fieldPath: "$.inputs.runSettings.approvalPolicy",
        message: `inputs.runSettings.approvalPolicy must be one of ${QUEUE_RUN_APPROVAL_POLICY_VALUES.join(", ")}.`,
        reasonCode: "invalid_approval_policy",
      }),
    );
  }
  if (value.executionPolicy !== "manual") {
    issues.push(
      issue({
        fieldPath: "$.inputs.runSettings.executionPolicy",
        message: "inputs.runSettings.executionPolicy must be manual.",
        reasonCode: "invalid_run_settings",
      }),
    );
  }
  issues.push(...validateExecutionTarget(value.executionTarget, value.executorWidgetId));

  return issues;
}

function validateExecutionTarget(
  executionTarget: unknown,
  legacyExecutorWidgetId: unknown,
): QueueWorkflowRequestValidationIssue[] {
  const issues: QueueWorkflowRequestValidationIssue[] = [];
  if (executionTarget === undefined) {
    if (!nonEmptyString(legacyExecutorWidgetId)) {
      issues.push(
        issue({
          fieldPath: "$.inputs.runSettings.executionTarget",
          message:
            "inputs.runSettings.executionTarget is required unless legacy executorWidgetId is supplied.",
          reasonCode: "missing_required_input",
        }),
      );
    }
    return issues;
  }

  if (!isRecord(executionTarget)) {
    issues.push(
      issue({
        fieldPath: "$.inputs.runSettings.executionTarget",
        message: "inputs.runSettings.executionTarget must be a typed JSON object.",
        reasonCode: "invalid_run_settings",
      }),
    );
    return issues;
  }

  for (const fieldName of Object.keys(executionTarget)) {
    if (!SUPPORTED_EXECUTION_TARGET_FIELDS.has(fieldName)) {
      issues.push(
        issue({
          fieldPath: `$.inputs.runSettings.executionTarget.${fieldName}`,
          message: `executionTarget field ${fieldName} is not supported by Queue workflow validation.`,
          reasonCode: "unsupported_run_settings_field",
        }),
      );
    }
  }

  if (executionTarget.providerId !== "codex") {
    issues.push(
      issue({
        fieldPath: "$.inputs.runSettings.executionTarget.providerId",
        message:
          "inputs.runSettings.executionTarget.providerId must be codex for this Queue workflow MVP.",
        reasonCode: "invalid_run_settings",
      }),
    );
  }

  switch (executionTarget.kind) {
    case "queue_local":
      if (!nonEmptyString(executionTarget.queueOwnerWidgetInstanceId)) {
        issues.push(
          issue({
            fieldPath:
              "$.inputs.runSettings.executionTarget.queueOwnerWidgetInstanceId",
            message:
              "queue_local executionTarget requires queueOwnerWidgetInstanceId.",
            reasonCode: "missing_required_input",
          }),
        );
      }
      if (executionTarget.executorWidgetId !== undefined) {
        issues.push(
          issue({
            fieldPath: "$.inputs.runSettings.executionTarget.executorWidgetId",
            message:
              "queue_local executionTarget must not include executorWidgetId.",
            reasonCode: "invalid_run_settings",
          }),
        );
      }
      break;
    case "agent_executor":
      if (!nonEmptyString(executionTarget.executorWidgetId)) {
        issues.push(
          issue({
            fieldPath: "$.inputs.runSettings.executionTarget.executorWidgetId",
            message:
              "legacy agent_executor executionTarget requires executorWidgetId.",
            reasonCode: "missing_required_input",
          }),
        );
      }
      if (executionTarget.queueOwnerWidgetInstanceId !== undefined) {
        issues.push(
          issue({
            fieldPath:
              "$.inputs.runSettings.executionTarget.queueOwnerWidgetInstanceId",
            message:
              "legacy agent_executor executionTarget must not include queueOwnerWidgetInstanceId.",
            reasonCode: "invalid_run_settings",
          }),
        );
      }
      break;
    default:
      issues.push(
        issue({
          fieldPath: "$.inputs.runSettings.executionTarget.kind",
          message:
            "inputs.runSettings.executionTarget.kind must be queue_local or agent_executor.",
          reasonCode: "invalid_run_settings",
        }),
      );
      break;
  }

  return issues;
}

function validateTasks(value: unknown): QueueWorkflowRequestValidationIssue[] {
  const issues: QueueWorkflowRequestValidationIssue[] = [];
  if (!Array.isArray(value) || value.length === 0) {
    return [
      issue({
        fieldPath: "$.inputs.tasks",
        message: "inputs.tasks is required and must be a non-empty array.",
        reasonCode: "missing_required_input",
      }),
    ];
  }

  const tasks: ValidatedTaskTemplate[] = [];
  const slots = new Map<string, number>();

  value.forEach((task, index) => {
    if (!isRecord(task)) {
      issues.push(
        issue({
          fieldPath: `$.inputs.tasks[${index}]`,
          message: "Queue workflow task template must be a JSON object.",
          reasonCode: "invalid_workflow_input",
        }),
      );
      return;
    }

    for (const fieldName of Object.keys(task)) {
      if (!SUPPORTED_TASK_TEMPLATE_FIELDS.has(fieldName)) {
        issues.push(
          issue({
            fieldPath: `$.inputs.tasks[${index}].${fieldName}`,
            message: `Task template field ${fieldName} is not supported by Queue workflow validation.`,
            reasonCode: "unsupported_task_field",
          }),
        );
      }
    }

    const slot = typeof task.slot === "string" ? task.slot.trim() : "";
    if (!slot) {
      issues.push(
        issue({
          fieldPath: `$.inputs.tasks[${index}].slot`,
          message: "Task template slot is required.",
          reasonCode: "missing_required_input",
        }),
      );
    } else if (!SLOT_PATTERN.test(slot)) {
      issues.push(
        issue({
          fieldPath: `$.inputs.tasks[${index}].slot`,
          message:
            "Task template slot must be a stable identifier using letters, numbers, underscore, or hyphen and must start with a letter.",
          reasonCode: "invalid_task_slot",
        }),
      );
    } else {
      const existingIndex = slots.get(slot);
      if (existingIndex !== undefined) {
        issues.push(
          issue({
            fieldPath: `$.inputs.tasks[${index}].slot`,
            message: `Task template slot ${slot} duplicates $.inputs.tasks[${existingIndex}].slot.`,
            reasonCode: "duplicate_task_slot",
          }),
        );
      } else {
        slots.set(slot, index);
      }
    }

    if (!nonEmptyString(task.title)) {
      issues.push(
        issue({
          fieldPath: `$.inputs.tasks[${index}].title`,
          message: "Task template title must be a non-empty string.",
          reasonCode: "missing_required_input",
        }),
      );
    }
    if (!nonEmptyString(task.prompt)) {
      issues.push(
        issue({
          fieldPath: `$.inputs.tasks[${index}].prompt`,
          message: "Task template prompt must be a non-empty string.",
          reasonCode: "missing_required_input",
        }),
      );
    }

    const dependsOnSlots = validateDependsOnSlots(task.dependsOnSlots, index);
    issues.push(...dependsOnSlots.issues);
    if (slot && SLOT_PATTERN.test(slot)) {
      tasks.push({
        dependsOnSlots: dependsOnSlots.slots,
        index,
        slot,
      });
    }
  });

  if (tasks.length === 0) {
    return issues;
  }

  issues.push(...validateDependencyReferences(tasks));
  issues.push(...validateRequiredDependencySmokeSlots(tasks));
  issues.push(...validateDependencyCycles(tasks));

  return issues;
}

function validateDependsOnSlots(value: unknown, taskIndex: number) {
  const issues: QueueWorkflowRequestValidationIssue[] = [];
  if (value === undefined) {
    return { issues, slots: [] };
  }
  if (!Array.isArray(value)) {
    return {
      issues: [
        issue({
          fieldPath: `$.inputs.tasks[${taskIndex}].dependsOnSlots`,
          message: "dependsOnSlots must be an array of task slot identifiers.",
          reasonCode: "invalid_task_dependency",
        }),
      ],
      slots: [],
    };
  }

  const slots: string[] = [];
  value.forEach((item, dependencyIndex) => {
    const dependencySlot = typeof item === "string" ? item.trim() : "";
    if (!dependencySlot || !SLOT_PATTERN.test(dependencySlot)) {
      issues.push(
        issue({
          fieldPath: `$.inputs.tasks[${taskIndex}].dependsOnSlots[${dependencyIndex}]`,
          message:
            "dependsOnSlots entries must be stable task slot identifiers.",
          reasonCode: "invalid_task_dependency",
        }),
      );
      return;
    }
    slots.push(dependencySlot);
  });

  return { issues, slots };
}

function validateDependencyReferences(
  tasks: readonly ValidatedTaskTemplate[],
): QueueWorkflowRequestValidationIssue[] {
  const issues: QueueWorkflowRequestValidationIssue[] = [];
  const slots = new Set(tasks.map((task) => task.slot));

  for (const task of tasks) {
    for (const dependencySlot of task.dependsOnSlots) {
      if (dependencySlot === task.slot) {
        issues.push(
          issue({
            fieldPath: `$.inputs.tasks[${task.index}].dependsOnSlots`,
            message: `Task slot ${task.slot} cannot depend on itself.`,
            reasonCode: "invalid_task_dependency",
          }),
        );
      }
      if (!slots.has(dependencySlot)) {
        issues.push(
          issue({
            fieldPath: `$.inputs.tasks[${task.index}].dependsOnSlots`,
            message: `dependsOnSlots references unknown task slot ${dependencySlot}.`,
            reasonCode: "invalid_task_dependency",
          }),
        );
      }
    }
  }

  return issues;
}

function validateRequiredDependencySmokeSlots(
  tasks: readonly ValidatedTaskTemplate[],
): QueueWorkflowRequestValidationIssue[] {
  const issues: QueueWorkflowRequestValidationIssue[] = [];
  const taskBySlot = new Map(tasks.map((task) => [task.slot, task]));
  for (const slot of DEPENDENCY_SMOKE_REQUIRED_SLOTS) {
    if (!taskBySlot.has(slot)) {
      issues.push(
        issue({
          fieldPath: "$.inputs.tasks",
          message: `dependency smoke workflows require task slot ${slot}.`,
          reasonCode: "missing_required_input",
        }),
      );
    }
  }

  const downstream = taskBySlot.get("downstream");
  if (downstream && !downstream.dependsOnSlots.includes("upstream")) {
    issues.push(
      issue({
        fieldPath: `$.inputs.tasks[${downstream.index}].dependsOnSlots`,
        message:
          "dependency smoke workflows require downstream.dependsOnSlots to include upstream.",
        reasonCode: "invalid_task_dependency",
      }),
    );
  }

  return issues;
}

function validateDependencyCycles(
  tasks: readonly ValidatedTaskTemplate[],
): QueueWorkflowRequestValidationIssue[] {
  const issues: QueueWorkflowRequestValidationIssue[] = [];
  const taskBySlot = new Map(tasks.map((task) => [task.slot, task]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const reported = new Set<string>();

  function visit(slot: string, path: readonly string[]) {
    if (visiting.has(slot)) {
      const cycleStart = path.indexOf(slot);
      const cycle = [...path.slice(Math.max(0, cycleStart)), slot].join(" -> ");
      if (!reported.has(cycle)) {
        reported.add(cycle);
        const task = taskBySlot.get(slot);
        issues.push(
          issue({
            fieldPath: task
              ? `$.inputs.tasks[${task.index}].dependsOnSlots`
              : "$.inputs.tasks",
            message: `Task dependency cycle detected: ${cycle}.`,
            reasonCode: "dependency_cycle",
          }),
        );
      }
      return;
    }
    if (visited.has(slot)) {
      return;
    }

    const task = taskBySlot.get(slot);
    if (!task) {
      return;
    }

    visiting.add(slot);
    for (const dependencySlot of task.dependsOnSlots) {
      visit(dependencySlot, [...path, slot]);
    }
    visiting.delete(slot);
    visited.add(slot);
  }

  for (const task of tasks) {
    visit(task.slot, []);
  }

  return issues;
}

function validateFailureReason(
  inputs: WorkflowInputs | undefined,
): QueueWorkflowRequestValidationIssue[] {
  if (isRecord(inputs) && nonEmptyString(inputs.failureReason)) {
    return [];
  }

  return [
    issue({
      fieldPath: "$.inputs.failureReason",
      message:
        "inputs.failureReason is required for dependency_failure_smoke.",
      reasonCode: "missing_required_input",
    }),
  ];
}

function validNotExecutableResult({
  workflowId,
  workflowMetadata,
}: {
  workflowId: QueueWorkflowId;
  workflowMetadata?: QueueModuleWorkflowMetadata;
}): QueueWorkflowRequestValidationResult {
  return {
    fieldPaths: [],
    issues: [],
    ok: true,
    reasons: [
      "Queue workflow request validated; supported QueueWorkflowRunner phases can run through the runtime adapter when explicit typed Queue inputs are supplied.",
      "Validation itself does not call Queue capabilities or mutate Queue state.",
      "Runtime workflow integration is limited to typed create/setup/start, worker-evidence, read, review, and finalization ports; validation, Git, rollback, Terminal, and downstream auto-start are not performed.",
    ],
    status: "workflow_valid_not_executable",
    ...(workflowMetadata ? { workflowMetadata } : {}),
    workflowId,
  };
}

function invalidResult({
  issues,
  status,
  workflowId,
  workflowMetadata,
}: {
  issues: readonly QueueWorkflowRequestValidationIssue[];
  status: Exclude<
    QueueWorkflowRequestValidationStatus,
    "workflow_valid_not_executable" | "input_validation_deferred"
  >;
  workflowId: QueueWorkflowId;
  workflowMetadata?: QueueModuleWorkflowMetadata;
}): QueueWorkflowRequestValidationResult {
  const firstIssue =
    issues[0] ??
    issue({
      fieldPath: "$",
      message: "Queue workflow request is invalid.",
      reasonCode: "invalid_workflow_input",
    });
  const reasonCode = invalidReasonCode(firstIssue.reasonCode);

  return {
    fieldPath: firstIssue.fieldPath,
    fieldPaths: issues.map((item) => item.fieldPath),
    issues,
    message: firstIssue.message,
    ok: false,
    reasonCode,
    reasons: issues.map(issueReason),
    status,
    ...(workflowMetadata ? { workflowMetadata } : {}),
    workflowId,
  };
}

function invalidReasonCode(
  reasonCode: QueueWorkflowRequestValidationReasonCode,
): Exclude<QueueWorkflowRequestValidationReasonCode, "input_validation_deferred"> {
  return reasonCode === "input_validation_deferred"
    ? "invalid_workflow_input"
    : reasonCode;
}

function statusForIssues(
  issues: readonly QueueWorkflowRequestValidationIssue[],
): Exclude<
  QueueWorkflowRequestValidationStatus,
  "workflow_valid_not_executable" | "input_validation_deferred"
> {
  if (
    issues.some((item) =>
      [
        "invalid_workflow_grant",
        "invalid_workflow_grant_mode",
        "invalid_workflow_constraint",
        "missing_grant",
        "missing_required_constraint",
      ].includes(item.reasonCode),
    )
  ) {
    return "invalid_workflow_grant";
  }

  if (issues.some((item) => item.reasonCode === "missing_required_input")) {
    return "missing_required_inputs";
  }

  if (issues.some((item) => item.reasonCode === "unsupported_workflow")) {
    return "unsupported_workflow";
  }

  return "invalid_workflow_input";
}

function issue({
  fieldPath,
  message,
  reasonCode,
}: QueueWorkflowRequestValidationIssue): QueueWorkflowRequestValidationIssue {
  return { fieldPath, message, reasonCode };
}

function issueReason(item: QueueWorkflowRequestValidationIssue) {
  return `${item.fieldPath}: ${item.message}`;
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && Boolean(value.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toQueueWorkflowId(value: string): QueueWorkflowId {
  return value as QueueWorkflowId;
}
