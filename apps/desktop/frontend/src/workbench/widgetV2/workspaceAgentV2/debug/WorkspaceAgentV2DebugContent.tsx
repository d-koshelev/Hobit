import { KeyValueList, Section } from "../../../../design-system";
import type { WorkspaceAgentV2DebugModel } from "./workspaceAgentV2DebugModel";

type WorkspaceAgentV2DebugContentProps = {
  readonly model: WorkspaceAgentV2DebugModel;
};

export function WorkspaceAgentV2DebugContent({
  model,
}: WorkspaceAgentV2DebugContentProps) {
  return (
    <div
      aria-label="Workspace Agent v2 diagnostics"
      className="workspace-agent-v2-debug-content"
    >
      {model.diagnostics.map((section) => (
        <Section
          className="workspace-agent-v2-debug-section"
          key={section.title}
          title={section.title}
        >
          <KeyValueList
            items={section.rows.map((row) => ({
              label: row.label,
              value: row.value,
            }))}
          />
        </Section>
      ))}
      <Section className="workspace-agent-v2-debug-section" title="Raw identifiers">
        <KeyValueList
          items={model.rawSummary.map((row) => ({
            label: row.label,
            value: row.value,
          }))}
        />
      </Section>
    </div>
  );
}
