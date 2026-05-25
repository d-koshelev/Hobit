import { useEffect, useId, useMemo, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { EmptyState } from "../design-system/EmptyState";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { Skill, SkillReviewStatus } from "../workspace/types";
import type { WidgetRenderProps } from "./types";

const DEFAULT_SKILL_TITLE = "Untitled skill";
const REVIEW_STATUS_OPTIONS: Array<{
  label: string;
  value: SkillReviewStatus;
}> = [
  { label: "Draft", value: "draft" },
  { label: "Needs review", value: "needs_review" },
  { label: "Reviewed", value: "reviewed" },
  { label: "Deprecated", value: "deprecated" },
];

type SkillDraft = {
  skillId: string | null;
  title: string;
  whenToUse: string;
  prerequisites: string;
  steps: string;
  validation: string;
  risks: string;
  tags: string;
  reviewStatus: SkillReviewStatus;
};

const EMPTY_DRAFT: SkillDraft = {
  skillId: null,
  title: DEFAULT_SKILL_TITLE,
  whenToUse: "",
  prerequisites: "",
  steps: "",
  validation: "",
  risks: "",
  tags: "",
  reviewStatus: "draft",
};

export function SkillLibraryWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onCreateSkill,
  onDeleteSkill,
  onGetSkill,
  onListSkills,
  onLoadLogs,
  onStartFrameMove,
  onUpdateSkill,
  title,
}: WidgetRenderProps) {
  const titleInputId = useId();
  const whenToUseInputId = useId();
  const prerequisitesInputId = useId();
  const stepsInputId = useId();
  const validationInputId = useId();
  const risksInputId = useId();
  const tagsInputId = useId();
  const statusInputId = useId();
  const apiAvailable = Boolean(
    onCreateSkill && onDeleteSkill && onGetSkill && onListSkills && onUpdateSkill,
  );
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [draft, setDraft] = useState<SkillDraft>(EMPTY_DRAFT);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isNewDraft = !draft.skillId;
  const isDirty = useMemo(
    () =>
      isNewDraft
        ? hasDraftContent(draft)
        : Boolean(
            selectedSkill &&
              (draft.title !== selectedSkill.title ||
                draft.whenToUse !== selectedSkill.whenToUse ||
                draft.prerequisites !== selectedSkill.prerequisites ||
                draft.steps !== selectedSkill.steps ||
                draft.validation !== selectedSkill.validation ||
                draft.risks !== selectedSkill.risks ||
                draft.tags !== selectedSkill.tags ||
                draft.reviewStatus !== selectedSkill.reviewStatus),
          ),
    [draft, isNewDraft, selectedSkill],
  );

  useEffect(() => {
    void loadSkills(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiAvailable]);

  async function loadSkills(preferredSkillId: string | null) {
    if (!apiAvailable || !onListSkills || !onGetSkill) {
      setSkills([]);
      clearDraft();
      setError("Skill Library API is not available in this runtime.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const loadedSkills = await onListSkills();
      setSkills(loadedSkills);
      const preferredExists = loadedSkills.some(
        (skill) => skill.skillId === preferredSkillId,
      );
      const skillIdToSelect = preferredExists
        ? preferredSkillId
        : loadedSkills[0]?.skillId;

      if (!skillIdToSelect) {
        clearDraft();
        return;
      }

      const detail = await onGetSkill(skillIdToSelect);
      if (!detail) {
        clearDraft();
        setError("The selected skill could not be found.");
        return;
      }

      setSelectedDraft(detail);
    } catch (loadError) {
      setSkills([]);
      clearDraft();
      setError(errorToMessage(loadError, "Unable to load skills."));
    } finally {
      setIsLoading(false);
    }
  }

  function startNewSkill() {
    if (isDirty) {
      setMessage("Save or discard the current skill before creating another.");
      return;
    }

    setSelectedSkill(null);
    setDraft({ ...EMPTY_DRAFT });
    setMessage(null);
    setError(null);
  }

  async function selectSkill(skillId: string) {
    if (!onGetSkill || selectedSkill?.skillId === skillId || isSelecting) {
      return;
    }

    if (isDirty) {
      setMessage("Save or discard the current skill before selecting another.");
      return;
    }

    setIsSelecting(true);
    setMessage(null);
    setError(null);

    try {
      const detail = await onGetSkill(skillId);
      if (!detail) {
        setError("The selected skill could not be found.");
        return;
      }

      setSelectedDraft(detail);
      setSkills((currentSkills) =>
        currentSkills.map((skill) =>
          skill.skillId === detail.skillId ? detail : skill,
        ),
      );
    } catch (selectError) {
      setError(errorToMessage(selectError, "Unable to open skill."));
    } finally {
      setIsSelecting(false);
    }
  }

  async function saveSkill() {
    if (!onCreateSkill || !onUpdateSkill || isSaving) {
      return;
    }

    const title = draft.title.trim();
    if (!title) {
      setMessage("Title is required before saving.");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const request = {
        title,
        whenToUse: draft.whenToUse,
        prerequisites: draft.prerequisites,
        steps: draft.steps,
        validation: draft.validation,
        risks: draft.risks,
        tags: draft.tags,
        reviewStatus: draft.reviewStatus,
      };
      const savedSkill = draft.skillId
        ? await onUpdateSkill({ skillId: draft.skillId, ...request })
        : await onCreateSkill(request);

      if (!savedSkill) {
        setError("The selected skill could not be found.");
        return;
      }

      setSelectedDraft(savedSkill);
      await loadSkills(savedSkill.skillId);
      setMessage("Skill saved.");
    } catch (saveError) {
      setError(errorToMessage(saveError, "Unable to save skill."));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteSelectedSkill() {
    if (!draft.skillId || !onDeleteSkill || isDeleting) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${draft.title.trim() || DEFAULT_SKILL_TITLE}" from this workspace?`,
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setMessage(null);
    setError(null);

    try {
      const deleted = await onDeleteSkill({ skillId: draft.skillId });
      if (!deleted) {
        setError("The selected skill could not be found.");
        return;
      }

      await loadSkills(null);
      setMessage("Skill deleted.");
    } catch (deleteError) {
      setError(errorToMessage(deleteError, "Unable to delete skill."));
    } finally {
      setIsDeleting(false);
    }
  }

  function discardDraft() {
    if (selectedSkill) {
      setSelectedDraft(selectedSkill);
    } else {
      setDraft({ ...EMPTY_DRAFT });
    }
    setMessage(null);
    setError(null);
  }

  function setSelectedDraft(skill: Skill) {
    setSelectedSkill(skill);
    setDraft({
      skillId: skill.skillId,
      title: skill.title,
      whenToUse: skill.whenToUse,
      prerequisites: skill.prerequisites,
      steps: skill.steps,
      validation: skill.validation,
      risks: skill.risks,
      tags: skill.tags,
      reviewStatus: skill.reviewStatus,
    });
  }

  function clearDraft() {
    setSelectedSkill(null);
    setDraft({ ...EMPTY_DRAFT });
  }

  const statusBadge = (
    <Badge variant={statusVariant(draft.reviewStatus)}>
      {statusLabel(draft.reviewStatus)}
    </Badge>
  );

  return (
    <WidgetFrame
      actions={
        <>
          <Button
            disabled={!apiAvailable || isLoading}
            onClick={startNewSkill}
            variant="secondary"
          >
            New skill
          </Button>
          {frameActions}
        </>
      }
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      status={statusBadge}
      style={frameStyle}
      title={title}
    >
      <div className="skill-library-shell">
        <div className="skill-library-summary">
          <span>Workspace-local.</span>
          <span>Not sent to Coordinator automatically.</span>
          <span>Future attach/share will be explicit.</span>
        </div>

        {isLoading ? (
          <EmptyState
            text="Workspace-local skills are loading from desktop storage."
            title="Loading skills."
          />
        ) : error && skills.length === 0 ? (
          <EmptyState text={error} title="Skills unavailable." />
        ) : (
          <div className="skill-library-layout">
            <aside className="skill-list-pane" aria-label="Skills">
              {skills.length === 0 ? (
                <EmptyState
                  text="Create the first reusable operator-authored skill for this workspace."
                  title="No skills yet."
                />
              ) : (
                <div className="skill-list">
                  {skills.map((skill) => (
                    <button
                      className={[
                        "skill-list-row",
                        selectedSkill?.skillId === skill.skillId
                          ? "skill-list-row-selected"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={isSelecting}
                      key={skill.skillId}
                      onClick={() => void selectSkill(skill.skillId)}
                      type="button"
                    >
                      <span className="skill-list-title">{skill.title}</span>
                      <span className="skill-list-meta">
                        {statusLabel(skill.reviewStatus)}
                        {skill.tags ? ` - ${skill.tags}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </aside>

            <section className="skill-editor-pane" aria-label="Selected skill">
              <div className="skill-editor">
                <label className="skill-field skill-field-wide">
                  <span>Title</span>
                  <input
                    className="input"
                    id={titleInputId}
                    onChange={(event) =>
                      setDraftField("title", event.currentTarget.value)
                    }
                    placeholder={DEFAULT_SKILL_TITLE}
                    value={draft.title}
                  />
                </label>

                <label className="skill-field">
                  <span>Review status</span>
                  <select
                    className="input"
                    id={statusInputId}
                    onChange={(event) =>
                      setDraftField(
                        "reviewStatus",
                        event.currentTarget.value as SkillReviewStatus,
                      )
                    }
                    value={draft.reviewStatus}
                  >
                    {REVIEW_STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="skill-field">
                  <span>Tags</span>
                  <input
                    className="input"
                    id={tagsInputId}
                    onChange={(event) =>
                      setDraftField("tags", event.currentTarget.value)
                    }
                    placeholder="review, deploy"
                    value={draft.tags}
                  />
                </label>

                <SkillTextArea
                  id={whenToUseInputId}
                  label="When to use"
                  onChange={(value) => setDraftField("whenToUse", value)}
                  value={draft.whenToUse}
                />
                <SkillTextArea
                  id={prerequisitesInputId}
                  label="Prerequisites"
                  onChange={(value) => setDraftField("prerequisites", value)}
                  value={draft.prerequisites}
                />
                <SkillTextArea
                  id={stepsInputId}
                  label="Steps"
                  onChange={(value) => setDraftField("steps", value)}
                  value={draft.steps}
                />
                <SkillTextArea
                  id={validationInputId}
                  label="Validation"
                  onChange={(value) => setDraftField("validation", value)}
                  value={draft.validation}
                />
                <SkillTextArea
                  id={risksInputId}
                  label="Risks"
                  onChange={(value) => setDraftField("risks", value)}
                  value={draft.risks}
                />

                <div className="skill-editor-actions">
                  <Button
                    disabled={!apiAvailable || !isDirty || isSaving || isDeleting}
                    onClick={() => void saveSkill()}
                    variant="primary"
                  >
                    {isSaving ? "Saving" : "Save skill"}
                  </Button>
                  <Button
                    disabled={!isDirty || isSaving || isDeleting}
                    onClick={discardDraft}
                    variant="secondary"
                  >
                    Discard
                  </Button>
                  <Button
                    disabled={!draft.skillId || isSaving || isDeleting}
                    onClick={() => void deleteSelectedSkill()}
                    variant="ghost"
                  >
                    {isDeleting ? "Deleting" : "Delete"}
                  </Button>
                </div>

                {message ? <p className="skill-message">{message}</p> : null}
                {error ? (
                  <p className="skill-message skill-message-error" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        )}
      </div>
    </WidgetFrame>
  );

  function setDraftField<Key extends keyof SkillDraft>(
    key: Key,
    value: SkillDraft[Key],
  ) {
    setDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
    setMessage(null);
    setError(null);
  }
}

function SkillTextArea({
  id,
  label,
  onChange,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="skill-field skill-field-wide">
      <span>{label}</span>
      <textarea
        className="input skill-textarea"
        id={id}
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      />
    </label>
  );
}

function hasDraftContent(draft: SkillDraft) {
  return Boolean(
    draft.title.trim() !== DEFAULT_SKILL_TITLE ||
      draft.whenToUse.trim() ||
      draft.prerequisites.trim() ||
      draft.steps.trim() ||
      draft.validation.trim() ||
      draft.risks.trim() ||
      draft.tags.trim(),
  );
}

function statusLabel(status: SkillReviewStatus) {
  return REVIEW_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function statusVariant(status: SkillReviewStatus) {
  switch (status) {
    case "reviewed":
      return "success";
    case "needs_review":
      return "warning";
    case "deprecated":
      return "neutral";
    case "draft":
    default:
      return "info";
  }
}

function errorToMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
