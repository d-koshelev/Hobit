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
  const popupTitleId = useId();
  const popupId = useId();
  const draftSummary = buildDraftSummary(documents, skills, draftReviews);
  const availability =
    actionAvailability ??
    defaultActionAvailability({
      onDraftReview,
      onImport,
      onManageSkills,
      onNew,
    });

  const activeButtonRef =
    openAction === "new-knowledge"
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

  return (
    <>
      <div
        aria-label="KnowledgeV2 explicit actions"
        className="knowledge-v2-actions"
      >
        <div aria-label="KnowledgeV2 view mode" className="knowledge-v2-view-toggle">
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
        {ACTIONS.map((action) => (
          <Button
            key={action.kind}
            onClick={() => setOpenAction(action.kind)}
            ref={buttonRefForAction(action.kind, {
              draftButtonRef,
              helpButtonRef,
              importButtonRef,
              newButtonRef,
              skillsButtonRef,
            })}
            variant={action.kind === "new-knowledge" ? "primary" : "secondary"}
          >
            {action.label}
            {badgeForAction(action.kind, availability) ? (
              <span className="knowledge-v2-action-badge">
                {badgeForAction(action.kind, availability)}
              </span>
            ) : null}
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
            <NewKnowledgePopup
              availability={availability.newKnowledge}
              onNew={onNew}
            />
          ) : null}
          {openAction === "import-file" ? (
            <ImportKnowledgePopup
              availability={availability.importFile}
              onImport={onImport}
            />
          ) : null}
          {openAction === "draft-review" ? (
            <DraftReviewPopup
              availability={availability.draftReview}
              draftSummary={draftSummary}
              onDraftReview={onDraftReview}
            />
          ) : null}
          {openAction === "manage-skills" ? (
            <ManageSkillsPopup
              availability={availability.manageSkills}
              onManageSkills={onManageSkills}
              skillsCount={skills.length}
            />
          ) : null}
          {openAction === "help-legend" ? (
            <HelpLegendPopup />
          ) : null}
        </article>
      </WidgetPopupShell>
    </>
  );
}

function NewKnowledgePopup({
  availability,
  onNew,
}: {
  readonly availability: KnowledgeV2ActionAvailability;
  readonly onNew?: () => void;
}) {
  return (
    <section className="knowledge-v2-action-popup-body">
      <ActionAvailabilityPanel availability={availability} label="New" />
      <p>
        Opening this popup does not create a Knowledge item. Choose an explicit
        creation path when the existing production flow is available.
      </p>
      <div className="knowledge-v2-action-options">
        <ActionOption
          description="Create a plain-text or Markdown Knowledge Document through the current Knowledge / Skills editor."
          status={
            onNew ? "Available through existing flow" : "Unavailable in KnowledgeV2"
          }
          title="New document"
        />
        <ActionOption
          description="Create a reusable Skill record through the current Knowledge / Skills editor."
          status={
            onNew ? "Available through existing flow" : "Unavailable in KnowledgeV2"
          }
          title="New skill"
        />
        <ActionOption
          description="Runbook/procedure authoring is not a current KnowledgeV2 model path."
          status="Coming soon"
          title="New runbook/procedure"
        />
      </div>
      {availability.state !== "unavailable" && onNew ? (
        <Button onClick={onNew} variant="secondary">
          Open existing create flow
        </Button>
      ) : (
        <UnavailableAction
          label="Open existing create flow"
          reason="Creation is unavailable because KnowledgeV2 did not receive an explicit create-flow callback."
        />
      )}
    </section>
  );
}

function ImportKnowledgePopup({
  availability,
  onImport,
}: {
  readonly availability: KnowledgeV2ActionAvailability;
  readonly onImport?: () => void;
}) {
  return (
    <section className="knowledge-v2-action-popup-body">
      <ActionAvailabilityPanel availability={availability} label="Import" />
      <p>
        Import remains explicit and single-file only in the existing production
        Knowledge / Skills flow. Opening this popup does not read or import a
        file.
      </p>
      <div className="knowledge-v2-action-options">
        <ActionOption
          description="File picker and drag-drop import are not wired in the KnowledgeV2 shell yet."
          status="Unavailable in KnowledgeV2"
          title="Choose or drop a text/Markdown file"
        />
        <ActionOption
          description="Use the current Knowledge / Skills import path for an explicit .txt, .md, or .markdown file."
          status={
            onImport
              ? "Available through existing flow"
              : "Unavailable in KnowledgeV2"
          }
          title="Existing single-file import"
        />
        <ActionOption
          description="Raw path entry is not exposed by KnowledgeV2. Use it only where the current production flow already supports it."
          status="Advanced fallback unavailable here"
          title="Raw path fallback"
        />
      </div>
      <p className="knowledge-v2-action-note">
        KnowledgeV2 has no direct file picker or raw path input in this popup
        yet. Use the existing import flow when available; this popup never
        reads a local file by itself.
      </p>
      {availability.state !== "unavailable" && onImport ? (
        <Button onClick={onImport} variant="secondary">
          Open existing import flow
        </Button>
      ) : (
        <UnavailableAction
          label="Open existing import flow"
          reason="Import is unavailable because KnowledgeV2 did not receive an explicit import-flow callback."
        />
      )}
    </section>
  );
}

function DraftReviewPopup({
  availability,
  draftSummary,
  onDraftReview,
}: {
  readonly availability: KnowledgeV2ActionAvailability;
  readonly draftSummary: ReturnType<typeof buildDraftSummary>;
  readonly onDraftReview?: () => void;
}) {
  return (
    <section className="knowledge-v2-action-popup-body">
      <ActionAvailabilityPanel availability={availability} label="Draft Review" />
      <p>
        Draft review stays outside the default catalog browsing view. This
        summary uses visible catalog records only.
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
      <p className="knowledge-v2-action-note">
        Full draft review and acceptance stay in the production Knowledge /
        Skills review surface. Raw draft contents are not shown in this catalog
        browser.
      </p>
      {availability.state !== "unavailable" && onDraftReview ? (
        <Button onClick={onDraftReview} variant="secondary">
          Open existing draft review flow
        </Button>
      ) : (
        <UnavailableAction
          label="Open existing draft review flow"
          reason={
            availability.reason ??
            "Draft review management is unavailable because KnowledgeV2 did not receive an explicit draft-review callback."
          }
        />
      )}
    </section>
  );
}

function ManageSkillsPopup({
  availability,
  onManageSkills,
  skillsCount,
}: {
  readonly availability: KnowledgeV2ActionAvailability;
  readonly onManageSkills?: () => void;
  readonly skillsCount: number;
}) {
  return (
    <section className="knowledge-v2-action-popup-body">
      <ActionAvailabilityPanel availability={availability} label="Manage Skills" />
      <p>
        KnowledgeV2 currently treats {skillsCount.toString()} Skill item
        {skillsCount === 1 ? "" : "s"} as catalog entries and filters. Skill
        editing remains in the production Knowledge / Skills surface.
      </p>
      <div className="knowledge-v2-action-options">
        <ActionOption
          description="Skill CRUD is still owned by the current Knowledge / Skills widget."
          status={
            onManageSkills
              ? "Available through existing flow"
              : "Unavailable in KnowledgeV2"
          }
          title="Skill records"
        />
        <ActionOption
          description="Skill categories are visible only as tags and filters in this experimental surface."
          status="Placeholder"
          title="Categories"
        />
        <ActionOption
          description="Reusable Skill templates are not implemented in KnowledgeV2."
          status="Coming soon"
          title="Templates"
        />
        <ActionOption
          description="Validation is shown from existing Skill text fields; no validator or execution path is added."
          status="Read-only summary"
          title="Validation"
        />
      </div>
      {availability.state !== "unavailable" && onManageSkills ? (
        <Button onClick={onManageSkills} variant="secondary">
          Open existing skills flow
        </Button>
      ) : (
        <UnavailableAction
          label="Open existing skills flow"
          reason="Skill management is unavailable because KnowledgeV2 did not receive an explicit Skill-management callback."
        />
      )}
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
      {availability.reason ? <p>{availability.reason}</p> : null}
      {availability.details && availability.details.length > 0 ? (
        <ul className="knowledge-v2-action-bridge-list">
          {availability.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function UnavailableAction({
  label,
  reason,
}: {
  readonly label: string;
  readonly reason: string;
}) {
  return (
    <div className="knowledge-v2-action-status">
      <Button disabled={true} title={reason} variant="secondary">
        {label}
      </Button>
      <p>{reason}</p>
    </div>
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
    <section className="knowledge-v2-action-popup-body">
      <p>
        This popup replaces persistent helper rails so the catalog and preview
        stay visible and stable.
      </p>
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
      <p className="knowledge-v2-action-note">
        Context actions are always explicit and target-based. Selection,
        filtering, previewing, and opening help do not attach, send, create, or
        run anything.
      </p>
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
