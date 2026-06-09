import { useId, useRef, useState, type RefObject } from "react";

import { Button } from "../../../design-system/Button";
import { WidgetPopupShell } from "../../../design-system/WidgetPopupShell";
import type {
  KnowledgeDocument,
  KnowledgeDraftReviewDecision,
} from "../../../workspace/types/knowledgeDocuments";
import type { Skill } from "../../../workspace/types/skills";

type KnowledgeV2ActionKind =
  | "draft-review"
  | "import-file"
  | "manage-skills"
  | "new-knowledge";

type KnowledgeV2ActionsProps = {
  readonly documents: readonly KnowledgeDocument[];
  readonly draftReviews?: readonly KnowledgeDraftReviewDecision[];
  readonly missingBridges?: readonly string[];
  readonly onDraftReview?: () => void;
  readonly onImport?: () => void;
  readonly onManageSkills?: () => void;
  readonly onNew?: () => void;
  readonly skills: readonly Skill[];
};

type ActionConfig = {
  readonly kind: KnowledgeV2ActionKind;
  readonly label: string;
};

const ACTIONS: readonly ActionConfig[] = [
  { kind: "new-knowledge", label: "New Knowledge" },
  { kind: "import-file", label: "Import file" },
  { kind: "draft-review", label: "Draft Review" },
  { kind: "manage-skills", label: "Manage Skills" },
];

export function KnowledgeV2Actions({
  documents,
  draftReviews = [],
  missingBridges = [],
  onDraftReview,
  onImport,
  onManageSkills,
  onNew,
  skills,
}: KnowledgeV2ActionsProps) {
  const [openAction, setOpenAction] = useState<KnowledgeV2ActionKind | null>(
    null,
  );
  const newButtonRef = useRef<HTMLButtonElement | null>(null);
  const importButtonRef = useRef<HTMLButtonElement | null>(null);
  const draftButtonRef = useRef<HTMLButtonElement | null>(null);
  const skillsButtonRef = useRef<HTMLButtonElement | null>(null);
  const popupTitleId = useId();
  const popupId = useId();
  const draftSummary = buildDraftSummary(documents, skills, draftReviews);

  const activeButtonRef =
    openAction === "new-knowledge"
      ? newButtonRef
      : openAction === "import-file"
        ? importButtonRef
        : openAction === "draft-review"
          ? draftButtonRef
          : openAction === "manage-skills"
            ? skillsButtonRef
            : undefined;

  return (
    <>
      <div
        aria-label="KnowledgeV2 explicit actions"
        className="knowledge-v2-actions"
      >
        {ACTIONS.map((action) => (
          <Button
            key={action.kind}
            onClick={() => setOpenAction(action.kind)}
            ref={buttonRefForAction(action.kind, {
              draftButtonRef,
              importButtonRef,
              newButtonRef,
              skillsButtonRef,
            })}
            variant={action.kind === "new-knowledge" ? "primary" : "secondary"}
          >
            {action.label}
          </Button>
        ))}
      </div>
      <WidgetPopupShell
        className="knowledge-v2-action-popup-shell"
        id={popupId}
        isOpen={openAction !== null}
        onRequestClose={() => setOpenAction(null)}
        returnFocusRef={activeButtonRef}
        titleId={popupTitleId}
        variant="floating"
      >
        <article className="knowledge-v2-action-popup">
          <header className="knowledge-v2-action-popup-header" data-popup-drag-handle>
            <div>
              <p className="knowledge-v2-eyebrow">KnowledgeV2 action</p>
              <h3 id={popupTitleId}>{titleForAction(openAction)}</h3>
            </div>
            <Button onClick={() => setOpenAction(null)} variant="ghost">
              Close
            </Button>
          </header>
          {openAction === "new-knowledge" ? (
            <ActionUnavailable
              actionLabel="New Knowledge"
              callback={onNew}
              ctaLabel="Open existing create flow"
              description="KnowledgeV2 browsing is frontend-only in this block. Creation remains owned by the production Knowledge / Skills document editor or an approved visible catalog proposal."
            />
          ) : null}
          {openAction === "import-file" ? (
            <ActionUnavailable
              actionLabel="Import file"
              callback={onImport}
              ctaLabel="Open existing import flow"
              description="KnowledgeV2 does not wire a file picker or path import form. Use the production Knowledge / Skills import flow for explicit single-file text or Markdown import."
            />
          ) : null}
          {openAction === "draft-review" ? (
            <section className="knowledge-v2-action-popup-body">
              <p>
                Draft review stays outside the default catalog browsing view.
                This summary uses visible catalog records only.
              </p>
              <dl className="knowledge-v2-action-facts">
                <div>
                  <dt>Draft documents</dt>
                  <dd>{draftSummary.documentDrafts.toString()}</dd>
                </div>
                <div>
                  <dt>Draft skills</dt>
                  <dd>{draftSummary.skillDrafts.toString()}</dd>
                </div>
                <div>
                  <dt>Needs review</dt>
                  <dd>{draftSummary.needsReviewSkills.toString()}</dd>
                </div>
                <div>
                  <dt>Review decisions</dt>
                  <dd>{draftSummary.reviewDecisions.toString()}</dd>
                </div>
              </dl>
              {missingBridges.length > 0 ? (
                <ul className="knowledge-v2-action-bridge-list">
                  {missingBridges.map((bridge) => (
                    <li key={bridge}>{bridge}</li>
                  ))}
                </ul>
              ) : null}
              <p className="knowledge-v2-action-note">
                Full draft review and acceptance stay in the production
                Knowledge / Skills review surface. Raw draft contents are not
                shown in this catalog browser.
              </p>
              {onDraftReview ? (
                <Button onClick={onDraftReview} variant="secondary">
                  Open existing draft review flow
                </Button>
              ) : (
                <p className="knowledge-v2-action-status">
                  Draft review management is unavailable in KnowledgeV2.
                </p>
              )}
            </section>
          ) : null}
          {openAction === "manage-skills" ? (
            <ActionUnavailable
              actionLabel="Manage Skills"
              callback={onManageSkills}
              ctaLabel="Open existing skills flow"
              description={`KnowledgeV2 currently treats ${skills.length.toString()} Skill item${skills.length === 1 ? "" : "s"} as catalog entries and filters. Skill editing remains in the production Knowledge / Skills surface.`}
            />
          ) : null}
        </article>
      </WidgetPopupShell>
    </>
  );
}

function ActionUnavailable({
  actionLabel,
  callback,
  ctaLabel,
  description,
}: {
  readonly actionLabel: string;
  readonly callback?: () => void;
  readonly ctaLabel: string;
  readonly description: string;
}) {
  return (
    <section className="knowledge-v2-action-popup-body">
      <p>{description}</p>
      {callback ? (
        <Button onClick={callback} variant="secondary">
          {ctaLabel}
        </Button>
      ) : (
        <p className="knowledge-v2-action-status">
          {actionLabel} is unavailable in the experimental KnowledgeV2 browser.
        </p>
      )}
    </section>
  );
}

function buildDraftSummary(
  documents: readonly KnowledgeDocument[],
  skills: readonly Skill[],
  draftReviews: readonly KnowledgeDraftReviewDecision[],
) {
  return {
    documentDrafts: documents.filter(
      (document) => document.lifecycleStatus === "draft",
    ).length,
    needsReviewSkills: skills.filter(
      (skill) => skill.reviewStatus === "needs_review",
    ).length,
    reviewDecisions: draftReviews.length,
    skillDrafts: skills.filter((skill) => skill.reviewStatus === "draft")
      .length,
  };
}

function buttonRefForAction(
  kind: KnowledgeV2ActionKind,
  refs: {
    readonly draftButtonRef: RefObject<HTMLButtonElement | null>;
    readonly importButtonRef: RefObject<HTMLButtonElement | null>;
    readonly newButtonRef: RefObject<HTMLButtonElement | null>;
    readonly skillsButtonRef: RefObject<HTMLButtonElement | null>;
  },
) {
  switch (kind) {
    case "new-knowledge":
      return refs.newButtonRef;
    case "import-file":
      return refs.importButtonRef;
    case "draft-review":
      return refs.draftButtonRef;
    case "manage-skills":
      return refs.skillsButtonRef;
  }
}

function titleForAction(action: KnowledgeV2ActionKind | null) {
  switch (action) {
    case "new-knowledge":
      return "New Knowledge";
    case "import-file":
      return "Import file";
    case "draft-review":
      return "Draft Review";
    case "manage-skills":
      return "Manage Skills";
    default:
      return "KnowledgeV2 action";
  }
}
