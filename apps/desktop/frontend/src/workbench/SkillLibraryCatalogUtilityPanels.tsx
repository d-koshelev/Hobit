import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from "react";
import { Button } from "../design-system/Button";
import type { KnowledgeDocument, Skill } from "../workspace/types";
import { CatalogDocumentEditor } from "./SkillLibraryCatalogPreview";
import type { KnowledgeDraftReviewItem, KnowledgeDraftReviewPack } from "./knowledgeDraftPacks";
import type {
  KnowledgeCatalogAttachmentState,
  KnowledgeCatalogListItem,
  KnowledgeDocumentDraft,
} from "./skillLibraryModel";
import { SkillLibraryDocumentImportControls } from "./SkillLibraryDocumentImportControls";
import { SkillLibraryDraftReviewPanel } from "./SkillLibraryDraftReviewPanel";
import {
  SkillLibrarySkillsPanel,
  type SkillLibrarySkillsPanelHandle,
  type SkillLibrarySkillsPanelStartupAction,
} from "./SkillLibrarySkillsPanel";
import type { SkillLibraryImportTarget } from "./useSkillLibraryDocumentImport";
import type { WidgetRenderProps } from "./types";

export type KnowledgeUtilityPanel =
  | "document"
  | "import"
  | "drafts"
  | "skills"
  | null;

type DraftReviewDecision = "accepted" | "pending" | "rejected";

type SkillLibraryCatalogUtilityPanelsProps = {
  activeUtilityPanel: KnowledgeUtilityPanel;
  attachmentState?: KnowledgeCatalogAttachmentState;
  canAttachKnowledgeContextToQueueTask: boolean;
  canCreateAgentQueueTask: boolean;
  documentApiAvailable: boolean;
  documentDraft: KnowledgeDocumentDraft;
  documentError: string | null;
  documentImportPath: string;
  documentImportScope: KnowledgeDocumentDraft["scope"];
  documentMessage: string | null;
  documents: KnowledgeDocument[];
  draftPayload: string;
  draftReviewDecisions: Record<string, DraftReviewDecision>;
  draftReviewPack: KnowledgeDraftReviewPack | null;
  hasImportFileApi: boolean;
  importTarget: SkillLibraryImportTarget;
  importPickerAvailable: boolean;
  isAcceptingDraftItem: boolean;
  isCreatingRefreshTask: boolean;
  isDeletingDocument: boolean;
  isDocumentDirty: boolean;
  isImportingDocument: boolean;
  isSavingDocument: boolean;
  selectedCatalogItem: KnowledgeCatalogListItem | null;
  selectedDocument: KnowledgeDocument | null;
  skills: Skill[];
  onAcceptDraftItem: (item: KnowledgeDraftReviewItem) => void;
  onArchiveDocument: () => void;
  onAttachDocumentToQueueTask: () => void;
  onAttachContextToCoordinator: WidgetRenderProps["onAttachContextToCoordinator"];
  onAttachKnowledgeContextToQueueTask: WidgetRenderProps["onAttachKnowledgeContextToQueueTask"];
  onClearDraftReviewPayload: () => void;
  onCloseUtilityPanel: () => void;
  onCreateRefreshTask: () => void;
  onCreateSkill: WidgetRenderProps["onCreateSkill"];
  onDeleteDocument: () => void;
  onDeleteSkill: WidgetRenderProps["onDeleteSkill"];
  onDiscardDraft: () => void;
  onDocumentImportScopeChange: (scope: KnowledgeDocument["scope"]) => void;
  onDraftPayloadChange: (payload: string) => void;
  onImportTargetChange: (target: SkillLibraryImportTarget) => void;
  onImportBrowserFileSelected: (file: File | null) => void;
  onGetSkill: WidgetRenderProps["onGetSkill"];
  onListSkills: WidgetRenderProps["onListSkills"];
  onLoadDraftReviewPayload: () => void;
  onLoadSelectedImportFile: () => void;
  onMarkStale: () => void;
  onPickImportFile: () => void;
  onRejectDraftItem: (item: KnowledgeDraftReviewItem) => void;
  onRestoreDocument: () => void;
  onSaveDocument: () => void;
  onShowSkillsInCatalog: () => void;
  onSetDocumentDraftField: <Key extends keyof KnowledgeDocumentDraft>(
    key: Key,
    value: KnowledgeDocumentDraft[Key],
  ) => void;
  onSkillsChanged: () => void;
  onStartNewDocument: () => void;
  onStartNewSkill: () => void;
  onToggleUtilityPanel: (panel: Exclude<KnowledgeUtilityPanel, null>) => void;
  onUpdateSkill: WidgetRenderProps["onUpdateSkill"];
  skillCreateAvailable: boolean;
  skillPanelStartupAction: SkillLibrarySkillsPanelStartupAction | null;
  skillsPanelRef: Ref<SkillLibrarySkillsPanelHandle>;
};

type DrawerDrag = {
  offsetX: number;
  offsetY: number;
};

export function SkillLibraryCatalogUtilityPanels({
  activeUtilityPanel,
  attachmentState,
  canAttachKnowledgeContextToQueueTask,
  canCreateAgentQueueTask,
  documentApiAvailable,
  documentDraft,
  documentError,
  documentImportPath,
  documentImportScope,
  documentMessage,
  documents,
  draftPayload,
  draftReviewDecisions,
  draftReviewPack,
  hasImportFileApi,
  importTarget,
  importPickerAvailable,
  isAcceptingDraftItem,
  isCreatingRefreshTask,
  isDeletingDocument,
  isDocumentDirty,
  isImportingDocument,
  isSavingDocument,
  selectedCatalogItem,
  selectedDocument,
  skills,
  onAcceptDraftItem,
  onArchiveDocument,
  onAttachDocumentToQueueTask,
  onAttachContextToCoordinator,
  onAttachKnowledgeContextToQueueTask,
  onClearDraftReviewPayload,
  onCloseUtilityPanel,
  onCreateRefreshTask,
  onCreateSkill,
  onDeleteDocument,
  onDeleteSkill,
  onDiscardDraft,
  onDocumentImportScopeChange,
  onDraftPayloadChange,
  onImportTargetChange,
  onImportBrowserFileSelected,
  onGetSkill,
  onListSkills,
  onLoadDraftReviewPayload,
  onLoadSelectedImportFile,
  onMarkStale,
  onPickImportFile,
  onRejectDraftItem,
  onRestoreDocument,
  onSaveDocument,
  onShowSkillsInCatalog,
  onSetDocumentDraftField,
  onSkillsChanged,
  onStartNewDocument,
  onStartNewSkill,
  onToggleUtilityPanel,
  onUpdateSkill,
  skillCreateAvailable,
  skillPanelStartupAction,
  skillsPanelRef,
}: SkillLibraryCatalogUtilityPanelsProps) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const drawerDragRef = useRef<DrawerDrag | null>(null);
  const [drawerPosition, setDrawerPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [isDrawerDragging, setIsDrawerDragging] = useState(false);

  useEffect(() => {
    if (!activeUtilityPanel) {
      setDrawerPosition(null);
      setIsDrawerDragging(false);
      drawerDragRef.current = null;
    }
  }, [activeUtilityPanel]);

  useEffect(() => {
    if (!isDrawerDragging) {
      return;
    }

    function moveDrawer(event: PointerEvent) {
      const drag = drawerDragRef.current;
      const drawer = drawerRef.current;

      if (!drag || !drawer) {
        return;
      }

      const rect = drawer.getBoundingClientRect();
      const maxLeft = Math.max(0, window.innerWidth - rect.width);
      const maxTop = Math.max(0, window.innerHeight - rect.height);

      setDrawerPosition({
        left: clamp(event.clientX - drag.offsetX, 0, maxLeft),
        top: clamp(event.clientY - drag.offsetY, 0, maxTop),
      });
    }

    function stopDrawerDrag() {
      drawerDragRef.current = null;
      setIsDrawerDragging(false);
    }

    window.addEventListener("pointermove", moveDrawer);
    window.addEventListener("pointerup", stopDrawerDrag);
    window.addEventListener("pointercancel", stopDrawerDrag);

    return () => {
      window.removeEventListener("pointermove", moveDrawer);
      window.removeEventListener("pointerup", stopDrawerDrag);
      window.removeEventListener("pointercancel", stopDrawerDrag);
    };
  }, [isDrawerDragging]);

  function startDrawerDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!(event.target instanceof Element)) {
      return;
    }

    if (event.target.closest("button,input,select,textarea,a")) {
      return;
    }

    const drawer = drawerRef.current;

    if (!drawer) {
      return;
    }

    const rect = drawer.getBoundingClientRect();
    drawerDragRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    setDrawerPosition({
      left: rect.left,
      top: rect.top,
    });
    setIsDrawerDragging(true);
    event.preventDefault();
  }

  return (
    <>
      <div className="skill-library-panel-actions" aria-label="Catalog actions">
        <Button
          disabled={!documentApiAvailable}
          onClick={onStartNewDocument}
          variant="secondary"
        >
          New item
        </Button>
        <Button
          disabled={!skillCreateAvailable}
          onClick={onStartNewSkill}
          variant={activeUtilityPanel === "skills" ? "primary" : "secondary"}
        >
          New skill
        </Button>
        <Button
          onClick={() => onToggleUtilityPanel("import")}
          variant={activeUtilityPanel === "import" ? "primary" : "secondary"}
        >
          Import file
        </Button>
        <Button
          onClick={() => onToggleUtilityPanel("drafts")}
          variant={activeUtilityPanel === "drafts" ? "primary" : "secondary"}
        >
          Review draft output
        </Button>
        <Button onClick={onShowSkillsInCatalog} variant="secondary">
          Manage skills
        </Button>
      </div>
      {activeUtilityPanel ? (
        <div className="skill-library-drawer-backdrop" data-widget-header-drag-ignore>
          <section
            className={[
              "skill-library-utility-panel",
              "skill-library-drawer",
              drawerPosition ? "skill-library-drawer-moved" : "",
              isDrawerDragging ? "skill-library-drawer-dragging" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={panelAriaLabel(activeUtilityPanel)}
            ref={drawerRef}
            style={drawerStyle(drawerPosition)}
          >
            <div
              className="skill-library-panel-header skill-library-panel-header-draggable"
              onPointerDown={startDrawerDrag}
            >
              <div>
                <p className="skill-list-meta">Secondary flow</p>
                <h3>{panelTitle(activeUtilityPanel, documentDraft)}</h3>
              </div>
              <Button onClick={onCloseUtilityPanel} variant="ghost">
                Close
              </Button>
            </div>
            {activeUtilityPanel === "document" ? (
              <CatalogDocumentEditor
                attachmentState={attachmentState}
                canAttachToQueueTask={Boolean(
                  selectedDocument &&
                    !isDocumentDirty &&
                    canAttachKnowledgeContextToQueueTask,
                )}
                canCreateRefreshTask={Boolean(
                  selectedDocument &&
                    !isDocumentDirty &&
                    canCreateAgentQueueTask &&
                    selectedDocument.sourceRef.trim(),
                )}
                documentApiAvailable={documentApiAvailable}
                documents={documents}
                draft={documentDraft}
                error={documentError}
                isCreatingRefreshTask={isCreatingRefreshTask}
                isDeletingDocument={isDeletingDocument}
                isDirty={isDocumentDirty}
                isSavingDocument={isSavingDocument}
                item={selectedCatalogItem}
                message={documentMessage}
                onArchiveDocument={onArchiveDocument}
                onAttachToQueueTask={onAttachDocumentToQueueTask}
                onCreateRefreshTask={onCreateRefreshTask}
                onDeleteDocument={onDeleteDocument}
                onDiscardDraft={onDiscardDraft}
                onMarkStale={onMarkStale}
                onRestoreDocument={onRestoreDocument}
                onSaveDocument={onSaveDocument}
                onSetDraftField={onSetDocumentDraftField}
                skills={skills}
              />
            ) : null}
            {activeUtilityPanel === "import" ? (
              <SkillLibraryDocumentImportControls
                documentApiAvailable={documentApiAvailable}
                documentImportPath={documentImportPath}
                documentImportScope={documentImportScope}
                hasImportFileApi={hasImportFileApi}
                importPickerAvailable={importPickerAvailable}
                importTarget={importTarget}
                isDeletingDocument={isDeletingDocument}
                isImportingDocument={isImportingDocument}
                isSavingDocument={isSavingDocument}
                onBrowserFileSelected={onImportBrowserFileSelected}
                onDocumentImportScopeChange={onDocumentImportScopeChange}
                onImportTargetChange={onImportTargetChange}
                onLoadSelectedImportFile={onLoadSelectedImportFile}
                onPickImportFile={onPickImportFile}
                skillImportAvailable={skillCreateAvailable}
              />
            ) : null}
            {activeUtilityPanel === "drafts" ? (
              <SkillLibraryDraftReviewPanel
                documentApiAvailable={documentApiAvailable}
                draftPayload={draftPayload}
                draftReviewDecisions={draftReviewDecisions}
                draftReviewPack={draftReviewPack}
                isAcceptingDraftItem={isAcceptingDraftItem}
                onAcceptDraftItem={onAcceptDraftItem}
                onClearDraftReviewPayload={onClearDraftReviewPayload}
                onDraftPayloadChange={onDraftPayloadChange}
                onLoadDraftReviewPayload={onLoadDraftReviewPayload}
                onRejectDraftItem={onRejectDraftItem}
                skillCreateAvailable={skillCreateAvailable}
              />
            ) : null}
            {activeUtilityPanel === "skills" ? (
              <>
                <p className="skill-attach-note">
                  Skill records are listed in the unified catalog. This editor
                  opens only for a selected Skill, a new Skill, or an imported
                  Skill draft.
                </p>
                <SkillLibrarySkillsPanel
                  catalogEditorMode={true}
                  isActive={activeUtilityPanel === "skills"}
                  onAttachContextToCoordinator={onAttachContextToCoordinator}
                  onAttachKnowledgeContextToQueueTask={onAttachKnowledgeContextToQueueTask}
                  onCreateSkill={onCreateSkill}
                  onDeleteSkill={onDeleteSkill}
                  onGetSkill={onGetSkill}
                  onListSkills={onListSkills}
                  onSkillsChanged={onSkillsChanged}
                  onToolbarStateChange={() => undefined}
                  onUpdateSkill={onUpdateSkill}
                  ref={skillsPanelRef}
                  startupAction={skillPanelStartupAction}
                />
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

function panelTitle(
  panel: Exclude<KnowledgeUtilityPanel, null>,
  documentDraft: KnowledgeDocumentDraft,
) {
  switch (panel) {
    case "document":
      return documentDraft.knowledgeDocumentId ? "Edit catalog item" : "New catalog item";
    case "import":
      return "Import file";
    case "drafts":
      return "Review Queue result drafts";
    case "skills":
      return "Skill editor";
  }
}

function panelAriaLabel(panel: Exclude<KnowledgeUtilityPanel, null>) {
  switch (panel) {
    case "document":
      return "Catalog item editor";
    case "import":
      return "Knowledge import";
    case "drafts":
      return "Queue Knowledge draft review";
    case "skills":
      return "Skill editor";
  }
}

function drawerStyle(
  drawerPosition: { left: number; top: number } | null,
): CSSProperties | undefined {
  if (!drawerPosition) {
    return undefined;
  }

  return {
    left: `${drawerPosition.left}px`,
    position: "fixed",
    top: `${drawerPosition.top}px`,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
