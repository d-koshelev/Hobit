import { useState } from "react";
import { Button } from "../design-system/Button";
import { Input } from "../design-system/Input";
import type { WorkspaceSummary } from "./types";

type WorkspaceRecentItemProps = {
  isDeleting: boolean;
  isDisabled: boolean;
  isOpening: boolean;
  onDeleteWorkspace: (workspace: WorkspaceSummary) => Promise<void>;
  onOpenWorkspace: (workspace: WorkspaceSummary) => void;
  workspace: WorkspaceSummary;
};

export function WorkspaceRecentItem({
  isDeleting,
  isDisabled,
  isOpening,
  onDeleteWorkspace,
  onOpenWorkspace,
  workspace,
}: WorkspaceRecentItemProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [confirmationName, setConfirmationName] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const typedNameMatches = confirmationName.trim() === workspace.title.trim();
  const deleteControlsDisabled = isDisabled || isOpening || isDeleting;
  const metadataRows = workspaceMetadataRows(workspace);
  const stats = workspaceStats(workspace);

  function openDeleteConfirmation() {
    setIsConfirmingDelete(true);
    setConfirmationName("");
    setDeleteError(null);
  }

  function closeDeleteConfirmation() {
    if (isDeleting) {
      return;
    }

    setIsConfirmingDelete(false);
    setConfirmationName("");
    setDeleteError(null);
  }

  async function confirmDeleteWorkspace() {
    if (!typedNameMatches || isDeleting) {
      return;
    }

    setDeleteError(null);

    try {
      await onDeleteWorkspace(workspace);
      setIsConfirmingDelete(false);
    } catch (error) {
      setDeleteError(workspaceDeletionErrorMessage(error));
    }
  }

  return (
    <div className="workspace-recent-entry">
      <div className="workspace-recent-row">
        <div className="workspace-recent-item">
          <div className="workspace-recent-item-copy">
            <h3 className="workspace-recent-item-title">{workspace.title}</h3>
            {workspace.description ? (
              <span className="workspace-recent-item-text">
                {workspace.description}
              </span>
            ) : null}
            <span className="workspace-recent-metadata">
              {metadataRows.map((row) => (
                <span key={row.label}>
                  {row.label}: {row.value}
                </span>
              ))}
            </span>
            {stats.length > 0 ? (
              <span className="workspace-recent-stats">
                {stats.map((stat) => (
                  <span key={stat.label}>
                    {stat.label}: {stat.value}
                  </span>
                ))}
              </span>
            ) : null}
          </div>
        </div>

        <div className="workspace-recent-actions">
          <Button
            aria-label={`Open ${workspace.title}`}
            className="workspace-open-trigger"
            disabled={
              isDisabled || isOpening || isDeleting || isConfirmingDelete
            }
            onClick={() => onOpenWorkspace(workspace)}
            variant="primary"
          >
            {isOpening ? "Opening..." : "Open"}
          </Button>
          <Button
            aria-expanded={isConfirmingDelete}
            aria-label={`Delete ${workspace.title}`}
            className="workspace-delete-trigger"
            disabled={deleteControlsDisabled}
            onClick={openDeleteConfirmation}
            variant="ghost"
          >
            Delete
          </Button>
        </div>
      </div>

      {isConfirmingDelete ? (
        <div
          aria-label={`Delete ${workspace.title} confirmation`}
          className="workspace-delete-confirm"
          role="group"
        >
          <div className="workspace-delete-confirm-copy">
            <p className="workspace-delete-confirm-title">
              Delete this workspace?
            </p>
            <p className="workspace-delete-confirm-text">
              This deletes Hobit workspace data only. Repository files and
              folders are not deleted. This cannot be undone.
            </p>
          </div>

          <label className="workspace-label" htmlFor={`delete-${workspace.id}`}>
            Type workspace name to confirm
          </label>
          <Input
            autoComplete="off"
            disabled={isDeleting}
            id={`delete-${workspace.id}`}
            onChange={(event) => setConfirmationName(event.target.value)}
            value={confirmationName}
          />

          <div className="workspace-delete-confirm-actions">
            <Button
              disabled={isDeleting}
              onClick={closeDeleteConfirmation}
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              className="workspace-delete-confirm-button"
              disabled={!typedNameMatches || isDeleting}
              onClick={() => void confirmDeleteWorkspace()}
              variant="secondary"
            >
              {isDeleting ? "Deleting..." : "Delete Workspace"}
            </Button>
          </div>

          {deleteError ? (
            <p className="workspace-delete-error" role="alert">
              {deleteError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function workspaceMetadataRows(workspace: WorkspaceSummary) {
  return [
    {
      label: "Created",
      value: formatWorkspaceDate(workspace.createdAt, "date"),
    },
    workspace.lastOpenedAt
      ? {
          label: "Last opened",
          value: formatWorkspaceDate(workspace.lastOpenedAt, "date-time"),
        }
      : {
          label: "Updated",
          value: formatWorkspaceDate(workspace.updatedAt, "date-time"),
        },
  ];
}

function workspaceStats(workspace: WorkspaceSummary) {
  return [
    { label: "Widgets", value: workspace.widgetCount },
    { label: "Agents", value: workspace.workspaceAgentCount },
    { label: "Notes", value: workspace.noteCount },
    { label: "Skills", value: workspace.skillCount },
    { label: "Docs", value: workspace.knowledgeDocumentCount },
    { label: "Queue", value: workspace.queueTaskCount },
  ].filter((stat) => stat.value > 0 || stat.label === "Widgets");
}

function formatWorkspaceDate(
  value: string,
  mode: "date" | "date-time",
) {
  const date = parseWorkspaceTimestamp(value);

  if (!date) {
    return "Unknown";
  }

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (mode === "date-time" && isToday) {
    return `today ${new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)}`;
  }

  if (mode === "date-time") {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function parseWorkspaceTimestamp(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (/^\d+(\.\d+)?$/.test(trimmedValue)) {
    const [secondsPart, fractionPart = ""] = trimmedValue.split(".");
    const seconds = Number(secondsPart);
    const milliseconds = Number(
      `${fractionPart.slice(0, 3).padEnd(3, "0") || "0"}`,
    );

    if (Number.isFinite(seconds) && Number.isFinite(milliseconds)) {
      return new Date(seconds * 1000 + milliseconds);
    }
  }

  const date = new Date(trimmedValue);

  return Number.isNaN(date.getTime()) ? null : date;
}

function workspaceDeletionErrorMessage(error: unknown) {
  const message = errorToMessage(error);
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("active direct work run")) {
    return "Stop active Direct Work runs before deleting this workspace.";
  }

  if (normalizedMessage.includes("workspace not found")) {
    return "Workspace not found.";
  }

  return message;
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Workspace deletion failed.";
}
