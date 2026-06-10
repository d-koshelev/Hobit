import { useId, useMemo, useState, type RefObject } from "react";

import { DisabledActionReason } from "../../../design-system/ActionPrimitives";
import { Button } from "../../../design-system/Button";
import { WidgetPopupShell } from "../../../design-system/WidgetPopupShell";
import type {
  AgentQueueReportActionCard,
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../../workspace/types";
import {
  getQueuePromptPackImportMetadata,
  type QueuePromptPackImportMetadata,
} from "../../promptPack/queuePromptPackMetadata";
import type {
  QueueInspectorSnapshot,
  QueueTaskViewModel,
} from "../../queue/queueV2ViewModel";
import type { QueueNextAction } from "../../queue/queueV2NextActionModel";
import type { AgentQueueController } from "../../queue/details/agentQueueTaskDetailsTypes";
import { AgentQueueTaskContextSection } from "../../queue/details/AgentQueueTaskContextSection";
import { AgentQueueTaskResultEvidenceSection } from "../../queue/details/AgentQueueTaskResultEvidenceSection";
import type { WidgetRenderProps } from "../../types";
import {
  buildQueueV2TaskDetailsActions,
  type QueueV2DetailsTab,
} from "./queueV2TaskDetailsActions";
import { QueueV2PromptPackImportSection } from "./QueueV2PromptPackImportSection";

type QueueV2TaskDetailsPopupProps = {
  inspector: QueueInspectorSnapshot | null;
  isOpen: boolean;
  onCreateKnowledgeDocument?: WidgetRenderProps["onCreateKnowledgeDocument"];
  onCreateSkill?: WidgetRenderProps["onCreateSkill"];
  onListKnowledgeDraftReviews?: WidgetRenderProps["onListKnowledgeDraftReviews"];
  onRecordKnowledgeDraftReview?: WidgetRenderProps["onRecordKnowledgeDraftReview"];
  onRequestNewTask?: () => void;
  onRequestClose: () => void;
  onShowQueueReportInWorkspaceChat?: (
    card: AgentQueueReportActionCard,
  ) => void;
  onShowQueueTaskInWorkspaceChat?: (task: AgentQueueTask) => void;
  queue?: AgentQueueController;
  returnFocusRef?: RefObject<HTMLElement | null>;
  taskViewModel: QueueTaskViewModel | null;
};

const TABS: { id: QueueV2DetailsTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "prompt", label: "Prompt" },
  { id: "result", label: "Result" },
  { id: "agent-log", label: "Agent Log" },
  { id: "context", label: "Context" },
  { id: "files-validation", label: "Files / Validation" },
  { id: "developer", label: "Developer" },
];

export function QueueV2TaskDetailsPopup({
  inspector,
  isOpen,
  onCreateKnowledgeDocument,
  onCreateSkill,
  onListKnowledgeDraftReviews,
  onRecordKnowledgeDraftReview,
  onRequestNewTask,
  onRequestClose,
  onShowQueueReportInWorkspaceChat,
  onShowQueueTaskInWorkspaceChat,
  queue,
  returnFocusRef,
  taskViewModel,
}: QueueV2TaskDetailsPopupProps) {
  const [activeTab, setActiveTab] = useState<QueueV2DetailsTab>("overview");
  const titleId = useId();
  const tabListId = useId();
  const task = taskViewModel?.task ?? null;
  const latestReport = latestTaskReport(task);
  const promptPackMetadata = task ? getQueuePromptPackImportMetadata(task) : null;
  const highLevelEvents = useMemo(
    () => highLevelTaskEvents(task, latestReport),
    [latestReport, task],
  );
  const detailActions = useMemo(
    () =>
      buildQueueV2TaskDetailsActions({
        inspector,
        onRequestNewTask,
        onSelectTab: setActiveTab,
        queue,
        task,
      }),
    [inspector, onRequestNewTask, queue, task],
  );

  if (!task || !taskViewModel || !inspector) {
    return null;
  }

  const activePanelId = `queue-v2-details-${task.queueItemId}-${activeTab}`;

  return (
    <WidgetPopupShell
      actions={
        <Button onClick={onRequestClose} variant="ghost">
          Close
        </Button>
      }
      bodyClassName="queue-v2-task-details-popup"
      className="queue-v2-task-details-shell"
      eyebrow="QueueV2 task details"
      id={`queue-v2-task-details-${task.queueItemId}`}
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      returnFocusRef={returnFocusRef}
      title={inspector.title}
      titleId={titleId}
      variant="floating"
    >
      <article>
        <p className="queue-v2-task-details-subtitle">
          {laneLabel(inspector.boardLane)} / {lifecycleLabel(inspector.lifecycle)}
        </p>

        <div className="queue-v2-task-details-actions">
          <div>
            <p className="queue-v2-task-details-action-kicker">Primary action</p>
            <p className="queue-v2-task-details-action-title">
              {queueV2NextActionLabel(inspector.nextAction)}
            </p>
            <span>{primaryActionReason(inspector, queue)}</span>
          </div>
          <div
            aria-label="QueueV2 task explicit actions"
            className="queue-v2-task-details-action-buttons"
          >
            <span className="queue-v2-task-details-action-item">
              <Button
                disabled={!onShowQueueTaskInWorkspaceChat}
                onClick={() => onShowQueueTaskInWorkspaceChat?.(task)}
                title={
                  onShowQueueTaskInWorkspaceChat
                    ? undefined
                    : "Workspace Chat is unavailable in this Workbench."
                }
                variant="secondary"
              >
                Show in Chat
              </Button>
              {!onShowQueueTaskInWorkspaceChat ? (
                <DisabledActionReason reason="Workspace Chat is unavailable in this Workbench." />
              ) : null}
            </span>
            {detailActions.map((action) => (
              <span
                className="queue-v2-task-details-action-item"
                key={action.id}
              >
                <Button
                  disabled={action.disabled}
                  onClick={action.onClick}
                  title={action.reason}
                  variant={action.variant}
                >
                  {action.label}
                </Button>
                {action.disabled ? (
                  <DisabledActionReason reason={action.reason} />
                ) : null}
              </span>
            ))}
          </div>
        </div>

        <div
          aria-label="QueueV2 task details tabs"
          className="queue-v2-task-details-tabs"
          id={tabListId}
          role="tablist"
        >
          {TABS.map((tab) => (
            <button
              aria-controls={`queue-v2-details-${task.queueItemId}-${tab.id}`}
              aria-selected={activeTab === tab.id}
              className="queue-v2-task-details-tab"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section
          aria-labelledby={tabListId}
          className="queue-v2-task-details-body"
          id={activePanelId}
          role="tabpanel"
        >
          {activeTab === "overview" ? (
            <OverviewSection
              events={highLevelEvents}
              inspector={inspector}
              promptPackMetadata={promptPackMetadata}
              task={task}
            />
          ) : null}
          {activeTab === "prompt" ? <PromptSection task={task} /> : null}
          {activeTab === "result" ? (
            queue ? (
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
              <ResultSection latestReport={latestReport} task={task} />
            )
          ) : null}
          {activeTab === "agent-log" ? (
            <AgentLogSection events={highLevelEvents} />
          ) : null}
          {activeTab === "context" ? (
            queue ? (
              <AgentQueueTaskContextSection
                onDetachContextRef={queue.knowledgeContext?.onDetachSelected}
                selectedTask={task}
              />
            ) : (
              <ContextSection task={task} />
            )
          ) : null}
          {activeTab === "files-validation" ? (
            <FilesValidationSection
              latestReport={latestReport}
              promptPackMetadata={promptPackMetadata}
              task={task}
            />
          ) : null}
          {activeTab === "developer" ? (
            <DeveloperSection
              inspector={inspector}
              latestReport={latestReport}
              task={task}
            />
          ) : null}
        </section>
      </article>
    </WidgetPopupShell>
  );
}

function OverviewSection({
  events,
  inspector,
  promptPackMetadata,
  task,
}: {
  events: string[];
  inspector: QueueInspectorSnapshot;
  promptPackMetadata: QueuePromptPackImportMetadata | null;
  task: AgentQueueTask;
}) {
  return (
    <div className="queue-v2-task-details-section">
      <DetailBlock label="Objective" value={inspector.objective || "No objective provided."} />
      <dl className="queue-v2-task-details-facts">
        <DetailFact label="Priority" value={inspector.priority.toString()} />
        <DetailFact label="Status" value={task.status} />
        <DetailFact label="Next action" value={queueV2NextActionLabel(inspector.nextAction)} />
        <DetailFact label="Why available" value={primaryActionReason(inspector)} />
      </dl>
      <div>
        <h3>Recent events</h3>
        <EventList events={events} />
      </div>
      {promptPackMetadata ? (
        <QueueV2PromptPackImportSection
          metadata={promptPackMetadata}
          task={task}
        />
      ) : null}
    </div>
  );
}

function PromptSection({ task }: { task: AgentQueueTask }) {
  return (
    <div className="queue-v2-task-details-section">
      <DetailBlock label="Original prompt summary" value={summarizeText(task.prompt)} />
      <DetailBlock
        label="Materialized prompt preview"
        value={
          task.context?.materializedAt
            ? "Materialized context data exists for this task. Prompt preview rendering remains placeholder-only in this UI block."
            : "No materialized prompt preview is available for this task."
        }
      />
    </div>
  );
}

function ResultSection({
  latestReport,
  task,
}: {
  latestReport: AgentQueueWorkerExecutionReport | null;
  task: AgentQueueTask;
}) {
  return (
    <div className="queue-v2-task-details-section">
      <DetailBlock
        label="Output summary"
        value={latestReport?.summary ?? "No worker result has been reported."}
      />
      <dl className="queue-v2-task-details-facts">
        <DetailFact
          label="Changed files"
          value={(latestReport?.changedFiles.length ?? 0).toString()}
        />
        <DetailFact label="Validation" value={validationSummary(task, latestReport)} />
        <DetailFact
          label="Report status"
          value={latestReport?.reportStatus ?? "No report"}
        />
      </dl>
    </div>
  );
}

function AgentLogSection({ events }: { events: string[] }) {
  return (
    <div className="queue-v2-task-details-section">
      <p className="queue-v2-task-details-note">
        High-level task timeline only. Raw events and payloads are kept in Developer.
      </p>
      <EventList events={events} />
    </div>
  );
}

function ContextSection({ task }: { task: AgentQueueTask }) {
  const context = task.context;

  return (
    <div className="queue-v2-task-details-section">
      <dl className="queue-v2-task-details-facts">
        <DetailFact
          label="Knowledge"
          value={(context?.attachedKnowledgeRefs.length ?? 0).toString()}
        />
        <DetailFact
          label="Skills"
          value={(context?.attachedSkillRefs.length ?? 0).toString()}
        />
        <DetailFact
          label="Warnings"
          value={(context?.contextWarnings.length ?? 0).toString()}
        />
        <DetailFact
          label="Token budget"
          value={
            context
              ? `${context.contextTokenBudget.estimatedTokens.toString()} / ${context.contextTokenBudget.maxTokens.toString()}`
              : "No context"
          }
        />
      </dl>
      <DetailBlock
        label="Context status"
        value={
          context?.contextTokenBudget.overBudget
            ? "Attached context is over budget."
            : context
              ? "Attached context is within the recorded budget."
              : "No Knowledge or Skill context is attached."
        }
      />
      <CompactList
        emptyLabel="No context warnings."
        items={context?.contextWarnings.map((warning) => warning.message) ?? []}
        label="Warnings"
      />
    </div>
  );
}

function FilesValidationSection({
  latestReport,
  promptPackMetadata,
  task,
}: {
  latestReport: AgentQueueWorkerExecutionReport | null;
  promptPackMetadata: QueuePromptPackImportMetadata | null;
  task: AgentQueueTask;
}) {
  return (
    <div className="queue-v2-task-details-section">
      <CompactList
        emptyLabel="No changed files reported."
        items={latestReport?.changedFiles ?? []}
        label="Changed files"
      />
      <CompactList
        emptyLabel="No validation commands were run."
        items={
          promptPackMetadata?.validationCommands.length
            ? promptPackMetadata.validationCommands
            : latestReport?.validationCommandsRun ?? latestReport?.commandsRun ?? []
        }
        label="Validation commands"
      />
      {promptPackMetadata?.expectedCommitTitle ? (
        <DetailBlock
          label="Expected commit title"
          value={promptPackMetadata.expectedCommitTitle}
        />
      ) : null}
      <DetailBlock label="Validation summary" value={validationSummary(task, latestReport)} />
    </div>
  );
}

function DeveloperSection({
  inspector,
  latestReport,
  task,
}: {
  inspector: QueueInspectorSnapshot;
  latestReport: AgentQueueWorkerExecutionReport | null;
  task: AgentQueueTask;
}) {
  return (
    <div className="queue-v2-task-details-section">
      <details className="queue-v2-task-details-developer">
        <summary>Raw / developer details</summary>
        <dl className="queue-v2-task-details-facts">
          <DetailFact label="Task id" value={task.queueItemId} />
          <DetailFact label="Workspace id" value={task.workspaceId} />
          <DetailFact label="Latest report id" value={latestReport?.reportId ?? "None"} />
          <DetailFact
            label="Compatible workers"
            value={
              inspector.workerAssignment.compatibleWorkerIds.length
                ? inspector.workerAssignment.compatibleWorkerIds.join(", ")
                : "None"
            }
          />
        </dl>
        <DetailBlock
          label="Raw report preview"
          value={latestReport?.rawReportPreview ?? "No raw report preview recorded."}
          mono
        />
      </details>
    </div>
  );
}

function DetailBlock({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="queue-v2-task-details-block">
      <h3>{label}</h3>
      <p className={mono ? "queue-v2-task-details-mono" : undefined}>{value}</p>
    </div>
  );
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function CompactList({
  emptyLabel,
  items,
  label,
}: {
  emptyLabel: string;
  items: readonly string[];
  label: string;
}) {
  return (
    <div className="queue-v2-task-details-block">
      <h3>{label}</h3>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyLabel}</p>
      )}
    </div>
  );
}

function EventList({ events }: { events: readonly string[] }) {
  return (
    <ol className="queue-v2-task-details-events">
      {events.map((event) => (
        <li key={event}>{event}</li>
      ))}
    </ol>
  );
}

function latestTaskReport(task: AgentQueueTask | null) {
  return task?.workerExecutionReports?.[task.workerExecutionReports.length - 1] ?? null;
}

function highLevelTaskEvents(
  task: AgentQueueTask | null,
  latestReport: AgentQueueWorkerExecutionReport | null,
) {
  if (!task) {
    return [];
  }

  return [
    `Created ${task.createdAt}`,
    `Current status is ${task.status}`,
    latestReport
      ? `Latest worker report is ${latestReport.reportStatus}: ${latestReport.summary}`
      : "No worker report recorded",
    `Validation is ${validationSummary(task, latestReport)}`,
  ];
}

function validationSummary(
  task: AgentQueueTask,
  latestReport: AgentQueueWorkerExecutionReport | null,
) {
  return latestReport?.validationResult ?? task.validationStatus ?? "not_started";
}

function summarizeText(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "No prompt text provided.";
  }

  return normalized.length > 420 ? `${normalized.slice(0, 420)}...` : normalized;
}

function primaryActionReason(
  inspector: QueueInspectorSnapshot,
  queue?: AgentQueueController,
) {
  if (inspector.blockedReasons.length) {
    return inspector.blockedReasons[0]?.label ?? "A visible blocker must be resolved.";
  }

  if (queue?.run.canStart) {
    return "Run is available only through the explicit task action below.";
  }

  if (inspector.eligibility.eligibleNow && !queue) {
    return "The task is eligible in the view model, but Queue actions are not wired in this view.";
  }

  if (inspector.reviewDecisionState === "review_open") {
    return "A result is available and needs explicit operator review.";
  }

  return "This popup is read-only in this block; no Queue runtime action is wired.";
}

export function queueV2NextActionLabel(action: QueueNextAction) {
  switch (action) {
    case "edit_draft":
      return "Edit draft";
    case "queue_task":
      return "Queue task";
    case "validate_readiness":
      return "Check readiness";
    case "run_now":
      return "Run now";
    case "assign_worker":
      return "Assign worker";
    case "wait_for_capacity":
      return "Wait for capacity";
    case "resolve_dependency":
      return "Resolve dependency";
    case "resolve_blocker":
      return "Resolve blocker";
    case "review_report":
      return "Review report";
    case "accept_result":
      return "Accept result";
    case "request_changes":
      return "Request changes";
    case "create_follow_up":
      return "Create follow-up";
    case "reject_result":
      return "Reject result";
    case "retry_or_rerun":
      return "Retry or rerun";
    case "close_cancelled":
      return "Close cancelled";
    case "view_history":
      return "View history";
  }
}

function laneLabel(lane: QueueInspectorSnapshot["boardLane"]) {
  switch (lane) {
    case "intake_draft":
      return "Intake";
    case "ready":
      return "Ready";
    case "running":
      return "Running";
    case "review":
      return "Review";
    case "blocked":
      return "Blocked";
    case "closed":
      return "Closed";
  }
}

function lifecycleLabel(lifecycle: QueueInspectorSnapshot["lifecycle"]) {
  return lifecycle.replace(/_/g, " ");
}
