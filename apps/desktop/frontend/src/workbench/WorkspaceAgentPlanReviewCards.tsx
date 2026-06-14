import { Badge } from "../design-system/Badge";
import type {
  CoordinatorOutcomeReviewDraft,
  CoordinatorPlanDraft,
} from "./coordinatorLocalProposalGeneration";

export function CoordinatorReviewCard({
  review,
}: {
  review: CoordinatorOutcomeReviewDraft;
}) {
  const statusVariant =
    review.statusInterpretation === "success"
      ? "success"
      : review.statusInterpretation === "failure"
        ? "error"
        : review.statusInterpretation === "needs review"
          ? "warning"
          : "neutral";

  return (
    <section
      aria-label={`Workspace Agent outcome review: ${review.title}`}
      className={`coordinator-review-card coordinator-review-card-${review.statusInterpretation.replace(
        /\s+/g,
        "-",
      )}`}
    >
      <div className="coordinator-review-header">
        <div className="coordinator-review-title-copy">
          <p className="coordinator-review-kicker">Outcome review</p>
          <h4 className="coordinator-review-title">{review.title}</h4>
        </div>
        <div className="coordinator-review-badges">
          <Badge variant={statusVariant}>
            {review.statusInterpretation}
          </Badge>
          <Badge variant="neutral">Visible text only</Badge>
          <Badge variant="neutral">No execution</Badge>
        </div>
      </div>
      <div className="coordinator-review-grid">
        <ReviewSection
          label="Observed result summary"
          value={review.observedSummary}
        />
        <ReviewSection
          label="Status interpretation"
          value={review.statusInterpretation}
        />
        <ReviewSection label="Likely outcome" value={review.likelyOutcome} />
        <ReviewList label="Risks / blockers" values={review.risksBlockers} />
        <ReviewList
          label="Next recommended actions"
          values={review.nextActions}
        />
      </div>
      <p className="coordinator-review-note">
        Review only. Workspace Agent does not read Queue history, Executor
        logs, or artifacts unless you paste or explicitly share them.
      </p>
    </section>
  );
}

export function CoordinatorPlanCard({ plan }: { plan: CoordinatorPlanDraft }) {
  return (
    <section
      aria-label={`Workspace Agent plan: ${plan.title}`}
      className="coordinator-plan-card"
    >
      <div className="coordinator-plan-header">
        <div className="coordinator-plan-title-copy">
          <p className="coordinator-plan-kicker">Plan draft</p>
          <h4 className="coordinator-plan-title">{plan.title}</h4>
          <div className="coordinator-plan-goal-block">
            <p className="coordinator-plan-section-label">Goal</p>
            <p className="coordinator-plan-goal">{plan.goal}</p>
          </div>
        </div>
        <div className="coordinator-plan-badges">
          <Badge variant="info">Plan draft</Badge>
          <Badge variant="neutral">No execution</Badge>
        </div>
      </div>
      <div className="coordinator-plan-grid">
        <PlanList label="Steps" values={plan.steps} />
        <PlanList label="Risks / notes" values={plan.riskNotes} />
        <PlanList
          label="Suggested next actions"
          values={plan.suggestedNextActions}
        />
      </div>
      <p className="coordinator-plan-note">
        Plan only. Queue task drafts require approval plus Create Queue task.
        Queue/Executor run work only after explicit operator action.
      </p>
    </section>
  );
}

function ReviewSection({ label, value }: { label: string; value: string }) {
  return (
    <div className="coordinator-review-section">
      <p className="coordinator-review-section-label">{label}</p>
      <p className="coordinator-review-section-value">{value}</p>
    </div>
  );
}

function ReviewList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="coordinator-review-section">
      <p className="coordinator-review-section-label">{label}</p>
      <ol className="coordinator-review-list">
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ol>
    </div>
  );
}

function PlanList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="coordinator-plan-section">
      <p className="coordinator-plan-section-label">{label}</p>
      <ol className="coordinator-plan-list">
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ol>
    </div>
  );
}
