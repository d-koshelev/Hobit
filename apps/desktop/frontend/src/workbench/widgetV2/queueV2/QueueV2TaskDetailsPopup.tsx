import { useId, useMemo, useState, type RefObject } from "react";

import { Button } from "../../../design-system/Button";
import { WidgetPopupShell } from "../../../design-system/WidgetPopupShell";
import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../../workspace/types";
import type {
  QueueInspectorSnapshot,
  QueueTaskViewModel,
} from "../../queue/queueV2ViewModel";
import type { QueueNextAction } from "../../queue/queueV2NextActionModel";

type QueueV2DetailsTab =
  | "overview"
  | "prompt"
  | "result"
  | "agent-log"
  | "context"
  | "files-validation"
  | "developer";

type QueueV2TaskDetailsPopupProps = {
  inspector: QueueInspectorSnapshot | null;
  isOpen: boolean;
  onRequestClose: () => void;
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
  onRequestClose,
  returnFocusRef,
  taskViewModel,
}: QueueV2TaskDetailsPopupProps) {
  const [activeTab, setActiveTab] = useState<QueueV2DetailsTab>("overview");
  const titleId = useId();
  const tabListId = useId();
  const task = taskViewModel?.task ?? null;
  const latestReport = latestTaskReport(task);
  const highLevelEvents = useMemo(
    () => highLevelTaskEvents(task, latestReport),
    [latestReport, task],
  );

  if (!task || !taskViewModel || !inspector) {
    return null;
  }

  const activePanelId = `queue-v2-details-${task.queueItemId}-${activeTab}`;

  return (
    <WidgetPopupShell
      className="queue-v2-task-details-shell"
      id={`queue-v2-task-details-${task.queueItemId}`}
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      returnFocusRef={returnFocusRef}
      titleId={titleId}
      variant="floating"
    >
      <article className="queue-v2-task-details-popup">
        <header className="queue-v2-task-details-header" data-popup-drag-handle>
          <div>
            <p className="queue-v2-task-details-kicker">QueueV2 task details</p>
            <h2 className="queue-v2-task-details-title" id={titleId}>
              {inspector.title}
            </h2>
            <p className="queue-v2-task-details-subtitle">
              {laneLabel(inspector.boardLane)} / {lifecycleLabel(inspector.lifecycle)}
            </p>
          </div>
          <Button onClick={onRequestClose} variant="ghost">
            Close
          </Button>
        </header>

        <div className="queue-v2-task-details-actions">
          <Button disabled title={primaryActionReason(inspector)} variant="primary">
            {queueV2NextActionLabel(inspector.nextAction)}
          </Button>
          <span>{primaryActionReason(inspector)}</span>
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
              task={task}
            />
          ) : null}
          {activeTab === "prompt" ? <PromptSection task={task} /> : null}
          {activeTab === "result" ? (
            <ResultSection latestReport={latestReport} task={task} />
          ) : null}
          {activeTab === "agent-log" ? (
            <AgentLogSection events={highLevelEvents} />
          ) : null}
          {activeTab === "context" ? <ContextSection task={task} /> : null}
          {activeTab === "files-validation" ? (
            <FilesValidationSection latestReport={latestReport} task={task} />
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
  task,
}: {
  events: string[];
  inspector: QueueInspectorSnapshot;
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
  task,
}: {
  latestReport: AgentQueueWorkerExecutionReport | null;
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
        items={latestReport?.validationCommandsRun ?? latestReport?.commandsRun ?? []}
        label="Validation commands"
      />
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

function primaryActionReason(inspector: QueueInspectorSnapshot) {
  if (inspector.blockedReasons.length) {
    return inspector.blockedReasons[0]?.label ?? "A visible blocker must be resolved.";
  }

  if (inspector.eligibility.eligibleNow) {
    return "The task is eligible in the view model, but run wiring is intentionally disabled in this block.";
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
