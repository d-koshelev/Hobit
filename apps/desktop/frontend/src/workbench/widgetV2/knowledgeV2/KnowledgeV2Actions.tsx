import { useId, useRef, useState, type RefObject } from "react";

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
  | "help-legend"
  | "import-file"
  | "manage-skills"
  | "new-knowledge";

type KnowledgeV2ActionsProps = {
  readonly actionAvailability?: KnowledgeV2ActionAvailabilityMap;
  readonly documents: readonly KnowledgeDocument[];
  readonly draftReviews?: readonly KnowledgeDraftReviewDecision[];
  readonly onDraftReview?: () => void;
  readonly onImport?: () => void;
  readonly onManageSkills?: () => void;
  readonly onNew?: () => void;
  readonly onViewModeChange?: (mode: "cards" | "list") => void;
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
  { kind: "help-legend", label: "Help" },
];

export function KnowledgeV2Actions({
  actionAvailability,
  documents,
  draftReviews = [],
  onDraftReview,
  onImport,
  onManageSkills,
  onNew,
  onViewModeChange,
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
  const helpButtonRef = useRef<HTMLButtonElement | null>(null);
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
            : openAction === "help-legend"
              ? helpButtonRef
              : undefined;
  const primaryActions = ACTIONS.filter((action) =>
    ["new-knowledge", "import-file"].includes(action.kind));
  const managementActions = ACTIONS.filter((action) =>
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
        <div
          aria-label="KnowledgeV2 view switcher"
          className="knowledge-v2-action-group knowledge-v2-view-toggle"
          data-group="view"
          role="group"
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
        </div>
        <div
          aria-label="KnowledgeV2 primary actions"
          className="knowledge-v2-action-group knowledge-v2-primary-actions"
          data-group="primary"
          role="group"
        >
          {primaryActions.map((action) => (
            <KnowledgeV2ActionButton
              badge={badgeForAction(action.kind, availability)}
              buttonRef={buttonRefForAction(action.kind, {
                draftButtonRef,
                helpButtonRef,
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
        </div>
        <div
          aria-label="KnowledgeV2 management actions"
          className="knowledge-v2-action-group knowledge-v2-management-actions"
          data-group="management"
          role="group"
        >
          {managementActions.map((action) => (
            <KnowledgeV2ActionButton
              badge={badgeForAction(action.kind, availability)}
              buttonRef={buttonRefForAction(action.kind, {
                draftButtonRef,
                helpButtonRef,
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
        </div>
        <div
          aria-label="KnowledgeV2 collapsed management actions"
          className="knowledge-v2-action-group knowledge-v2-more-actions"
          data-group="more"
          role="group"
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
              {managementActions.map((action) => (
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
            </div>
          ) : null}
        </div>
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
          {openAction === "help-legend" ? <HelpLegendPopup /> : null}
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
      <p>Create only through an explicit existing flow.</p>
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
        <ActionOption
          description="Not a current KnowledgeV2 path."
          status="Coming soon"
          title="New runbook/procedure"
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
      <p>Explicit single-file import only.</p>
      <div className="knowledge-v2-action-options">
        <ActionOption
          description="Not wired here."
          status="Unavailable in KnowledgeV2"
          title="Choose or drop a text/Markdown file"
        />
        <ActionOption
          description=".txt, .md, or .markdown."
          status={availabilityStatusText(availability)}
          title="Existing single-file import"
        />
        <ActionOption
          description="Use existing flow only."
          status="Advanced fallback unavailable here"
          title="Raw path fallback"
        />
      </div>
      <details className="knowledge-v2-action-note">
        <summary>Safety details</summary>
        <p>This popup never reads a local file by itself.</p>
      </details>
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
      <details className="knowledge-v2-action-note">
        <summary>Review details</summary>
        <p>Raw draft contents stay out of this catalog browser.</p>
      </details>
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
        <ActionOption
          description="Tags and filters only."
          status="Placeholder"
          title="Categories"
        />
        <ActionOption
          description="Not implemented."
          status="Coming soon"
          title="Templates"
        />
        <ActionOption
          description="Text fields only."
          status="Read-only summary"
          title="Validation"
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
      {availability.details && availability.details.length > 0 ? (
        <details className="knowledge-v2-action-bridge-list">
          <summary>Bridge details</summary>
          <ul>
            {availability.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </details>
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
    case "help-legend":
      return null;
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
      return "Partially available";
    case "unavailable":
      return "Unavailable in KnowledgeV2";
  }
}

function shortAvailabilityReason(availability: KnowledgeV2ActionAvailability) {
  switch (availability.state) {
    case "available":
      return "Ready";
    case "partial":
      return "Some bridge details unavailable.";
    case "unavailable":
      return "Bridge unavailable.";
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

function HelpLegendPopup() {
  return (
    <section className="knowledge-v2-action-popup-content">
      <p>Safety and status legend.</p>
      <dl className="knowledge-v2-action-facts knowledge-v2-action-facts-wide">
        <div>
          <dt>Published</dt>
          <dd>Ready and usable</dd>
        </div>
        <div>
          <dt>Draft</dt>
          <dd>In progress / review needed</dd>
        </div>
        <div>
          <dt>Archived</dt>
          <dd>No longer active</dd>
        </div>
        <div>
          <dt>Rejected</dt>
          <dd>Not approved / cannot attach</dd>
        </div>
        <div>
          <dt>Stale</dt>
          <dd>Update recommended</dd>
        </div>
        <div>
          <dt>Large</dt>
          <dd>Review recommended</dd>
        </div>
        <div>
          <dt>Unavailable</dt>
          <dd>Cannot be used</dd>
        </div>
      </dl>
      <p className="knowledge-v2-action-note">Explicit attach only.</p>
    </section>
  );
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
    readonly helpButtonRef: RefObject<HTMLButtonElement | null>;
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
    case "help-legend":
      return refs.helpButtonRef;
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
    case "help-legend":
      return "Help / Legend";
    default:
      return "KnowledgeV2 action";
  }
}
