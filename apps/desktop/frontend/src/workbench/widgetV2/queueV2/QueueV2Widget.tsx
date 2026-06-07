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

const queueV2Manifest = getWidgetV2Manifest("queue-v2");

type QueueV2WidgetProps = {
  autorunArmed?: boolean;
  globalExecutionState?: QueueGlobalStatus;
  pausedQueueTagIds?: ReadonlySet<string>;
  tasks?: readonly AgentQueueTask[];
  workers?: readonly AgentWorkerSummary[];
};

export function QueueV2Widget({
  autorunArmed = false,
  globalExecutionState = "started",
  pausedQueueTagIds = new Set(),
  tasks = [],
  workers = [],
}: QueueV2WidgetProps) {
  return (
    <WidgetV2Shell
      status={{
        detail:
          "Experimental Widget V2 board. It is not catalog-available and does not replace Agent Queue V1.",
        label: "Experimental",
        tone: "warning",
      }}
      subtitle="Frontend-only Queue v2 board. No task mutation or execution actions are wired."
      title={queueV2Manifest?.title ?? "Agent Queue v2"}
    >
      <WidgetV2Toolbar label="Agent Queue v2 command bar">
        <span>Board preview</span>
        <span>Selection only. Actions are not wired.</span>
      </WidgetV2Toolbar>
      <WidgetV2PanelLayout
        bottomDrawer={
          <WidgetV2BottomDrawer label="Agent Queue v2 closed and history">
            <details>
              <summary>Activity / history</summary>
              <p>Detailed run history and raw output remain collapsed.</p>
            </details>
          </WidgetV2BottomDrawer>
        }
        leftRail={
          <WidgetV2LeftRail label="Agent Queue v2 left rail">
            <p>Workers: {workers.length.toString()}</p>
            <p>Autorun: {autorunArmed ? "Armed" : "Off"}</p>
          </WidgetV2LeftRail>
        }
        primary={
          <QueueV2Board
            autorunArmed={autorunArmed}
            globalExecutionState={globalExecutionState}
            pausedQueueTagIds={pausedQueueTagIds}
            tasks={tasks}
            workers={workers}
          />
        }
        primaryLabel="Agent Queue v2 board"
      />
    </WidgetV2Shell>
  );
}
