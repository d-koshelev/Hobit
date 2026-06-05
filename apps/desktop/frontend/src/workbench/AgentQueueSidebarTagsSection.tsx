import { useState } from "react";

import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import {
  AgentQueueTagColorControl,
  AgentQueueTagColorSwatch,
} from "./AgentQueueTagColorControl";
import type { AgentQueueFoundationController } from "./queue/useAgentQueueController";

export function AgentQueueSidebarTagsSection({
  foundation,
}: {
  foundation: AgentQueueFoundationController;
}) {
  const [newTagName, setNewTagName] = useState("");
  const [renamingTagId, setRenamingTagId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteConfirmTagId, setDeleteConfirmTagId] = useState<string | null>(null);
  const pausedTagCount = foundation.queueTags.filter(
    (tag) => tag.status === "paused",
  ).length;

  function createTag() {
    if (foundation.onCreateQueueTag(newTagName)) {
      setNewTagName("");
      setDeleteConfirmTagId(null);
    }
  }

  function startRename(queueTagId: string, queueTagName: string) {
    setRenamingTagId(queueTagId);
    setRenameDraft(queueTagName);
    setDeleteConfirmTagId(null);
  }

  async function confirmRename(queueTagId: string) {
    if (await foundation.onRenameQueueTag(queueTagId, renameDraft)) {
      setRenamingTagId(null);
      setRenameDraft("");
    }
  }

  function requestDelete(queueTagId: string, isEmpty: boolean) {
    if (!isEmpty) {
      foundation.onDeleteQueueTag(queueTagId);
      return;
    }

    setDeleteConfirmTagId(queueTagId);
    setRenamingTagId(null);
  }

  return (
    <section className="agent-queue-sidebar-section">
      <div className="agent-queue-section-header">
        <p className="agent-queue-section-title">Tags</p>
        <Badge variant={pausedTagCount > 0 ? "warning" : "neutral"}>
          {foundation.queueTags.length.toString()} tags
        </Badge>
      </div>
      <p className="agent-queue-sidebar-row-meta agent-queue-compact-summary">
        {pausedTagCount > 0
          ? `${pausedTagCount.toString()} paused`
          : "Tags ready"}
      </p>
      <p className="agent-queue-sidebar-row-meta agent-queue-sidebar-subtle">
        Tag colors are editable for the current Hobit session; Queue tag
        storage does not persist colors yet.
      </p>
      <div className="agent-queue-sidebar-list">
        {foundation.queueTags.map((tag) => (
          <div
            className="agent-queue-sidebar-row agent-queue-sidebar-row-compact agent-queue-tag-row"
            key={tag.queueTagId}
          >
            <div className="agent-queue-sidebar-row-main">
              {renamingTagId === tag.queueTagId ? (
                <input
                  aria-label={`Rename ${tag.queueTagName}`}
                  className="input agent-queue-tag-management-input"
                  onChange={(event) => setRenameDraft(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void confirmRename(tag.queueTagId);
                    }
                  }}
                  value={renameDraft}
                />
              ) : (
                <p className="agent-queue-sidebar-row-title">
                  <AgentQueueTagColorSwatch colorToken={tag.colorToken} />
                  {tag.queueTagName}
                </p>
              )}
              <p className="agent-queue-sidebar-row-meta">
                {tag.taskCount} items, {tag.runningCount} running
              </p>
            </div>
            <div className="agent-queue-sidebar-row-actions">
              <Badge variant={tag.status === "paused" ? "warning" : "success"}>
                {tag.status}
              </Badge>
              {tag.needsCoordinatorReview ? (
                <Badge variant="warning">review</Badge>
              ) : null}
              {tag.status === "paused" ? (
                <Button
                  onClick={() => foundation.onResumeQueueTag(tag.queueTagId)}
                  variant="ghost"
                >
                  Resume tag
                </Button>
              ) : (
                <Button
                  onClick={() => foundation.onPauseQueueTag(tag.queueTagId)}
                  variant="ghost"
                >
                  Pause
                </Button>
              )}
            </div>
            <details className="agent-queue-details agent-queue-rail-details agent-queue-tag-secondary-details">
              <summary>Tag details</summary>
              <dl className="agent-queue-validation-summary">
                <div>
                  <dt>Validating</dt>
                  <dd>{tag.validatingCount}</dd>
                </div>
                <div>
                  <dt>Needs review</dt>
                  <dd>{tag.needsReviewCount}</dd>
                </div>
                <div>
                  <dt>Failed validation</dt>
                  <dd>{tag.failedValidationCount}</dd>
                </div>
                <div>
                  <dt>Coordinator review</dt>
                  <dd>{tag.coordinatorReviewCount}</dd>
                </div>
              </dl>
              {tag.pauseReason ? (
                <p className="agent-queue-sidebar-row-meta">
                  Paused by {pauseReasonLabel(tag.pauseReason)}.
                </p>
              ) : null}
            </details>
          </div>
        ))}
      </div>
      <details className="agent-queue-details agent-queue-rail-details agent-queue-management-details">
        <summary>Manage tags</summary>
        <p className="agent-queue-run-note">
          Color changes update the current session only because Queue tag color
          is not persisted in the current model.
        </p>
        <div className="agent-queue-tag-create-row">
          <input
            aria-label="New queue tag name"
            className="input agent-queue-tag-management-input"
            onChange={(event) => setNewTagName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                createTag();
              }
            }}
            placeholder="New tag"
            value={newTagName}
          />
          <Button onClick={createTag} variant="secondary">
            Add tag
          </Button>
        </div>
        {foundation.tagManagementError ? (
          <p className="agent-queue-message agent-queue-message-error" role="alert">
            {foundation.tagManagementError}
          </p>
        ) : foundation.tagManagementMessage ? (
          <p className="agent-queue-message">{foundation.tagManagementMessage}</p>
        ) : null}
        <div className="agent-queue-sidebar-list">
          {foundation.queueTags.map((tag) => (
            <div className="agent-queue-management-row" key={tag.queueTagId}>
              <p className="agent-queue-sidebar-row-title">
                <AgentQueueTagColorSwatch colorToken={tag.colorToken} />
                {tag.queueTagName}
              </p>
              <div className="agent-queue-sidebar-row-actions">
                <AgentQueueTagColorControl
                  colorToken={tag.colorToken}
                  onChange={(colorToken) =>
                    foundation.onSetQueueTagColor(tag.queueTagId, colorToken)
                  }
                  queueTagName={tag.queueTagName}
                />
                {renamingTagId === tag.queueTagId ? (
                  <>
                    <Button
                      onClick={() => void confirmRename(tag.queueTagId)}
                      variant="secondary"
                    >
                      Save
                    </Button>
                    <Button
                      onClick={() => {
                        setRenamingTagId(null);
                        setRenameDraft("");
                      }}
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => startRename(tag.queueTagId, tag.queueTagName)}
                    variant="ghost"
                  >
                    Rename
                  </Button>
                )}
                {deleteConfirmTagId === tag.queueTagId ? (
                  <>
                    <Button
                      className="agent-queue-delete-button"
                      onClick={() => {
                        if (foundation.onDeleteQueueTag(tag.queueTagId)) {
                          setDeleteConfirmTagId(null);
                        }
                      }}
                      variant="ghost"
                    >
                      Confirm delete
                    </Button>
                    <Button
                      onClick={() => setDeleteConfirmTagId(null)}
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    className="agent-queue-delete-button"
                    onClick={() =>
                      requestDelete(tag.queueTagId, tag.taskCount === 0)
                    }
                    title={
                      tag.taskCount === 0
                        ? "Delete this empty queue tag."
                        : "Reassign items before deleting this queue tag."
                    }
                    variant="ghost"
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

function pauseReasonLabel(reason: string) {
  switch (reason) {
    case "edit_review":
      return "task edit review";
    case "manual":
    default:
      return "manual pause";
  }
}
