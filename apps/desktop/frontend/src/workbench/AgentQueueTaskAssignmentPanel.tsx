import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type { AgentQueueTask } from "../workspace/types";
import {
  assignmentLabel,
  isFinalQueueTaskStatus,
} from "./agentQueueTaskUiModel";
import type { AgentExecutorSlot } from "./types";

type AgentQueueTaskAssignmentPanelProps = {
  apiAvailable: boolean;
  assignmentError: string | null;
  assignmentMessage: string | null;
  currentSelection: string;
  executorSlots: AgentExecutorSlot[];
  inputId: string;
  isAssigning: boolean;
  isDirty: boolean;
  onAssign: () => void;
  onClear: () => void;
  onSelectionChange: (executorWidgetInstanceId: string) => void;
  selectedTask: AgentQueueTask;
};

export function AgentQueueTaskAssignmentPanel({
  apiAvailable,
  assignmentError,
  assignmentMessage,
  currentSelection,
  executorSlots,
  inputId,
  isAssigning,
  isDirty,
  onAssign,
  onClear,
  onSelectionChange,
  selectedTask,
}: AgentQueueTaskAssignmentPanelProps) {
  const hasAssignedExecutor = Boolean(selectedTask.assignedExecutorWidgetId);
  const isFinalStatus = isFinalQueueTaskStatus(selectedTask.status);
  const hasExecutorSlots = executorSlots.length > 0;
  const assignmentDisabledReason = assignmentControlMessage({
    apiAvailable,
    hasExecutorSlots,
    isDirty,
    isFinalStatus,
  });
  const assignDisabled = Boolean(
    assignmentDisabledReason ||
      isAssigning ||
      !hasExecutorSlots ||
      !currentSelection,
  );
  const clearDisabled = Boolean(
    assignmentDisabledReason || isAssigning || !hasAssignedExecutor,
  );

  return (
    <section
      aria-label="Queue task assignment"
      className="agent-queue-assignment-section"
    >
      <div className="agent-queue-assignment-header">
        <div>
          <p className="agent-queue-assignment-title">Assignment</p>
          <p className="agent-queue-assignment-copy">
            Assignment only. This does not run the task.
          </p>
        </div>
        <Badge variant={hasAssignedExecutor ? "info" : "neutral"}>
          {assignmentLabel(selectedTask.assignedExecutorWidgetId)}
        </Badge>
      </div>

      {assignmentDisabledReason ? (
        <p className="agent-queue-assignment-note">
          {assignmentDisabledReason}
        </p>
      ) : null}

      {!hasExecutorSlots ? (
        <>
          <p className="agent-queue-assignment-note">
            No Agent Executor widgets available. Add an Agent Executor to assign
            tasks.
          </p>
          {hasAssignedExecutor ? (
            <div className="agent-queue-assignment-buttons">
              <Button
                disabled={clearDisabled}
                onClick={() => onClear()}
                variant="ghost"
              >
                Clear assignment
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="agent-queue-assignment-controls">
          <div className="agent-queue-assignment-field">
            <label className="field-label" htmlFor={inputId}>
              Executor slot
            </label>
            <select
              className="input agent-queue-assignment-select"
              disabled={!apiAvailable || isDirty || isFinalStatus || isAssigning}
              id={inputId}
              onChange={(event) =>
                onSelectionChange(event.currentTarget.value)
              }
              value={currentSelection}
            >
              {executorSlots.map((slot) => (
                <option
                  key={slot.widgetInstanceId}
                  value={slot.widgetInstanceId}
                >
                  {slot.label}
                </option>
              ))}
            </select>
          </div>
          <div className="agent-queue-assignment-buttons">
            <Button
              disabled={assignDisabled}
              onClick={() => onAssign()}
              variant="secondary"
            >
              {isAssigning ? "Assigning" : "Assign"}
            </Button>
            {hasAssignedExecutor ? (
              <Button
                disabled={clearDisabled}
                onClick={() => onClear()}
                variant="ghost"
              >
                Clear assignment
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {assignmentMessage ? (
        <p className="agent-queue-message agent-queue-message-success">
          {assignmentMessage}
        </p>
      ) : null}
      {assignmentError ? (
        <p className="agent-queue-message agent-queue-message-error" role="alert">
          {assignmentError}
        </p>
      ) : null}
    </section>
  );
}

function assignmentControlMessage({
  hasExecutorSlots,
  apiAvailable,
  isDirty,
  isFinalStatus,
}: {
  apiAvailable: boolean;
  hasExecutorSlots: boolean;
  isDirty: boolean;
  isFinalStatus: boolean;
}) {
  if (!apiAvailable) {
    return "Assignment persistence is not available in this runtime.";
  }

  if (isDirty) {
    return "Save task edits before changing assignment.";
  }

  if (isFinalStatus) {
    return "Assignment is locked for final-status tasks.";
  }

  if (!hasExecutorSlots) {
    return null;
  }

  return null;
}
