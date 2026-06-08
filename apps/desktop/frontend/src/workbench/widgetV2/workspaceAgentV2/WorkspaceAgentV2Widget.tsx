import {
  WidgetV2BottomDrawer,
  WidgetV2PanelLayout,
  WidgetV2RightInspector,
  WidgetV2Shell,
  WidgetV2Toolbar,
} from "../WidgetV2Shell";
import { getWidgetV2Manifest } from "../widgetV2Registry";
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
  void onQueueTaskCreate;
  void onRunRequest;

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
          <WidgetV2BottomDrawer label="Workspace Agent v2 composer placeholder">
            <section aria-label="Workspace Agent v2 composer">
              <h3>Composer</h3>
              <p>
                Message input placeholder only. No provider request, Direct Run,
                or Queue task creation is available in this scaffold.
              </p>
              <textarea
                aria-label="Workspace Agent v2 composer placeholder input"
                className="input"
                disabled
                placeholder="Composer placeholder"
                rows={3}
              />
            </section>
          </WidgetV2BottomDrawer>
        }
        primary={
          <section aria-label="Workspace Agent v2 transcript placeholder">
            <h3>Main transcript</h3>
            <p>
              Transcript placeholder for future visible conversation and proposal
              review. No hidden context is read.
            </p>
          </section>
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
