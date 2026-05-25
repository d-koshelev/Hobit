import type { KnowledgeDocument, KnowledgeDocumentSearchResult } from "./types";
import type { WorkspaceApi } from "./workspaceApiTypes";

const documentsByWorkspaceId = new Map<string, KnowledgeDocument[]>();
let nextDocumentId = 1;

export const createKnowledgeDocument: WorkspaceApi["createKnowledgeDocument"] =
  async (request) => {
    const now = new Date().toISOString();
    const document: KnowledgeDocument = {
      knowledgeDocumentId: `dev_memory_kdoc_${nextDocumentId++}`,
      workspaceId: request.workspaceId,
      title: request.title,
      sourceLabel: request.sourceLabel,
      content: request.content,
      tags: request.tags,
      enabled: request.enabled,
      createdAt: now,
      updatedAt: now,
    };

    const documents = getWorkspaceDocuments(request.workspaceId);
    documentsByWorkspaceId.set(request.workspaceId, [document, ...documents]);
    return cloneDocument(document);
  };

export const listKnowledgeDocuments: WorkspaceApi["listKnowledgeDocuments"] =
  async (request) => {
    return getSortedWorkspaceDocuments(request.workspaceId).map(cloneDocument);
  };

export const getKnowledgeDocument: WorkspaceApi["getKnowledgeDocument"] =
  async (request) => {
    const document =
      getWorkspaceDocuments(request.workspaceId).find(
        (candidate) =>
          candidate.knowledgeDocumentId === request.knowledgeDocumentId,
      ) ?? null;

    return document ? cloneDocument(document) : null;
  };

export const updateKnowledgeDocument: WorkspaceApi["updateKnowledgeDocument"] =
  async (request) => {
    const documents = getWorkspaceDocuments(request.workspaceId);
    const documentIndex = documents.findIndex(
      (document) =>
        document.knowledgeDocumentId === request.knowledgeDocumentId,
    );

    if (documentIndex === -1) {
      return null;
    }

    const currentDocument = documents[documentIndex];
    const updatedDocument: KnowledgeDocument = {
      ...currentDocument,
      title: request.title,
      sourceLabel: request.sourceLabel,
      content: request.content,
      tags: request.tags,
      enabled: request.enabled,
      updatedAt: new Date().toISOString(),
    };
    documentsByWorkspaceId.set(
      request.workspaceId,
      documents.map((document, index) =>
        index === documentIndex ? updatedDocument : document,
      ),
    );

    return cloneDocument(updatedDocument);
  };

export const deleteKnowledgeDocument: WorkspaceApi["deleteKnowledgeDocument"] =
  async (request) => {
    const documents = getWorkspaceDocuments(request.workspaceId);
    const nextDocuments = documents.filter(
      (document) =>
        document.knowledgeDocumentId !== request.knowledgeDocumentId,
    );

    if (nextDocuments.length === documents.length) {
      return false;
    }

    documentsByWorkspaceId.set(request.workspaceId, nextDocuments);
    return true;
  };

export const searchKnowledgeDocuments: WorkspaceApi["searchKnowledgeDocuments"] =
  async (request) => {
    const terms = lexicalTerms(request.query);
    if (terms.length === 0) {
      return [];
    }

    const results = getWorkspaceDocuments(request.workspaceId)
      .filter((document) => document.enabled)
      .flatMap((document) =>
        chunkDocumentContent(document.content).map((snippet, index) => ({
          knowledgeDocumentId: document.knowledgeDocumentId,
          documentTitle: document.title,
          sourceLabel: document.sourceLabel,
          tags: document.tags,
          chunkId: `${document.knowledgeDocumentId}_chunk_${index}`,
          chunkIndex: index,
          snippet: boundedSnippet(snippet),
          score: scoreDocumentChunk(document, snippet, terms),
        })),
      )
      .filter((result) => result.score > 0)
      .sort(compareSearchResults)
      .slice(0, Math.max(1, Math.min(request.limit ?? 5, 20)));

    return results.map(cloneSearchResult);
  };

function getWorkspaceDocuments(workspaceId: string) {
  return documentsByWorkspaceId.get(workspaceId) ?? [];
}

function getSortedWorkspaceDocuments(workspaceId: string) {
  return [...getWorkspaceDocuments(workspaceId)].sort(compareDocuments);
}

function compareDocuments(left: KnowledgeDocument, right: KnowledgeDocument) {
  return right.updatedAt.localeCompare(left.updatedAt);
}

function cloneDocument(document: KnowledgeDocument): KnowledgeDocument {
  return { ...document };
}

function cloneSearchResult(
  result: KnowledgeDocumentSearchResult,
): KnowledgeDocumentSearchResult {
  return { ...result };
}

function chunkDocumentContent(content: string) {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.length > 0 ? paragraphs : [];
}

function lexicalTerms(query: string) {
  return Array.from(
    new Set(
      query
        .toLocaleLowerCase()
        .split(/[^a-z0-9]+/i)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2),
    ),
  );
}

function scoreDocumentChunk(
  document: KnowledgeDocument,
  snippet: string,
  terms: string[],
) {
  const title = document.title.toLocaleLowerCase();
  const source = document.sourceLabel.toLocaleLowerCase();
  const tags = document.tags.toLocaleLowerCase();
  const text = snippet.toLocaleLowerCase();

  return terms.reduce(
    (score, term) =>
      score +
      10 * countMatches(title, term) +
      6 * countMatches(tags, term) +
      4 * countMatches(source, term) +
      2 * countMatches(text, term),
    0,
  );
}

function countMatches(haystack: string, needle: string) {
  return haystack.split(needle).length - 1;
}

function boundedSnippet(text: string) {
  const compacted = text.replace(/\s+/g, " ").trim();
  return compacted.length > 900
    ? `${compacted.slice(0, 897)}...`
    : compacted;
}

function compareSearchResults(
  left: KnowledgeDocumentSearchResult,
  right: KnowledgeDocumentSearchResult,
) {
  return (
    right.score - left.score ||
    left.documentTitle.localeCompare(right.documentTitle) ||
    left.chunkIndex - right.chunkIndex
  );
}
