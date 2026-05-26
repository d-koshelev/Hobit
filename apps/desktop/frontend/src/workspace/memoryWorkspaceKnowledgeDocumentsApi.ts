import type { KnowledgeDocument, KnowledgeDocumentSearchResult } from "./types";
import type { WorkspaceApi } from "./workspaceApiTypes";

const documentsByWorkspaceId = new Map<string, KnowledgeDocument[]>();
const globalDocuments: KnowledgeDocument[] = [];
let nextDocumentId = 1;

export const createKnowledgeDocument: WorkspaceApi["createKnowledgeDocument"] =
  async (request) => {
    const now = new Date().toISOString();
    const document: KnowledgeDocument = {
      knowledgeDocumentId: `dev_memory_kdoc_${nextDocumentId++}`,
      workspaceId: request.scope === "global" ? "" : request.workspaceId,
      scope: request.scope ?? "workspace",
      title: request.title,
      sourceLabel: request.sourceLabel,
      content: request.content,
      tags: request.tags,
      enabled: request.enabled,
      createdAt: now,
      updatedAt: now,
    };

    if (document.scope === "global") {
      globalDocuments.unshift(document);
    } else {
      const documents = getWorkspaceDocuments(request.workspaceId);
      documentsByWorkspaceId.set(request.workspaceId, [document, ...documents]);
    }
    return cloneDocument(document);
  };

export const listKnowledgeDocuments: WorkspaceApi["listKnowledgeDocuments"] =
  async (request) => {
    return getSortedVisibleDocuments(request.workspaceId).map(cloneDocument);
  };

export const getKnowledgeDocument: WorkspaceApi["getKnowledgeDocument"] =
  async (request) => {
    const document =
      getVisibleDocuments(request.workspaceId).find(
        (candidate) =>
          candidate.knowledgeDocumentId === request.knowledgeDocumentId,
      ) ?? null;

    return document ? cloneDocument(document) : null;
  };

export const updateKnowledgeDocument: WorkspaceApi["updateKnowledgeDocument"] =
  async (request) => {
    const currentDocuments = getMutableDocumentsForId(
      request.workspaceId,
      request.knowledgeDocumentId,
    );
    const documentIndex = currentDocuments.findIndex(
      (document) =>
        document.knowledgeDocumentId === request.knowledgeDocumentId,
    );

    if (documentIndex === -1) {
      return null;
    }

    const currentDocument = currentDocuments[documentIndex];
    const nextScope = request.scope ?? currentDocument.scope;
    const updatedDocument: KnowledgeDocument = {
      ...currentDocument,
      workspaceId: nextScope === "global" ? "" : request.workspaceId,
      scope: nextScope,
      title: request.title,
      sourceLabel: request.sourceLabel,
      content: request.content,
      tags: request.tags,
      enabled: request.enabled,
      updatedAt: new Date().toISOString(),
    };
    currentDocuments.splice(documentIndex, 1);
    if (updatedDocument.scope === "global") {
      globalDocuments.unshift(updatedDocument);
    } else {
      const documents = getWorkspaceDocuments(request.workspaceId);
      documentsByWorkspaceId.set(request.workspaceId, [
        updatedDocument,
        ...documents.filter(
          (document) =>
            document.knowledgeDocumentId !== updatedDocument.knowledgeDocumentId,
        ),
      ]);
    }

    return cloneDocument(updatedDocument);
  };

export const deleteKnowledgeDocument: WorkspaceApi["deleteKnowledgeDocument"] =
  async (request) => {
    const documents = getMutableDocumentsForId(
      request.workspaceId,
      request.knowledgeDocumentId,
    );
    const nextDocuments = documents.filter(
      (document) =>
        document.knowledgeDocumentId !== request.knowledgeDocumentId,
    );

    if (nextDocuments.length === documents.length) {
      return false;
    }

    if (documents === globalDocuments) {
      globalDocuments.splice(0, globalDocuments.length, ...nextDocuments);
    } else {
      documentsByWorkspaceId.set(request.workspaceId, nextDocuments);
    }
    return true;
  };

export const searchKnowledgeDocuments: WorkspaceApi["searchKnowledgeDocuments"] =
  async (request) => {
    const terms = lexicalTerms(request.query);
    if (terms.length === 0) {
      return [];
    }

    const results = getVisibleDocuments(request.workspaceId)
      .filter((document) => document.enabled)
      .flatMap((document) =>
        chunkDocumentContent(document.content).map((snippet, index) => ({
          knowledgeDocumentId: document.knowledgeDocumentId,
          documentTitle: document.title,
          scope: document.scope,
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

function getVisibleDocuments(workspaceId: string) {
  return [...getWorkspaceDocuments(workspaceId), ...globalDocuments];
}

function getSortedVisibleDocuments(workspaceId: string) {
  return getVisibleDocuments(workspaceId).sort(compareDocuments);
}

function getMutableDocumentsForId(
  workspaceId: string,
  knowledgeDocumentId: string,
) {
  return globalDocuments.some(
    (document) => document.knowledgeDocumentId === knowledgeDocumentId,
  )
    ? globalDocuments
    : getWorkspaceDocuments(workspaceId);
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
