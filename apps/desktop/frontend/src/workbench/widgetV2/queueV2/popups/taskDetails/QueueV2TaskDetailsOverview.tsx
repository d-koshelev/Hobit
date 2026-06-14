import { KeyValueList, Section } from "../../../../../design-system";
import type { AgentQueueTask } from "../../../../../workspace/types";
import type {
  QueueInspectorSnapshot,
  QueueTaskViewModel,
} from "../../../../queue/queueV2ViewModel";
import { queueV2NextActionLabel } from "../../../../queue/queueV2NextActionModel";
import type { QueuePromptPackImportMetadata } from "../../../../promptPack/queuePromptPackMetadata";
import { QueueV2DiffReviewSection } from "../../QueueV2DiffReviewSection";
import { QueueV2PromptPackImportSection } from "../../QueueV2PromptPackImportSection";
import { QueueV2TaskBlockersSection } from "../../QueueV2TaskBlockersSection";
import { DetailBlock, EventList } from "../../QueueV2TaskDetailsBlocks";

export function QueueV2TaskDetailsOverview({
  events,
  inspector,
  onOpenLinkedTask,
  promptPackMetadata,
  task,
  taskViewModel,
}: {
  events: readonly string[];
  inspector: QueueInspectorSnapshot;
  onOpenLinkedTask?: (taskId: string) => void;
  promptPackMetadata: QueuePromptPackImportMetadata | null;
  task: AgentQueueTask;
  taskViewModel: QueueTaskViewModel;
}) {
  return (
    <div className="queue-v2-task-details-section">
      <DetailBlock
        label="Objective"
        value={inspector.objective || "No objective provided."}
      />
      <Section compact title="Task state">
        <KeyValueList
          compact
          items={[
            { label: "Priority", value: inspector.priority.toString() },
            { label: "Status", value: inspector.humanStatus.text },
            { label: "Next action", value: queueV2NextActionLabel(inspector.nextAction) },
            {
              label: "Dependencies",
              value: inspector.dependencySummary.message,
            },
            {
              label: "Primary blocker",
              value: inspector.blockerSummary.primaryReason ?? "None",
            },
            {
              label: "Latest report",
              value: inspector.reportSummary ?? "No report yet",
            },
          ]}
        />
      </Section>
      <QueueV2TaskBlockersSection inspector={inspector} />
      <QueueV2DiffReviewSection
        onOpenLinkedTask={onOpenLinkedTask}
        taskViewModel={taskViewModel}
      />
      <Section compact title="Recent activity">
        <EventList events={events} />
      </Section>
      {promptPackMetadata ? (
        <QueueV2PromptPackImportSection
          dependencyState={inspector.dependencyState}
          metadata={promptPackMetadata}
          task={task}
        />
      ) : null}
    </div>
  );
}
