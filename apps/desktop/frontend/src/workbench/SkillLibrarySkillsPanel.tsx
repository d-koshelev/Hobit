import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "../design-system/Button";
import { EmptyState } from "../design-system/EmptyState";
import type { Skill, SkillReviewStatus } from "../workspace/types";
import {
  DEFAULT_SKILL_TITLE,
  EMPTY_SKILL_DRAFT,
  REVIEW_STATUS_OPTIONS,
  isSkillDraftDirty,
  skillCoordinatorContextText,
  skillDraftFromSkill,
  statusLabel,
  type SkillDraft,
} from "./skillLibraryModel";
import type { WidgetRenderProps } from "./types";

export type SkillLibrarySkillsPanelHandle = {
  startNewSkill: () => void;
  selectSkill: (skillId: string) => Promise<void>;
};

export type SkillLibrarySkillsPanelStartupAction =
  | {
      actionId: number;
      kind: "import";
      draft: SkillDraft;
      sourceFileName: string;
    }
  | {
      actionId: number;
      kind: "new";
    }
  | {
      actionId: number;
      kind: "select";
      skillId: string;
    };

export type SkillLibrarySkillsToolbarState = {
  isNewDisabled: boolean;
  reviewStatus: SkillReviewStatus;
};

type SkillLibrarySkillsPanelProps = {
  catalogEditorMode?: boolean;
  isActive: boolean;
  onAttachContextToCoordinator: WidgetRenderProps["onAttachContextToCoordinator"];
  onAttachKnowledgeContextToQueueTask: WidgetRenderProps["onAttachKnowledgeContextToQueueTask"];
  onCreateSkill: WidgetRenderProps["onCreateSkill"];
  onDeleteSkill: WidgetRenderProps["onDeleteSkill"];
  onGetSkill: WidgetRenderProps["onGetSkill"];
  onListSkills: WidgetRenderProps["onListSkills"];
  onSkillsChanged?: () => void;
  onToolbarStateChange: (state: SkillLibrarySkillsToolbarState) => void;
  onUpdateSkill: WidgetRenderProps["onUpdateSkill"];
  startupAction?: SkillLibrarySkillsPanelStartupAction | null;
};

export const SkillLibrarySkillsPanel = forwardRef<
  SkillLibrarySkillsPanelHandle,
  SkillLibrarySkillsPanelProps
>(function SkillLibrarySkillsPanel(
  {
    catalogEditorMode = false,
    isActive,
    onAttachContextToCoordinator,
    onAttachKnowledgeContextToQueueTask,
    onCreateSkill,
    onDeleteSkill,
    onGetSkill,
    onListSkills,
    onSkillsChanged,
    onToolbarStateChange,
    onUpdateSkill,
    startupAction,
  },
  ref,
) {
  const handledStartupActionIdRef = useRef<number | null>(null);
  const apiAvailable = Boolean(
    onCreateSkill && onDeleteSkill && onGetSkill && onListSkills && onUpdateSkill,
  );
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [draft, setDraft] = useState<SkillDraft>({ ...EMPTY_SKILL_DRAFT });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isDirty = useMemo(
    () => isSkillDraftDirty(draft, selectedSkill),
    [draft, selectedSkill],
  );
  const canAttachToCoordinator = Boolean(
    selectedSkill && !isDirty && onAttachContextToCoordinator,
  );
  const canAttachToQueueTask = Boolean(
    selectedSkill && !isDirty && onAttachKnowledgeContextToQueueTask,
  );

  useEffect(() => {
    void loadSkills(null);
  }, [apiAvailable]);

  useEffect(() => {
    onToolbarStateChange({
      isNewDisabled: !apiAvailable || isLoading,
      reviewStatus: draft.reviewStatus,
    });
  }, [apiAvailable, draft.reviewStatus, isLoading, onToolbarStateChange]);

  useImperativeHandle(ref, () => ({
    selectSkill,
    startNewSkill,
  }));

  useEffect(() => {
    if (
      !isActive ||
      isLoading ||
      !startupAction ||
      handledStartupActionIdRef.current === startupAction.actionId
    ) {
      return;
    }

    handledStartupActionIdRef.current = startupAction.actionId;

    if (startupAction.kind === "new") {
      startNewSkill();
      return;
    }

    if (startupAction.kind === "select") {
      void selectSkill(startupAction.skillId);
      return;
    }

    loadImportedSkillDraft(startupAction.draft, startupAction.sourceFileName);
  }, [isActive, isLoading, startupAction]);

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
    setDraft({ ...EMPTY_SKILL_DRAFT });
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
      onSkillsChanged?.();
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
      onSkillsChanged?.();
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
      setDraft({ ...EMPTY_SKILL_DRAFT });
    }
    setMessage(null);
    setError(null);
  }

  function loadImportedSkillDraft(importedDraft: SkillDraft, sourceFileName: string) {
    if (isDirty) {
      setMessage("Save or discard the current skill before loading an imported draft.");
      return;
    }

    setSelectedSkill(null);
    setDraft(importedDraft);
    setMessage(
      `Loaded ${sourceFileName} as an unsaved Skill draft. Review and save it before attaching or using it.`,
    );
    setError(null);
  }

  function attachSelectedSkillToCoordinator() {
    if (!selectedSkill || isDirty || !onAttachContextToCoordinator) {
      return;
    }

    onAttachContextToCoordinator({
      contextText: skillCoordinatorContextText(selectedSkill),
      sourceLabel: "Skill Library / Skill",
    });
    setMessage("Skill attached to Workspace Agent as visible context.");
    setError(null);
  }

  async function attachSelectedSkillToQueueTask() {
    if (!selectedSkill || isDirty || !onAttachKnowledgeContextToQueueTask) {
      return;
    }

    const result = await Promise.resolve(onAttachKnowledgeContextToQueueTask({
        kind: "skill",
        skill: selectedSkill,
      })).catch((attachError) => ({
        message:
          attachError instanceof Error
            ? attachError.message
            : "Unable to attach Skill to the selected Queue task.",
        status: "unavailable" as const,
      }));
    setMessage(result.message);
    setError(result.status === "blocked" ? result.message : null);
  }

  function setSelectedDraft(skill: Skill) {
    setSelectedSkill(skill);
    setDraft(skillDraftFromSkill(skill));
  }

  function clearDraft() {
    setSelectedSkill(null);
    setDraft({ ...EMPTY_SKILL_DRAFT });
  }

  function setDraftField<Key extends keyof SkillDraft>(
    key: Key,
    value: SkillDraft[Key],
  ) {
    setDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
    setMessage(null);
    setError(null);
  }

  return (
    <div
      className="skill-library-tab-panel"
      hidden={!isActive}
      role="region"
      aria-label="Skill records editor"
    >
      <div className="skill-library-summary skill-library-summary-secondary">
        <span>Operator-authored procedures.</span>
        <span>
          Skills are not sent to Workspace Agent unless explicitly attached.
        </span>
      </div>

      {isLoading ? (
        <EmptyState
          text="Workspace-local skills are loading from desktop storage."
          title="Loading skills."
        />
      ) : error && skills.length === 0 ? (
        <EmptyState text={error} title="Skills unavailable." />
      ) : (
        <div
          className={
            catalogEditorMode
              ? "skill-library-layout skill-library-layout-editor-only"
              : "skill-library-layout"
          }
        >
          {catalogEditorMode ? null : (
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
          )}

          <section className="skill-editor-pane" aria-label="Selected skill">
            <div className="skill-editor">
              <label className="skill-field skill-field-wide">
                <span>Title</span>
                <input
                  className="input"
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
                  onChange={(event) =>
                    setDraftField("tags", event.currentTarget.value)
                  }
                  placeholder="review, deploy"
                  value={draft.tags}
                />
              </label>

              <SkillTextArea
                label="When to use"
                onChange={(value) => setDraftField("whenToUse", value)}
                value={draft.whenToUse}
              />
              <SkillTextArea
                label="Prerequisites"
                onChange={(value) => setDraftField("prerequisites", value)}
                value={draft.prerequisites}
              />
              <SkillTextArea
                label="Steps"
                onChange={(value) => setDraftField("steps", value)}
                value={draft.steps}
              />
              <SkillTextArea
                label="Validation"
                onChange={(value) => setDraftField("validation", value)}
                value={draft.validation}
              />
              <SkillTextArea
                label="Risks"
                onChange={(value) => setDraftField("risks", value)}
                value={draft.risks}
              />

              <div className="skill-editor-actions">
                {onAttachContextToCoordinator ? (
                  <Button
                    disabled={!canAttachToCoordinator || isSaving || isDeleting}
                    onClick={attachSelectedSkillToCoordinator}
                    title={
                      isDirty
                        ? "Save this Skill before attaching it to Workspace Agent."
                        : "Shares this saved Skill with Workspace Agent. Does not send automatically."
                    }
                    variant="secondary"
                  >
                    Attach to Workspace Agent
                  </Button>
                ) : null}
                {onAttachKnowledgeContextToQueueTask ? (
                  <Button
                    disabled={!canAttachToQueueTask || isSaving || isDeleting}
                    onClick={() => void attachSelectedSkillToQueueTask()}
                    title={
                      isDirty
                        ? "Save this Skill before attaching it to a Queue task."
                        : "Attaches this saved Skill to the selected Queue task as a safe ref and summary. Does not run automatically."
                    }
                    variant="secondary"
                  >
                    Attach to Queue task
                  </Button>
                ) : null}
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
              <p className="skill-attach-note">
                {onAttachKnowledgeContextToQueueTask
                  ? "Attach uses the last saved Skill. Save edits before attaching. Queue attachment stores refs and summaries only; no work starts automatically."
                  : onAttachContextToCoordinator
                    ? "Attach uses the last saved Skill. Save edits before attaching. Does not send automatically."
                    : "Add Workspace Agent to attach saved Skills as visible context."}
              </p>

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
  );
});

function SkillTextArea({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="skill-field skill-field-wide">
      <span>{label}</span>
      <textarea
        className="input skill-textarea"
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      />
    </label>
  );
}

function errorToMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
