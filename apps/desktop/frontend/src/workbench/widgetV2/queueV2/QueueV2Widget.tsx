import {
  WidgetV2BottomDrawer,
  WidgetV2LeftRail,
  WidgetV2PanelLayout,
  WidgetV2Shell,
  WidgetV2Toolbar,
} from "../WidgetV2Shell";
import { getWidgetV2Manifest } from "../widgetV2Registry";

const queueV2Manifest = getWidgetV2Manifest("queue-v2");

export function QueueV2Widget() {
  return (
    <WidgetV2Shell
      status={{
        detail:
          "Experimental Widget V2 scaffold. It is not catalog-available and does not replace Agent Queue V1.",
        label: "Experimental",
        tone: "warning",
      }}
      subtitle="Planned Widget V2 scaffold. No task mutation or execution actions are wired."
      title={queueV2Manifest?.title ?? "Agent Queue v2"}
    >
      <WidgetV2Toolbar label="Agent Queue v2 command bar">
        <span>Command bar placeholder</span>
        <span>Actions are not wired in this scaffold.</span>
      </WidgetV2Toolbar>
      <WidgetV2PanelLayout
        bottomDrawer={
          <WidgetV2BottomDrawer label="Agent Queue v2 closed and history">
            <details>
              <summary>Closed / history placeholder</summary>
              <p>Closed tasks and history stay collapsed in this scaffold.</p>
            </details>
          </WidgetV2BottomDrawer>
        }
        leftRail={
          <WidgetV2LeftRail label="Agent Queue v2 left rail">
            <p>Left rail placeholder</p>
            <p>Filters, capacity, and worker summaries are planned only.</p>
          </WidgetV2LeftRail>
        }
        primary={
          <section aria-label="Agent Queue v2 board placeholder">
            <h3>Board placeholder</h3>
            <p>Intake, Ready, Running, Review, Blocked, and Closed lanes are planned.</p>
          </section>
        }
        primaryLabel="Agent Queue v2 board"
      />
    </WidgetV2Shell>
  );
}
