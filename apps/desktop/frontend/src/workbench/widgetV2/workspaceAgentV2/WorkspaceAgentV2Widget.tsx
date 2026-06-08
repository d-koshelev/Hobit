import {
  WidgetV2BottomDrawer,
  WidgetV2PanelLayout,
  WidgetV2RightInspector,
  WidgetV2Shell,
  WidgetV2Toolbar,
} from "../WidgetV2Shell";
import { getWidgetV2Manifest } from "../widgetV2Registry";
import { WorkspaceAgentV2Composer } from "./WorkspaceAgentV2Composer";
import { WorkspaceAgentV2Transcript } from "./WorkspaceAgentV2Transcript";
import { WorkspaceAgentV2TopBar } from "./WorkspaceAgentV2TopBar";

const workspaceAgentV2Manifest = getWidgetV2Manifest("workspace-agent-v2");

type WorkspaceAgentV2WidgetProps = {
  readonly onQueueTaskCreate?: () => void;
  readonly onRunRequest?: () => void;
};

export function WorkspaceAgentV2Widget({
  onQueueTaskCreate,
  onRunRequest,
}: WorkspaceAgentV2WidgetProps = {}) {
  return (
    <WidgetV2Shell
      status={{
        detail:
          "Experimental scaffold only. It does not replace the V1 Workspace Agent.",
        label: "Experimental",
        tone: "warning",
      }}
      subtitle="Inert Widget V2 conversation shell. Provider execution and Queue task creation are not wired."
      title={workspaceAgentV2Manifest?.title ?? "Workspace Agent v2"}
    >
      <WidgetV2Toolbar label="Workspace Agent v2 provider and mode row">
        <WorkspaceAgentV2TopBar />
      </WidgetV2Toolbar>
      <WidgetV2PanelLayout
        bottomDrawer={
          <WidgetV2BottomDrawer label="Workspace Agent v2 composer">
            <WorkspaceAgentV2Composer
              onDirectRun={onRunRequest}
              onQueueRun={onQueueTaskCreate}
            />
          </WidgetV2BottomDrawer>
        }
        primary={
          <WorkspaceAgentV2Transcript
            emptyState={
              <>
                <h3>Transcript</h3>
                <p>
                  Visible conversation scaffold only. No hidden context is read.
                </p>
              </>
            }
          />
        }
        primaryLabel="Workspace Agent v2 transcript"
        rightInspector={
          <WidgetV2RightInspector label="Workspace Agent v2 activity pane">
            <section aria-label="Workspace Agent v2 activity placeholder">
              <h3>Activity</h3>
              <p>
                Activity pane placeholder only. No provider, Queue, Terminal, Git,
                JDBC, or backend runtime is invoked.
              </p>
            </section>
          </WidgetV2RightInspector>
        }
      />
    </WidgetV2Shell>
  );
}
