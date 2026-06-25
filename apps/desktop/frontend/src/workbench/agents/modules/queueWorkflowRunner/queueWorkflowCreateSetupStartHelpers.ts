import type {
  AgentQueueWorkflowApplyRunSettingsResult,
  AgentQueueWorkflowExecutionTarget,
  AgentQueueWorkflowMaterializeTaskSlotResult,
  AgentQueueWorkflowPromoteTaskSlotResult,
  ApplyAgentQueueWorkflowRunSettingsRequest,
  MaterializeAgentQueueWorkflowTaskSlotRequest,
  StartAssignedAgentQueueTaskResponse,
} from "../../../../workspace/types";
import {
  DEPENDENCY_WORKFLOWS,
  EMPTY_CREATE_SETUP_START_REPORT,
  QUEUE_FINALIZATION_CONFIRMATION_TOKEN,
  QUEUE_MODULE_ID,
} from "./queueWorkflowRunnerConstants";
import {
  cleanString,
  isRecord,
  numberInput,
  recordRecord,
  recordString,
  stringArray,
  stripUndefined,
} from "./queueWorkflowRunnerRefs";
import type {
  QueueWorkflowCreateSetupStartReport,
  QueueWorkflowCreateSetupStartRunnerInput,
  QueueWorkflowRunnerBlocker,
  QueueWorkflowRunnerRequest,
  QueueWorkflowVariables,
} from "./queueWorkflowRunnerTypes";

type QueueWorkflowResolvedTaskSlotInput = {
  dependsOnSlots: string[];
  taskSpec: MaterializeAgentQueueWorkflowTaskSlotRequest["taskSpec"];
  taskSpecHash?: string | null;
};

type QueueWorkflowResolvedRunSettingsInput = {
  expectedQueueControlVersion?: number | null;
  runSettings: ApplyAgentQueueWorkflowRunSettingsRequest["runSettings"];
  stderrCapBytes?: number | null;
  stdoutCapBytes?: number | null;
  timeoutMs?: number | null;
};

type QueueWorkflowResolvedCreateSetupStartInput = {
  downstream: QueueWorkflowResolvedTaskSlotInput;
  expectedQueueControlVersion?: number | null;
  runSettings: ApplyAgentQueueWorkflowRunSettingsRequest["runSettings"];
  stderrCapBytes?: number | null;
  stdoutCapBytes?: number | null;
  timeoutMs?: number | null;
  upstream: QueueWorkflowResolvedTaskSlotInput;
};

type QueueWorkflowCreateSetupStartInputResolution =
  | { ok: true; value: QueueWorkflowResolvedCreateSetupStartInput }
  | { blocker: QueueWorkflowRunnerBlocker; ok: false };

type QueueWorkflowCreateSetupStartConfirmationResolution =
  | { ok: true; token: string }
  | { blocker: QueueWorkflowRunnerBlocker; ok: false };

export function createSetupStartReportForInput(
  input: QueueWorkflowCreateSetupStartRunnerInput,
): QueueWorkflowCreateSetupStartReport {
  return {
    ...EMPTY_CREATE_SETUP_START_REPORT,
    supportedWorkflow: DEPENDENCY_WORKFLOWS.has(input.request.workflowId),
    workflowRunId: input.workflowRunId,
  };
}

export function validateCreateSetupStartRunnerBoundary({
  request,
  validation,
  workflowRunId,
}: QueueWorkflowCreateSetupStartRunnerInput): QueueWorkflowRunnerBlocker | null {
  if (request.moduleId !== QUEUE_MODULE_ID) {
    return {
      fieldPath: "$.moduleId",
      message: "Queue create/setup/start workflow runner only accepts moduleId queue.",
      reasonCode: "invalid_request",
    };
  }

  if (validation.workflowId !== request.workflowId) {
    return {
      fieldPath: "$.workflowId",
      message: "Queue workflow validation result does not match the request workflowId.",
      reasonCode: "invalid_request",
    };
  }

  if (validation.status === "input_validation_deferred") {
    return {
      fieldPath: "$.workflowId",
      message:
        "Queue create/setup/start workflow runner requires fully validated dependency workflow inputs.",
      reasonCode: "input_validation_deferred",
    };
  }

  if (!validation.ok) {
    return {
      fieldPath: validation.fieldPath,
      message: validation.message,
      reasonCode: "invalid_request",
    };
  }

  if (validation.status !== "workflow_valid_not_executable") {
    return {
      fieldPath: "$.workflowId",
      message: "Queue workflow request has not passed Queue workflow validation.",
      reasonCode: "invalid_request",
    };
  }

  if (!DEPENDENCY_WORKFLOWS.has(request.workflowId)) {
    return {
      fieldPath: "$.workflowId",
      message: `${request.workflowId} is not supported by the Queue create/setup/start workflow runner.`,
      reasonCode: "workflow_not_supported_read_only",
    };
  }

  if (!workflowRunId.trim()) {
    return {
      fieldPath: "$.metadata.workflowRunId",
      message: "Queue create/setup/start workflow runner requires a durable workflowRunId.",
      reasonCode: "missing_workflow_run_id",
    };
  }

  return null;
}

export function resolveCreateSetupStartInput(
  request: QueueWorkflowRunnerRequest,
): QueueWorkflowCreateSetupStartInputResolution {
  const upstream = resolveTaskSlotInput(request, "upstream");
  if (!upstream.ok) {
    return upstream;
  }
  const downstream = resolveTaskSlotInput(request, "downstream");
  if (!downstream.ok) {
    return downstream;
  }
  if (!downstream.value.dependsOnSlots.includes("upstream")) {
    return {
      blocker: {
        fieldPath: "$.inputs.tasks",
        message:
          "Queue create/setup/start requires downstream.dependsOnSlots to explicitly include upstream.",
        reasonCode: "blocked_materialization",
        slot: "downstream",
      },
      ok: false,
    };
  }

  const runSettings = resolveRunSettingsInput(request);
  if (!runSettings.ok) {
    return runSettings;
  }

  return {
    ok: true,
    value: {
      downstream: downstream.value,
      expectedQueueControlVersion: runSettings.value.expectedQueueControlVersion,
      runSettings: runSettings.value.runSettings,
      stderrCapBytes: runSettings.value.stderrCapBytes,
      stdoutCapBytes: runSettings.value.stdoutCapBytes,
      timeoutMs: runSettings.value.timeoutMs,
      upstream: upstream.value,
    },
  };
}

function resolveTaskSlotInput(
  request: QueueWorkflowRunnerRequest,
  slot: "downstream" | "upstream",
):
  | { ok: true; value: QueueWorkflowResolvedTaskSlotInput }
  | { blocker: QueueWorkflowRunnerBlocker; ok: false } {
  const tasks = Array.isArray(request.inputs?.tasks) ? request.inputs.tasks : [];
  const task = tasks.find(
    (candidate: unknown) =>
      isRecord(candidate) && cleanString(candidate.slot) === slot,
  );
  if (!isRecord(task)) {
    return {
      blocker: {
        fieldPath: "$.inputs.tasks",
        message: `Queue create/setup/start requires typed taskSpec for slot ${slot}.`,
        reasonCode: "missing_task_spec",
        slot,
      },
      ok: false,
    };
  }

  const title = cleanString(task.title);
  const prompt = cleanString(task.prompt);
  if (!title || !prompt) {
    return {
      blocker: {
        fieldPath: "$.inputs.tasks",
        message: `Queue create/setup/start requires non-empty title and prompt for slot ${slot}.`,
        reasonCode: "missing_task_spec",
        slot,
      },
      ok: false,
    };
  }

  return {
    ok: true,
    value: {
      dependsOnSlots: stringArray(task.dependsOnSlots),
      taskSpec: stripUndefined({
        description: cleanString(task.description) ?? null,
        priority: numberInput(task.priority),
        prompt,
        status: cleanString(task.status) ?? null,
        title,
      }),
      taskSpecHash: cleanString(task.taskSpecHash) ?? null,
    },
  };
}

function resolveRunSettingsInput(
  request: QueueWorkflowRunnerRequest,
):
  | { ok: true; value: QueueWorkflowResolvedRunSettingsInput }
  | { blocker: QueueWorkflowRunnerBlocker; ok: false } {
  const runSettingsInput = recordRecord(request.inputs, "runSettings");
  if (!runSettingsInput) {
    return {
      blocker: {
        fieldPath: "$.inputs.runSettings",
        message: "Queue create/setup/start requires typed upstream runSettings.",
        reasonCode: "missing_run_settings",
      },
      ok: false,
    };
  }

  const codexExecutable = recordString(runSettingsInput, "codexExecutable");
  const executionWorkspace = recordString(runSettingsInput, "workspaceRoot");
  const sandbox = recordString(runSettingsInput, "sandbox");
  const approvalPolicy = recordString(runSettingsInput, "approvalPolicy");
  const executionPolicy = recordString(runSettingsInput, "executionPolicy");
  const executionTarget = resolveExecutionTargetInput(runSettingsInput);
  if (!executionTarget.ok) {
    return executionTarget;
  }
  if (
    !codexExecutable ||
    !executionWorkspace ||
    !sandbox ||
    !approvalPolicy ||
    !executionPolicy
  ) {
    return {
      blocker: {
        fieldPath: "$.inputs.runSettings",
        message:
          "Queue create/setup/start requires codexExecutable, workspaceRoot, sandbox, approvalPolicy, executionPolicy, and typed executionTarget or legacy executorWidgetId.",
        reasonCode: "missing_run_settings",
      },
      ok: false,
    };
  }

  return {
    ok: true,
    value: {
      expectedQueueControlVersion: numberInput(
        runSettingsInput.expectedQueueControlVersion ??
          request.inputs?.expectedQueueControlVersion,
      ),
      runSettings: {
        approvalPolicy,
        codexExecutable,
        executionPolicy,
        executionWorkspace,
        executionTarget: executionTarget.value.executionTarget,
        executorWidgetId: executionTarget.value.executorWidgetId,
        sandbox,
      },
      stderrCapBytes: numberInput(runSettingsInput.stderrCapBytes),
      stdoutCapBytes: numberInput(runSettingsInput.stdoutCapBytes),
      timeoutMs: numberInput(runSettingsInput.timeoutMs),
    },
  };
}

function resolveExecutionTargetInput(
  runSettingsInput: Record<string, unknown>,
):
  | {
      ok: true;
      value: {
        executionTarget?: AgentQueueWorkflowExecutionTarget;
        executorWidgetId?: string;
      };
    }
  | { blocker: QueueWorkflowRunnerBlocker; ok: false } {
  const executionTarget = recordRecord(runSettingsInput, "executionTarget");
  if (!executionTarget) {
    const executorWidgetId = recordString(runSettingsInput, "executorWidgetId");
    if (!executorWidgetId) {
      return {
        blocker: {
          fieldPath: "$.inputs.runSettings.executionTarget",
          message:
            "Queue create/setup/start requires queue_local executionTarget or legacy executorWidgetId.",
          reasonCode: "missing_run_settings",
        },
        ok: false,
      };
    }
    return {
      ok: true,
      value: { executorWidgetId },
    };
  }

  const kind = recordString(executionTarget, "kind");
  const providerId = recordString(executionTarget, "providerId");
  if (providerId !== "codex") {
    return {
      blocker: {
        fieldPath: "$.inputs.runSettings.executionTarget.providerId",
        message: "Queue create/setup/start only supports providerId codex.",
        reasonCode: "invalid_request",
      },
      ok: false,
    };
  }

  if (kind === "queue_local") {
    const queueOwnerWidgetInstanceId = recordString(
      executionTarget,
      "queueOwnerWidgetInstanceId",
    );
    return {
      ok: true,
      value: {
        executionTarget: {
          kind,
          providerId,
          ...(queueOwnerWidgetInstanceId
            ? { queueOwnerWidgetInstanceId }
            : {}),
        },
      },
    };
  }

  if (kind === "agent_executor") {
    const executorWidgetId = recordString(executionTarget, "executorWidgetId");
    if (!executorWidgetId) {
      return {
        blocker: {
          fieldPath: "$.inputs.runSettings.executionTarget.executorWidgetId",
          message:
            "Legacy agent_executor executionTarget requires executorWidgetId.",
          reasonCode: "missing_run_settings",
        },
        ok: false,
      };
    }
    return {
      ok: true,
      value: {
        executionTarget: {
          kind,
          providerId,
          executorWidgetId,
        },
        executorWidgetId,
      },
    };
  }

  return {
    blocker: {
      fieldPath: "$.inputs.runSettings.executionTarget.kind",
      message:
        "Queue create/setup/start executionTarget.kind must be queue_local or agent_executor.",
      reasonCode: "invalid_request",
    },
    ok: false,
  };
}

export function resolveCreateSetupStartConfirmation(
  request: QueueWorkflowRunnerRequest,
): QueueWorkflowCreateSetupStartConfirmationResolution {
  const token = cleanString(request.grant?.confirmationToken);
  if (!token) {
    return {
      blocker: {
        fieldPath: "$.grant.confirmationToken",
        message:
          "Queue worker start requires exact structured confirmationToken.",
        reasonCode: "start_confirmation_required",
      },
      ok: false,
    };
  }

  if (token !== QUEUE_FINALIZATION_CONFIRMATION_TOKEN) {
    return {
      blocker: {
        fieldPath: "$.grant.confirmationToken",
        message:
          "Queue worker start confirmationToken must exactly equal operator-confirmed.",
        reasonCode: "start_confirmation_invalid",
      },
      ok: false,
    };
  }

  return { ok: true, token };
}

export function updateCreateSetupStartReportMaterialize(
  report: QueueWorkflowCreateSetupStartReport,
  materialize: AgentQueueWorkflowMaterializeTaskSlotResult,
  slot: string,
): QueueWorkflowCreateSetupStartReport {
  const binding = materialize.binding;
  return stripUndefined({
    ...report,
    downstreamTaskId:
      slot === "downstream" ? binding?.taskId : report.downstreamTaskId,
    materializedSlots: {
      ...report.materializedSlots,
      [slot]: stripUndefined({
        dependencyTaskIds: binding?.dependencyTaskIds,
        dependsOnSlots: binding?.dependsOnSlots,
        status: materialize.status,
        taskId: binding?.taskId,
        taskSpecHash: binding?.taskSpecHash,
      }),
    },
    upstreamTaskId:
      slot === "upstream" ? binding?.taskId : report.upstreamTaskId,
  });
}

export function updateCreateSetupStartReportRunSettings(
  report: QueueWorkflowCreateSetupStartReport,
  setup: AgentQueueWorkflowApplyRunSettingsResult,
): QueueWorkflowCreateSetupStartReport {
  return {
    ...report,
    runSettings: stripUndefined({
      executionTargetHash: setup.binding?.executionTargetHash,
      executionTargetKind: setup.binding?.executionTargetKind,
      executorWidgetId: setup.binding?.executorWidgetId,
      providerId: setup.binding?.providerId,
      queueOwnerWidgetInstanceId: setup.binding?.queueOwnerWidgetInstanceId,
      settingsHash: setup.binding?.settingsHash,
      slot: setup.binding?.slot ?? "upstream",
      status: setup.status,
      taskId: setup.binding?.taskId,
    }),
  };
}

export function updateCreateSetupStartReportPromote(
  report: QueueWorkflowCreateSetupStartReport,
  promote: AgentQueueWorkflowPromoteTaskSlotResult,
): QueueWorkflowCreateSetupStartReport {
  return {
    ...report,
    promote: stripUndefined({
      slot: promote.binding?.slot ?? "upstream",
      status: promote.status,
      taskId: promote.binding?.taskId,
    }),
  };
}

export function updateCreateSetupStartReportStart(
  report: QueueWorkflowCreateSetupStartReport,
  start: StartAssignedAgentQueueTaskResponse,
  fallbackTaskId: string,
): QueueWorkflowCreateSetupStartReport {
  return {
    ...report,
    start: stripUndefined({
      actionIdempotencyKey: start.actionIdempotencyKey,
      runId: start.runId,
      status: start.status,
      taskId: start.queueItemId || fallbackTaskId,
    }),
  };
}

export function blockerForMaterializeResult(
  result: AgentQueueWorkflowMaterializeTaskSlotResult,
  slot: string,
): QueueWorkflowRunnerBlocker | null {
  if ((result.status === "created" || result.status === "reused") && result.binding) {
    return null;
  }
  return {
    fieldPath: result.blocker?.missingRequiredField ?? undefined,
    message:
      result.blocker?.blockerMessage ??
      result.conflict?.conflictMessage ??
      `Queue workflow task slot ${slot} materialization stopped with status ${result.status}.`,
    reasonCode: "blocked_materialization",
    slot,
    taskId: result.binding?.taskId ?? result.task?.queueItemId,
  };
}

export function blockerForApplyRunSettingsResult(
  result: AgentQueueWorkflowApplyRunSettingsResult,
): QueueWorkflowRunnerBlocker | null {
  if ((result.status === "applied" || result.status === "reused") && result.binding) {
    return null;
  }
  return {
    fieldPath: result.blocker?.missingRequiredField ?? undefined,
    message:
      result.blocker?.blockerMessage ??
      result.conflict?.conflictMessage ??
      `Queue workflow run settings stopped with status ${result.status}.`,
    reasonCode: "blocked_setup",
    slot: "upstream",
    taskId: result.binding?.taskId ?? result.task?.queueItemId,
  };
}

export function blockerForPromoteResult(
  result: AgentQueueWorkflowPromoteTaskSlotResult,
): QueueWorkflowRunnerBlocker | null {
  if ((result.status === "promoted" || result.status === "reused") && result.binding) {
    return null;
  }
  return {
    fieldPath: result.blocker?.missingRequiredField ?? undefined,
    message:
      result.blocker?.blockerMessage ??
      result.conflict?.conflictMessage ??
      `Queue workflow promote stopped with status ${result.status}.`,
    reasonCode: "blocked_setup",
    slot: "upstream",
    taskId: result.binding?.taskId ?? result.task?.queueItemId,
  };
}

export function blockerForStartResult(
  result: StartAssignedAgentQueueTaskResponse,
): QueueWorkflowRunnerBlocker | null {
  if (
    (result.status === "started" || result.status === "already_started") &&
    result.runId
  ) {
    return null;
  }

  const blockerCode = result.blocker?.blockerCode;
  return {
    fieldPath: result.blocker?.missingRequiredField ?? undefined,
    message:
      result.blocker?.blockerMessage ??
      `Queue workflow worker start stopped with status ${result.status}.`,
    reasonCode:
      blockerCode === "orphaned_start" || blockerCode === "start_state_unknown"
        ? "worker_start_orphan"
        : "blocked_worker_start",
    taskId: result.queueItemId,
  };
}

export function blockerForCreateSetupStartError(error: unknown): QueueWorkflowRunnerBlocker {
  return {
    message:
      error instanceof Error
        ? error.message
        : "Queue workflow create/setup/start failed unexpectedly.",
    reasonCode: "blocked_worker_start",
  };
}

export function setMaterializedSlotVariables(
  variables: QueueWorkflowVariables,
  binding: NonNullable<AgentQueueWorkflowMaterializeTaskSlotResult["binding"]>,
) {
  const current = variables.slots[binding.slot] ?? { slot: binding.slot };
  variables.slots[binding.slot] = stripUndefined({
    ...current,
    taskId: binding.taskId,
    taskSpecHash: binding.taskSpecHash,
  });
  variables.taskIdsBySlot[binding.slot] = binding.taskId;
  if (!variables.scopedTaskIds.includes(binding.taskId)) {
    variables.scopedTaskIds.push(binding.taskId);
  }
}

export function setRunSettingsSlotVariables(
  variables: QueueWorkflowVariables,
  binding: NonNullable<AgentQueueWorkflowApplyRunSettingsResult["binding"]>,
) {
  const current = variables.slots[binding.slot] ?? { slot: binding.slot };
  variables.slots[binding.slot] = stripUndefined({
    ...current,
    executionTargetHash: binding.executionTargetHash,
    executionTargetKind: binding.executionTargetKind,
    executorWidgetId: binding.executorWidgetId,
    providerId: binding.providerId,
    queueOwnerWidgetInstanceId: binding.queueOwnerWidgetInstanceId ?? undefined,
    settingsHash: binding.settingsHash,
    taskId: binding.taskId,
  });
  variables.taskIdsBySlot[binding.slot] = binding.taskId;
}

export function setStartedSlotVariables(
  variables: QueueWorkflowVariables,
  slot: string,
  start: StartAssignedAgentQueueTaskResponse,
) {
  const current = variables.slots[slot] ?? { slot };
  variables.slots[slot] = stripUndefined({
    ...current,
    runId: start.runId,
    taskId: start.queueItemId,
  });
  variables.runIdsBySlot[slot] = start.runId;
  if (!variables.scopedRunIds.includes(start.runId)) {
    variables.scopedRunIds.push(start.runId);
  }
}

export function workflowStartIdempotencyKey({
  executionTargetHash,
  settingsHash,
  taskId,
  workflowRunId,
}: {
  executionTargetHash: string;
  settingsHash: string;
  taskId: string;
  workflowRunId: string;
}) {
  return `${workflowRunId}:start_worker:${taskId}:${executionTargetHash}:${settingsHash}`;
}

export function createSetupStartSummary({
  report,
  workflowId,
}: {
  report: QueueWorkflowCreateSetupStartReport;
  workflowId: string;
}) {
  const control = report.queueControl?.status ?? "unknown";
  const runId = report.start?.runId ?? "no-run";
  return [
    `Queue workflow ${workflowId} run ${report.workflowRunId ?? "unknown"} reached awaiting_worker_completion.`,
    `Tasks: upstream=${report.upstreamTaskId ?? "missing"}, downstream=${report.downstreamTaskId ?? "missing"}.`,
    `Settings=${report.runSettings?.status ?? "missing"}, promote=${report.promote?.status ?? "missing"}, Queue control=${control}, worker=${report.start?.status ?? "missing"} runId=${runId}.`,
    "Paused before evidence recording; review/finalization/downstream start were not run.",
  ].join(" ");
}

export function materializeVerb(status: string) {
  return status === "created" ? "created" : "reused";
}

export function setupVerb(status: string) {
  return status === "applied" ? "applied" : "reused";
}

export function promoteVerb(status: string) {
  return status === "promoted" ? "promoted" : "reused";
}
