import { useEffect, useState } from "react";
import { Badge } from "../../../design-system/Badge";
import { Button } from "../../../design-system/Button";
import { acceptKnowledgeDraftItem } from "../../knowledgeDraftAcceptance";
import {
  knowledgeDraftAcceptedSourceRef,
  knowledgeDraftReviewItemKey,
  knowledgeDraftReviewSourceFingerprint,
  type KnowledgeDraftReviewItem,
  type KnowledgeDraftReviewPack,
} from "../../knowledgeDraftPacks";
import type { WidgetRenderProps } from "../../types";
import { previewText } from "./agentQueueTaskDetailsFormatters";

type QueueDraftReviewDecision = "accepted" | "pending" | "rejected";

export function AgentQueueKnowledgeDraftReview({
  onCreateKnowledgeDocument,
  onCreateSkill,
  onListKnowledgeDraftReviews,
  onRecordKnowledgeDraftReview,
  pack,
}: {
  onCreateKnowledgeDocument: WidgetRenderProps["onCreateKnowledgeDocument"];
  onCreateSkill: WidgetRenderProps["onCreateSkill"];
  onListKnowledgeDraftReviews: WidgetRenderProps["onListKnowledgeDraftReviews"];
  onRecordKnowledgeDraftReview: WidgetRenderProps["onRecordKnowledgeDraftReview"];
  pack: KnowledgeDraftReviewPack;
}) {
  const [acceptingItemId, setAcceptingItemId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<
    Record<string, QueueDraftReviewDecision>
  >({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    setAcceptingItemId(null);
    setDecisions({});
    setMessage(null);
    setError(null);

    if (!onListKnowledgeDraftReviews) {
      return () => {
        isActive = false;
      };
    }

    void onListKnowledgeDraftReviews({
      draftPackId: pack.draftPackId,
      sourceFingerprint: knowledgeDraftReviewSourceFingerprint(pack),
    })
      .then((ledgerDecisions) => {
        if (!isActive || ledgerDecisions.length === 0) {
          return;
        }

        setDecisions(
          Object.fromEntries(
            ledgerDecisions.map((decision) => [
              decision.proposedItemId,
              decision.action === "rejected" ? "rejected" : "accepted",
            ]),
          ),
        );
        setMessage("Loaded previous draft review decisions for this pack.");
      })
      .catch(() => {
        if (isActive) {
          setMessage(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [onListKnowledgeDraftReviews, pack.draftPackId, pack.rawJson]);

  async function rejectDraftItem(item: KnowledgeDraftReviewItem) {
    if (onRecordKnowledgeDraftReview) {
      try {
        await onRecordKnowledgeDraftReview({
          draftPackId: pack.draftPackId,
          sourceFingerprint: knowledgeDraftReviewSourceFingerprint(pack),
          sourceQueueItemId: item.sourceQueueItemId ?? pack.queueItemId,
          sourceRunId: null,
          proposedItemId: item.draftItemId,
          proposedItemKey: knowledgeDraftReviewItemKey(pack, item),
          action: "rejected",
          reviewedAt: new Date().toISOString(),
          acceptedKnowledgeDocumentId: null,
          acceptedSkillId: null,
          rejectionReason: null,
        });
      } catch {
        // Keep local review behavior when the durable ledger is unavailable.
      }
    }

    setDecisions((current) => ({
      ...current,
      [item.draftItemId]: "rejected",
    }));
    setMessage("Draft item rejected for this review. Not saved as Knowledge.");
    setError(null);
  }

  async function acceptDraft(item: KnowledgeDraftReviewItem) {
    if (acceptingItemId) {
      return;
    }

    setAcceptingItemId(item.draftItemId);
    setMessage(null);
    setError(null);

    try {
      const accepted = await acceptKnowledgeDraftItem({
        item,
        onCreateKnowledgeDocument,
        onCreateSkill,
        pack,
      });

      if (onRecordKnowledgeDraftReview) {
        try {
          await onRecordKnowledgeDraftReview({
            draftPackId: pack.draftPackId,
            sourceFingerprint: knowledgeDraftReviewSourceFingerprint(pack),
            sourceQueueItemId: item.sourceQueueItemId ?? pack.queueItemId,
            sourceRunId: null,
            proposedItemId: item.draftItemId,
            proposedItemKey: knowledgeDraftReviewItemKey(pack, item),
            action: "accepted",
            reviewedAt: new Date().toISOString(),
            acceptedKnowledgeDocumentId:
              accepted.kind === "document"
                ? accepted.document.knowledgeDocumentId
                : null,
            acceptedSkillId:
              accepted.kind === "skill" ? accepted.skill.skillId : null,
            rejectionReason: null,
          });
        } catch {
          // The created item remains explicit; local decision state is the fallback.
        }
      }

      setDecisions((current) => ({
        ...current,
        [item.draftItemId]: "accepted",
      }));
      setMessage(
        `${accepted.message} Queue coordinator closure remains separate.`,
      );
    } catch (acceptError) {
      setError(errorToMessage(acceptError, "Unable to accept draft item."));
    } finally {
      setAcceptingItemId(null);
    }
  }

  return (
    <div className="agent-queue-knowledge-draft-review">
      <div className="agent-queue-knowledge-draft-notice">
        <div>
          <p className="agent-queue-final-response-label">
            Knowledge draft pack
          </p>
          <p className="agent-queue-run-note">
            {pack.packTitle} contains {pack.proposedItems.length.toString()} draft
            item{pack.proposedItems.length === 1 ? "" : "s"}. Accepting creates
            Knowledge / Skills records only for selected items.
          </p>
        </div>
        <Button
          onClick={() => void copyDraftPackPayload(pack)}
          title="Copies the draft pack JSON for explicit import in Knowledge / Skills."
          variant="secondary"
        >
          Copy draft payload
        </Button>
      </div>
      <div className="agent-queue-knowledge-draft-list">
        {pack.proposedItems.map((item) => (
          <KnowledgeDraftReviewItemCard
            acceptingItemId={acceptingItemId}
            decision={decisions[item.draftItemId] ?? "pending"}
            item={item}
            key={item.draftItemId}
            onAccept={() => void acceptDraft(item)}
            onCreateKnowledgeDocument={onCreateKnowledgeDocument}
            onCreateSkill={onCreateSkill}
            onReject={() => void rejectDraftItem(item)}
            pack={pack}
          />
        ))}
      </div>
      {message ? (
        <p className="agent-queue-message agent-queue-message-success">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="agent-queue-message agent-queue-message-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function KnowledgeDraftReviewItemCard({
  acceptingItemId,
  decision,
  item,
  onAccept,
  onCreateKnowledgeDocument,
  onCreateSkill,
  onReject,
  pack,
}: {
  acceptingItemId: string | null;
  decision: QueueDraftReviewDecision;
  item: KnowledgeDraftReviewItem;
  onAccept: () => void;
  onCreateKnowledgeDocument: WidgetRenderProps["onCreateKnowledgeDocument"];
  onCreateSkill: WidgetRenderProps["onCreateSkill"];
  onReject: () => void;
  pack: KnowledgeDraftReviewPack;
}) {
  const isDecisionFinal = decision !== "pending";
  const isAcceptingThisItem = acceptingItemId === item.draftItemId;
  const unavailableMessage = acceptUnavailableMessage(item, {
    onCreateKnowledgeDocument,
    onCreateSkill,
  });
  const acceptDisabled =
    isDecisionFinal ||
    Boolean(acceptingItemId) ||
    Boolean(unavailableMessage);

  return (
    <article className="agent-queue-knowledge-draft-item">
      <div className="agent-queue-knowledge-draft-item-header">
        <div>
          <p className="agent-queue-knowledge-draft-item-title">
            {item.title}
          </p>
          <p className="agent-queue-run-note">
            {previewText(item.quickSummary || item.fullContent, 260)}
          </p>
        </div>
        <Badge variant={decisionBadgeVariant(decision)}>
          {decisionLabel(decision)}
        </Badge>
      </div>
      <dl className="agent-queue-result-evidence-facts">
        <div>
          <dt>Target</dt>
          <dd>
            {item.targetKind === "skill" ? "Skill" : "Knowledge Document"}
          </dd>
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
          <dd>{knowledgeDraftAcceptedSourceRef(pack, item)}</dd>
        </div>
      </dl>
      <details className="agent-queue-details agent-queue-secondary-details">
        <summary>Full draft content</summary>
        <pre className="agent-queue-flow-selection-prompt">
          {item.fullContent}
        </pre>
      </details>
      <div className="agent-queue-run-actions">
        <Button disabled={acceptDisabled} onClick={onAccept} variant="primary">
          {isAcceptingThisItem
            ? "Accepting"
            : item.targetKind === "skill"
              ? "Accept as Skill"
              : "Accept as Knowledge Document"}
        </Button>
        <Button
          disabled={isDecisionFinal || Boolean(acceptingItemId)}
          onClick={onReject}
          variant="secondary"
        >
          Reject / leave unaccepted
        </Button>
      </div>
      {unavailableMessage ? (
        <p className="agent-queue-message agent-queue-message-warning">
          {unavailableMessage}
        </p>
      ) : null}
    </article>
  );
}

function acceptUnavailableMessage(
  item: KnowledgeDraftReviewItem,
  {
    onCreateKnowledgeDocument,
    onCreateSkill,
  }: {
    onCreateKnowledgeDocument: WidgetRenderProps["onCreateKnowledgeDocument"];
    onCreateSkill: WidgetRenderProps["onCreateSkill"];
  },
) {
  if (item.targetKind === "skill") {
    return onCreateSkill
      ? null
      : "Accept unavailable: Skill create API is not available in this Queue widget.";
  }

  return onCreateKnowledgeDocument
    ? null
    : "Accept unavailable: Knowledge Document create API is not available in this Queue widget.";
}

async function copyDraftPackPayload(pack: KnowledgeDraftReviewPack) {
  if (!navigator.clipboard) {
    return;
  }

  await navigator.clipboard.writeText(pack.rawJson);
}

function decisionBadgeVariant(
  decision: QueueDraftReviewDecision,
): "neutral" | "success" | "warning" {
  switch (decision) {
    case "accepted":
      return "success";
    case "rejected":
      return "neutral";
    case "pending":
    default:
      return "warning";
  }
}

function decisionLabel(decision: QueueDraftReviewDecision) {
  switch (decision) {
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected for this review";
    case "pending":
    default:
      return "Pending review";
  }
}

function errorToMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
