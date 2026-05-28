import type { KnowledgeDocumentSearchResult } from "../workspace/types";

export type WorkspaceKnowledgeLookupStatus =
  | "idle"
  | "checked"
  | "matched"
  | "failed"
  | "unavailable";

export type WorkspaceKnowledgeLookup = {
  error: string | null;
  query: string;
  results: KnowledgeDocumentSearchResult[];
  status: WorkspaceKnowledgeLookupStatus;
};

export const EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP: WorkspaceKnowledgeLookup = {
  error: null,
  query: "",
  results: [],
  status: "idle",
};

export function workspaceKnowledgeSummaryText(
  lookup: WorkspaceKnowledgeLookup,
) {
  if (lookup.status === "matched") {
    return `Used knowledge: ${lookup.results.length} snippets`;
  }

  if (lookup.status === "checked") {
    return "Workspace knowledge checked: no matches";
  }

  if (lookup.status === "failed") {
    return "Workspace knowledge check failed";
  }

  if (lookup.status === "unavailable") {
    return "Workspace knowledge not available";
  }

  return "Workspace knowledge";
}

export function workspaceKnowledgeLogText(lookup: WorkspaceKnowledgeLookup) {
  if (lookup.status === "matched") {
    return `Used knowledge: ${lookup.results.length} snippets.`;
  }

  if (lookup.status === "checked") {
    return "Workspace knowledge checked: no matches.";
  }

  if (lookup.status === "failed") {
    return "Workspace knowledge check failed; continuing without it.";
  }

  if (lookup.status === "unavailable") {
    return "Workspace knowledge not available.";
  }

  return "";
}

export function codexPromptWithWorkspaceKnowledge(
  operatorPrompt: string,
  results: KnowledgeDocumentSearchResult[],
) {
  const knowledgeBlock = results
    .slice(0, 5)
    .map((result) =>
      [
        `[Doc: ${result.documentTitle}, chunk ${result.chunkIndex + 1}]`,
        `Scope: ${knowledgeScopeLabel(result.scope)}`,
        result.snippet,
      ].join("\n"),
    )
    .join("\n\n");

  return [
    "Workspace knowledge found for this request:",
    knowledgeBlock,
    "Use this only if relevant. If it does not help, ignore it.",
    "",
    "User request:",
    operatorPrompt,
  ].join("\n");
}

export function knowledgeScopeLabel(scope: KnowledgeDocumentSearchResult["scope"]) {
  return scope === "global" ? "Global" : "Workspace";
}
