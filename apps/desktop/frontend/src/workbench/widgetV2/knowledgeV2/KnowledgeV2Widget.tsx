import { useEffect, useMemo, useState } from "react";

import type { KnowledgeDocument } from "../../../workspace/types/knowledgeDocuments";
import type { KnowledgeDraftReviewDecision } from "../../../workspace/types/knowledgeDocuments";
import type { Skill } from "../../../workspace/types/skills";
import type { WidgetRenderProps } from "../../types";
import { WidgetV2Shell } from "../WidgetV2Shell";
import { getWidgetV2Manifest } from "../widgetV2Registry";
import { KnowledgeV2Actions } from "./KnowledgeV2Actions";
import { KnowledgeV2CatalogBrowser } from "./KnowledgeV2CatalogBrowser";

const knowledgeV2Manifest = getWidgetV2Manifest("knowledge-v2");

export type KnowledgeV2WidgetProps = {
  readonly draftReviews?: readonly KnowledgeDraftReviewDecision[];
  readonly documents?: readonly KnowledgeDocument[];
  readonly onDraftReview?: () => void;
  readonly onImport?: () => void;
  readonly onListKnowledgeDocuments?: WidgetRenderProps["onListKnowledgeDocuments"];
  readonly onListKnowledgeDraftReviews?: WidgetRenderProps["onListKnowledgeDraftReviews"];
  readonly onListSkills?: WidgetRenderProps["onListSkills"];
  readonly onManageSkills?: () => void;
  readonly onNew?: () => void;
  readonly skills?: readonly Skill[];
};

export function KnowledgeV2Widget({
  draftReviews,
  documents,
  onListKnowledgeDocuments,
  onListKnowledgeDraftReviews,
  onListSkills,
  onDraftReview,
  onImport,
  onManageSkills,
  onNew,
  skills,
}: KnowledgeV2WidgetProps = {}) {
  const dataBridge = useKnowledgeV2DataBridge({
    draftReviews,
    documents,
    onListKnowledgeDocuments,
    onListKnowledgeDraftReviews,
    onListSkills,
    skills,
  });
  const status = useMemo(
    () => knowledgeV2StatusForBridge(dataBridge),
    [dataBridge],
  );

  return (
    <WidgetV2Shell
      actions={
        <KnowledgeV2Actions
          documents={dataBridge.documents}
          draftReviews={dataBridge.draftReviews}
          missingBridges={dataBridge.missingBridges}
          onDraftReview={onDraftReview}
          onImport={onImport}
          onManageSkills={onManageSkills}
          onNew={onNew}
          skills={dataBridge.skills}
        />
      }
      status={status}
      subtitle="Browse and preview passed Knowledge Documents and Skills. Creation, import, draft review, indexing, storage, and backend behavior stay outside this surface."
      title={knowledgeV2Manifest?.title ?? "Knowledge v2"}
    >
      <KnowledgeV2CatalogBrowser
        documents={dataBridge.documents}
        loadError={dataBridge.loadError}
        missingBridges={dataBridge.missingBridges}
        skills={dataBridge.skills}
        status={dataBridge.status}
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
  readonly skills?: readonly Skill[];
};

type KnowledgeV2DataBridge = {
  readonly documents: readonly KnowledgeDocument[];
  readonly draftReviews: readonly KnowledgeDraftReviewDecision[];
  readonly loadError: string | null;
  readonly missingBridges: readonly string[];
  readonly skills: readonly Skill[];
  readonly status: "loading" | "partial" | "ready" | "unavailable";
};

function useKnowledgeV2DataBridge({
  draftReviews,
  documents,
  onListKnowledgeDocuments,
  onListKnowledgeDraftReviews,
  onListSkills,
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
      try {
        const [nextDocuments, nextSkills] = await Promise.all([
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

        setLoadedDocuments(nextDocuments);
        setLoadedSkills(nextSkills);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
          setLoadedDocuments(documents ?? []);
          setLoadedSkills(skills ?? []);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadBridgeData();

    return () => {
      cancelled = true;
    };
  }, [documents, onListKnowledgeDocuments, onListSkills, skills]);

  const missingBridges = [
    documentBridgeAvailable ? null : "Knowledge Documents list bridge",
    skillBridgeAvailable ? null : "Skills list bridge",
    draftReviewBridgeAvailable
      ? null
      : draftReviewListActionAvailable
        ? "Draft review item bridge is partial: the current list action requires a selected draft pack"
        : "Draft review item bridge",
  ].filter((bridge): bridge is string => Boolean(bridge));
  const status =
    isLoading
      ? "loading"
      : !documentBridgeAvailable && !skillBridgeAvailable
        ? "unavailable"
        : missingBridges.length > 0 || loadError
          ? "partial"
          : "ready";

  return {
    documents: documents ?? loadedDocuments,
    draftReviews: draftReviews ?? [],
    loadError,
    missingBridges,
    skills: skills ?? loadedSkills,
    status,
  };
}

function knowledgeV2StatusForBridge(dataBridge: KnowledgeV2DataBridge) {
  if (dataBridge.status === "loading") {
    return {
      detail:
        "KnowledgeV2 is loading through existing Knowledge / Skills frontend list actions.",
      label: "Loading",
      tone: "neutral" as const,
    };
  }

  if (dataBridge.status === "ready") {
    return {
      detail:
        "KnowledgeV2 is reading existing Knowledge / Skills frontend data. Current Knowledge / Skills remains the production surface.",
      label: "Experimental",
      tone: "warning" as const,
    };
  }

  if (dataBridge.status === "partial") {
    return {
      detail:
        "KnowledgeV2 is using only available frontend bridges; unavailable bridges are reported in the catalog.",
      label: "Partial bridge",
      tone: "warning" as const,
    };
  }

  return {
    detail:
      "KnowledgeV2 has no Knowledge / Skills data bridge in this experimental path. No production data is being faked.",
    label: "Data unavailable",
    tone: "warning" as const,
  };
}
