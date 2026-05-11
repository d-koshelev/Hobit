import { useState } from "react";
import { Badge } from "../design-system/Badge";
import { WidgetFrame } from "../design-system/WidgetFrame";
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
import type { WidgetRenderProps } from "./types";

export function AgentQueuePlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onLoadLogs,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  const [selectedItemId, setSelectedItemId] =
    useState<AgentQueuePreviewItemId>(agentQueuePreview.defaultSelectedItemId);
  const selectedDetailPreview =
    agentQueuePreview.detailPreviews[selectedItemId] ??
    agentQueuePreview.detailPreviews[agentQueuePreview.defaultSelectedItemId];

  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      status={<Badge variant="neutral">Placeholder</Badge>}
      title={title}
    >
      <div className="agent-queue-placeholder">
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
      </div>
    </WidgetFrame>
  );
}
