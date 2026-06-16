export type SmartQueueDogfoodTicketState =
  | "draft"
  | "queued"
  | "blocked"
  | "running"
  | "awaiting_review"
  | "in_review"
  | "done"
  | "failure";

export type SmartQueueDogfoodAgentPromptState =
  | "idle"
  | "running"
  | "completed"
  | "not_completed"
  | "failed"
  | "additional_prompt_running";

export type SmartQueueDogfoodReviewOutcome =
  | "completed"
  | "not_completed"
  | "failed";

export type SmartQueueCoordinatorReviewDecisionKind =
  | "approve_validation"
  | "request_commit"
  | "attach_commit_result"
  | "mark_done"
  | "add_follow_up_prompt"
  | "return_to_running_added_prompt"
  | "block_task"
  | "fail_task";

export type SmartQueueCommitResultStatus = "success" | "failed";

export type SmartQueueDogfoodLifecycleSideEffectFlags = {
  readonly wouldCallCodex: false;
  readonly wouldCallShell: false;
  readonly wouldCallWorkspaceApi: false;
  readonly wouldExecuteCommit: false;
  readonly wouldExecuteRollback: false;
  readonly wouldLaunchTerminal: false;
  readonly wouldMutateGit: false;
  readonly wouldPersist: false;
  readonly wouldStartWorker: false;
};

export type SmartQueueReviewMessage = {
  readonly messageId: string;
  readonly taskId: string;
  readonly attemptId?: string;
  readonly fromQueueItemId: string;
  readonly toCoordinatorAgentId: string;
  readonly reviewOutcome: SmartQueueDogfoodReviewOutcome;
  readonly finalAgentMessage: string;
  readonly validationSummary?: string;
  readonly changedFilesSummary?: string;
  readonly createdAt: string;
  readonly productSummary: string;
};

export type SmartQueueReviewAck = {
  readonly ackId: string;
  readonly messageId: string;
  readonly coordinatorAgentId: string;
  readonly receivedAt: string;
};

export type SmartQueueCoordinatorReviewDecision = {
  readonly decisionId: string;
  readonly taskId: string;
  readonly kind: SmartQueueCoordinatorReviewDecisionKind;
  readonly createdAt: string;
  readonly coordinatorAgentId?: string;
  readonly reason: string;
  readonly reviewMessageId?: string;
  readonly validationApprovalId?: string;
  readonly commitRequestId?: string;
  readonly commitResultId?: string;
  readonly followUpPromptId?: string;
};

export type SmartQueueFollowUpPrompt = {
  readonly followUpPromptId: string;
  readonly taskId: string;
  readonly parentAttemptId?: string;
  readonly threadId?: string;
  readonly prompt: string;
  readonly createdByCoordinatorAgentId: string;
  readonly createdAt: string;
};

export type SmartQueueCommitRequest = {
  readonly commitRequestId: string;
  readonly taskId: string;
  readonly requestedByCoordinatorAgentId: string;
  readonly reason: string;
  readonly createdAt: string;
  readonly modelOnly: true;
};

export type SmartQueueCommitResult = {
  readonly commitResultId: string;
  readonly taskId: string;
  readonly commitRequestId?: string;
  readonly status: SmartQueueCommitResultStatus;
  readonly commitHash?: string;
  readonly summary: string;
  readonly attachedAt: string;
  readonly modelOnly: true;
  readonly noGitMutationPerformed: true;
};

export type SmartQueueValidationApproval = {
  readonly validationApprovalId: string;
  readonly taskId: string;
  readonly approvedByCoordinatorAgentId: string;
  readonly summary: string;
  readonly approvedAt: string;
  readonly modelOnly: true;
};

export type SmartQueueDogfoodLifecycleItem = {
  readonly taskId: string;
  readonly title?: string;
  readonly originalPrompt?: string;
  readonly currentRunnablePrompt?: string;
  readonly ticketState: SmartQueueDogfoodTicketState;
  readonly agentPromptState: SmartQueueDogfoodAgentPromptState;
  readonly reviewOutcome?: SmartQueueDogfoodReviewOutcome;
  readonly additionalPromptCount: number;
  readonly currentAttemptId?: string;
  readonly currentThreadId?: string;
  readonly finalAgentMessage?: string;
  readonly validationSummary?: string;
  readonly changedFilesSummary?: string;
  readonly blockedReason?: string;
  readonly failureReason?: string;
  readonly followUpPrompts: readonly SmartQueueFollowUpPrompt[];
  readonly reviewMessages: readonly SmartQueueReviewMessage[];
  readonly reviewAcks: readonly SmartQueueReviewAck[];
  readonly coordinatorDecisions: readonly SmartQueueCoordinatorReviewDecision[];
  readonly validationApprovals: readonly SmartQueueValidationApproval[];
  readonly commitRequests: readonly SmartQueueCommitRequest[];
  readonly commitResults: readonly SmartQueueCommitResult[];
  readonly sideEffects: SmartQueueDogfoodLifecycleSideEffectFlags;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type SmartQueueLifecycleTransitionErrorCode =
  | "empty_prompt"
  | "invalid_commit_result"
  | "invalid_follow_up_prompt"
  | "invalid_state"
  | "missing_commit_request"
  | "missing_commit_result"
  | "missing_final_agent_message"
  | "missing_review_message"
  | "missing_review_outcome"
  | "missing_validation_approval"
  | "terminal_state"
  | "wrong_review_ack_target";

export type SmartQueueLifecycleTransitionError = {
  readonly code: SmartQueueLifecycleTransitionErrorCode;
  readonly action: string;
  readonly message: string;
  readonly currentTicketState: SmartQueueDogfoodTicketState;
  readonly currentAgentPromptState: SmartQueueDogfoodAgentPromptState;
  readonly expectedTicketStates?: readonly SmartQueueDogfoodTicketState[];
};

export type SmartQueueLifecycleTransitionResult<TPayload = undefined> = {
  readonly ok: boolean;
  readonly item: SmartQueueDogfoodLifecycleItem;
  readonly value?: TPayload;
  readonly error?: SmartQueueLifecycleTransitionError;
};

export type SmartQueueLifecycleHumanStatus = {
  readonly ticketLabel: string;
  readonly agentPromptLabel: string;
  readonly reviewLabel?: string;
  readonly text: string;
};

export type SmartQueueDogfoodLifecycleSelfTestReport = {
  readonly reportId: string;
  readonly status: "passed" | "failed";
  readonly summary: string;
  readonly upstreamBeforeDoneStartable: boolean;
  readonly upstreamAfterDoneStartable: boolean;
  readonly followUpAdditionalPromptCount: number;
  readonly sideEffects: SmartQueueDogfoodLifecycleSideEffectFlags;
  readonly createdAt: string;
};
