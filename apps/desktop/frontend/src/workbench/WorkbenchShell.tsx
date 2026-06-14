import { useState } from "react";
import type { AppThemeController } from "../theme/useAppTheme";
import {
  listTerminalPtySessions,
  updateWorkspace,
} from "../workspace/workspaceApi";
import type { WidgetCatalogTemplate } from "./catalogTemplates";
import { coordinatorWorkspacePreset } from "./presets";
import { addPresetWidgetsToWorkbench } from "./presetWidgetSetup";
import { useCurrentSessionActivity } from "./useCurrentSessionActivity";
import { useWorkbenchWidgetActions } from "./useWorkbenchWidgetActions";
import { WorkbenchActivity } from "./WorkbenchActivity";
import { WorkbenchCanvas } from "./WorkbenchCanvas";
import { WidgetCatalogShell } from "./WidgetCatalogShell";
import { WorkbenchTopBar } from "./WorkbenchTopBar";
import type { WorkbenchLayoutMode, WorkbenchViewState } from "./types";
import { createWorkbenchViewStateFromWorkspaceState } from "./viewState";
import { DEFAULT_WORKBENCH_GRID_SIZE } from "./workbenchLayoutGeometry";

type WorkbenchShellProps = {
  onCloseWorkspace?: () => void;
  onViewStateChange: (viewState: WorkbenchViewState) => void;
  theme: AppThemeController;
  viewState: WorkbenchViewState;
};

export function WorkbenchShell({
  onCloseWorkspace,
  onViewStateChange,
  theme,
  viewState,
}: WorkbenchShellProps) {
  const [isWidgetCatalogOpen, setIsWidgetCatalogOpen] = useState(false);
  const [isActivityPanelOpen, setIsActivityPanelOpen] = useState(false);
  const [closeWorkspaceMessage, setCloseWorkspaceMessage] = useState<
    string | null
  >(null);
  const [isClosingWorkspace, setIsClosingWorkspace] = useState(false);
  const [layoutMode, setLayoutMode] =
    useState<WorkbenchLayoutMode>("editing");
  const [gridSize, setGridSize] = useState(DEFAULT_WORKBENCH_GRID_SIZE);
  const currentSessionActivity = useCurrentSessionActivity();
  const openWidgetCatalog = () => setIsWidgetCatalogOpen(true);
  const closeWidgetCatalog = () => setIsWidgetCatalogOpen(false);
  const widgetActions = useWorkbenchWidgetActions({
    currentSessionActivity: currentSessionActivity.events,
    onViewStateChange,
    viewState,
  });
  async function addTemplateToWorkbench(template: WidgetCatalogTemplate) {
    const didAddWidget = await widgetActions.addWidgetTemplate(template);

    if (didAddWidget) {
      closeWidgetCatalog();
    }
  }

  async function startCoordinatorWorkspace() {
    const workbenchId = viewState.workbench.id;

    if (!workbenchId) {
      return;
    }

    try {
      const workbenchState = await addPresetWidgetsToWorkbench(
        {
          existingWidgetDefinitionIds: viewState.widgets.map(
            (widget) => widget.definitionId,
          ),
          workbenchId,
          workspaceId: viewState.workspace.id,
        },
        coordinatorWorkspacePreset,
      );

      if (workbenchState) {
        onViewStateChange(
          createWorkbenchViewStateFromWorkspaceState(workbenchState),
        );
      }
    } catch (error) {
      console.error("Failed to add Workspace Agent workspace widgets.", error);
    }
  }

  async function closeWorkspace() {
    if (currentSessionActivity.status.kind === "running") {
      setCloseWorkspaceMessage(
        "Stop active local runs before closing this workspace.",
      );
      return;
    }

    const workbenchId = viewState.workbench.id;

    if (workbenchId) {
      setIsClosingWorkspace(true);

      try {
        const terminalSessions = await listTerminalPtySessions({
          workbenchId,
          workspaceId: viewState.workspace.id,
        });
        const hasActiveTerminalSession = terminalSessions.some(
          (session) =>
            session.endedAt === null &&
            (session.status === "running" || session.status === "stopping"),
        );

        if (hasActiveTerminalSession) {
          setCloseWorkspaceMessage(
            "Stop active local runs before closing this workspace.",
          );
          return;
        }
      } catch {
        // Browser fallback cannot inspect local PTY sessions.
      } finally {
        setIsClosingWorkspace(false);
      }
    }

    setCloseWorkspaceMessage(null);
    onCloseWorkspace?.();
  }

  async function renameWorkspace(title: string) {
    const updatedWorkspace = await updateWorkspace({
      title,
      workspaceId: viewState.workspace.id,
    });

    if (!updatedWorkspace) {
      return false;
    }

    onViewStateChange({
      ...viewState,
      workspace: {
        ...viewState.workspace,
        description: updatedWorkspace.description,
        id: updatedWorkspace.id,
        status: updatedWorkspace.status,
        title: updatedWorkspace.title,
      },
    });

    return true;
  }

  return (
    <main className="app-shell">
      <div className="workbench">
        <WorkbenchTopBar
          activityPanelId="workbench-activity-panel"
          activityStatus={currentSessionActivity.status}
          gridSize={gridSize}
          isActivityPanelOpen={isActivityPanelOpen}
          layoutMode={layoutMode}
          onGridSizeChange={setGridSize}
          isClosingWorkspace={isClosingWorkspace}
          onCloseWorkspace={
            onCloseWorkspace ? () => void closeWorkspace() : undefined
          }
          onLayoutModeChange={setLayoutMode}
          onOpenWidgetCatalog={openWidgetCatalog}
          onRenameWorkspace={renameWorkspace}
          onToggleActivityPanel={() =>
            setIsActivityPanelOpen((current) => !current)
          }
          theme={theme}
          viewState={viewState}
        />
        {closeWorkspaceMessage ? (
          <p className="workbench-close-message" role="alert">
            {closeWorkspaceMessage}
          </p>
        ) : null}
        <div
          className={`workbench-content${
            isWidgetCatalogOpen ? " workbench-content-catalog-open" : ""
          }`}
        >
          <WorkbenchCanvas
            gridSize={gridSize}
            layoutMode={layoutMode}
            onOpenWidgetCatalog={openWidgetCatalog}
            onStartCoordinatorWorkspace={() => void startCoordinatorWorkspace()}
            viewState={viewState}
            widgetActions={widgetActions}
          />
          <WidgetCatalogShell
            isOpen={isWidgetCatalogOpen}
            onAddTemplate={addTemplateToWorkbench}
            onClose={closeWidgetCatalog}
          />
        </div>
        {isActivityPanelOpen ? (
          <WorkbenchActivity
            events={viewState.recentEvents}
            id="workbench-activity-panel"
            onClose={() => setIsActivityPanelOpen(false)}
          />
        ) : null}
      </div>
    </main>
  );
}
