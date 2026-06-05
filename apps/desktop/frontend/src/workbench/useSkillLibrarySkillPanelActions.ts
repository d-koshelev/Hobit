import { useRef, useState } from "react";
import type { Skill } from "../workspace/types";
import type { SkillDraft } from "./skillLibraryModel";
import type { SkillLibrarySkillsPanelStartupAction } from "./SkillLibrarySkillsPanel";

type UseSkillLibrarySkillPanelActionsParams = {
  setActiveUtilityPanel: (panel: "skills" | null) => void;
  setCatalogView: (view: "skills") => void;
  setDocumentMessage: (message: string | null) => void;
};

export type SkillImportDraftRequest = {
  draft: SkillDraft;
  fileName: string;
};

export function useSkillLibrarySkillPanelActions({
  setActiveUtilityPanel,
  setCatalogView,
  setDocumentMessage,
}: UseSkillLibrarySkillPanelActionsParams) {
  const actionCounterRef = useRef(0);
  const [skillPanelStartupAction, setSkillPanelStartupAction] =
    useState<SkillLibrarySkillsPanelStartupAction | null>(null);

  function nextSkillPanelActionId() {
    actionCounterRef.current += 1;
    return actionCounterRef.current;
  }

  function openSkillsPanel() {
    setActiveUtilityPanel("skills");
  }

  function openSelectedSkillInSkillsPanel(selectedSkill: Skill | null) {
    if (selectedSkill) {
      setSkillPanelStartupAction({
        actionId: nextSkillPanelActionId(),
        kind: "select",
        skillId: selectedSkill.skillId,
      });
    }
    openSkillsPanel();
  }

  function startNewSkill() {
    setCatalogView("skills");
    setSkillPanelStartupAction({
      actionId: nextSkillPanelActionId(),
      kind: "new",
    });
    openSkillsPanel();
  }

  function showSkillsInCatalog() {
    setCatalogView("skills");
    setActiveUtilityPanel(null);
    setDocumentMessage(
      "Skills are shown in the unified catalog. Select a Skill to edit it or use New skill to create one.",
    );
  }

  function loadSkillImportDraft({ draft, fileName }: SkillImportDraftRequest) {
    setCatalogView("skills");
    setSkillPanelStartupAction({
      actionId: nextSkillPanelActionId(),
      draft,
      kind: "import",
      sourceFileName: fileName,
    });
    openSkillsPanel();
  }

  return {
    loadSkillImportDraft,
    openSelectedSkillInSkillsPanel,
    showSkillsInCatalog,
    skillPanelStartupAction,
    startNewSkill,
  };
}
