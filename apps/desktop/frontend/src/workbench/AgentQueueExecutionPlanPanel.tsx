import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import {
  executionPlanBadgeVariant,
  executionPlanEstimateText,
  executionPlanStatusLabel,
} from "./queue/agentQueueExecutionPlanModel";
import type { AgentQueueExecutionPlanController } from "./queue/useAgentQueueController";

type AgentQueueExecutionPlanPanelProps = {
  executionPlan: AgentQueueExecutionPlanController;
};

export function AgentQueueExecutionPlanPanel({
  executionPlan,
}: AgentQueueExecutionPlanPanelProps) {
  const plan = executionPlan.plan;

  return (
    <div className="agent-queue-execution-group agent-queue-plan-preview">
      <div className="agent-queue-execution-group-header">
        <div>
          <p
            className="agent-queue-execution-group-title"
            title="Local deterministic estimate. It does not start execution."
          >
            Expected plan of work
          </p>
          <p className="agent-queue-run-note">
            Plan preview. Structured metadata only; never appended to the prompt.
          </p>
        </div>
        <div className="agent-queue-execution-badges">
          <Badge variant={executionPlanBadgeVariant(plan)}>
            {executionPlanStatusLabel(plan)}
          </Badge>
          {plan ? <Badge variant="neutral">{plan.source}</Badge> : null}
        </div>
      </div>

      {plan ? (
        <>
          <dl className="agent-queue-plan-facts">
            <div>
              <dt>Estimate</dt>
              <dd>{executionPlanEstimateText(plan)}</dd>
            </div>
            <div>
              <dt>Complexity</dt>
              <dd>{plan.complexity}</dd>
            </div>
            <div>
              <dt>Risk</dt>
              <dd>{plan.risk}</dd>
            </div>
            <div>
              <dt>Worker</dt>
              <dd>{plan.workerId}</dd>
            </div>
            <div>
              <dt>Generated</dt>
              <dd>{formatRunTimestamp(plan.generatedAt)}</dd>
            </div>
          </dl>

          <PlanList title="Approx. steps" values={plan.steps} />
          <PlanList
            emptyText="No specific files or areas inferred."
            title="Likely files / areas"
            values={plan.likelyFilesOrAreas}
          />
          <PlanList
            emptyText="No validation commands inferred."
            title="Expected validation"
            values={plan.expectedValidationCommands}
          />

          {plan.splitRecommendation ? (
            <p className="agent-queue-run-warning">
              Split recommendation: {plan.splitRecommendation}
            </p>
          ) : null}
          {plan.status === "stale" ? (
            <p className="agent-queue-run-warning">
              This plan is stale. Refresh it before using the estimate for an
              execution decision.
            </p>
          ) : null}
          {plan.notes ? (
            <p className="agent-queue-run-note">{plan.notes}</p>
          ) : null}
        </>
      ) : (
        <p className="agent-queue-run-note">
          No expected plan has been generated. Generate a local preview to estimate scope before any explicit run.
        </p>
      )}

      <div className="agent-queue-run-actions">
        <Button
          disabled={!executionPlan.canGenerate}
          onClick={() => executionPlan.onGenerate()}
          variant={plan ? "secondary" : "primary"}
        >
          {plan ? "Refresh plan" : "Generate plan preview"}
        </Button>
      </div>

      {executionPlan.message ? (
        <p className="agent-queue-message">{executionPlan.message}</p>
      ) : null}
    </div>
  );
}

function PlanList({
  emptyText,
  title,
  values,
}: {
  emptyText?: string;
  title: string;
  values: string[];
}) {
  return (
    <div className="agent-queue-plan-list">
      <p className="field-label">{title}</p>
      {values.length > 0 ? (
        <ul>
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <p className="agent-queue-run-note">{emptyText ?? "None inferred."}</p>
      )}
    </div>
  );
}

function formatRunTimestamp(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}
