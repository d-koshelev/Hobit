import { useEffect, useMemo, useRef, useState } from "react";

import { WidgetDebugPopup } from "../../../design-system";
import type { KnowledgeDocument } from "../../../workspace/types/knowledgeDocuments";
import type { KnowledgeDraftReviewDecision } from "../../../workspace/types/knowledgeDocuments";
import type { Skill } from "../../../workspace/types/skills";
import type { WidgetRenderProps } from "../../types";
import { WidgetV2Shell } from "../WidgetV2Shell";
import {
  KnowledgeV2Actions,
  type KnowledgeV2ActionAvailabilityMap,
} from "./KnowledgeV2Actions";
import { KnowledgeV2CatalogBrowser } from "./KnowledgeV2CatalogBrowser";
import { KnowledgeV2DebugContent } from "./debug/KnowledgeV2DebugContent";
import { buildKnowledgeV2DebugModel } from "./debug/knowledgeV2DebugModel";

export type KnowledgeV2WidgetProps = {
  readonly displaySubtitle?: string;
  readonly displayTitle?: string;
  readonly draftReviews?: readonly KnowledgeDraftReviewDecision[];
  readonly documents?: readonly KnowledgeDocument[];
  readonly onAttachContextToCoordinator?: WidgetRenderProps["onAttachContextToCoordinator"];
  readonly onAttachKnowledgeContextToQueueTask?: WidgetRenderProps["onAttachKnowledgeContextToQueueTask"];
  readonly onDeleteKnowledgeDocument?: WidgetRenderProps["onDeleteKnowledgeDocument"];
  readonly onDeleteSkill?: WidgetRenderProps["onDeleteSkill"];
  readonly onDraftReview?: () => void;
  readonly onImport?: () => void;
  readonly onListKnowledgeDocuments?: WidgetRenderProps["onListKnowledgeDocuments"];
  readonly onListKnowledgeDraftReviews?: WidgetRenderProps["onListKnowledgeDraftReviews"];
  readonly onListSkills?: WidgetRenderProps["onListSkills"];
  readonly onManageSkills?: () => void;
  readonly onNew?: () => void;
  readonly onUpdateKnowledgeDocument?: WidgetRenderProps["onUpdateKnowledgeDocument"];
  readonly skills?: readonly Skill[];
};

export function KnowledgeV2Widget({
  displaySubtitle,
  displayTitle,
  draftReviews,
  documents,
  onAttachContextToCoordinator,
  onAttachKnowledgeContextToQueueTask,
  onDeleteKnowledgeDocument,
  onDeleteSkill,
  onListKnowledgeDocuments,
  onListKnowledgeDraftReviews,
  onListSkills,
  onDraftReview,
  onImport,
  onManageSkills,
  onNew,
  onUpdateKnowledgeDocument,
  skills,
}: KnowledgeV2WidgetProps = {}) {
  const [viewMode, setViewMode] = useState<"cards" | "list">("list");
  const [reloadKey, setReloadKey] = useState(0);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const debugButtonRef = useRef<HTMLButtonElement | null>(null);
  const dataBridge = useKnowledgeV2DataBridge({
    draftReviews,
    documents,
    onListKnowledgeDocuments,
    onListKnowledgeDraftReviews,
    onListSkills,
    reloadKey,
    skills,
  });
  const status = useMemo(
    () => knowledgeV2StatusForBridge(dataBridge),
    [dataBridge],
  );
  const actionAvailability = useMemo(
    () =>
      knowledgeV2ActionAvailability({
        dataBridge,
        onDraftReview,
        onImport,
        onManageSkills,
        onNew,
      }),
    [dataBridge, onDraftReview, onImport, onManageSkills, onNew],
  );
  const debugModel = useMemo(
    () =>
      buildKnowledgeV2DebugModel({
        actionAvailability,
        bridgeState: dataBridge,
        callbackState: {
          onDraftReview: Boolean(onDraftReview),
          onImport: Boolean(onImport),
          onManageSkills: Boolean(onManageSkills),
          onNew: Boolean(onNew),
        },
        documents: dataBridge.documents,
        draftReviews: dataBridge.draftReviews,
        skills: dataBridge.skills,
      }),
    [
      actionAvailability,
      dataBridge,
      onDraftReview,
      onImport,
      onManageSkills,
      onNew,
    ],
  );

  return (
    <WidgetV2Shell
      actions={
        <>
          <KnowledgeV2Actions
            actionAvailability={actionAvailability}
            documents={dataBridge.documents}
            draftReviews={dataBridge.draftReviews}
            onDraftReview={onDraftReview}
            onImport={onImport}
            onManageSkills={onManageSkills}
            onNew={onNew}
            onOpenDebug={() => setIsDebugOpen(true)}
            onViewModeChange={setViewMode}
            debugButtonRef={debugButtonRef}
            skills={dataBridge.skills}
            viewMode={viewMode}
          />
          <WidgetDebugPopup
            onClose={() => setIsDebugOpen(false)}
            open={isDebugOpen}
            returnFocusRef={debugButtonRef}
            title="KnowledgeV2 diagnostics"
          >
            <KnowledgeV2DebugContent model={debugModel} />
          </WidgetDebugPopup>
        </>
      }
      info={{
        content: (
          <div className="knowledge-v2-help-popover">
            <p>
              Browse Knowledge Documents and Skills together. Create, import,
              review, and context actions stay explicit.
            </p>
            {displaySubtitle ? <p>{displaySubtitle}</p> : null}
            {dataBridge.loadError ? (
              <section className="knowledge-v2-help-section">
                <h4>Data issue</h4>
                <p>Some catalog data could not be loaded.</p>
                <button
                  className="knowledge-v2-empty-action"
                  onClick={() => setReloadKey((current) => current + 1)}
                  type="button"
                >
                  Retry data bridge
                </button>
              </section>
            ) : null}
          </div>
        ),
        label: "Knowledge / Skills information",
        title: "Knowledge / Skills",
      }}
      status={status}
      title={displayTitle ?? "Knowledge / Skills"}
    >
      <KnowledgeV2CatalogBrowser
        documents={dataBridge.documents}
        loadError={dataBridge.loadError}
        missingBridges={dataBridge.missingBridges}
        onAttachContextToCoordinator={onAttachContextToCoordinator}
        onAttachKnowledgeContextToQueueTask={onAttachKnowledgeContextToQueueTask}
        onDeleteKnowledgeDocument={onDeleteKnowledgeDocument}
        onDeleteSkill={onDeleteSkill}
        onImport={onImport}
        onRetry={() => setReloadKey((current) => current + 1)}
        onUpdateKnowledgeDocument={onUpdateKnowledgeDocument}
        skills={dataBridge.skills}
        status={dataBridge.status}
        viewMode={viewMode}
      />
    </WidgetV2Shell>
  );
}

type KnowledgeV2DataBridgeInput = {
  readonly draftReviews?: readonly KnowledgeDraftReviewDecision[];
  readonly documents?: readonly KnowledgeDocument[];
  readonly onListKnowledgeDocuments?: WidgetRenderProps["onListKnowledgeDocuments"];
  readonly onListKnowledgeDraftReviews?: WidgetRenderProps["onListKnowledgeDraftReviews"];
  readonly onListSkills?: WidgetRenderProps["onListSkills"];
  readonly reloadKey: number;
  readonly skills?: readonly Skill[];
};

type KnowledgeV2DataBridge = {
  readonly actionMissingBridges: readonly string[];
  readonly documentBridgeAvailable: boolean;
  readonly documents: readonly KnowledgeDocument[];
  readonly draftReviews: readonly KnowledgeDraftReviewDecision[];
  readonly draftReviewBridgeAvailable: boolean;
  readonly draftReviewListActionAvailable: boolean;
  readonly loadError: string | null;
  readonly missingBridges: readonly string[];
  readonly skillBridgeAvailable: boolean;
  readonly skillBridgeIssue: string | null;
  readonly skills: readonly Skill[];
  readonly status: "loading" | "partial" | "ready" | "unavailable";
};

function useKnowledgeV2DataBridge({
  draftReviews,
  documents,
  onListKnowledgeDocuments,
  onListKnowledgeDraftReviews,
  onListSkills,
  reloadKey,
  skills,
}: KnowledgeV2DataBridgeInput): KnowledgeV2DataBridge {
  const [loadedDocuments, setLoadedDocuments] = useState<
    readonly KnowledgeDocument[]
  >([]);
  const [loadedSkills, setLoadedSkills] = useState<readonly Skill[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const documentBridgeAvailable =
    documents !== undefined || onListKnowledgeDocuments !== undefined;
  const skillBridgeAvailable = skills !== undefined || onListSkills !== undefined;
  const draftReviewBridgeAvailable = draftReviews !== undefined;
  const draftReviewListActionAvailable =
    onListKnowledgeDraftReviews !== undefined;

  useEffect(() => {
    let cancelled = false;

    if (documents !== undefined && skills !== undefined) {
      setLoadedDocuments(documents);
      setLoadedSkills(skills);
      setLoadError(null);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (!onListKnowledgeDocuments && !onListSkills) {
      setLoadedDocuments(documents ?? []);
      setLoadedSkills(skills ?? []);
      setLoadError(null);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    setLoadError(null);

    async function loadBridgeData() {
      const [documentResult, skillResult] = await Promise.allSettled([
        documents !== undefined
          ? Promise.resolve(documents)
          : onListKnowledgeDocuments
            ? onListKnowledgeDocuments()
            : Promise.resolve([]),
        skills !== undefined
          ? Promise.resolve(skills)
          : onListSkills
            ? onListSkills()
            : Promise.resolve([]),
      ]);

      if (cancelled) {
        return;
      }

      const errors: string[] = [];
      if (documentResult.status === "fulfilled") {
        setLoadedDocuments(documentResult.value);
      } else {
        errors.push(errorMessage(documentResult.reason, "documents"));
        setLoadedDocuments(documents ?? []);
      }
      if (skillResult.status === "fulfilled") {
        setLoadedSkills(skillResult.value);
      } else {
        errors.push(errorMessage(skillResult.reason, "skills"));
        setLoadedSkills(skills ?? []);
      }

      setLoadError(errors.length > 0 ? errors.join("; ") : null);
      setIsLoading(false);
    }

    void loadBridgeData();

    return () => {
      cancelled = true;
    };
  }, [documents, onListKnowledgeDocuments, onListSkills, reloadKey, skills]);

  const dataMissingBridges = [
    documentBridgeAvailable ? null : "Knowledge Documents list bridge",
    skillBridgeAvailable ? null : "Skills list bridge",
  ].filter((bridge): bridge is string => Boolean(bridge));
  const actionMissingBridges = [
    draftReviewBridgeAvailable
      ? null
      : draftReviewListActionAvailable
        ? "Draft review item bridge is partial: the current list action requires a selected draft pack"
        : "Draft review item bridge",
  ].filter((bridge): bridge is string => Boolean(bridge));
  const skillBridgeIssue =
    !skillBridgeAvailable
      ? "Skills list bridge is unavailable, so Manage Skills can only report the missing bridge."
      : loadError?.includes("skills:")
        ? `Skills list bridge failed: ${loadError}`
        : null;
  const status =
    isLoading
      ? "loading"
      : !documentBridgeAvailable && !skillBridgeAvailable
        ? "unavailable"
        : dataMissingBridges.length > 0 || loadError
          ? "partial"
          : "ready";

  return {
    actionMissingBridges,
    documentBridgeAvailable,
    documents: documents ?? loadedDocuments,
    draftReviews: draftReviews ?? [],
    draftReviewBridgeAvailable,
    draftReviewListActionAvailable,
    loadError,
    missingBridges: dataMissingBridges,
    skillBridgeAvailable,
    skillBridgeIssue,
    skills: skills ?? loadedSkills,
    status,
  };
}

function productUnavailableReason(action: string) {
  return `${action} is unavailable in this surface.`;
}

function knowledgeV2ActionAvailability({
  dataBridge,
  onDraftReview,
  onImport,
  onManageSkills,
  onNew,
}: {
  readonly dataBridge: KnowledgeV2DataBridge;
  readonly onDraftReview?: () => void;
  readonly onImport?: () => void;
  readonly onManageSkills?: () => void;
  readonly onNew?: () => void;
}): KnowledgeV2ActionAvailabilityMap {
  return {
    draftReview: !onDraftReview
      ? {
          details: ["Missing onDraftReview callback."],
          reason: productUnavailableReason("Draft Review"),
          state: "unavailable",
        }
      : dataBridge.draftReviewBridgeAvailable
        ? { reason: null, state: "available" }
        : {
            details: dataBridge.actionMissingBridges,
            reason: dataBridge.draftReviewListActionAvailable
              ? "Draft Review opens the existing review flow; item-level review details are limited here."
              : "Draft Review opens the existing review flow.",
            state: "available",
          },
    importFile: !onImport
      ? {
          details: ["Missing onImport callback."],
          reason: productUnavailableReason("Import"),
          state: "unavailable",
        }
      : {
          details: [
            "Direct KnowledgeV2 file picker is not wired.",
            "Raw path import is not exposed in this popup.",
          ],
          reason: null,
          state: "available",
        },
    manageSkills: !onManageSkills
      ? {
          details: [
            "Missing onManageSkills callback.",
            ...(dataBridge.skillBridgeIssue ? [dataBridge.skillBridgeIssue] : []),
          ],
          reason: productUnavailableReason("Manage Skills"),
          state: "unavailable",
        }
      : dataBridge.skillBridgeIssue
        ? {
            details: [dataBridge.skillBridgeIssue],
            reason: "Manage Skills opens the existing Skill flow.",
            state: "available",
          }
        : { reason: null, state: "available" },
    newKnowledge: !onNew
      ? {
          details: ["Missing onNew callback."],
          reason: productUnavailableReason("New"),
          state: "unavailable",
        }
      : { reason: null, state: "available" },
  };
}

function errorMessage(error: unknown, label: string) {
  const message = error instanceof Error ? error.message : String(error);
  return `${label}: ${message}`;
}

function knowledgeV2StatusForBridge(dataBridge: KnowledgeV2DataBridge) {
  const counts = knowledgeV2BridgeCountSummary(dataBridge);

  if (dataBridge.status === "loading") {
    return {
      detail: `Loading Knowledge / Skills data through existing list actions. ${counts}`,
      label: "Loading",
      tone: "neutral" as const,
    };
  }

  if (dataBridge.status === "ready") {
    return {
      detail: `Knowledge / Skills data sources are ready. ${counts}`,
      label: "Data sources ready",
      tone: "neutral" as const,
    };
  }

  if (dataBridge.status === "partial") {
    return {
      detail: `Knowledge / Skills is using available data sources only. ${counts}`,
      label: "Data sources partial",
      tone: "warning" as const,
    };
  }

  return {
    detail: `Knowledge / Skills has no connected data source here. ${counts} No production data is being faked.`,
    label: "Data unavailable",
    tone: "warning" as const,
  };
}

function knowledgeV2BridgeCountSummary(dataBridge: KnowledgeV2DataBridge) {
  return `Documents: ${dataBridge.documents.length.toString()}; Skills: ${dataBridge.skills.length.toString()}; Drafts: ${dataBridge.draftReviews.length.toString()}.`;
}
