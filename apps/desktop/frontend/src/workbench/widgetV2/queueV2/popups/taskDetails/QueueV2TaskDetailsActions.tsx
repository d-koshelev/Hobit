import { useState } from "react";

import { Button, DisabledActionReason } from "../../../../../design-system";
import type { AgentQueueTask } from "../../../../../workspace/types";
import type { QueueV2TaskDetailsAction } from "../../queueV2TaskDetailsActions";

type QueueV2TaskDetailsActionsProps = {
  actions: readonly QueueV2TaskDetailsAction[];
  onRequestValidation: () => void;
  onShowQueueTaskInWorkspaceChat?: (task: AgentQueueTask) => void;
  task: AgentQueueTask;
  validationDisabledReason?: string | null;
  validationRequestRunning: boolean;
};

export function QueueV2TaskDetailsActions({
  actions,
  onRequestValidation,
  onShowQueueTaskInWorkspaceChat,
  task,
  validationDisabledReason,
  validationRequestRunning,
}: QueueV2TaskDetailsActionsProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const primaryAction = selectPrimaryAction(actions);
  const secondaryActions = actions.filter((action) => action !== primaryAction);

  return (
    <section
      aria-label="QueueV2 task explicit actions"
      className="queue-v2-task-details-actions queue-v2-task-details-action-strip"
    >
      <div className="queue-v2-task-details-primary-action">
        <Button
          disabled={primaryAction?.disabled ?? true}
          onClick={primaryAction?.onClick ?? (() => undefined)}
          title={primaryAction?.reason}
          variant={primaryAction?.variant ?? "primary"}
        >
          {primaryAction?.label ?? "No action available"}
        </Button>
        <DisabledActionReason reason={primaryAction?.reason} />
      </div>
      <div className="queue-v2-task-details-more">
        <Button
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((current) => !current)}
          variant="ghost"
        >
          More
        </Button>
        <div
          aria-label="More QueueV2 task actions"
          className="queue-v2-task-details-more-menu"
          data-open={isMenuOpen ? "true" : "false"}
          role="menu"
        >
          {secondaryActions.map((action) => (
            <span className="queue-v2-task-details-action-item" key={action.id}>
              <Button
                disabled={action.disabled}
                onClick={action.onClick}
                title={action.reason}
                variant={action.variant}
              >
                {action.label}
              </Button>
              <DisabledActionReason reason={action.disabled ? action.reason : null} />
            </span>
          ))}
          <span className="queue-v2-task-details-action-item">
            <Button
              disabled={!onShowQueueTaskInWorkspaceChat}
              onClick={() => onShowQueueTaskInWorkspaceChat?.(task)}
              title={
                onShowQueueTaskInWorkspaceChat
                  ? undefined
                  : "Workspace Chat is unavailable in this Workbench."
              }
              variant="secondary"
            >
              Show in Chat
            </Button>
            <DisabledActionReason
              reason={
                onShowQueueTaskInWorkspaceChat
                  ? null
                  : "Workspace Chat is unavailable in this Workbench."
              }
            />
          </span>
          <span className="queue-v2-task-details-action-item">
            <Button
              disabled={Boolean(validationDisabledReason) || validationRequestRunning}
              onClick={onRequestValidation}
              title={validationDisabledReason ?? undefined}
              variant="secondary"
            >
              {validationRequestRunning ? "Requesting validation" : "Request validation"}
            </Button>
            <DisabledActionReason reason={validationDisabledReason} />
          </span>
        </div>
      </div>
    </section>
  );
}

function selectPrimaryAction(actions: readonly QueueV2TaskDetailsAction[]) {
  return (
    actions.find((action) => action.variant === "primary") ??
    actions.find((action) => action.id !== "refresh") ??
    actions[0] ??
    null
  );
}
