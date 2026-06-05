import { Button } from "../design-system/Button";
import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
} from "../renderMemoryGuards";
import {
  knowledgeDraftAcceptedSourceRef,
  type KnowledgeDraftReviewItem,
  type KnowledgeDraftReviewPack,
} from "./knowledgeDraftPacks";
import { draftDecisionLabel } from "./SkillLibraryDocumentsPanel.helpers";

type DraftReviewDecision = "accepted" | "pending" | "rejected";

type SkillLibraryDraftReviewPanelProps = {
  documentApiAvailable: boolean;
  draftPayload: string;
  draftReviewDecisions: Record<string, DraftReviewDecision>;
  draftReviewPack: KnowledgeDraftReviewPack | null;
  isAcceptingDraftItem: boolean;
  skillCreateAvailable: boolean;
  onAcceptDraftItem: (item: KnowledgeDraftReviewItem) => void;
  onClearDraftReviewPayload: () => void;
  onDraftPayloadChange: (payload: string) => void;
  onLoadDraftReviewPayload: () => void;
  onRejectDraftItem: (item: KnowledgeDraftReviewItem) => void;
};

export function SkillLibraryDraftReviewPanel({
  documentApiAvailable,
  draftPayload,
  draftReviewDecisions,
  draftReviewPack,
  isAcceptingDraftItem,
  skillCreateAvailable,
  onAcceptDraftItem,
  onClearDraftReviewPayload,
  onDraftPayloadChange,
  onLoadDraftReviewPayload,
  onRejectDraftItem,
}: SkillLibraryDraftReviewPanelProps) {
  const visibleDraftItems =
    draftReviewPack?.proposedItems.slice(0, RENDER_MEMORY_CAPS.eventRows) ??
    [];
  const hiddenDraftItemCount = draftReviewPack
    ? Math.max(0, draftReviewPack.proposedItems.length - visibleDraftItems.length)
    : 0;

  return (
    <section className="skill-draft-review" aria-label="Draft Knowledge review">
      <div className="skill-draft-review-header">
        <div>
          <p className="skill-list-meta">Draft review</p>
          <h3>Review Queue result drafts</h3>
        </div>
        {draftReviewPack ? (
          <span className="skill-scope-badge">
            {draftReviewPack.proposedItems.length.toString()} item
            {draftReviewPack.proposedItems.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      <p className="skill-draft-review-help">
        Paste the visible Queue worker report, final result, or draft-pack JSON
        that contains proposed Knowledge items. Loading drafts only prepares
        this review surface; accept creates a Knowledge Document or Skill
        through the existing catalog paths, and rejection is local to this
        review.
      </p>
      <label className="skill-field skill-field-wide">
        <span>Queue result or draft pack</span>
        <textarea
          className="input skill-draft-payload-textarea"
          onChange={(event) => onDraftPayloadChange(event.currentTarget.value)}
          placeholder="Paste the Queue result, worker report, or fenced hobit-knowledge-draft JSON."
          value={draftPayload}
        />
      </label>
      <div className="skill-editor-actions">
        <Button
          disabled={!documentApiAvailable && !skillCreateAvailable}
          onClick={onLoadDraftReviewPayload}
          variant="secondary"
        >
          Load drafts
        </Button>
        <Button
          disabled={!draftReviewPack}
          onClick={onClearDraftReviewPayload}
          variant="ghost"
        >
          Clear drafts
        </Button>
      </div>
      {draftReviewPack ? (
        <div className="skill-draft-review-list">
          <p className="skill-draft-review-pack-title">
            {draftReviewPack.packTitle}
            {draftReviewPack.queueItemId
              ? ` - Queue task ${draftReviewPack.queueItemId}`
              : ""}
          </p>
          {visibleDraftItems.map((item) => {
            const decision =
              draftReviewDecisions[item.draftItemId] ?? "pending";
            const isActionDisabled =
              decision !== "pending" || isAcceptingDraftItem;
            const quickSummaryMissing = !item.quickSummary.trim();

            return (
              <article
                className="skill-draft-review-item"
                key={item.draftItemId}
              >
                <div className="skill-draft-review-item-header">
                  <div>
                    <h4>{item.title}</h4>
                    <p>
                      {quickSummaryMissing
                        ? "Summary missing. Accepted active Knowledge will remain warning-bearing until a quick summary is added."
                        : cappedPreviewText(
                            item.quickSummary,
                            RENDER_MEMORY_CAPS.knowledgePreviewChars,
                          )}
                    </p>
                  </div>
                  <span className="skill-scope-badge">
                    {draftDecisionLabel(decision)}
                  </span>
                </div>
                <dl className="skill-draft-review-facts">
                  <div>
                    <dt>Target</dt>
                    <dd>{item.targetKind === "skill" ? "Skill" : "Document"}</dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>{item.suggestedType}</dd>
                  </div>
                  <div>
                    <dt>Scope</dt>
                    <dd>{item.suggestedScope}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{knowledgeDraftAcceptedSourceRef(draftReviewPack, item)}</dd>
                  </div>
                </dl>
                <div className="skill-editor-actions">
                  <Button
                    disabled={isActionDisabled}
                    onClick={() => onAcceptDraftItem(item)}
                    variant="primary"
                  >
                    Accept
                  </Button>
                  <Button
                    disabled={isActionDisabled}
                    onClick={() => onRejectDraftItem(item)}
                    variant="secondary"
                  >
                    Reject / archive
                  </Button>
                </div>
              </article>
            );
          })}
          {hiddenDraftItemCount > 0 ? (
            <p className="skill-attach-note">
              Preview capped. Showing first {visibleDraftItems.length.toString()}{" "}
              of {draftReviewPack.proposedItems.length.toString()} draft item(s).
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
