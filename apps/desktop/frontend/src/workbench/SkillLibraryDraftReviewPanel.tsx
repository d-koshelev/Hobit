import { Button } from "../design-system/Button";
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
  return (
    <section className="skill-draft-review" aria-label="Draft Knowledge review">
      <div className="skill-draft-review-header">
        <div>
          <p className="skill-list-meta">Draft review</p>
          <h3>Queue Knowledge drafts</h3>
        </div>
        {draftReviewPack ? (
          <span className="skill-scope-badge">
            {draftReviewPack.proposedItems.length.toString()} item
            {draftReviewPack.proposedItems.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      <label className="skill-field skill-field-wide">
        <span>Draft payload</span>
        <textarea
          className="input skill-draft-payload-textarea"
          onChange={(event) => onDraftPayloadChange(event.currentTarget.value)}
          placeholder="Paste a Queue result, worker report, or draft pack JSON."
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
          {draftReviewPack.proposedItems.map((item) => {
            const decision =
              draftReviewDecisions[item.draftItemId] ?? "pending";
            const isActionDisabled =
              decision !== "pending" || isAcceptingDraftItem;

            return (
              <article
                className="skill-draft-review-item"
                key={item.draftItemId}
              >
                <div className="skill-draft-review-item-header">
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.quickSummary || item.fullContent}</p>
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
        </div>
      ) : null}
    </section>
  );
}
