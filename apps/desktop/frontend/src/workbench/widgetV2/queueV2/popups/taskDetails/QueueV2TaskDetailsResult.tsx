import { KeyValueList, Section } from "../../../../../design-system";
import type {
  AgentQueueReportActionCard,
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../../../../workspace/types";
import type { WidgetRenderProps } from "../../../../types";
import type { AgentQueueController } from "../../../../queue/details/agentQueueTaskDetailsTypes";
import { AgentQueueTaskResultEvidenceSection } from "../../../../queue/details/AgentQueueTaskResultEvidenceSection";
import {
  AgentQueueTaskReviewEvidenceSection,
  type QueueReviewEvidenceActionState,
} from "../../../../queue/details/AgentQueueTaskReviewEvidenceSection";
import type {
  QueueReviewEvidenceBrokerAction,
} from "../../../../queue/queueReviewEvidenceActions";
import type {
  QueueAgentReviewEvidenceBundleOutput,
} from "../../../../agents/adapters/queueAgentCapabilityTypes";
import type { QueuePromptPackImportMetadata } from "../../../../promptPack/queuePromptPackMetadata";
import { QueueV2FilesValidationSection } from "../../QueueV2ValidationEvidenceSection";
import { QueueV2CoordinatorSection } from "../../QueueV2CoordinatorSection";
import { CompactList, DetailBlock } from "../../QueueV2TaskDetailsBlocks";
import { validationSummary } from "../../model/queueV2TaskDetailsFormat";
import type { QueueV2ValidationRequestState } from "../../QueueV2ValidationEvidenceSection";
import type { queueV2ValidationEvidenceView } from "../../queueV2ValidationEvidence";
import type { QueueTaskViewModel } from "../../../../queue/queueV2ViewModel";

export function QueueV2TaskDetailsResult({
  latestReport,
  onCreateKnowledgeDocument,
  onCreateSkill,
  onListKnowledgeDraftReviews,
  onRecordKnowledgeDraftReview,
  onShowQueueReportInWorkspaceChat,
  onRefreshReviewEvidence,
  onReviewEvidenceAction,
  promptPackMetadata,
  queue,
  reviewEvidenceActionState,
  reviewEvidenceLoading,
  reviewEvidenceOutput,
  task,
  validationEvidence,
  validationRequestMessage,
  validationRequestState,
  onOpenLinkedTask,
  taskViewModel,
}: {
  latestReport: AgentQueueWorkerExecutionReport | null;
  onCreateKnowledgeDocument?: WidgetRenderProps["onCreateKnowledgeDocument"];
  onCreateSkill?: WidgetRenderProps["onCreateSkill"];
  onListKnowledgeDraftReviews?: WidgetRenderProps["onListKnowledgeDraftReviews"];
  onRecordKnowledgeDraftReview?: WidgetRenderProps["onRecordKnowledgeDraftReview"];
  onShowQueueReportInWorkspaceChat?: (
    card: AgentQueueReportActionCard,
  ) => void;
  onRefreshReviewEvidence?: () => Promise<void> | void;
  onReviewEvidenceAction?: (
    action: QueueReviewEvidenceBrokerAction,
  ) => Promise<void> | void;
  promptPackMetadata: QueuePromptPackImportMetadata | null;
  queue?: AgentQueueController;
  reviewEvidenceActionState?: QueueReviewEvidenceActionState;
  reviewEvidenceLoading?: boolean;
  reviewEvidenceOutput?: QueueAgentReviewEvidenceBundleOutput | null;
  task: AgentQueueTask;
  validationEvidence: ReturnType<typeof queueV2ValidationEvidenceView> | null;
  validationRequestMessage: string | null;
  validationRequestState: QueueV2ValidationRequestState;
  onOpenLinkedTask?: (taskId: string) => void;
  taskViewModel: QueueTaskViewModel;
}) {
  const hasResultEvidenceBridge = Boolean(queue?.workerReport && queue?.reportActionCard);

  return (
    <div className="queue-v2-task-details-section">
      <AgentQueueTaskReviewEvidenceSection
        actionState={reviewEvidenceActionState}
        evidenceOutput={reviewEvidenceOutput}
        isLoading={reviewEvidenceLoading}
        onRefreshReviewEvidence={onRefreshReviewEvidence}
        onReviewAction={onReviewEvidenceAction}
        taskViewModel={taskViewModel}
      />
      {queue && hasResultEvidenceBridge ? (
        <AgentQueueTaskResultEvidenceSection
          onCreateKnowledgeDocument={onCreateKnowledgeDocument}
          onCreateSkill={onCreateSkill}
          onListKnowledgeDraftReviews={onListKnowledgeDraftReviews}
          onRecordKnowledgeDraftReview={onRecordKnowledgeDraftReview}
          onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
          queue={queue}
          selectedTask={task}
        />
      ) : (
        <ResultSummary latestReport={latestReport} task={task} />
      )}
      <QueueV2FilesValidationSection
        latestReport={latestReport}
        promptPackMetadata={promptPackMetadata}
        task={task}
        validationEvidence={validationEvidence}
        validationRequestMessage={validationRequestMessage}
        validationRequestState={validationRequestState}
      />
      <QueueV2CoordinatorSection
        onOpenLinkedTask={onOpenLinkedTask}
        queue={queue?.coordinatorFinalization ? queue : undefined}
        taskViewModel={taskViewModel}
      />
    </div>
  );
}

function ResultSummary({
  latestReport,
  task,
}: {
  latestReport: AgentQueueWorkerExecutionReport | null;
  task: AgentQueueTask;
}) {
  return (
    <Section compact title="Result summary">
      <DetailBlock
        label="Output summary"
        value={latestReport?.summary ?? "No worker result has been reported."}
      />
      <KeyValueList
        compact
        items={[
          {
            label: "Changed files",
            value: (latestReport?.changedFiles.length ?? 0).toString(),
          },
          { label: "Validation", value: validationSummary(task, latestReport) },
          { label: "Report status", value: latestReport?.reportStatus ?? "No report" },
        ]}
      />
      <CompactList
        emptyLabel="No reported errors."
        items={latestReport?.errors ?? []}
        label="Errors"
      />
    </Section>
  );
}
