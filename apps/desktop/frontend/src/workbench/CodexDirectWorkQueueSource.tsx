import type { DirectWorkRunHandoff } from "./types";

export function CodexDirectWorkQueueSource({
  handoff,
}: {
  handoff: DirectWorkRunHandoff;
}) {
  return (
    <section
      aria-label="Queue-started Direct Work source"
      className="codex-direct-work-source"
    >
      <div className="codex-direct-work-copy">
        <p className="codex-direct-work-title">Source: Agent Queue</p>
        <p className="codex-direct-work-text">Task: {handoff.taskTitle}</p>
      </div>
      <dl className="codex-direct-work-result-grid">
        <div className="codex-direct-work-result-field">
          <dt className="codex-direct-work-result-label">Run id</dt>
          <dd className="codex-direct-work-result-value">{handoff.runId}</dd>
        </div>
        <div className="codex-direct-work-result-field">
          <dt className="codex-direct-work-result-label">Execution workspace</dt>
          <dd className="codex-direct-work-result-value">{handoff.repoRoot}</dd>
        </div>
      </dl>
    </section>
  );
}
