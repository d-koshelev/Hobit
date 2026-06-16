import type {
  SmartQueueDogfoodAgentPromptState,
  SmartQueueDogfoodLifecycleItem,
  SmartQueueDogfoodReviewOutcome,
  SmartQueueDogfoodTicketState,
  SmartQueueLifecycleHumanStatus,
} from "./smartQueueDogfoodLifecycleTypes";

export function getLifecycleHumanStatus(
  item: SmartQueueDogfoodLifecycleItem,
): SmartQueueLifecycleHumanStatus {
  const ticketLabel = ticketStateLabel(item.ticketState);
  const agentPromptLabel = agentPromptStateLabel(item.agentPromptState);
  const reviewLabel = reviewStatusLabel(item);

  return {
    agentPromptLabel,
    reviewLabel,
    text: [ticketLabel, agentPromptLabel, reviewLabel]
      .filter(Boolean)
      .join(" - "),
    ticketLabel,
  };
}

export function ticketStateLabel(state: SmartQueueDogfoodTicketState) {
  switch (state) {
    case "draft":
      return "Draft";
    case "queued":
      return "Queued";
    case "blocked":
      return "Blocked";
    case "running":
      return "Running";
    case "awaiting_review":
      return "Awaiting review";
    case "in_review":
      return "In review";
    case "done":
      return "Done";
    case "failure":
      return "Failure";
  }
}

export function agentPromptStateLabel(
  state: SmartQueueDogfoodAgentPromptState,
) {
  switch (state) {
    case "idle":
      return "Idle";
    case "running":
      return "Running";
    case "completed":
      return "Agent completed";
    case "not_completed":
      return "Agent not completed";
    case "failed":
      return "Agent failed";
    case "additional_prompt_running":
      return "Follow-up prompt running";
  }
}

export function reviewOutcomeLabel(outcome: SmartQueueDogfoodReviewOutcome) {
  switch (outcome) {
    case "completed":
      return "Agent completed";
    case "not_completed":
      return "Agent not completed";
    case "failed":
      return "Agent failed";
  }
}

function reviewStatusLabel(item: SmartQueueDogfoodLifecycleItem) {
  if (item.ticketState === "awaiting_review") {
    return "Waiting for coordinator review";
  }

  if (item.ticketState === "in_review" && item.reviewAcks.length > 0) {
    return "Review acknowledged";
  }

  return item.reviewOutcome
    ? reviewOutcomeLabel(item.reviewOutcome)
    : undefined;
}
