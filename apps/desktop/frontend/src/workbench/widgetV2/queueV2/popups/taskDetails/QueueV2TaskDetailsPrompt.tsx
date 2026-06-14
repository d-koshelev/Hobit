import type { AgentQueueTask } from "../../../../../workspace/types";
import { DetailBlock } from "../../QueueV2TaskDetailsBlocks";
import { summarizeText } from "../../model/queueV2TaskDetailsFormat";

export function QueueV2TaskDetailsPrompt({ task }: { task: AgentQueueTask }) {
  return (
    <div className="queue-v2-task-details-section">
      <DetailBlock label="Original prompt summary" value={summarizeText(task.prompt)} />
      {task.description.trim() ? (
        <DetailBlock label="Description" value={task.description.trim()} />
      ) : null}
    </div>
  );
}
