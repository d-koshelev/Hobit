import type {
  HobitAgentActionRequest,
  HobitAgentBrokerResult,
} from "../agents/broker/types";
import type {
  QueueAgentCapabilityId,
  QueueAgentLifecycleGetOutput,
  QueueAgentLifecycleTransitionOutput,
  QueueAgentReviewEvidenceBundleOutput,
} from "../agents/adapters/queueAgentCapabilityTypes";
import type {
  SmartQueueDogfoodLifecycleItem,
} from "./smartQueueDogfoodLifecycle";
import type {
  QueueWorkerEvidenceBundle,
} from "./smartQueueWorkerEvidenceBundle";
import type {
  WorkspaceAgentHobitActionInvoker,
} from "../workspaceAgentBrokerActionRuntime";

const DEFAULT_REVIEW_UI_AGENT_ID = "workspace-agent";
const DEFAULT_REVIEW_COORDINATOR_ID = "queue-coordinator";
const DEFAULT_VALIDATION_APPROVAL_SUMMARY =
  "Validation approved by coordinator review. No validation execution.";

export type QueueReviewEvidenceBrokerAction =
  | {
      readonly evidenceBundle?: QueueWorkerEvidenceBundle | null;
      readonly finalAgentMessage?: string | null;
      readonly changedFilesSummary?: string | null;
      readonly taskId: string;
      readonly type: "create_review_message";
      readonly validationSummary?: string | null;
    }
  | {
      readonly messageId: string;
      readonly taskId: string;
      readonly type: "ack_review";
    }
  | {
      readonly taskId: string;
      readonly type: "approve_validation";
    }
  | {
      readonly prompt: string;
      readonly taskId: string;
      readonly type: "add_follow_up_prompt";
    }
  | {
      readonly taskId: string;
      readonly type: "mark_done";
    }
  | {
      readonly reason: string;
      readonly taskId: string;
      readonly type: "fail";
    }
  | {
      readonly reason: string;
      readonly taskId: string;
      readonly type: "block";
    };

export type QueueReviewEvidenceBrokerActionResult = {
  readonly brokerResult?: HobitAgentBrokerResult;
  readonly lifecycle: SmartQueueDogfoodLifecycleItem | null;
  readonly message: string;
  readonly ok: boolean;
  readonly output?: QueueAgentLifecycleTransitionOutput;
};

export type QueueReviewEvidenceReadResult = {
  readonly brokerResult?: HobitAgentBrokerResult;
  readonly message: string;
  readonly ok: boolean;
  readonly output: QueueAgentReviewEvidenceBundleOutput | null;
};

export type QueueDogfoodLifecycleReadResult = {
  readonly brokerResult?: HobitAgentBrokerResult;
  readonly lifecycles: readonly SmartQueueDogfoodLifecycleItem[];
  readonly message: string;
  readonly ok: boolean;
};

type QueueReviewEvidenceBrokerDeps = {
  readonly agentId?: string;
  readonly coordinatorAgentId?: string;
  readonly invokeHobitAgentActionRequest?: WorkspaceAgentHobitActionInvoker;
  readonly now?: () => string;
};

export async function invokeQueueReviewEvidenceBrokerAction(
  deps: QueueReviewEvidenceBrokerDeps,
  action: QueueReviewEvidenceBrokerAction,
): Promise<QueueReviewEvidenceBrokerActionResult> {
  const invoke = deps.invokeHobitAgentActionRequest;
  if (!invoke) {
    return {
      lifecycle: null,
      message: "Review actions unavailable.",
      ok: false,
    };
  }

  const request = queueReviewActionRequest(deps, action);
  const brokerResult = (await invoke(request)) as HobitAgentBrokerResult<
    QueueAgentLifecycleTransitionOutput
  >;
  const result = brokerResult.result;
  const output = result.output;

  return {
    brokerResult,
    lifecycle: output?.lifecycle ?? null,
    message: actionResultMessage(brokerResult),
    ok: result.status === "succeeded" && Boolean(output),
    output,
  };
}

export async function readQueueReviewEvidenceBundle(
  deps: QueueReviewEvidenceBrokerDeps,
  taskId: string,
): Promise<QueueReviewEvidenceReadResult> {
  const invoke = deps.invokeHobitAgentActionRequest;
  if (!invoke) {
    return {
      message: "Review evidence unavailable.",
      ok: false,
      output: null,
    };
  }

  const request = queueReviewReadRequest(deps, "queue.review.getEvidenceBundle", {
    taskId,
  });
  const brokerResult = (await invoke(request)) as HobitAgentBrokerResult<
    QueueAgentReviewEvidenceBundleOutput
  >;
  const result = brokerResult.result;

  return {
    brokerResult,
    message: actionResultMessage(brokerResult),
    ok: result.status === "succeeded" && Boolean(result.output),
    output: result.output ?? null,
  };
}

export async function readKnownQueueDogfoodLifecycles(
  deps: QueueReviewEvidenceBrokerDeps,
): Promise<QueueDogfoodLifecycleReadResult> {
  const invoke = deps.invokeHobitAgentActionRequest;
  if (!invoke) {
    return {
      lifecycles: [],
      message: "Review lifecycle unavailable.",
      ok: false,
    };
  }

  const request = queueReviewReadRequest(deps, "queue.lifecycle.get", {});
  const brokerResult = (await invoke(request)) as HobitAgentBrokerResult<
    QueueAgentLifecycleGetOutput
  >;
  const result = brokerResult.result;
  const lifecycles = result.output?.lifecycles ?? [];

  return {
    brokerResult,
    lifecycles,
    message: actionResultMessage(brokerResult),
    ok: result.status === "succeeded",
  };
}

function queueReviewActionRequest(
  deps: QueueReviewEvidenceBrokerDeps,
  action: QueueReviewEvidenceBrokerAction,
): HobitAgentActionRequest {
  const coordinatorAgentId =
    deps.coordinatorAgentId ?? DEFAULT_REVIEW_COORDINATOR_ID;
  const requestedAt = deps.now?.() ?? new Date().toISOString();

  switch (action.type) {
    case "create_review_message":
      return queueReviewWriteRequest(
        deps,
        "queue.review.createMessage",
        {
          changedFilesSummary: action.changedFilesSummary ?? undefined,
          coordinatorAgentId,
          evidenceBundle: action.evidenceBundle ?? undefined,
          finalAgentMessage: action.finalAgentMessage ?? undefined,
          taskId: action.taskId,
          validationSummary: action.validationSummary ?? undefined,
        },
        requestedAt,
      );
    case "ack_review":
      return queueReviewWriteRequest(
        deps,
        "queue.review.ack",
        {
          coordinatorAgentId,
          messageId: action.messageId,
          taskId: action.taskId,
        },
        requestedAt,
      );
    case "approve_validation":
      return queueReviewWriteRequest(
        deps,
        "queue.coordinator.approveValidation",
        {
          coordinatorAgentId,
          summary: DEFAULT_VALIDATION_APPROVAL_SUMMARY,
          taskId: action.taskId,
        },
        requestedAt,
      );
    case "add_follow_up_prompt":
      return queueReviewWriteRequest(
        deps,
        "queue.coordinator.addFollowUpPrompt",
        {
          coordinatorAgentId,
          prompt: action.prompt,
          taskId: action.taskId,
        },
        requestedAt,
      );
    case "mark_done":
      return queueReviewWriteRequest(
        deps,
        "queue.item.markDone",
        {
          commit: {
            commitTitle: "Coordinator accepted Queue review. No Git mutation.",
          },
          coordinatorAgentId,
          reason: "Accepted by coordinator review.",
          taskId: action.taskId,
          validationApproved: true,
          validationSummary: DEFAULT_VALIDATION_APPROVAL_SUMMARY,
        },
        requestedAt,
      );
    case "fail":
      return queueReviewWriteRequest(
        deps,
        "queue.item.fail",
        {
          coordinatorAgentId,
          reason: action.reason,
          taskId: action.taskId,
        },
        requestedAt,
      );
    case "block":
      return queueReviewWriteRequest(
        deps,
        "queue.item.block",
        {
          coordinatorAgentId,
          reason: action.reason,
          taskId: action.taskId,
        },
        requestedAt,
      );
  }
}

function queueReviewReadRequest(
  deps: QueueReviewEvidenceBrokerDeps,
  capabilityId: QueueAgentCapabilityId,
  input: unknown,
): HobitAgentActionRequest {
  return queueReviewRequest({
    agentId: deps.agentId,
    capabilityId,
    createdAt: deps.now?.() ?? new Date().toISOString(),
    dryRun: false,
    input,
  });
}

function queueReviewWriteRequest(
  deps: QueueReviewEvidenceBrokerDeps,
  capabilityId: QueueAgentCapabilityId,
  input: unknown,
  requestedAt: string,
): HobitAgentActionRequest {
  return queueReviewRequest({
    agentId: deps.agentId,
    capabilityId,
    createdAt: requestedAt,
    dryRun: false,
    input,
  });
}

function queueReviewRequest({
  agentId = DEFAULT_REVIEW_UI_AGENT_ID,
  capabilityId,
  createdAt,
  dryRun,
  input,
}: {
  readonly agentId?: string;
  readonly capabilityId: QueueAgentCapabilityId;
  readonly createdAt: string;
  readonly dryRun: boolean;
  readonly input: unknown;
}): HobitAgentActionRequest {
  const taskId =
    typeof input === "object" && input !== null && "taskId" in input
      ? String((input as { taskId?: unknown }).taskId ?? "queue")
      : "queue";

  return {
    agentId,
    agentRole: "workspace_agent",
    agentRoleId: "workspace_agent",
    capabilityId,
    createdAt,
    dryRun,
    input,
    requestId: `queue-review-ui:${capabilityId}:${taskId}:${createdAt}`,
    requestedAt: createdAt,
  };
}

function actionResultMessage(brokerResult: HobitAgentBrokerResult) {
  const result = brokerResult.result;
  if (result.status === "succeeded") {
    return result.message || "Review action completed.";
  }

  return (
    result.policyReasons[0] ??
    result.unavailableReason ??
    result.message ??
    "Review action failed."
  );
}
