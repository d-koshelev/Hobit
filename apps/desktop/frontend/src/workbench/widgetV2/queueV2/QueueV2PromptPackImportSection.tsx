import type { AgentQueueTask } from "../../../workspace/types";
import type { AgentQueueDependencyState } from "../../agentQueueTaskUiModel";
import type { QueuePromptPackImportMetadata } from "../../promptPack/queuePromptPackMetadata";

type QueueV2PromptPackImportSectionProps = {
  dependencyState: AgentQueueDependencyState;
  metadata: QueuePromptPackImportMetadata;
  task: AgentQueueTask;
};

export function QueueV2PromptPackImportSection({
  dependencyState,
  metadata,
  task,
}: QueueV2PromptPackImportSectionProps) {
  return (
    <div className="queue-v2-task-details-section">
      <h3>Prompt-pack import</h3>
      <dl className="queue-v2-task-details-facts">
        <DetailFact
          label="Pack"
          value={formatPackLabel(metadata.packName, metadata.packId)}
        />
        <DetailFact label="Block id" value={metadata.blockId ?? "Unknown"} />
        <DetailFact
          label="Dependencies"
          value={formatListSummary(metadata.dependencies, "None")}
        />
        <DetailFact
          label="Queue links"
          value={formatListSummary(task.dependsOn ?? [], "No linked Queue dependencies")}
        />
        <DetailFact
          label="Dependency state"
          value={formatDependencyState(dependencyState)}
        />
        <DetailFact
          label="Validation"
          value={
            metadata.validationCommands.length > 0
              ? `${metadata.validationCommands.length.toString()} command(s)`
              : "No validation command metadata"
          }
        />
        <DetailFact
          label="Expected commit"
          value={metadata.expectedCommitTitle ?? "No expected commit title"}
        />
      </dl>
      <CompactList
        emptyLabel="No allowed-scope notes."
        items={metadata.allowedScope}
        label="Allowed scope"
      />
      <CompactList
        emptyLabel="No forbidden-scope warnings."
        items={metadata.forbiddenScope}
        label="Forbidden scope"
      />
      <CompactList
        emptyLabel="No validation command metadata."
        items={metadata.validationCommands}
        label="Validation commands"
      />
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

function formatPackLabel(name: string | null, id: string | null) {
  if (name && id) {
    return `${name} (${id})`;
  }

  return name ?? id ?? "Unknown";
}

function formatListSummary(items: readonly string[], emptyLabel: string) {
  return items.length > 0 ? items.join(", ") : emptyLabel;
}

function formatDependencyState(dependencyState: AgentQueueDependencyState) {
  if (dependencyState.status === "ready") {
    return dependencyState.dependsOn.length > 0
      ? "Dependencies satisfied"
      : "No dependencies";
  }

  const blockers = dependencyState.blockedBy
    .map((blocker) => blocker.title)
    .join(", ");

  return blockers
    ? `Waiting on ${blockers}`
    : dependencyState.status === "invalid"
      ? "Dependency links need review"
      : "Waiting on dependencies";
}
