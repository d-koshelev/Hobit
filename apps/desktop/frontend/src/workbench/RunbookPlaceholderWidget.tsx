import { useId, useState } from "react";
import { Badge } from "../design-system/Badge";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { WidgetRenderProps } from "./types";

type RunbookStepState =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "skipped"
  | "blocked";

type RunbookStep = {
  id: string;
  title: string;
  instructions: string;
  state: RunbookStepState;
  notes: string;
};

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "error";

const STEP_STATES: RunbookStepState[] = [
  "pending",
  "running",
  "done",
  "failed",
  "skipped",
  "blocked",
];

const STEP_STATE_BADGE_VARIANTS: Record<RunbookStepState, BadgeVariant> = {
  pending: "neutral",
  running: "info",
  done: "success",
  failed: "error",
  skipped: "neutral",
  blocked: "warning",
};

const INITIAL_RUNBOOK_STEPS: RunbookStep[] = [
  {
    id: "understand-objective",
    title: "Understand the objective",
    instructions:
      "Clarify the desired outcome, constraints, and success criteria before changing anything.",
    state: "pending",
    notes: "",
  },
  {
    id: "collect-evidence",
    title: "Collect evidence",
    instructions:
      "Gather relevant observations, notes, logs, screenshots, or references needed for the decision.",
    state: "pending",
    notes: "",
  },
  {
    id: "decide-next-action",
    title: "Decide next action",
    instructions:
      "Review the evidence, choose the next manual action, and record the reasoning.",
    state: "pending",
    notes: "",
  },
];

export function RunbookPlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onLoadLogs,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  const stateSelectId = useId();
  const notesTextareaId = useId();
  const [steps, setSteps] = useState<RunbookStep[]>(INITIAL_RUNBOOK_STEPS);
  const [selectedStepId, setSelectedStepId] = useState(
    INITIAL_RUNBOOK_STEPS[0].id,
  );
  const selectedStep =
    steps.find((step) => step.id === selectedStepId) ?? steps[0];

  function updateSelectedStep(update: Partial<RunbookStep>) {
    setSteps((currentSteps) =>
      currentSteps.map((step) =>
        step.id === selectedStep.id ? { ...step, ...update } : step,
      ),
    );
  }

  return (
    <WidgetFrame
      actions={frameActions}
      info="Manual procedural steps with local step state and notes. It does not execute tools or create Queue work."
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      title={title}
    >
      <div className="runbook-widget">
        <div className="runbook-layout">
          <section aria-label="Runbook steps" className="runbook-step-panel">
            <p className="runbook-section-title">Steps</p>
            <div className="runbook-step-list" role="list">
              {steps.map((step, index) => (
                <button
                  aria-pressed={step.id === selectedStep.id}
                  className={[
                    "runbook-step-item",
                    step.id === selectedStep.id
                      ? "runbook-step-item-active"
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  type="button"
                >
                  <span className="runbook-step-meta">Step {index + 1}</span>
                  <span className="runbook-step-title">{step.title}</span>
                  <Badge variant={STEP_STATE_BADGE_VARIANTS[step.state]}>
                    {step.state}
                  </Badge>
                </button>
              ))}
            </div>
          </section>

          <section
            aria-label="Selected runbook step"
            className="runbook-detail"
          >
            <div className="runbook-detail-header">
              <div className="runbook-detail-copy">
                <p className="runbook-section-title">{selectedStep.title}</p>
                <p className="runbook-text">{selectedStep.instructions}</p>
              </div>
              <Badge variant={STEP_STATE_BADGE_VARIANTS[selectedStep.state]}>
                {selectedStep.state}
              </Badge>
            </div>

            <label className="runbook-label" htmlFor={stateSelectId}>
              Step state
            </label>
            <select
              className="select runbook-state-select"
              id={stateSelectId}
              onChange={(event) =>
                updateSelectedStep({
                  state: event.currentTarget.value as RunbookStepState,
                })
              }
              value={selectedStep.state}
            >
              {STEP_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>

            <label className="runbook-label" htmlFor={notesTextareaId}>
              Notes / evidence
            </label>
            <textarea
              className="input runbook-notes"
              id={notesTextareaId}
              onChange={(event) =>
                updateSelectedStep({ notes: event.currentTarget.value })
              }
              placeholder="Record local notes or evidence for this step."
              rows={4}
              value={selectedStep.notes}
            />
            <p className="runbook-note">
              Notes and state changes stay local to this widget session.
            </p>
          </section>
        </div>
      </div>
    </WidgetFrame>
  );
}
