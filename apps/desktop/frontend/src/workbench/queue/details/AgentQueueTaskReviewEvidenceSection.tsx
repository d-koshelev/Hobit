import { useState } from "react";
import { Badge, Button, Textarea } from "../../../design-system";
import type {
  QueueAgentReviewEvidenceBundleOutput,
} from "../../agents/adapters/queueAgentCapabilityTypes";
import type {
  QueueReviewEvidenceBrokerAction,
} from "../queueReviewEvidenceActions";
import {
  buildQueueReviewEvidenceViewModel,
  QUEUE_REVIEW_FOLLOW_UP_PROMPT_MAX_LENGTH,
  QUEUE_REVIEW_REASON_MAX_LENGTH,
} from "../queueReviewEvidenceViewModel";
import type { QueueTaskViewModel } from "../queueV2ViewModel";

export type QueueReviewEvidenceActionState = {
  readonly loading: boolean;
  readonly message: string | null;
  readonly status: "idle" | "success" | "error";
};

export function AgentQueueTaskReviewEvidenceSection({
  actionState,
  evidenceOutput,
  isLoading,
  onRefreshReviewEvidence,
  onReviewAction,
  taskViewModel,
}: {
  readonly actionState?: QueueReviewEvidenceActionState;
  readonly evidenceOutput?: QueueAgentReviewEvidenceBundleOutput | null;
  readonly isLoading?: boolean;
  readonly onRefreshReviewEvidence?: () => Promise<void> | void;
  readonly onReviewAction?: (
    action: QueueReviewEvidenceBrokerAction,
  ) => Promise<void> | void;
  readonly taskViewModel: QueueTaskViewModel;
}) {
  const [followUpPrompt, setFollowUpPrompt] = useState("");
  const [reason, setReason] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const model = buildQueueReviewEvidenceViewModel({
    dogfoodLifecycle: taskViewModel.dogfoodLifecycle,
    evidenceOutput,
    taskId: taskViewModel.taskId,
  });

  if (!model.relevant) {
    return null;
  }

  const actionsUnavailable = !onReviewAction;
  const actionMessage = actionState?.message ?? null;
  const actionLoading = actionState?.loading ?? false;

  async function invoke(action: QueueReviewEvidenceBrokerAction) {
    if (!onReviewAction) {
      return;
    }

    setInputError(null);
    await onReviewAction(action);
  }

  async function addFollowUp() {
    const prompt = followUpPrompt.trim();
    const validationError = validateTextInput({
      emptyMessage: "Follow-up prompt is required.",
      maxLength: QUEUE_REVIEW_FOLLOW_UP_PROMPT_MAX_LENGTH,
      value: prompt,
    });
    if (validationError) {
      setInputError(validationError);
      return;
    }

    await invoke({
      prompt,
      taskId: model.taskId,
      type: "add_follow_up_prompt",
    });
    setFollowUpPrompt("");
  }

  async function decideFailure(type: "block" | "fail") {
    const trimmedReason = reason.trim();
    const validationError = validateTextInput({
      emptyMessage: "Reason is required.",
      maxLength: QUEUE_REVIEW_REASON_MAX_LENGTH,
      value: trimmedReason,
    });
    if (validationError) {
      setInputError(validationError);
      return;
    }

    await invoke({ reason: trimmedReason, taskId: model.taskId, type });
    setReason("");
  }

  return (
    <section
      aria-label="Dogfood review"
      className="agent-queue-expanded-section agent-queue-review-evidence"
    >
      <div className="agent-queue-expanded-section-header">
        <div>
          <p className="agent-queue-expanded-kicker">Dogfood review</p>
          <p className="agent-queue-execution-group-title">
            {model.lifecycleStatusLabel}
          </p>
          {model.evidenceLabel ? (
            <p className="agent-queue-run-note">{model.evidenceLabel}</p>
          ) : null}
        </div>
        <Badge variant={model.inReview ? "info" : "warning"}>
          {model.lifecycleStatusLabel}
        </Badge>
      </div>

      <dl className="agent-queue-result-evidence-facts agent-queue-result-evidence-facts-primary">
        <div>
          <dt>Agent outcome</dt>
          <dd>{model.agentOutcomeLabel}</dd>
        </div>
        <div>
          <dt>Review</dt>
          <dd>{model.reviewMessageStateLabel ?? "Waiting for coordinator review"}</dd>
        </div>
        <div>
          <dt>Changed files</dt>
          <dd>{model.changedFiles.label}</dd>
        </div>
        <div>
          <dt>Validation</dt>
          <dd>{model.validation.label}</dd>
        </div>
        {model.runReferenceLabel ? (
          <div>
            <dt>Run</dt>
            <dd>{model.runReferenceLabel}</dd>
          </div>
        ) : null}
        {model.logReferenceLabel ? (
          <div>
            <dt>Logs</dt>
            <dd>{model.logReferenceLabel}</dd>
          </div>
        ) : null}
        {model.followUpPromptRunning ? (
          <div>
            <dt>Follow-up</dt>
            <dd>
              Follow-up prompt running
              {model.additionalPromptCount > 0
                ? ` (${model.additionalPromptCount.toString()})`
                : ""}
            </dd>
          </div>
        ) : null}
      </dl>

      {model.evidenceSummary ? (
        <p className="agent-queue-worker-report-summary">
          {model.evidenceSummary}
        </p>
      ) : null}

      {model.finalAgentMessage.preview ? (
        <div className="agent-queue-final-response-block">
          <p className="agent-queue-final-response-label">Final agent message</p>
          <pre className="agent-queue-final-response-text">
            {model.finalAgentMessage.preview}
          </pre>
        </div>
      ) : null}

      {model.changedFiles.previewPaths.length > 0 ? (
        <div className="agent-queue-review-evidence-preview">
          <p className="agent-queue-final-response-label">Changed files</p>
          <ul>
            {model.changedFiles.previewPaths.map((path) => (
              <li key={path}>{path}</li>
            ))}
          </ul>
          {model.changedFiles.omittedCount > 0 ? (
            <p className="agent-queue-run-note">
              + {model.changedFiles.omittedCount.toString()} more
            </p>
          ) : null}
        </div>
      ) : null}

      {model.validation.summaryPreview || model.validation.outputPreview ? (
        <div className="agent-queue-final-response-block">
          <p className="agent-queue-final-response-label">Validation summary</p>
          <pre className="agent-queue-final-response-text">
            {model.validation.summaryPreview ??
              model.validation.outputPreview ??
              ""}
          </pre>
        </div>
      ) : null}

      {model.frontendOnlyLabel ? (
        <p className="agent-queue-run-note">{model.frontendOnlyLabel}</p>
      ) : null}

      {isLoading ? (
        <p className="agent-queue-run-note">Loading review evidence...</p>
      ) : null}
      {actionsUnavailable ? (
        <p className="agent-queue-run-note">Review actions unavailable.</p>
      ) : null}
      {inputError ? (
        <p className="agent-queue-message agent-queue-message-error" role="alert">
          {inputError}
        </p>
      ) : null}
      {actionMessage ? (
        <p
          className={[
            "agent-queue-message",
            actionState?.status === "error"
              ? "agent-queue-message-error"
              : "agent-queue-message-success",
          ].join(" ")}
          role={actionState?.status === "error" ? "alert" : "status"}
        >
          {actionMessage}
        </p>
      ) : null}

      <div className="agent-queue-run-actions">
        {onRefreshReviewEvidence ? (
          <Button
            disabled={actionLoading || isLoading}
            onClick={() => void onRefreshReviewEvidence()}
            variant="ghost"
          >
            Refresh review
          </Button>
        ) : null}
        {model.actions.createReviewMessage.visible ? (
          <Button
            disabled={
              actionsUnavailable ||
              actionLoading ||
              !model.actions.createReviewMessage.enabled
            }
            onClick={() =>
              void invoke({
                changedFilesSummary: evidenceOutput?.changedFilesSummary,
                evidenceBundle: model.evidenceBundle,
                finalAgentMessage: evidenceOutput?.finalAgentMessage,
                taskId: model.taskId,
                type: "create_review_message",
                validationSummary: evidenceOutput?.validationSummary,
              })
            }
            title={model.actions.createReviewMessage.disabledReason ?? undefined}
            variant="secondary"
          >
            {model.actions.createReviewMessage.label}
          </Button>
        ) : null}
        {model.actions.ackReview.visible ? (
          <Button
            disabled={
              actionsUnavailable || actionLoading || !model.actions.ackReview.enabled
            }
            onClick={() =>
              model.latestReviewMessageId
                ? void invoke({
                    messageId: model.latestReviewMessageId,
                    taskId: model.taskId,
                    type: "ack_review",
                  })
                : undefined
            }
            title={model.actions.ackReview.disabledReason ?? undefined}
            variant="secondary"
          >
            {model.actions.ackReview.label}
          </Button>
        ) : null}
        {model.actions.approveValidation.visible ? (
          <Button
            disabled={
              actionsUnavailable ||
              actionLoading ||
              !model.actions.approveValidation.enabled
            }
            onClick={() =>
              void invoke({ taskId: model.taskId, type: "approve_validation" })
            }
            title={model.actions.approveValidation.disabledReason ?? undefined}
            variant="secondary"
          >
            {model.actions.approveValidation.label}
          </Button>
        ) : null}
        {model.actions.markDone.visible ? (
          <Button
            disabled={
              actionsUnavailable || actionLoading || !model.actions.markDone.enabled
            }
            onClick={() => void invoke({ taskId: model.taskId, type: "mark_done" })}
            title={model.actions.markDone.disabledReason ?? undefined}
            variant="primary"
          >
            {model.actions.markDone.label}
          </Button>
        ) : null}
      </div>

      {model.actions.addFollowUpPrompt.visible ? (
        <div className="agent-queue-review-evidence-form">
          <label>
            <span>Follow-up prompt</span>
            <Textarea
              maxLength={QUEUE_REVIEW_FOLLOW_UP_PROMPT_MAX_LENGTH}
              onChange={(event) => {
                setFollowUpPrompt(event.currentTarget.value);
                setInputError(null);
              }}
              rows={3}
              value={followUpPrompt}
            />
          </label>
          <div className="agent-queue-run-actions">
            <Button
              disabled={
                actionsUnavailable ||
                actionLoading ||
                !model.actions.addFollowUpPrompt.enabled
              }
              onClick={() => void addFollowUp()}
              title={model.actions.addFollowUpPrompt.disabledReason ?? undefined}
              variant="secondary"
            >
              {model.actions.addFollowUpPrompt.label}
            </Button>
          </div>
        </div>
      ) : null}

      {model.actions.fail.visible || model.actions.block.visible ? (
        <div className="agent-queue-review-evidence-form">
          <label>
            <span>Reason</span>
            <Textarea
              maxLength={QUEUE_REVIEW_REASON_MAX_LENGTH}
              onChange={(event) => {
                setReason(event.currentTarget.value);
                setInputError(null);
              }}
              rows={2}
              value={reason}
            />
          </label>
          <div className="agent-queue-run-actions">
            {model.actions.fail.visible ? (
              <Button
                disabled={
                  actionsUnavailable || actionLoading || !model.actions.fail.enabled
                }
                onClick={() => void decideFailure("fail")}
                title={model.actions.fail.disabledReason ?? undefined}
                variant="secondary"
              >
                {model.actions.fail.label}
              </Button>
            ) : null}
            {model.actions.block.visible ? (
              <Button
                disabled={
                  actionsUnavailable || actionLoading || !model.actions.block.enabled
                }
                onClick={() => void decideFailure("block")}
                title={model.actions.block.disabledReason ?? undefined}
                variant="secondary"
              >
                {model.actions.block.label}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function validateTextInput({
  emptyMessage,
  maxLength,
  value,
}: {
  readonly emptyMessage: string;
  readonly maxLength: number;
  readonly value: string;
}) {
  if (!value) {
    return emptyMessage;
  }

  if (value.length > maxLength) {
    return `Text must be ${maxLength.toString()} characters or fewer.`;
  }

  return null;
}
