import type { KnowledgeDocumentSearchResult } from "../workspace/types";

const MAX_WORKSPACE_KNOWLEDGE_RESULTS = 5;
const MAX_WORKSPACE_KNOWLEDGE_SNIPPET_CHARS = 900;
const MAX_WORKSPACE_KNOWLEDGE_CONTEXT_CHARS = 3600;

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
  const knowledgeBlocks: string[] = [];
  let usedChars = 0;

  for (const result of results.slice(0, MAX_WORKSPACE_KNOWLEDGE_RESULTS)) {
    if (usedChars >= MAX_WORKSPACE_KNOWLEDGE_CONTEXT_CHARS) {
      break;
    }

    const remainingChars = MAX_WORKSPACE_KNOWLEDGE_CONTEXT_CHARS - usedChars;
    const snippet = boundedSnippet(result.snippet, Math.min(
      MAX_WORKSPACE_KNOWLEDGE_SNIPPET_CHARS,
      remainingChars,
    ));
    const block =
      [
        `[Doc: ${result.documentTitle}, chunk ${result.chunkIndex + 1}]`,
        `Scope: ${knowledgeScopeLabel(result.scope)}`,
        snippet,
      ].join("\n");
    knowledgeBlocks.push(block);
    usedChars += block.length + 2;
  }

  const knowledgeBlock = knowledgeBlocks.join("\n\n");

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

function boundedSnippet(value: string, maxChars: number) {
  const compacted = value.replace(/\s+/g, " ").trim();
  if (compacted.length <= maxChars) {
    return compacted;
  }

  return `${compacted.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}
