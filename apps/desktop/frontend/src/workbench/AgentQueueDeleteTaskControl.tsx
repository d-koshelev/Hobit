import { Button } from "../design-system/Button";
import type { AgentQueueDeleteController } from "./queue/useAgentQueueController";

type AgentQueueDeleteTaskControlProps = {
  deleteTask: AgentQueueDeleteController;
};

export function AgentQueueDeleteTaskControl({
  deleteTask,
}: AgentQueueDeleteTaskControlProps) {
  return (
    <>
      {deleteTask.blockedReason ? (
        <p className="agent-queue-delete-note">{deleteTask.blockedReason}</p>
      ) : null}
      {deleteTask.isConfirming ? (
        <div
          aria-label="Delete queue task confirmation"
          className="agent-queue-delete-confirmation"
          role="alertdialog"
        >
          <div>
            <p className="agent-queue-delete-title">Delete this task?</p>
            <p className="agent-queue-delete-copy">
              Only the Queue task record is removed. Executor runs, logs,
              results, and Direct Work history stay.
            </p>
          </div>
          <div className="agent-queue-delete-actions">
            <Button
              disabled={deleteTask.isDeleting}
              onClick={() => deleteTask.onCancel()}
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              className="agent-queue-delete-confirm-button"
              disabled={deleteTask.isDeleting}
              onClick={() => deleteTask.onConfirm()}
              variant="secondary"
            >
              {deleteTask.isDeleting ? "Deleting" : "Delete task"}
            </Button>
          </div>
        </div>
      ) : null}
      {deleteTask.message ? (
        <p className="agent-queue-message agent-queue-message-success">
          {deleteTask.message}
        </p>
      ) : null}
      {deleteTask.error ? (
        <p className="agent-queue-message agent-queue-message-error" role="alert">
          {deleteTask.error}
        </p>
      ) : null}
    </>
  );
}
