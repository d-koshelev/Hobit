import { AgentQueueEmptySelection } from "./AgentQueueEmptySelection";
import { AgentQueueTaskSection } from "./AgentQueueTaskSection";
import type {
  AgentExecutorRunOpenRequestInput,
  AgentExecutorSlot,
  CoordinatorAttachedContextInput,
  WidgetRenderProps,
} from "./types";
import type { AgentQueueReportActionCard } from "../workspace/types";
import { AgentQueueFlowSelectionSummary } from "./queue/details/AgentQueueFlowSelectionSummary";
import { AgentQueueTaskActivityTimelineSection } from "./queue/details/AgentQueueTaskActivityTimelineSection";
import { AgentQueueTaskActionSurface } from "./queue/details/AgentQueueTaskActionSurface";
import { AgentQueueTaskContextSection } from "./queue/details/AgentQueueTaskContextSection";
import {
  AgentQueueTaskDeveloperDetailsSection,
  SubmittedMetadata,
} from "./queue/details/AgentQueueTaskDeveloperDetailsSection";
import { AgentQueueTaskOverviewSection } from "./queue/details/AgentQueueTaskOverviewSection";
import { AgentQueueTaskResultEvidenceSection } from "./queue/details/AgentQueueTaskResultEvidenceSection";
import type { AgentQueueController } from "./queue/details/agentQueueTaskDetailsTypes";

type AgentQueueTaskDetailsPanelProps = {
  agentExecutorSlots: AgentExecutorSlot[];
  assignmentInputId: string;
  descriptionInputId: string;
  executionPolicyInputId: string;
  onOpenAgentExecutorRun?: (
    request: AgentExecutorRunOpenRequestInput,
  ) => void;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onCreateKnowledgeDocument: WidgetRenderProps["onCreateKnowledgeDocument"];
  onCreateSkill: WidgetRenderProps["onCreateSkill"];
  onShowQueueReportInWorkspaceChat?: (
    card: AgentQueueReportActionCard,
  ) => void;
  priorityInputId: string;
  promptInputId: string;
  presentation?: "full" | "flow-summary";
  queue: AgentQueueController;
  selectedTaskHint: string;
  statusInputId: string;
  titleInputId: string;
};

export function AgentQueueTaskDetailsPanel({
  agentExecutorSlots,
  assignmentInputId,
  descriptionInputId,
  executionPolicyInputId,
  onOpenAgentExecutorRun,
  onAttachContextToCoordinator,
  onCreateKnowledgeDocument,
  onCreateSkill,
  onShowQueueReportInWorkspaceChat,
  priorityInputId,
  promptInputId,
  presentation = "full",
  queue,
  selectedTaskHint,
  statusInputId,
  titleInputId,
}: AgentQueueTaskDetailsPanelProps) {
  const {
    deleteTask,
    draft,
    editTask,
    editorError,
    isDirty,
    isLoading,
    isSaving,
    loadError,
    saveTask,
    selectedTask,
    tasks,
    updateDraft,
    updatePriority,
    validationMessage,
  } = queue;

  if (presentation === "flow-summary") {
    return (
      <section
        aria-label="Selected Agent Queue task summary"
        className="agent-queue-task-editor-pane agent-queue-task-editor-pane-flow"
      >
        {isLoading ? (
          <div className="agent-queue-empty-state">
            <p className="empty-state-title">Loading queue.</p>
            <p className="empty-state-text">
              Workspace queue tasks are loading.
            </p>
          </div>
        ) : loadError ? (
          <div className="agent-queue-empty-state" role="alert">
            <p className="empty-state-title">Queue unavailable.</p>
            <p className="empty-state-text">
              {loadError} Use Refresh to try again.
            </p>
          </div>
        ) : selectedTask ? (
          <AgentQueueFlowSelectionSummary
            queue={queue}
            selectedTask={selectedTask}
          />
        ) : (
          <AgentQueueEmptySelection hasTasks={tasks.length > 0} />
        )}
      </section>
    );
  }

  return (
    <section
      aria-label="Selected Agent Queue task"
      className="agent-queue-task-editor-pane"
    >
      {isLoading ? (
        <div className="agent-queue-empty-state">
          <p className="empty-state-title">Loading queue.</p>
          <p className="empty-state-text">
            Workspace queue tasks are loading.
          </p>
        </div>
      ) : loadError ? (
        <div className="agent-queue-empty-state" role="alert">
          <p className="empty-state-title">Queue unavailable.</p>
          <p className="empty-state-text">
            {loadError} Use Refresh to try again.
          </p>
        </div>
      ) : selectedTask ? (
        <div className="agent-queue-task-editor">
          <AgentQueueTaskOverviewSection queue={queue} selectedTask={selectedTask} />

          <AgentQueueTaskActionSurface
            agentExecutorSlots={agentExecutorSlots}
            assignmentInputId={assignmentInputId}
            onAttachContextToCoordinator={onAttachContextToCoordinator}
            onOpenAgentExecutorRun={onOpenAgentExecutorRun}
            queue={queue}
            selectedTask={selectedTask}
          />

          <AgentQueueTaskContextSection selectedTask={selectedTask} />

          <AgentQueueTaskResultEvidenceSection
            onCreateKnowledgeDocument={onCreateKnowledgeDocument}
            onCreateSkill={onCreateSkill}
            onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
            queue={queue}
            selectedTask={selectedTask}
          />

          <AgentQueueTaskActivityTimelineSection queue={queue} selectedTask={selectedTask} />

          <AgentQueueTaskDeveloperDetailsSection
            agentExecutorSlots={agentExecutorSlots}
            onAttachContextToCoordinator={onAttachContextToCoordinator}
            onOpenAgentExecutorRun={onOpenAgentExecutorRun}
            onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
            queue={queue}
            selectedTask={selectedTask}
            showDiffReviewLinkage={true}
            showSubmittedMetadata={true}
            showWorkerExecutionReport={true}
            taskEditMetadata={
              <details
                className="agent-queue-details agent-queue-secondary-details"
                open={editTask.isEditing}
              >
                <summary>Task edit and metadata</summary>
                <SubmittedMetadata queue={queue} />
                <AgentQueueTaskSection
                  deleteTask={deleteTask}
                  descriptionInputId={descriptionInputId}
                  draft={draft}
                  editTask={editTask}
                  executionPolicyInputId={executionPolicyInputId}
                  isDirty={isDirty}
                  isSaving={isSaving}
                  onDraftChange={updateDraft}
                  onPriorityChange={updatePriority}
                  onSave={() => void saveTask()}
                  ordering={queue.ordering}
                  priorityInputId={priorityInputId}
                  promptInputId={promptInputId}
                  selectedTask={selectedTask}
                  selectedTaskHint={selectedTaskHint}
                  statusInputId={statusInputId}
                  tasks={tasks}
                  titleInputId={titleInputId}
                />
              </details>
            }
          />

          {validationMessage ? (
            <p
              className="agent-queue-message agent-queue-message-warning"
              role="alert"
            >
              {validationMessage}
            </p>
          ) : null}
          {editorError ? (
            <p
              className="agent-queue-message agent-queue-message-error"
              role="alert"
            >
              {editorError}
            </p>
          ) : null}
          <details className="agent-queue-details agent-queue-safety-details">
            <summary>Queue boundaries</summary>
            <p className="agent-queue-boundary-note">
              Queue tasks are workspace-local records. Queue shows safe
              event-driven activity for selected runs, while raw execution
              detail remains Executor-owned. Queue does not run hidden
              background scheduling, launch Terminal commands, or mutate Git.
            </p>
          </details>
        </div>
      ) : (
        <AgentQueueEmptySelection hasTasks={tasks.length > 0} />
      )}
    </section>
  );
}
