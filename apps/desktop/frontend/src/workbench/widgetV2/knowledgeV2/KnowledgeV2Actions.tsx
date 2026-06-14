import { useId, useRef, useState, type RefObject } from "react";

import { TopbarGroup } from "../../../design-system/ActionPrimitives";
import { Button } from "../../../design-system/Button";
import { WidgetPopupShell } from "../../../design-system/WidgetPopupShell";
import type {
  KnowledgeDocument,
  KnowledgeDraftReviewDecision,
} from "../../../workspace/types/knowledgeDocuments";
import type { Skill } from "../../../workspace/types/skills";
import { KnowledgeV2ActionFooter } from "./KnowledgeV2ActionFooter";
import { KnowledgeV2ActionButton } from "./KnowledgeV2ActionButton";

export type KnowledgeV2ActionKind =
  | "draft-review"
  | "import-file"
  | "manage-skills"
  | "new-knowledge";

type KnowledgeV2ActionsProps = {
  readonly actionAvailability?: KnowledgeV2ActionAvailabilityMap;
  readonly documents: readonly KnowledgeDocument[];
  readonly draftReviews?: readonly KnowledgeDraftReviewDecision[];
  readonly onDraftReview?: () => void;
  readonly onOpenDebug?: () => void;
  readonly onImport?: () => void;
  readonly onManageSkills?: () => void;
  readonly onNew?: () => void;
  readonly onViewModeChange?: (mode: "cards" | "list") => void;
  readonly debugButtonRef?: RefObject<HTMLButtonElement | null>;
  readonly skills: readonly Skill[];
  readonly viewMode?: "cards" | "list";
};

type ActionConfig = {
  readonly kind: KnowledgeV2ActionKind;
  readonly label: string;
};

export type KnowledgeV2ActionAvailability = {
  readonly details?: readonly string[];
  readonly reason: string | null;
  readonly state: "available" | "partial" | "unavailable";
};

export type KnowledgeV2ActionAvailabilityMap = {
  readonly draftReview: KnowledgeV2ActionAvailability;
  readonly importFile: KnowledgeV2ActionAvailability;
  readonly manageSkills: KnowledgeV2ActionAvailability;
  readonly newKnowledge: KnowledgeV2ActionAvailability;
};

const ACTIONS: readonly ActionConfig[] = [
  { kind: "new-knowledge", label: "New" },
  { kind: "import-file", label: "Import" },
  { kind: "draft-review", label: "Draft Review" },
  { kind: "manage-skills", label: "Manage Skills" },
];

export function KnowledgeV2Actions({
  actionAvailability,
  documents,
  draftReviews = [],
  onDraftReview,
  onOpenDebug,
  onImport,
  onManageSkills,
  onNew,
  onViewModeChange,
  debugButtonRef,
  skills,
  viewMode = "list",
}: KnowledgeV2ActionsProps) {
  const [openAction, setOpenAction] = useState<KnowledgeV2ActionKind | null>(
    null,
  );
  const newButtonRef = useRef<HTMLButtonElement | null>(null);
  const importButtonRef = useRef<HTMLButtonElement | null>(null);
  const draftButtonRef = useRef<HTMLButtonElement | null>(null);
  const skillsButtonRef = useRef<HTMLButtonElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const popupTitleId = useId();
  const popupId = useId();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [openedFromMore, setOpenedFromMore] = useState(false);
  const draftSummary = buildDraftSummary(documents, skills, draftReviews);
  const availability =
    actionAvailability ??
    defaultActionAvailability({
      onDraftReview,
      onImport,
      onManageSkills,
      onNew,
    });

  const visibleActions = ACTIONS.filter(
    (action) =>
      availabilityForAction(action.kind, availability)?.state !== "unavailable",
  );
  const activeButtonRef = openedFromMore
    ? moreButtonRef
    : openAction === "new-knowledge"
      ? newButtonRef
      : openAction === "import-file"
        ? importButtonRef
        : openAction === "draft-review"
          ? draftButtonRef
          : openAction === "manage-skills"
            ? skillsButtonRef
            : undefined;
  const primaryActions = visibleActions.filter((action) =>
    ["new-knowledge", "import-file"].includes(action.kind));
  const secondaryActions = visibleActions.filter((action) =>
    !["new-knowledge", "import-file"].includes(action.kind));

  function openTopbarAction(action: KnowledgeV2ActionKind, fromMore = false) {
    setOpenedFromMore(fromMore);
    setOpenAction(action);
    setIsMoreOpen(false);
  }

  return (
    <>
      <div
        aria-label="KnowledgeV2 explicit actions"
        className="knowledge-v2-actions"
      >
        <TopbarGroup
          className="knowledge-v2-action-group knowledge-v2-view-toggle knowledge-v2-action-group-spaced"
          data-group="view"
          label="KnowledgeV2 view switcher"
        >
          <Button
            aria-pressed={viewMode === "list"}
            onClick={() => onViewModeChange?.("list")}
            variant={viewMode === "list" ? "primary" : "secondary"}
          >
            List
          </Button>
          <Button
            aria-pressed={viewMode === "cards"}
            onClick={() => onViewModeChange?.("cards")}
            variant={viewMode === "cards" ? "primary" : "secondary"}
          >
            Cards
          </Button>
        </TopbarGroup>
        <TopbarGroup
          className="knowledge-v2-action-group knowledge-v2-primary-actions knowledge-v2-action-group-spaced"
          data-group="primary"
          label="KnowledgeV2 primary actions"
          priority="primary"
        >
          {primaryActions.map((action) => (
            <KnowledgeV2ActionButton
              badge={badgeForAction(action.kind, availability)}
              buttonRef={buttonRefForAction(action.kind, {
                draftButtonRef,
                importButtonRef,
                newButtonRef,
                skillsButtonRef,
              })}
              kind={action.kind}
              key={action.kind}
              label={action.label}
              onOpen={() => openTopbarAction(action.kind)}
            />
          ))}
        </TopbarGroup>
        <TopbarGroup
          className="knowledge-v2-action-group knowledge-v2-more-actions knowledge-v2-action-group-spaced"
          data-group="more"
          label="KnowledgeV2 secondary actions"
        >
          <Button
            aria-controls="knowledge-v2-more-actions-menu"
            aria-expanded={isMoreOpen}
            onClick={() => setIsMoreOpen((current) => !current)}
            ref={moreButtonRef}
            variant="secondary"
          >
            More
          </Button>
          {isMoreOpen ? (
            <div
              aria-label="KnowledgeV2 More menu"
              className="knowledge-v2-more-menu"
              id="knowledge-v2-more-actions-menu"
              role="menu"
            >
              {secondaryActions.map((action) => (
                <KnowledgeV2ActionButton
                  badge={badgeForAction(action.kind, availability)}
                  kind={action.kind}
                  key={action.kind}
                  label={action.label}
                  onOpen={() => openTopbarAction(action.kind, true)}
                  role="menuitem"
                  variant="secondary"
                />
              ))}
              {onOpenDebug ? (
                <Button
                  aria-label="KnowledgeV2 debug diagnostics"
                  onClick={() => {
                    setIsMoreOpen(false);
                    onOpenDebug();
                  }}
                  ref={debugButtonRef}
                  role="menuitem"
                  variant="secondary"
                >
                  Debug
                </Button>
              ) : null}
            </div>
          ) : null}
        </TopbarGroup>
      </div>
      <WidgetPopupShell
        actions={
          <Button onClick={() => setOpenAction(null)} variant="ghost">
            Close
          </Button>
        }
        bodyClassName="knowledge-v2-action-popup-body"
        className="knowledge-v2-action-popup-shell"
        eyebrow="KnowledgeV2 action"
        footer={
          openAction ? (
            <KnowledgeV2ActionFooter
              action={openAction}
              availability={availability}
              onDraftReview={onDraftReview}
              onImport={onImport}
              onManageSkills={onManageSkills}
              onNew={onNew}
            />
          ) : null
        }
        id={popupId}
        isOpen={openAction !== null}
        onRequestClose={() => setOpenAction(null)}
        returnFocusRef={activeButtonRef}
        title={titleForAction(openAction)}
        titleId={popupTitleId}
        variant="floating"
      >
        <article className="knowledge-v2-action-popup">
          {openAction === "new-knowledge" ? (
            <NewKnowledgePopup
              availability={availability.newKnowledge}
            />
          ) : null}
          {openAction === "import-file" ? (
            <ImportKnowledgePopup
              availability={availability.importFile}
            />
          ) : null}
          {openAction === "draft-review" ? (
            <DraftReviewPopup
              availability={availability.draftReview}
              draftSummary={draftSummary}
            />
          ) : null}
          {openAction === "manage-skills" ? (
            <ManageSkillsPopup
              availability={availability.manageSkills}
              skillsCount={skills.length}
            />
          ) : null}
        </article>
      </WidgetPopupShell>
    </>
  );
}

function NewKnowledgePopup({
  availability,
}: {
  readonly availability: KnowledgeV2ActionAvailability;
}) {
  return (
    <section className="knowledge-v2-action-popup-content">
      <ActionAvailabilityPanel availability={availability} label="New" />
      <p>Create a Knowledge Document or Skill through the existing create flow.</p>
      <div className="knowledge-v2-action-options">
        <ActionOption
          description="Plain-text or Markdown document."
          status={availabilityStatusText(availability)}
          title="New document"
        />
        <ActionOption
          description="Reusable reviewed instruction."
          status={availabilityStatusText(availability)}
          title="New skill"
        />
      </div>
    </section>
  );
}

function ImportKnowledgePopup({
  availability,
}: {
  readonly availability: KnowledgeV2ActionAvailability;
}) {
  return (
    <section className="knowledge-v2-action-popup-content">
      <ActionAvailabilityPanel availability={availability} label="Import" />
      <p>Import one plain text or Markdown file through the existing import flow.</p>
      <div className="knowledge-v2-action-options">
        <ActionOption
          description=".txt, .md, or .markdown."
          status={availabilityStatusText(availability)}
          title="Existing single-file import"
        />
      </div>
    </section>
  );
}

function DraftReviewPopup({
  availability,
  draftSummary,
}: {
  readonly availability: KnowledgeV2ActionAvailability;
  readonly draftSummary: ReturnType<typeof buildDraftSummary>;
}) {
  return (
    <section className="knowledge-v2-action-popup-content">
      <ActionAvailabilityPanel availability={availability} label="Draft Review" />
      <p>Visible draft counts only.</p>
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
    </section>
  );
}

function ManageSkillsPopup({
  availability,
  skillsCount,
}: {
  readonly availability: KnowledgeV2ActionAvailability;
  readonly skillsCount: number;
}) {
  return (
    <section className="knowledge-v2-action-popup-content">
      <ActionAvailabilityPanel availability={availability} label="Manage Skills" />
      <p>
        {skillsCount.toString()} Skill item{skillsCount === 1 ? "" : "s"} in
        the catalog.
      </p>
      <div className="knowledge-v2-action-options">
        <ActionOption
          description="Existing editor."
          status={availabilityStatusText(availability)}
          title="Skill records"
        />
      </div>
    </section>
  );
}

function ActionAvailabilityPanel({
  availability,
  label,
}: {
  readonly availability: KnowledgeV2ActionAvailability;
  readonly label: string;
}) {
  return (
    <section
      aria-label={`${label} availability`}
      className="knowledge-v2-action-availability"
      data-state={availability.state}
    >
      <span className="knowledge-v2-chip" data-tone={toneForAvailability(availability.state)}>
        {labelForAvailability(availability.state)}
      </span>
      {availability.reason ? (
        <span title={availability.reason}>
          {shortAvailabilityReason(availability)}
        </span>
      ) : null}
    </section>
  );
}

function defaultActionAvailability({
  onDraftReview,
  onImport,
  onManageSkills,
  onNew,
}: {
  readonly onDraftReview?: () => void;
  readonly onImport?: () => void;
  readonly onManageSkills?: () => void;
  readonly onNew?: () => void;
}): KnowledgeV2ActionAvailabilityMap {
  return {
    draftReview: onDraftReview
      ? available()
      : unavailable(
          "Draft review management is unavailable because KnowledgeV2 did not receive an explicit draft-review callback.",
        ),
    importFile: onImport
      ? available()
      : unavailable(
          "Import is unavailable because KnowledgeV2 did not receive an explicit import-flow callback.",
        ),
    manageSkills: onManageSkills
      ? available()
      : unavailable(
          "Skill management is unavailable because KnowledgeV2 did not receive an explicit Skill-management callback.",
        ),
    newKnowledge: onNew
      ? available()
      : unavailable(
          "Creation is unavailable because KnowledgeV2 did not receive an explicit create-flow callback.",
        ),
  };
}

function available(): KnowledgeV2ActionAvailability {
  return { reason: null, state: "available" };
}

function unavailable(
  reason: string,
  details: readonly string[] = [],
): KnowledgeV2ActionAvailability {
  return { details, reason, state: "unavailable" };
}

function badgeForAction(
  kind: KnowledgeV2ActionKind,
  availability: KnowledgeV2ActionAvailabilityMap,
) {
  const actionAvailability = availabilityForAction(kind, availability);
  if (!actionAvailability || actionAvailability.state === "available") {
    return null;
  }
  return labelForAvailability(actionAvailability.state);
}

function availabilityForAction(
  kind: KnowledgeV2ActionKind,
  availability: KnowledgeV2ActionAvailabilityMap,
) {
  switch (kind) {
    case "new-knowledge":
      return availability.newKnowledge;
    case "import-file":
      return availability.importFile;
    case "draft-review":
      return availability.draftReview;
    case "manage-skills":
      return availability.manageSkills;
  }
}

function labelForAvailability(state: KnowledgeV2ActionAvailability["state"]) {
  switch (state) {
    case "available":
      return "Available";
    case "partial":
      return "Partial";
    case "unavailable":
      return "Unavailable";
  }
}

function availabilityStatusText(availability: KnowledgeV2ActionAvailability) {
  switch (availability.state) {
    case "available":
      return "Available through existing flow";
    case "partial":
      return "Available with limits";
    case "unavailable":
      return "Unavailable in KnowledgeV2";
  }
}

function shortAvailabilityReason(availability: KnowledgeV2ActionAvailability) {
  switch (availability.state) {
    case "available":
      return "Ready";
    case "partial":
      return availability.reason ?? "Available with limits.";
    case "unavailable":
      return availability.reason ?? "Unavailable.";
  }
}

function toneForAvailability(state: KnowledgeV2ActionAvailability["state"]) {
  switch (state) {
    case "available":
      return "ok";
    case "partial":
      return "warning";
    case "unavailable":
      return "unavailable";
  }
}

function ActionOption({
  description,
  status,
  title,
}: {
  readonly description: string;
  readonly status: string;
  readonly title: string;
}) {
  return (
    <div className="knowledge-v2-action-option">
      <div>
        <h4>{title}</h4>
        <p>{description}</p>
        <span>{status}</span>
      </div>
    </div>
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
      return "New";
    case "import-file":
      return "Import";
    case "draft-review":
      return "Draft Review";
    case "manage-skills":
      return "Manage Skills";
    default:
      return "KnowledgeV2 action";
  }
}
