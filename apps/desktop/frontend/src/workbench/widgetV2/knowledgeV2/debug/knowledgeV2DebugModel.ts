import type {
  KnowledgeDocument,
  KnowledgeDraftReviewDecision,
} from "../../../../workspace/types/knowledgeDocuments";
import type { Skill } from "../../../../workspace/types/skills";
import type { KnowledgeV2ActionAvailabilityMap } from "../KnowledgeV2Actions";

export type KnowledgeV2DebugBridgeState = {
  readonly documentBridgeAvailable: boolean;
  readonly draftReviewBridgeAvailable: boolean;
  readonly draftReviewListActionAvailable: boolean;
  readonly loadError: string | null;
  readonly missingBridges: readonly string[];
  readonly skillBridgeAvailable: boolean;
  readonly skillBridgeIssue: string | null;
  readonly status: "loading" | "partial" | "ready" | "unavailable";
};

export type KnowledgeV2DebugCallbackState = {
  readonly onDraftReview: boolean;
  readonly onImport: boolean;
  readonly onManageSkills: boolean;
  readonly onNew: boolean;
};

export type KnowledgeV2DebugModel = {
  readonly actionDiagnostics: readonly KnowledgeV2DebugEntry[];
  readonly bridgeDiagnostics: readonly KnowledgeV2DebugEntry[];
  readonly callbackDiagnostics: readonly KnowledgeV2DebugEntry[];
  readonly implementationNotes: readonly string[];
  readonly rawPayloadSummary: readonly KnowledgeV2DebugEntry[];
  readonly sourceDiagnostics: readonly KnowledgeV2DebugEntry[];
};

export type KnowledgeV2DebugEntry = {
  readonly label: string;
  readonly value: string;
};

export function buildKnowledgeV2DebugModel({
  actionAvailability,
  bridgeState,
  callbackState,
  documents,
  draftReviews,
  skills,
}: {
  readonly actionAvailability: KnowledgeV2ActionAvailabilityMap;
  readonly bridgeState: KnowledgeV2DebugBridgeState;
  readonly callbackState: KnowledgeV2DebugCallbackState;
  readonly documents: readonly KnowledgeDocument[];
  readonly draftReviews: readonly KnowledgeDraftReviewDecision[];
  readonly skills: readonly Skill[];
}): KnowledgeV2DebugModel {
  return {
    actionDiagnostics: [
      actionEntry("New", actionAvailability.newKnowledge),
      actionEntry("Import", actionAvailability.importFile),
      actionEntry("Draft Review", actionAvailability.draftReview),
      actionEntry("Manage Skills", actionAvailability.manageSkills),
    ],
    bridgeDiagnostics: [
      { label: "Bridge status", value: bridgeState.status },
      {
        label: "Document list bridge",
        value: availableText(bridgeState.documentBridgeAvailable),
      },
      {
        label: "Skill list bridge",
        value: availableText(bridgeState.skillBridgeAvailable),
      },
      {
        label: "Draft review item bridge",
        value: availableText(bridgeState.draftReviewBridgeAvailable),
      },
      {
        label: "Draft review list action",
        value: availableText(bridgeState.draftReviewListActionAvailable),
      },
      {
        label: "Missing bridges",
        value: bridgeState.missingBridges.length
          ? bridgeState.missingBridges.join("; ")
          : "None",
      },
      {
        label: "Load error",
        value: bridgeState.loadError ?? "None",
      },
      {
        label: "Skill bridge issue",
        value: bridgeState.skillBridgeIssue ?? "None",
      },
    ],
    callbackDiagnostics: [
      callbackEntry("onNew", callbackState.onNew),
      callbackEntry("onImport", callbackState.onImport),
      callbackEntry("onDraftReview", callbackState.onDraftReview),
      callbackEntry("onManageSkills", callbackState.onManageSkills),
    ],
    implementationNotes: [
      "KnowledgeV2 is a frontend WidgetV2 surface over existing Knowledge / Skills data and callbacks.",
      "The main surface intentionally hides callback names, bridge names, raw ids, and not-wired implementation notes.",
      "No direct file picker, raw path import, automatic context injection, hidden ingestion, or standalone Knowledge Catalog runtime is implemented here.",
    ],
    rawPayloadSummary: [
      {
        label: "Document ids",
        value: summarizeIds(documents, (document) => document.knowledgeDocumentId),
      },
      {
        label: "Skill ids",
        value: summarizeIds(skills, (skill) => skill.skillId),
      },
      {
        label: "Draft review ids",
        value: summarizeIds(draftReviews, (review) => review.reviewId),
      },
      {
        label: "Draft pack ids",
        value: summarizeIds(draftReviews, (review) => review.draftPackId),
      },
    ],
    sourceDiagnostics: [
      { label: "Documents loaded", value: documents.length.toString() },
      { label: "Skills loaded", value: skills.length.toString() },
      { label: "Draft reviews loaded", value: draftReviews.length.toString() },
      {
        label: "Document source kinds",
        value: summarizeUnique(documents.map((document) => document.sourceKind)),
      },
      {
        label: "Document scopes",
        value: summarizeUnique(documents.map((document) => document.scope)),
      },
    ],
  };
}

function actionEntry(
  label: string,
  availability: KnowledgeV2ActionAvailabilityMap[keyof KnowledgeV2ActionAvailabilityMap],
): KnowledgeV2DebugEntry {
  const details =
    availability.details && availability.details.length > 0
      ? ` Details: ${availability.details.join("; ")}`
      : "";
  return {
    label,
    value: `${availability.state}. ${availability.reason ?? "No product-facing reason."}${details}`,
  };
}

function callbackEntry(label: string, available: boolean): KnowledgeV2DebugEntry {
  return { label, value: available ? "callback supplied" : "callback missing" };
}

function availableText(available: boolean) {
  return available ? "available" : "missing";
}

function summarizeIds<T>(
  values: readonly T[],
  getId: (value: T) => string | null | undefined,
) {
  const ids = values.map(getId).filter((id): id is string => Boolean(id));
  if (ids.length === 0) {
    return "None";
  }
  return ids.slice(0, 8).join(", ") + (ids.length > 8 ? `, +${ids.length - 8}` : "");
}

function summarizeUnique(values: readonly (string | null | undefined)[]) {
  const uniqueValues = Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
  return uniqueValues.length ? uniqueValues.join(", ") : "None";
}
