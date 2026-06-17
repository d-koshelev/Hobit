import { useId, useMemo, useState, type RefObject } from "react";

import { Button, WidgetPopupShell } from "../../../../../design-system";
import type {
  AgentQueueReportActionCard,
  AgentQueueTask,
} from "../../../../../workspace/types";
import {
  getQueuePromptPackImportMetadata,
} from "../../../../promptPack/queuePromptPackMetadata";
import type {
  QueueInspectorSnapshot,
  QueueTaskViewModel,
} from "../../../../queue/queueV2ViewModel";
import type { AgentQueueController } from "../../../../queue/details/agentQueueTaskDetailsTypes";
import type { WidgetRenderProps } from "../../../../types";
import type { QueueValidationRunResult } from "../../../../queue/queueValidationEvidenceService";
import type { ValidationRunner } from "../../../../validation";
import type {
  QueueAgentReviewEvidenceBundleOutput,
} from "../../../../agents/adapters/queueAgentCapabilityTypes";
import type {
  QueueReviewEvidenceBrokerAction,
} from "../../../../queue/queueReviewEvidenceActions";
import type {
  QueueReviewEvidenceActionState,
} from "../../../../queue/details/AgentQueueTaskReviewEvidenceSection";
import {
  buildQueueV2TaskDetailsActions,
  type QueueV2DetailsTab,
} from "../../queueV2TaskDetailsActions";
import {
  validationRequestDisabledReason,
  type QueueV2ValidationRequestState,
} from "../../QueueV2ValidationEvidenceSection";
import { queueV2ValidationEvidenceView } from "../../queueV2ValidationEvidence";
import { QueueV2TaskDetailsActions } from "./QueueV2TaskDetailsActions";
import { QueueV2TaskDetailsActivity } from "./QueueV2TaskDetailsActivity";
import { QueueV2TaskDetailsContext } from "./QueueV2TaskDetailsContext";
import { QueueV2TaskCodexSetup } from "./QueueV2TaskCodexSetup";
import { QueueV2CoordinatorDecisionCard } from "./QueueV2CoordinatorDecisionCard";
import { QueueV2TaskDetailsHeader } from "./QueueV2TaskDetailsHeader";
import { QueueV2TaskDetailsOverview } from "./QueueV2TaskDetailsOverview";
import { QueueV2TaskDetailsPrompt } from "./QueueV2TaskDetailsPrompt";
import { QueueV2TaskDetailsResult } from "./QueueV2TaskDetailsResult";
import { QueueV2TaskDetailsSummary } from "./QueueV2TaskDetailsSummary";
import { QueueV2TaskDetailsTabs } from "./QueueV2TaskDetailsTabs";
import {
  highLevelTaskEvents,
  latestTaskReport,
} from "../../model/queueV2TaskDetailsFormat";

export type QueueV2TaskDetailsPopupProps = {
  currentWorkspaceRoot?: string | null;
  inspector: QueueInspectorSnapshot | null;
  isOpen: boolean;
  onCreateKnowledgeDocument?: WidgetRenderProps["onCreateKnowledgeDocument"];
  onCreateSkill?: WidgetRenderProps["onCreateSkill"];
  onListKnowledgeDraftReviews?: WidgetRenderProps["onListKnowledgeDraftReviews"];
  onRecordKnowledgeDraftReview?: WidgetRenderProps["onRecordKnowledgeDraftReview"];
  onRequestNewTask?: () => void;
  onRequestValidation?: (
    task: AgentQueueTask,
    runner: ValidationRunner,
  ) => Promise<QueueValidationRunResult>;
  onOpenLinkedTask?: (taskId: string) => void;
  onRequestClose: () => void;
  onRefreshReviewEvidence?: (taskId: string) => Promise<void> | void;
  onReviewEvidenceAction?: (
    action: QueueReviewEvidenceBrokerAction,
  ) => Promise<void> | void;
  onShowQueueReportInWorkspaceChat?: (
    card: AgentQueueReportActionCard,
  ) => void;
  onShowQueueTaskInWorkspaceChat?: (task: AgentQueueTask) => void;
  queue?: AgentQueueController;
  reviewEvidenceActionState?: QueueReviewEvidenceActionState;
  reviewEvidenceLoadingTaskId?: string | null;
  reviewEvidenceOutput?: QueueAgentReviewEvidenceBundleOutput | null;
  returnFocusRef?: RefObject<HTMLElement | null>;
  showCoordinatorDecisionCard?: boolean;
  taskViewModel: QueueTaskViewModel | null;
  validationRunner?: ValidationRunner | null;
};

export function QueueV2TaskDetailsPopup({
  currentWorkspaceRoot = null,
  inspector,
  isOpen,
  onCreateKnowledgeDocument,
  onCreateSkill,
  onListKnowledgeDraftReviews,
  onRecordKnowledgeDraftReview,
  onRequestNewTask,
  onRequestValidation,
  onOpenLinkedTask,
  onRequestClose,
  onRefreshReviewEvidence,
  onReviewEvidenceAction,
  onShowQueueReportInWorkspaceChat,
  onShowQueueTaskInWorkspaceChat,
  queue,
  reviewEvidenceActionState,
  reviewEvidenceLoadingTaskId = null,
  reviewEvidenceOutput,
  returnFocusRef,
  showCoordinatorDecisionCard = false,
  taskViewModel,
  validationRunner,
}: QueueV2TaskDetailsPopupProps) {
  const [activeTab, setActiveTab] = useState<QueueV2DetailsTab>("overview");
  const [validationRequestState, setValidationRequestState] = useState<
    QueueV2ValidationRequestState
  >("idle");
  const [codexSetupRequested, setCodexSetupRequested] = useState(false);
  const [validationRequestMessage, setValidationRequestMessage] =
    useState<string | null>(null);
  const titleId = useId();
  const task = taskViewModel?.task ?? null;
  const latestReport = latestTaskReport(task);
  const promptPackMetadata = task ? getQueuePromptPackImportMetadata(task) : null;
  const validationEvidence = task ? queueV2ValidationEvidenceView(task) : null;
  const validationDisabledReason = validationRequestDisabledReason({
    onRequestValidation,
    task,
    validationRunner,
  });
  const highLevelEvents = useMemo(
    () => highLevelTaskEvents(task, latestReport),
    [latestReport, task],
  );
  const detailActions = useMemo(
    () =>
      buildQueueV2TaskDetailsActions({
        currentWorkspaceRoot,
        inspector,
        onRequestCodexSetup: () => setCodexSetupRequested(true),
        onRequestNewTask,
        onSelectTab: setActiveTab,
        queue,
        task,
      }),
    [currentWorkspaceRoot, inspector, onRequestNewTask, queue, task],
  );

  if (!task || !taskViewModel || !inspector) {
    return null;
  }

  async function requestValidation() {
    if (validationDisabledReason || !task || !validationRunner || !onRequestValidation) {
      setValidationRequestState("unavailable");
      setValidationRequestMessage(
        validationDisabledReason ?? "Validation request is unavailable.",
      );
      return;
    }

    setValidationRequestState("running");
    setValidationRequestMessage(null);

    try {
      const result = await onRequestValidation(task, validationRunner);
      const status = result.runnerOutput.unavailable
        ? "unavailable"
        : result.runnerOutput.summary.status === "passed"
          ? "passed"
          : "failed";

      setValidationRequestState(status);
      setValidationRequestMessage(result.attachment.summary.summary);
    } catch (error) {
      setValidationRequestState("failed");
      setValidationRequestMessage(
        error instanceof Error
          ? error.message
          : "Validation request failed before evidence could be attached.",
      );
    }
  }

  const footerPrimaryAction =
    detailActions.find((action) => action.variant === "primary") ??
    detailActions.find((action) => action.id !== "refresh") ??
    null;

  return (
    <WidgetPopupShell
      actions={
        <Button onClick={onRequestClose} variant="ghost">
          Close
        </Button>
      }
      bodyClassName="queue-v2-task-details-popup"
      className="queue-v2-task-details-shell"
      footer={
        <>
          <Button onClick={onRequestClose} variant="ghost">
            Close
          </Button>
          {footerPrimaryAction ? (
            <Button
              disabled={footerPrimaryAction.disabled}
              onClick={footerPrimaryAction.onClick}
              title={footerPrimaryAction.reason}
              variant={footerPrimaryAction.variant}
            >
              {footerPrimaryAction.label}
            </Button>
          ) : null}
        </>
      }
      id={`queue-v2-task-details-${task.queueItemId}`}
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      resizable
      returnFocusRef={returnFocusRef}
      title={inspector.title}
      titleId={titleId}
      variant="floating"
    >
      <article className="queue-v2-task-details-content">
        <span className="queue-v2-task-details-compat-label">
          QueueV2 task details
        </span>
        <QueueV2TaskDetailsHeader inspector={inspector} taskStatus={task.status} />
        <QueueV2TaskDetailsSummary inspector={inspector} task={task} />
        <QueueV2TaskDetailsActions
          actions={detailActions}
          onRequestValidation={() => void requestValidation()}
          onShowQueueTaskInWorkspaceChat={onShowQueueTaskInWorkspaceChat}
          task={task}
          validationDisabledReason={validationDisabledReason}
          validationRequestRunning={validationRequestState === "running"}
        />
        {(!task.codexExecutable?.trim() || codexSetupRequested) ? (
          <QueueV2TaskCodexSetup queue={queue} task={task} />
        ) : null}
        {showCoordinatorDecisionCard ? (
          <QueueV2CoordinatorDecisionCard queue={queue} task={task} />
        ) : null}
        <div className="queue-v2-task-details-body">
          <QueueV2TaskDetailsTabs
            activeTab={activeTab}
            activityPanel={<QueueV2TaskDetailsActivity events={highLevelEvents} />}
            contextPanel={<QueueV2TaskDetailsContext queue={queue} task={task} />}
            onTabChange={setActiveTab}
            overviewPanel={
              <QueueV2TaskDetailsOverview
                events={highLevelEvents}
                inspector={inspector}
                onOpenLinkedTask={onOpenLinkedTask}
                promptPackMetadata={promptPackMetadata}
                task={task}
                taskViewModel={taskViewModel}
              />
            }
            promptPanel={<QueueV2TaskDetailsPrompt task={task} />}
            resultPanel={
              <QueueV2TaskDetailsResult
                latestReport={latestReport}
                onCreateKnowledgeDocument={onCreateKnowledgeDocument}
                onCreateSkill={onCreateSkill}
                onListKnowledgeDraftReviews={onListKnowledgeDraftReviews}
                onRecordKnowledgeDraftReview={onRecordKnowledgeDraftReview}
                onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
                promptPackMetadata={promptPackMetadata}
                queue={queue}
                reviewEvidenceActionState={reviewEvidenceActionState}
                reviewEvidenceLoading={reviewEvidenceLoadingTaskId === task.queueItemId}
                reviewEvidenceOutput={reviewEvidenceOutput}
                task={task}
                validationEvidence={validationEvidence}
                validationRequestMessage={validationRequestMessage}
                validationRequestState={validationRequestState}
                onOpenLinkedTask={onOpenLinkedTask}
                onRefreshReviewEvidence={
                  onRefreshReviewEvidence
                    ? () => onRefreshReviewEvidence(task.queueItemId)
                    : undefined
                }
                onReviewEvidenceAction={onReviewEvidenceAction}
                taskViewModel={taskViewModel}
              />
            }
          />
        </div>
      </article>
    </WidgetPopupShell>
  );
}
