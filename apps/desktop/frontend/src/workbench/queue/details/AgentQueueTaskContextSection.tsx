import type {
  AgentQueueTask,
  AgentQueueTaskContextRef,
  AgentQueueTaskContextSnapshot,
  AgentQueueTaskContextWarning,
} from "../../../workspace/types";
import {
  materializeQueueExecutionPrompt,
  queueContextSummary,
} from "../../agentQueueKnowledgeContext";

type AgentQueueTaskContextSectionProps = {
  selectedTask: AgentQueueTask;
};

export function AgentQueueTaskContextSection({
  selectedTask,
}: AgentQueueTaskContextSectionProps) {
  const context = selectedTask.context;
  const summary = queueContextSummary(context);
  const hasContext = summary.knowledgeCount > 0 || summary.skillCount > 0;
  const materialized = hasContext
    ? materializeQueueExecutionPrompt(selectedTask)
    : null;

  return (
    <section
      aria-label="Attached Queue task context"
      className="agent-queue-context-section"
    >
      <div className="agent-queue-section-header">
        <div>
          <p className="agent-queue-expanded-kicker">Context</p>
          <h3 className="agent-queue-section-title">Attached Knowledge / Skills</h3>
        </div>
        <span className="agent-queue-context-count">
          {(summary.knowledgeCount + summary.skillCount).toString()}
        </span>
      </div>

      {!hasContext ? (
        <p className="agent-queue-section-copy">
          No Knowledge or Skill refs are attached to this task.
        </p>
      ) : (
        <>
          <ContextRefList
            label="Knowledge"
            refs={context?.attachedKnowledgeRefs ?? []}
          />
          <ContextRefList label="Skills" refs={context?.attachedSkillRefs ?? []} />
          <SnapshotList snapshots={context?.attachedKnowledgeSnapshots ?? []} />
          <ContextWarningList warnings={context?.contextWarnings ?? []} />
          {materialized?.contextSection ? (
            <details className="agent-queue-details agent-queue-secondary-details">
              <summary>Prompt context preview</summary>
              <pre className="agent-queue-flow-selection-prompt">
                {materialized.contextSection}
              </pre>
            </details>
          ) : null}
          <p className="agent-queue-section-copy">
            Context is stored as safe refs and bounded snapshots. The visible
            prompt preview above is what is added before the task prompt for an
            explicit manual run.
          </p>
          <p className="agent-queue-section-copy">
            Materialized: {context?.materializedAt ?? "Not materialized"}.
            Estimated context tokens:{" "}
            {context?.contextTokenBudget.estimatedTokens.toString() ?? "0"} /{" "}
            {context?.contextTokenBudget.maxTokens.toString() ?? "0"}.
          </p>
        </>
      )}
    </section>
  );
}

function SnapshotList({
  snapshots,
}: {
  snapshots: AgentQueueTaskContextSnapshot[];
}) {
  if (snapshots.length === 0) {
    return null;
  }

  return (
    <div className="agent-queue-context-group">
      <p className="agent-queue-context-label">Materialized snapshots</p>
      {snapshots.map((snapshot) => (
        <article className="agent-queue-context-ref" key={snapshot.id}>
          <div className="agent-queue-context-ref-header">
            <strong>{snapshot.title}</strong>
            <span>{snapshot.capped ? "Capped" : "Bounded"}</span>
          </div>
          <p>{snapshot.content}</p>
          <dl>
            <div>
              <dt>Snapshot</dt>
              <dd>{snapshot.id}</dd>
            </div>
            <div>
              <dt>Tokens</dt>
              <dd>{snapshot.tokenEstimate.toString()}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function ContextRefList({
  label,
  refs,
}: {
  label: string;
  refs: AgentQueueTaskContextRef[];
}) {
  if (refs.length === 0) {
    return null;
  }

  return (
    <div className="agent-queue-context-group">
      <p className="agent-queue-context-label">{label}</p>
      {refs.map((ref) => (
        <article className="agent-queue-context-ref" key={`${ref.kind}:${ref.id}`}>
          <div className="agent-queue-context-ref-header">
            <strong>{ref.title}</strong>
            <span>{ref.status}</span>
          </div>
          <p>{ref.quickSummary}</p>
          <dl>
            <div>
              <dt>Scope</dt>
              <dd>{ref.scope}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{ref.source}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{ref.version || "Unknown"}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function ContextWarningList({
  warnings,
}: {
  warnings: AgentQueueTaskContextWarning[];
}) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="agent-queue-context-warnings">
      {warnings.map((warning) => (
        <p
          className={[
            "agent-queue-context-warning",
            `agent-queue-context-warning-${warning.severity}`,
          ].join(" ")}
          key={warning.id}
        >
          {warning.message}
        </p>
      ))}
    </div>
  );
}
