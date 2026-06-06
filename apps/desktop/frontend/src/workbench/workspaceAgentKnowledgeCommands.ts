import type {
  KnowledgeDocument,
  KnowledgeDocumentSearchResult,
} from "../workspace/types";
import { knowledgeScopeLabel } from "./workspaceAgentDirectWorkKnowledge";
import {
  workspaceAgentVisibleContextBlock,
  type WorkspaceAgentVisibleContext,
} from "./workspaceAgentVisibleContext";
import type { WorkspaceAgentTranscriptMessage } from "./WorkspaceAgentTranscript";

const MAX_SEARCH_RESULTS = 3;
const MAX_SNIPPET_CHARS = 700;

export type WorkspaceAgentKnowledgeCommandResult =
  | {
      handled: false;
    }
  | {
      body: string;
      handled: true;
      visibleContext?: WorkspaceAgentVisibleContext;
    };

export type WorkspaceAgentKnowledgeCommandHandlers = {
  getKnowledgeDocument?: (knowledgeDocumentId: string) => Promise<KnowledgeDocument | null>;
  searchKnowledgeDocuments?: (request: {
    limit?: number | null;
    query: string;
  }) => Promise<KnowledgeDocumentSearchResult[]>;
};

export type SendWorkspaceAgentKnowledgeCommandOptions = {
  createLocalMessage: (
    role: WorkspaceAgentTranscriptMessage["role"],
    body: string,
  ) => WorkspaceAgentTranscriptMessage;
  getKnowledgeDocument?: WorkspaceAgentKnowledgeCommandHandlers["getKnowledgeDocument"];
  isProviderPending: boolean;
  onMessages: (
    operatorMessage: WorkspaceAgentTranscriptMessage,
    assistantMessage: WorkspaceAgentTranscriptMessage,
  ) => void;
  onSetDraft: (draft: string) => void;
  onSetVisibleContext: (context: WorkspaceAgentVisibleContext | null) => void;
  onFocusComposer: () => void;
  rawDraft: string;
  searchKnowledgeDocuments?: WorkspaceAgentKnowledgeCommandHandlers["searchKnowledgeDocuments"];
};

export async function runWorkspaceAgentKnowledgeCommand(
  rawDraft: string,
  handlers: WorkspaceAgentKnowledgeCommandHandlers,
): Promise<WorkspaceAgentKnowledgeCommandResult> {
  const command = parseWorkspaceAgentKnowledgeCommand(rawDraft);
  if (!command) {
    return { handled: false };
  }

  if (!handlers.searchKnowledgeDocuments) {
    return {
      body: "Knowledge API unavailable. No search, attach, provider call, Terminal command, JDBC query, or Queue task was run.",
      handled: true,
    };
  }

  if (!command.query) {
    return {
      body: "Add a search query after `knowledge search:` or `knowledge attach:`. No Knowledge context was attached.",
      handled: true,
    };
  }

  const results = await handlers.searchKnowledgeDocuments({
    limit: MAX_SEARCH_RESULTS,
    query: command.query,
  });

  if (command.action === "search") {
    return {
      body: searchResultsBody(command.query, results),
      handled: true,
    };
  }

  if (results.length === 0) {
    return {
      body: `No active searchable Knowledge matched "${command.query}". Nothing was attached.`,
      handled: true,
    };
  }

  const selectedResult = results[0];
  const document =
    await handlers.getKnowledgeDocument?.(selectedResult.knowledgeDocumentId);
  if (!document) {
    return {
      body: `${selectedResult.documentTitle} was found but not attached: Knowledge document details API unavailable.`,
      handled: true,
    };
  }

  const attachability = knowledgeDocumentAttachability(document);

  if (!attachability.attachable) {
    return {
      body: `${selectedResult.documentTitle} was found but not attached: ${attachability.reason}`,
      handled: true,
    };
  }

  const visibleContext = visibleContextFromKnowledgeResult(
    selectedResult,
    document,
  );

  return {
    body: [
      "Knowledge context attached visibly.",
      `Title: ${document.title}`,
      `Scope: ${knowledgeScopeLabel(document.scope)}`,
      `Status: ${document.lifecycleStatus}`,
      `Version: ${document.updatedAt || "Unknown"}`,
      `Source: ${document.sourceLabel || selectedResult.sourceLabel || "Knowledge Document"}`,
      "Only the bounded visible summary/snippet was attached. No provider, Terminal, JDBC, Queue execution, or hidden context call was made.",
    ].join("\n"),
    handled: true,
    visibleContext,
  };
}

export async function sendWorkspaceAgentKnowledgeCommandFromDraft({
  createLocalMessage,
  getKnowledgeDocument,
  isProviderPending,
  onFocusComposer,
  onMessages,
  onSetDraft,
  onSetVisibleContext,
  rawDraft,
  searchKnowledgeDocuments,
}: SendWorkspaceAgentKnowledgeCommandOptions) {
  const trimmedDraft = rawDraft.trim();
  if (!trimmedDraft || isProviderPending) {
    return false;
  }

  const result = await runWorkspaceAgentKnowledgeCommand(trimmedDraft, {
    getKnowledgeDocument,
    searchKnowledgeDocuments,
  });

  if (!result.handled) {
    return false;
  }

  if (result.visibleContext) {
    onSetVisibleContext(result.visibleContext);
    onSetDraft(workspaceAgentVisibleContextBlock(result.visibleContext));
  } else {
    onSetDraft("");
    onSetVisibleContext(null);
  }

  onMessages(
    createLocalMessage("operator", trimmedDraft),
    createLocalMessage("assistant", result.body),
  );
  window.setTimeout(onFocusComposer, 0);

  return true;
}

function parseWorkspaceAgentKnowledgeCommand(rawDraft: string) {
  const draft = rawDraft.trim();
  const match = draft.match(
    /^(?:\/)?knowledge\s+(search|attach)\s*:?\s*([\s\S]*)$/i,
  );

  if (!match) {
    return null;
  }

  return {
    action: match[1].toLowerCase() as "search" | "attach",
    query: match[2].trim(),
  };
}

function searchResultsBody(
  query: string,
  results: KnowledgeDocumentSearchResult[],
) {
  if (results.length === 0) {
    return `No active searchable Knowledge matched "${query}". No context was attached.`;
  }

  return [
    `Knowledge search results for "${query}"`,
    "No context was attached. Use `knowledge attach: <query>` to attach one visible bounded result.",
    "",
    ...results.slice(0, MAX_SEARCH_RESULTS).map((result, index) =>
      [
        `${index + 1}. ${result.documentTitle}`,
        `Scope: ${knowledgeScopeLabel(result.scope)}`,
        `Source: ${result.sourceLabel || "Knowledge Document"}`,
        `Snippet: ${boundedText(result.snippet, MAX_SNIPPET_CHARS)}`,
      ].join("\n"),
    ),
  ].join("\n\n");
}

function knowledgeDocumentAttachability(document: KnowledgeDocument) {
  if (!document.enabled) {
    return { attachable: false, reason: "disabled Knowledge is blocked." };
  }

  if (document.searchable === false) {
    return { attachable: false, reason: "non-searchable Knowledge is blocked." };
  }

  if (document.lifecycleStatus === "rejected") {
    return { attachable: false, reason: "rejected Knowledge is blocked." };
  }

  if (document.lifecycleStatus !== "active") {
    return {
      attachable: false,
      reason: `${document.lifecycleStatus} Knowledge requires a separate reviewed acknowledgement flow before attach.`,
    };
  }

  return { attachable: true, reason: null };
}

function visibleContextFromKnowledgeResult(
  result: KnowledgeDocumentSearchResult,
  document: KnowledgeDocument,
): WorkspaceAgentVisibleContext {
  const scope = knowledgeScopeLabel(document.scope);
  return {
    contextText: [
      `Title: ${document.title}`,
      `Scope: ${scope}`,
      `Status: ${document.lifecycleStatus}`,
      `Version: ${document.updatedAt || "Unknown"}`,
      `Source: ${document.sourceLabel || result.sourceLabel || "Knowledge Document"}`,
      document.sourceRef.trim() ? `Source ref: ${document.sourceRef.trim()}` : null,
      `Quick summary: ${document.quickSummary.trim() || "Summary missing."}`,
      `Bounded search snippet: ${boundedText(result.snippet, MAX_SNIPPET_CHARS)}`,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n"),
    sourceLabel: `Knowledge: ${document.title} (${scope}, ${document.lifecycleStatus}, v ${document.updatedAt || "Unknown"})`,
  };
}

function boundedText(value: string, maxChars: number) {
  const compacted = value.replace(/\s+/g, " ").trim();
  if (compacted.length <= maxChars) {
    return compacted;
  }

  return `${compacted.slice(0, Math.max(0, maxChars - 12)).trimEnd()} [truncated]`;
}
