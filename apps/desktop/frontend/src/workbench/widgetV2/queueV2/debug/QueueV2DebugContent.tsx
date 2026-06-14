import type { QueueV2DebugModel, QueueV2DebugSection } from "./queueV2DebugModel";

type QueueV2DebugContentProps = {
  model: QueueV2DebugModel;
};

export function QueueV2DebugContent({ model }: QueueV2DebugContentProps) {
  return (
    <div className="queue-v2-debug-content">
      {model.sections.map((section) => (
        <QueueV2DebugSectionView
          key={section.title}
          logs={model.logs}
          section={section}
        />
      ))}
    </div>
  );
}

function QueueV2DebugSectionView({
  section,
  logs,
}: {
  section: QueueV2DebugSection;
  logs: readonly string[];
}) {
  if (section.title === "Task logs") {
    return (
      <section className="queue-v2-debug-content-section">
        <h3>{section.title}</h3>
        <pre>{logs.join("\n")}</pre>
      </section>
    );
  }

  return (
    <section className="queue-v2-debug-content-section">
      <h3>{section.title}</h3>
      <dl className="queue-v2-task-details-facts">
        {section.facts.map((fact) => (
          <div key={`${section.title}-${fact.label}`}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
