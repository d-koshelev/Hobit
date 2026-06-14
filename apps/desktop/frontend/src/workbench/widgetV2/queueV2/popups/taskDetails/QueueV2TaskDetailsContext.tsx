import { KeyValueList, Notice } from "../../../../../design-system";
import type { AgentQueueTask } from "../../../../../workspace/types";
import { AgentQueueTaskContextSection } from "../../../../queue/details/AgentQueueTaskContextSection";
import type { AgentQueueController } from "../../../../queue/details/agentQueueTaskDetailsTypes";
import { CompactList, DetailBlock } from "../../QueueV2TaskDetailsBlocks";

export function QueueV2TaskDetailsContext({
  queue,
  task,
}: {
  queue?: AgentQueueController;
  task: AgentQueueTask;
}) {
  if (queue) {
    return (
      <AgentQueueTaskContextSection
        onDetachContextRef={queue.knowledgeContext?.onDetachSelected}
        selectedTask={task}
      />
    );
  }

  const context = task.context;

  return (
    <div className="queue-v2-task-details-section">
      <KeyValueList
        compact
        items={[
          {
            label: "Knowledge",
            value: (context?.attachedKnowledgeRefs.length ?? 0).toString(),
          },
          {
            label: "Skills",
            value: (context?.attachedSkillRefs.length ?? 0).toString(),
          },
          {
            label: "Warnings",
            value: (context?.contextWarnings.length ?? 0).toString(),
          },
          {
            label: "Token budget",
            value: context
              ? `${context.contextTokenBudget.estimatedTokens.toString()} / ${context.contextTokenBudget.maxTokens.toString()}`
              : "No context",
          },
        ]}
      />
      {context?.contextTokenBudget.overBudget ? (
        <Notice variant="warning">Attached context is over budget.</Notice>
      ) : (
        <DetailBlock
          label="Context status"
          value={
            context
              ? "Attached context is within the recorded budget."
              : "No Knowledge or Skill context is attached."
          }
        />
      )}
      <CompactList
        emptyLabel="No context warnings."
        items={context?.contextWarnings.map((warning) => warning.message) ?? []}
        label="Warnings"
      />
    </div>
  );
}
