import { useMemo } from "react";

import {
  WidgetV2BottomDrawer,
  WidgetV2LeftRail,
  WidgetV2PanelLayout,
  WidgetV2Shell,
  WidgetV2Toolbar,
} from "../WidgetV2Shell";
import { getWidgetV2Manifest } from "../widgetV2Registry";
import { QueueV2Board } from "./QueueV2Board";
import type { AgentQueueTask } from "../../../workspace/types";
import type {
  AgentWorkerSummary,
  QueueGlobalStatus,
} from "../../agentQueueTaskUiModel";
import type { AgentQueueController } from "../../queue/details/agentQueueTaskDetailsTypes";
import { selectQueueV2ViewModel } from "../../queue/queueV2ViewModel";
import { QueueV2ActivityStream } from "./QueueV2ActivityStream";
import { QueueV2LeftRail } from "./QueueV2LeftRail";
import { QueueV2TopBar } from "./QueueV2TopBar";

const queueV2Manifest = getWidgetV2Manifest("queue-v2");

type QueueV2WidgetProps = {
  autorunArmed?: boolean;
  currentWorkspaceRoot?: string | null;
  globalExecutionState?: QueueGlobalStatus;
  pausedQueueTagIds?: ReadonlySet<string>;
  queue?: AgentQueueController;
  tasks?: readonly AgentQueueTask[];
  workers?: readonly AgentWorkerSummary[];
};

export function QueueV2Widget({
  autorunArmed = false,
  currentWorkspaceRoot = null,
  globalExecutionState = "started",
  pausedQueueTagIds = new Set(),
  queue,
  tasks = [],
  workers = [],
}: QueueV2WidgetProps) {
  const viewModel = useMemo(
    () =>
      selectQueueV2ViewModel({
        autorunArmed,
        globalExecutionState,
        pausedQueueTagIds,
        tasks,
        workers,
      }),
    [autorunArmed, globalExecutionState, pausedQueueTagIds, tasks, workers],
  );

  return (
    <WidgetV2Shell
      info={{
        content: "Review Queue tasks, capacity, current activity, and closed history.",
        label: "Agent Queue information",
        title: "Agent Queue",
      }}
      title={queueV2Manifest?.title ?? "Agent Queue v2"}
    >
      <WidgetV2Toolbar label="Agent Queue v2 command bar">
        <QueueV2TopBar
          globalExecutionState={globalExecutionState}
          viewModel={viewModel}
        />
      </WidgetV2Toolbar>
      <WidgetV2PanelLayout
        bottomDrawer={
          <WidgetV2BottomDrawer label="Agent Queue v2 activity and closed history">
            <QueueV2ActivityStream viewModel={viewModel} />
          </WidgetV2BottomDrawer>
        }
        leftRail={
          <WidgetV2LeftRail label="Agent Queue v2 left rail">
            <QueueV2LeftRail
              globalExecutionState={globalExecutionState}
              tasks={tasks}
              viewModel={viewModel}
            />
          </WidgetV2LeftRail>
        }
        primary={
          <QueueV2Board
            autorunArmed={autorunArmed}
            currentWorkspaceRoot={currentWorkspaceRoot}
            globalExecutionState={globalExecutionState}
            pausedQueueTagIds={pausedQueueTagIds}
            queue={queue}
            tasks={tasks}
            workers={workers}
          />
        }
        primaryLabel="Agent Queue v2 board"
      />
    </WidgetV2Shell>
  );
}
