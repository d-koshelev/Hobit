import type { KnowledgeV2DebugModel } from "./knowledgeDebugModel";

export function KnowledgeV2DebugContent({
  model,
}: {
  readonly model: KnowledgeV2DebugModel;
}) {
  return (
    <div className="knowledge-v2-debug-content">
      <DebugSection entries={model.bridgeDiagnostics} title="Bridge State" />
      <DebugSection
        entries={model.callbackDiagnostics}
        title="Callback Availability"
      />
      <DebugSection entries={model.sourceDiagnostics} title="Sources" />
      <DebugSection
        entries={model.actionDiagnostics}
        title="Action Diagnostics"
      />
      <DebugSection entries={model.rawPayloadSummary} title="Raw Id Summary" />
      <section className="knowledge-v2-debug-section">
        <h4>Implementation Notes</h4>
        <ul>
          {model.implementationNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DebugSection({
  entries,
  title,
}: {
  readonly entries: readonly { readonly label: string; readonly value: string }[];
  readonly title: string;
}) {
  return (
    <section className="knowledge-v2-debug-section">
      <h4>{title}</h4>
      <dl>
        {entries.map((entry) => (
          <div key={entry.label}>
            <dt>{entry.label}</dt>
            <dd>{entry.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
