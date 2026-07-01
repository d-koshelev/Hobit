import type { CSSProperties } from "react";
import { Button } from "../design-system/Button";
import type { QueueWorkspaceRecoveryProjection } from "../workspace/types";

type WorkbenchEmptyCanvasProps = {
  canvasGridStyle: CSSProperties;
  canvasLabel: string;
  canvasShellClass: string;
  onOpenQueueView?: () => void;
  onOpenWidgetCatalog: () => void;
  onStartCoordinatorWorkspace: () => void;
  queueRecovery?: QueueWorkspaceRecoveryProjection;
};

export function WorkbenchEmptyCanvas({
  canvasGridStyle,
  canvasLabel,
  canvasShellClass,
  onOpenQueueView,
  onOpenWidgetCatalog,
  onStartCoordinatorWorkspace,
  queueRecovery,
}: WorkbenchEmptyCanvasProps) {
  const shouldShowQueueRecovery =
    Boolean(onOpenQueueView) &&
    Boolean(queueRecovery) &&
    queueRecovery!.recoveryAvailable &&
    queueRecovery!.canRestoreQueueView;
  const queueTaskLabel =
    queueRecovery?.queueTaskCount === 1
      ? "1 Queue task"
      : `${queueRecovery?.queueTaskCount ?? 0} Queue tasks`;
  const queueTaskVerb = queueRecovery?.queueTaskCount === 1 ? "is" : "are";
  const runningSummary =
    queueRecovery && queueRecovery.runningTaskCount > 0
      ? `${queueRecovery.runningTaskCount} running`
      : null;
  const recoverySummary =
    queueRecovery && queueRecovery.staleRunningCandidateCount > 0
      ? `${queueRecovery.staleRunningCandidateCount} may need recovery review`
      : null;

  return (
    <section
      className={canvasShellClass}
      aria-label={canvasLabel}
      style={canvasGridStyle}
    >
      <div className="canvas-stack">
        <div className="empty-workbench" aria-label="Empty workbench">
          <div className="empty-workbench-content">
            <h1 className="empty-workbench-title">Your workbench is empty</h1>
            <p className="empty-workbench-text">
              Start with Workspace Agent and Notes, or add individual widgets
              for a manual workbench.
            </p>
            <div className="empty-workbench-actions">
              <Button onClick={onStartCoordinatorWorkspace} variant="primary">
                Add Workspace Agent + Notes
              </Button>
              <Button onClick={onOpenWidgetCatalog} variant="secondary">
                + Add Widget
              </Button>
            </div>
            {shouldShowQueueRecovery ? (
              <div
                className="empty-workbench-recovery"
                aria-label="Agent Queue recovery"
              >
                <div>
                  <p className="empty-workbench-recovery-title">
                    Agent Queue has saved tasks
                  </p>
                  <p className="empty-workbench-recovery-text">
                    {queueTaskLabel} {queueTaskVerb} stored in this Workspace.
                  </p>
                  {runningSummary || recoverySummary ? (
                    <p className="empty-workbench-recovery-meta">
                      {[runningSummary, recoverySummary]
                        .filter(Boolean)
                        .join("; ")}
                    </p>
                  ) : null}
                </div>
                <Button onClick={onOpenQueueView} variant="secondary">
                  Open Agent Queue
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
