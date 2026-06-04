import type {
  AgentQueueTask,
  AgentQueueTaskContextRef,
  AgentQueueTaskContextWarning,
} from "../../../workspace/types";
import { queueContextSummary } from "../../agentQueueKnowledgeContext";

type AgentQueueTaskContextSectionProps = {
  selectedTask: AgentQueueTask;
};

export function AgentQueueTaskContextSection({
  selectedTask,
}: AgentQueueTaskContextSectionProps) {
  const context = selectedTask.context;
  const summary = queueContextSummary(context);
  const hasContext = summary.knowledgeCount > 0 || summary.skillCount > 0;

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
          <ContextWarningList warnings={context?.contextWarnings ?? []} />
          <p className="agent-queue-section-copy">
            Context is stored as safe refs and summaries. No raw document body,
            prompt materialization, Executor run, provider call, or Queue
            Autorun was started by attachment.
          </p>
          <p className="agent-queue-section-copy">
            Materialized: {context?.materializedAt ?? "Not materialized"}
          </p>
        </>
      )}
    </section>
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
