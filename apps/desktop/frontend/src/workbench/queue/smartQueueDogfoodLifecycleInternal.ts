import type {
  SmartQueueCoordinatorReviewDecision,
  SmartQueueCoordinatorReviewDecisionKind,
  SmartQueueDogfoodLifecycleItem,
  SmartQueueDogfoodLifecycleSideEffectFlags,
  SmartQueueDogfoodTicketState,
  SmartQueueLifecycleTransitionError,
  SmartQueueLifecycleTransitionErrorCode,
  SmartQueueLifecycleTransitionResult,
} from "./smartQueueDogfoodLifecycleTypes";
import { ticketStateLabel } from "./smartQueueDogfoodLifecycleLabels";

export const NO_DOGFOOD_LIFECYCLE_SIDE_EFFECTS: SmartQueueDogfoodLifecycleSideEffectFlags = {
  wouldCallCodex: false,
  wouldCallShell: false,
  wouldCallWorkspaceApi: false,
  wouldExecuteCommit: false,
  wouldExecuteRollback: false,
  wouldLaunchTerminal: false,
  wouldMutateGit: false,
  wouldPersist: false,
  wouldStartWorker: false,
};

const TERMINAL_TICKET_STATES = new Set<SmartQueueDogfoodTicketState>([
  "done",
  "failure",
]);

export function assertTicketState(
  item: SmartQueueDogfoodLifecycleItem,
  action: string,
  expectedTicketStates: readonly SmartQueueDogfoodTicketState[],
): SmartQueueLifecycleTransitionError | undefined {
  if (TERMINAL_TICKET_STATES.has(item.ticketState)) {
    return transitionError({
      action,
      code: "terminal_state",
      expectedTicketStates,
      item,
      message: `${ticketStateLabel(item.ticketState)} is terminal in the MVP lifecycle model.`,
    });
  }

  if (!expectedTicketStates.includes(item.ticketState)) {
    return transitionError({
      action,
      code: "invalid_state",
      expectedTicketStates,
      item,
      message: `${action} cannot run from ${ticketStateLabel(item.ticketState)}.`,
    });
  }

  return undefined;
}

export function coordinatorDecision(
  input: Omit<SmartQueueCoordinatorReviewDecision, "reason"> & {
    readonly reason?: string;
  },
): SmartQueueCoordinatorReviewDecision {
  return {
    ...input,
    reason: cleanText(input.reason) || decisionReason(input.kind),
  };
}

export function transitionError({
  action,
  code,
  expectedTicketStates,
  item,
  message,
}: {
  readonly action: string;
  readonly code: SmartQueueLifecycleTransitionErrorCode;
  readonly expectedTicketStates?: readonly SmartQueueDogfoodTicketState[];
  readonly item: SmartQueueDogfoodLifecycleItem;
  readonly message: string;
}): SmartQueueLifecycleTransitionError {
  return {
    action,
    code,
    currentAgentPromptState: item.agentPromptState,
    currentTicketState: item.ticketState,
    expectedTicketStates,
    message,
  };
}

export function success<TPayload = undefined>(
  item: SmartQueueDogfoodLifecycleItem,
  value?: TPayload,
): SmartQueueLifecycleTransitionResult<TPayload> {
  return {
    item,
    ok: true,
    value,
  };
}

export function failure<TPayload = undefined>(
  item: SmartQueueDogfoodLifecycleItem,
  error: SmartQueueLifecycleTransitionError,
): SmartQueueLifecycleTransitionResult<TPayload> {
  return {
    error,
    item,
    ok: false,
  };
}

export function mustTransition<TPayload = undefined>(
  result: SmartQueueLifecycleTransitionResult<TPayload>,
) {
  if (!result.ok) {
    throw new Error(result.error?.message ?? "Lifecycle self-test failed.");
  }

  return result.item;
}

export function cleanText(value: string | undefined) {
  return value?.trim() ?? "";
}

export function cleanOptionalText(value: string | undefined) {
  const cleaned = cleanText(value);

  return cleaned || undefined;
}

function decisionReason(kind: SmartQueueCoordinatorReviewDecisionKind) {
  switch (kind) {
    case "approve_validation":
      return "Validation approved.";
    case "request_commit":
      return "Commit requested.";
    case "attach_commit_result":
      return "Commit result attached.";
    case "mark_done":
      return "Marked done.";
    case "add_follow_up_prompt":
      return "Follow-up prompt added.";
    case "return_to_running_added_prompt":
      return "Returned to running with added prompt.";
    case "block_task":
      return "Blocked by coordinator decision.";
    case "fail_task":
      return "Failed by coordinator decision.";
  }
}
