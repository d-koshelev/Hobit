import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { AgentQueueItem, AgentQueueSnapshot } from "../workspace/types";
import {
  AgentQueueGroupList,
  AgentQueueItemDetail,
  AgentQueueLinkedSurfaces,
  AgentQueueOverviewSection,
  AgentQueueSummarySection,
} from "./AgentQueuePlaceholderSections";
import {
  agentQueuePreview,
  type AgentQueuePreviewItemId,
} from "./agentQueuePreview";
import { StaticPreviewFieldList } from "./StaticPreviewPrimitives";
import type { WidgetRenderProps } from "./types";

type QueueLoadState =
  | {
      status: "idle" | "loading";
    }
  | {
      message: string;
      status: "failed";
    }
  | {
      snapshot: AgentQueueSnapshot | null;
      status: "ready";
    };

export function AgentQueuePlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onGetAgentQueueSnapshot,
  onLoadLogs,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  const [selectedItemId, setSelectedItemId] =
    useState<AgentQueuePreviewItemId>(agentQueuePreview.defaultSelectedItemId);
  const [selectedQueueItemId, setSelectedQueueItemId] = useState<string | null>(
    null,
  );
  const [loadState, setLoadState] = useState<QueueLoadState>({
    status: "idle",
  });
  const persistedItems =
    loadState.status === "ready" ? (loadState.snapshot?.items ?? []) : [];
  const selectedQueueItem = useMemo(
    () =>
      persistedItems.find((item) => item.id === selectedQueueItemId) ??
      persistedItems[0] ??
      null,
    [persistedItems, selectedQueueItemId],
  );
  const selectedDetailPreview =
    agentQueuePreview.detailPreviews[selectedItemId] ??
    agentQueuePreview.detailPreviews[agentQueuePreview.defaultSelectedItemId];

  async function refreshQueueSnapshot() {
    if (!onGetAgentQueueSnapshot) {
      setLoadState({
        message: "Agent Queue persisted review items are unavailable in this runtime.",
        status: "failed",
      });
      return;
    }

    setLoadState({ status: "loading" });

    try {
      const snapshot = await onGetAgentQueueSnapshot();
      setLoadState({
        snapshot,
        status: "ready",
      });
    } catch (error) {
      setLoadState({
        message: errorToMessage(error),
        status: "failed",
      });
    }
  }

  useEffect(() => {
    void refreshQueueSnapshot();
  }, [onGetAgentQueueSnapshot]);

  useEffect(() => {
    if (persistedItems.length === 0) {
      if (selectedQueueItemId !== null) {
        setSelectedQueueItemId(null);
      }
      return;
    }

    if (
      !selectedQueueItemId ||
      !persistedItems.some((item) => item.id === selectedQueueItemId)
    ) {
      setSelectedQueueItemId(persistedItems[0].id);
    }
  }, [persistedItems, selectedQueueItemId]);

  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      status={<Badge variant="warning">Review inbox</Badge>}
      title={title}
    >
      <div className="agent-queue-placeholder">
        <section className="agent-queue-summary">
          <div className="agent-queue-summary-copy">
            <p className="agent-queue-summary-title">Agent Queue</p>
            <p className="agent-queue-summary-text">
              Persisted review inbox for Agent Chat proposal-only mock results.
              Items are needs_review records only; no executor, tools, Terminal
              commands, approvals, or apply actions run from this widget.
            </p>
          </div>
          <div className="agent-queue-summary-badges">
            <Badge variant="warning">{persistedItems.length} review</Badge>
            <Badge variant="neutral">No execution</Badge>
            <Button
              disabled={loadState.status === "loading"}
              onClick={() => void refreshQueueSnapshot()}
              variant="secondary"
            >
              {loadState.status === "loading" ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </section>

        {loadState.status === "failed" ? (
          <AgentQueueEmptyState
            badgeLabel="Unavailable"
            text={loadState.message}
            title="Queue read path unavailable"
          />
        ) : selectedQueueItem ? (
          <>
            <PersistedQueueItems
              items={persistedItems}
              onSelectItem={setSelectedQueueItemId}
              selectedItemId={selectedQueueItem.id}
            />
            <PersistedQueueItemDetail item={selectedQueueItem} />
          </>
        ) : (
          <>
            <AgentQueueEmptyState
              badgeLabel={
                loadState.status === "loading" ? "Loading" : "No items"
              }
              text={
                loadState.status === "loading"
                  ? "Reading persisted Agent Queue review items for this Workbench."
                  : "No persisted proposal review items exist in this Workspace Workbench yet."
              }
              title="No persisted review items"
            />
            <section className="agent-queue-group">
              <div className="agent-queue-section-header">
                <div className="agent-queue-group-copy">
                  <h3 className="agent-queue-section-title">Static preview</h3>
                  <p className="agent-queue-section-text">
                    Demo-only planned queue copy remains separate from real
                    persisted review items.
                  </p>
                </div>
                <Badge variant="neutral">Demo</Badge>
              </div>
            </section>
            <AgentQueueSummarySection summary={agentQueuePreview.summary} />
            <AgentQueueOverviewSection overview={agentQueuePreview.overview} />
            <AgentQueueGroupList
              groups={agentQueuePreview.groups}
              onSelectItem={setSelectedItemId}
              selectedItemId={selectedItemId}
            />
            <AgentQueueItemDetail preview={selectedDetailPreview} />
            <AgentQueueLinkedSurfaces
              linkedSurfaces={agentQueuePreview.linkedSurfaces}
            />
          </>
        )}
      </div>
    </WidgetFrame>
  );
}

function PersistedQueueItems({
  items,
  onSelectItem,
  selectedItemId,
}: {
  items: readonly AgentQueueItem[];
  onSelectItem: (itemId: string) => void;
  selectedItemId: string;
}) {
  return (
    <section className="agent-queue-group agent-queue-group-warning">
      <div className="agent-queue-section-header">
        <div className="agent-queue-group-copy">
          <h3 className="agent-queue-section-title">Persisted review items</h3>
          <p className="agent-queue-section-text">
            Real Agent Queue items created explicitly from persisted Agent Chat
            proposal artifacts.
          </p>
        </div>
        <Badge variant="warning">{items.length} needs review</Badge>
      </div>
      <div className="agent-queue-card-list">
        {items.map((item) => (
          <article
            aria-label={`Show persisted queue item ${item.title}`}
            aria-pressed={item.id === selectedItemId}
            className={`agent-queue-item-card agent-queue-item-card-warning${
              item.id === selectedItemId
                ? " agent-queue-item-card-selected"
                : ""
            }`}
            key={item.id}
            onClick={() => onSelectItem(item.id)}
            onKeyDown={(event) =>
              handleItemKeyDown(event, () => onSelectItem(item.id))
            }
            role="button"
            tabIndex={0}
          >
            <div className="agent-queue-item-header">
              <div className="agent-queue-item-title-copy">
                <p className="agent-queue-item-block">{shortId(item.id)}</p>
                <h4 className="agent-queue-item-title">{item.title}</h4>
              </div>
              <Badge variant="warning">{formatStatus(item.status)}</Badge>
            </div>
            <StaticPreviewFieldList
              className="agent-queue-card-signals"
              fieldClassName="agent-queue-card-signal"
              fields={[
                { label: "Source", value: shortId(item.sourceRunId) },
                { label: "Prompt", value: item.promptSummary },
                { label: "Decision", value: formatStatus(item.decisionStatus) },
              ]}
              labelClassName="agent-queue-card-label"
              valueClassName="agent-queue-card-value"
            />
          </article>
        ))}
      </div>
    </section>
  );
}

function PersistedQueueItemDetail({ item }: { item: AgentQueueItem }) {
  return (
    <section aria-label="Persisted Agent Queue item detail" className="agent-queue-detail">
      <div className="agent-queue-detail-header">
        <div className="agent-queue-group-copy">
          <p className="agent-queue-item-block">{shortId(item.id)}</p>
          <h3 className="agent-queue-section-title">{item.title}</h3>
          <p className="agent-queue-section-text">
            Review-only queue item created from an Agent Chat proposal-only mock
            result. No approval, apply, executor, or tool path is available.
          </p>
        </div>
        <div className="agent-queue-action-row">
          <Badge variant="warning">{formatStatus(item.status)}</Badge>
          <Badge variant="neutral">{formatStatus(item.decisionStatus)}</Badge>
        </div>
      </div>

      <div className="agent-queue-detail-grid agent-queue-detail-grid-primary">
        <QueueReadOnlySection
          fields={[
            { label: "Source run", value: item.sourceRunId },
            { label: "Source result", value: item.sourceResultId },
            { label: "Source widget", value: item.sourceWidgetTitle },
          ]}
          title="Source"
        />
        <QueueReadOnlySection
          fields={[
            { label: "Prompt", value: item.promptSummary },
            { label: "Context", value: item.approvedContextSummary },
            { label: "Summary", value: item.proposalSummary },
          ]}
          title="Proposal"
        />
        <QueueReadOnlySection
          fields={[
            { label: "Proposal only", value: formatBoolean(item.proposalOnlyMock) },
            { label: "No LLM", value: formatBoolean(item.noLlmCalled) },
            { label: "No tools", value: formatBoolean(item.noToolsExecuted) },
            {
              label: "No mutations",
              value: formatBoolean(item.noMutationsPerformed),
            },
          ]}
          title="Safety"
        />
      </div>

      <div className="agent-queue-detail-grid agent-queue-detail-grid-secondary">
        <section className="agent-queue-detail-section agent-queue-detail-section-secondary">
          <h4 className="agent-queue-item-title">Proposed plan</h4>
          <ul className="agent-run-overview-list">
            {item.proposedPlan.map((step) => (
              <li className="agent-run-overview-step" key={step}>
                {step}
              </li>
            ))}
          </ul>
        </section>
        <section className="agent-queue-detail-section agent-queue-detail-section-secondary">
          <h4 className="agent-queue-item-title">Proposed actions</h4>
          <div className="agent-queue-card-list">
            {item.proposedActions.map((action) => (
              <div className="agent-queue-card-field" key={action.title}>
                <div className="agent-queue-section-header">
                  <p className="agent-queue-card-label">{action.title}</p>
                  <Badge variant="neutral">{formatStatus(action.status)}</Badge>
                </div>
                <p className="agent-queue-card-value">{action.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function QueueReadOnlySection({
  fields,
  title,
}: {
  fields: Array<{ label: string; value: string }>;
  title: string;
}) {
  return (
    <section className="agent-queue-detail-section agent-queue-detail-section-primary">
      <h4 className="agent-queue-item-title">{title}</h4>
      <StaticPreviewFieldList
        className="agent-queue-item-grid"
        fieldClassName="agent-queue-card-field"
        fields={fields}
        labelClassName="agent-queue-card-label"
        valueClassName="agent-queue-card-value"
      />
    </section>
  );
}

function AgentQueueEmptyState({
  badgeLabel,
  text,
  title,
}: {
  badgeLabel: string;
  text: string;
  title: string;
}) {
  return (
    <section className="agent-queue-group">
      <div className="agent-queue-section-header">
        <div className="agent-queue-group-copy">
          <h3 className="agent-queue-section-title">{title}</h3>
          <p className="agent-queue-section-text">{text}</p>
        </div>
        <Badge variant="neutral">{badgeLabel}</Badge>
      </div>
    </section>
  );
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function formatBoolean(value: boolean) {
  return value ? "true" : "false";
}

function shortId(value: string) {
  return value.length > 18 ? `${value.slice(0, 18)}...` : value;
}

function handleItemKeyDown(
  event: KeyboardEvent<HTMLElement>,
  onSelect: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onSelect();
  }
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to read Agent Queue review items.";
}
