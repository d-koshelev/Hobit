import type { KnowledgeDocument } from "../../../workspace/types/knowledgeDocuments";
import type { Skill } from "../../../workspace/types/skills";
import {
  knowledgeDocumentWorkspaceAgentContextText,
  skillCoordinatorContextText,
} from "../../skillLibraryModel";
import type { CoordinatorAttachedContextInput, WidgetRenderProps } from "../../types";
import type { KnowledgeV2CatalogItem } from "../model/knowledgeCatalogTypes";

export type KnowledgeV2ContextActionStatus =
  | "attached"
  | "blocked"
  | "copied"
  | "detached"
  | "unavailable";

export type KnowledgeV2ContextActionNotice = {
  readonly message: string;
  readonly status: KnowledgeV2ContextActionStatus;
};

export type KnowledgeV2ContextAffordanceSource =
  | {
      readonly document: KnowledgeDocument;
      readonly item: KnowledgeV2CatalogItem;
      readonly kind: "knowledge_document";
    }
  | {
      readonly item: KnowledgeV2CatalogItem;
      readonly kind: "skill";
      readonly skill: Skill;
    };

export type KnowledgeV2ContextAffordanceState = {
  readonly canAttach: boolean;
  readonly reason: string | null;
  readonly warning: string | null;
};

export type KnowledgeV2ContextTarget =
  | "copy_reference"
  | "queue_selected_task"
  | "workspace_agent_current"
  | "workspace_agent_next";

export function knowledgeV2ContextAffordanceSource(
  item: KnowledgeV2CatalogItem,
  documents: readonly KnowledgeDocument[],
  skills: readonly Skill[],
): KnowledgeV2ContextAffordanceSource | null {
  if (item.recordKind === "document") {
    const document =
      documents.find(
        (candidate) => candidate.knowledgeDocumentId === item.recordId,
      ) ?? null;
    return document ? { document, item, kind: "knowledge_document" } : null;
  }

  if (item.recordKind === "skill") {
    const skill =
      skills.find((candidate) => candidate.skillId === item.recordId) ?? null;
    return skill ? { item, kind: "skill", skill } : null;
  }

  return null;
}

export function knowledgeV2ContextAffordanceState(
  source: KnowledgeV2ContextAffordanceSource | null,
): KnowledgeV2ContextAffordanceState {
  if (!source) {
    return blocked("Source record is unavailable in this Knowledge view.");
  }

  if (source.kind === "skill") {
    if (source.skill.reviewStatus !== "reviewed") {
      return blocked(
        `Skill review status is ${formatToken(source.skill.reviewStatus)}; only reviewed Skills can be attached as context.`,
      );
    }

    return {
      canAttach: true,
      reason: null,
      warning: null,
    };
  }

  const { document } = source;
  if (!document.enabled) {
    return blocked("Knowledge Document is disabled.");
  }
  if (document.searchable === false) {
    return blocked("Knowledge Document is marked not searchable.");
  }
  if (document.lifecycleStatus === "rejected") {
    return blocked("Knowledge Document is rejected.");
  }
  if (document.lifecycleStatus === "archived") {
    return blocked("Knowledge Document is archived.");
  }
  if (document.lifecycleStatus === "draft") {
    return blocked(
      "Knowledge Document is still a draft; mark it active after review before using it as context.",
    );
  }
  if (document.lifecycleStatus === "stale") {
    return {
      canAttach: true,
      reason: null,
      warning: "Stale item: review warning first.",
    };
  }

  return {
    canAttach: true,
    reason: null,
    warning:
      document.content.length > 12_000
        ? "Large item: bounded context only."
        : null,
  };
}

export function knowledgeV2WorkspaceAgentContextInput(
  source: KnowledgeV2ContextAffordanceSource | readonly KnowledgeV2ContextAffordanceSource[],
): CoordinatorAttachedContextInput {
  const sources = Array.isArray(source) ? source : [source];
  if (sources.length > 1) {
    return {
      contextText: sources.map(knowledgeV2ContextText).join("\n\n---\n\n"),
      sourceLabel: `Knowledge / Skills / ${sources.length.toString()} selected items`,
    };
  }

  const [singleSource] = sources;
  if (singleSource.kind === "skill") {
    return {
      contextText: skillCoordinatorContextText(singleSource.skill),
      sourceLabel: "Knowledge / Skills / Skill",
    };
  }

  return {
    contextText: knowledgeDocumentWorkspaceAgentContextText(singleSource.document),
    sourceLabel: "Knowledge / Skills / Knowledge Document",
  };
}

export function knowledgeV2ContextText(source: KnowledgeV2ContextAffordanceSource) {
  if (source.kind === "skill") {
    return skillCoordinatorContextText(source.skill);
  }

  return knowledgeDocumentWorkspaceAgentContextText(source.document);
}

export async function attachKnowledgeV2SourceToQueueTask(
  source: KnowledgeV2ContextAffordanceSource,
  callback: WidgetRenderProps["onAttachKnowledgeContextToQueueTask"],
): Promise<KnowledgeV2ContextActionNotice> {
  if (!callback) {
    return {
      message: "Queue attach is unavailable because no selected Queue task bridge is connected.",
      status: "unavailable",
    };
  }

  try {
    const result =
      source.kind === "skill"
        ? await Promise.resolve(callback({ kind: "skill", skill: source.skill }))
        : await Promise.resolve(
            callback({
              document: source.document,
              kind: "knowledge_document",
            }),
          );

    return {
      message: result.message,
      status: result.status,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Unable to attach this Knowledge item to the selected Queue task.",
      status: "unavailable",
    };
  }
}

export function knowledgeV2ReferenceText(item: KnowledgeV2CatalogItem) {
  return [
    `Knowledge reference: ${item.title}`,
    `Kind: ${formatToken(item.recordKind)}`,
    `Type: ${formatToken(item.type)}`,
    `Record id: ${item.recordId}`,
    `Lifecycle: ${formatToken(item.lifecycleState)}`,
    `Scope: ${formatScope(item.source.scope)}`,
    item.source.label ? `Source: ${item.source.label}` : null,
    item.source.ref ? `Source ref: ${item.source.ref}` : null,
    `Summary: ${item.summary}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export function formatKnowledgeV2ContextUnavailableReason(
  canAttach: boolean,
  bridgeAvailable: boolean,
  reason: string | null,
  bridgeLabel: string,
) {
  if (!canAttach) {
    return reason ?? "This item is not approved for context use.";
  }
  if (!bridgeAvailable) {
    return `${bridgeLabel} attach bridge is unavailable in this Knowledge path.`;
  }
  return null;
}

function blocked(reason: string): KnowledgeV2ContextAffordanceState {
  return {
    canAttach: false,
    reason,
    warning: reason,
  };
}

function formatScope(scope: KnowledgeV2CatalogItem["source"]["scope"]) {
  if (scope === "global") {
    return "Global";
  }
  if (scope === "workspace") {
    return "Workspace";
  }
  return "No scope";
}

function formatToken(value: string) {
  return value
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}
