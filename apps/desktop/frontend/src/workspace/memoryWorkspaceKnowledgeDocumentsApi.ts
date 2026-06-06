import {
  knowledgeSourceRefFromLegacyFields,
  legacyKnowledgeSourceFromRefs,
  type KnowledgeDocument,
  type KnowledgeDocumentSearchResult,
} from "./types";
import type { WorkspaceApi } from "./workspaceApiTypes";

const documentsByWorkspaceId = new Map<string, KnowledgeDocument[]>();
const globalDocuments: KnowledgeDocument[] = [];
let nextDocumentId = 1;

export const createKnowledgeDocument: WorkspaceApi["createKnowledgeDocument"] =
  async (request) => {
    const now = new Date().toISOString();
    const legacySource = legacyKnowledgeSourceFromRefs(request.sourceRefs);
    const sourceKind = normalizeSourceKind(
      request.sourceKind ?? legacySource?.sourceKind,
    );
    const sourceRef = normalizeSourceRef(
      request.sourceRef ?? legacySource?.sourceRef,
    );
    const document: KnowledgeDocument = {
      knowledgeDocumentId: `dev_memory_kdoc_${nextDocumentId++}`,
      workspaceId: request.scope === "global" ? "" : request.workspaceId,
      scope: request.scope ?? "workspace",
      catalogItemType: request.catalogItemType ?? "documentation_knowledge",
      quickSummary: normalizeQuickSummary(request.quickSummary),
      lifecycleStatus: request.lifecycleStatus ?? "active",
      title: request.title,
      sourceLabel: request.sourceLabel,
      sourceKind,
      sourceRef,
      sourceRefs: request.sourceRefs ?? [
        knowledgeSourceRefFromLegacyFields({
          sourceKind,
          sourceLabel: request.sourceLabel,
          sourceRef,
        }),
      ],
      relations: request.relations ?? [],
      content: request.content,
      tags: request.tags,
      enabled: request.enabled,
      searchable: request.searchable ?? true,
      version: 1,
      versionSummary: request.versionSummary ?? "",
      createdAt: now,
      updatedAt: now,
      reviewedAt:
        request.reviewedAt ??
        (request.lifecycleStatus === "draft" ||
        request.lifecycleStatus === "stale" ||
        request.lifecycleStatus === "archived"
          ? null
          : now),
      createdByTaskId:
        request.createdByTaskId ?? inferCreatedByTaskId(request.sourceRefs),
      createdFromRunId:
        request.createdFromRunId ?? inferCreatedFromRunId(request.sourceRefs),
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
    const legacySource = legacyKnowledgeSourceFromRefs(request.sourceRefs);
    const sourceKind = normalizeSourceKind(
      request.sourceKind ?? legacySource?.sourceKind ?? currentDocument.sourceKind,
    );
    const sourceRef = normalizeSourceRef(
      request.sourceRef ?? legacySource?.sourceRef ?? currentDocument.sourceRef,
    );
    const updatedDocument: KnowledgeDocument = {
      ...currentDocument,
      workspaceId: nextScope === "global" ? "" : request.workspaceId,
      scope: nextScope,
      catalogItemType:
        request.catalogItemType ?? currentDocument.catalogItemType,
      quickSummary: normalizeQuickSummary(
        request.quickSummary ?? currentDocument.quickSummary,
      ),
      lifecycleStatus:
        request.lifecycleStatus ?? currentDocument.lifecycleStatus,
      title: request.title,
      sourceLabel: request.sourceLabel,
      sourceKind,
      sourceRef,
      sourceRefs: request.sourceRefs ??
        currentDocument.sourceRefs ?? [
          knowledgeSourceRefFromLegacyFields({
            sourceKind,
            sourceLabel: request.sourceLabel,
            sourceRef,
          }),
        ],
      relations: request.relations ?? currentDocument.relations ?? [],
      content: request.content,
      tags: request.tags,
      enabled: request.enabled,
      searchable: request.searchable ?? currentDocument.searchable ?? true,
      version: (currentDocument.version ?? 1) + 1,
      versionSummary: request.versionSummary ?? "",
      updatedAt: new Date().toISOString(),
      reviewedAt:
        request.reviewedAt ??
        currentDocument.reviewedAt ??
        (request.lifecycleStatus === "active" || request.lifecycleStatus === "rejected"
          ? new Date().toISOString()
          : null),
      createdByTaskId:
        request.createdByTaskId ??
        currentDocument.createdByTaskId ??
        inferCreatedByTaskId(request.sourceRefs),
      createdFromRunId:
        request.createdFromRunId ??
        currentDocument.createdFromRunId ??
        inferCreatedFromRunId(request.sourceRefs),
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
      .filter((document) => document.searchable !== false)
      .filter((document) => document.lifecycleStatus === "active")
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
  return {
    ...document,
    sourceRefs: document.sourceRefs?.map((sourceRef) => ({ ...sourceRef })),
    relations: document.relations?.map((relation) => ({ ...relation })),
  };
}

function cloneSearchResult(
  result: KnowledgeDocumentSearchResult,
): KnowledgeDocumentSearchResult {
  return { ...result };
}

function normalizeQuickSummary(quickSummary: string | null | undefined) {
  return (quickSummary ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join("\n");
}

function normalizeSourceKind(sourceKind: string | null | undefined) {
  const trimmed = sourceKind?.trim();
  return trimmed || "operator_authored";
}

function normalizeSourceRef(sourceRef: string | null | undefined) {
  return sourceRef?.trim() ?? "";
}

function inferCreatedByTaskId(sourceRefs: KnowledgeDocument["sourceRefs"]) {
  for (const sourceRef of sourceRefs ?? []) {
    if (sourceRef.kind === "queue_task") {
      return sourceRef.queueTaskId;
    }
    if (sourceRef.kind === "queue_run") {
      return sourceRef.queueTaskId ?? undefined;
    }
  }
  return undefined;
}

function inferCreatedFromRunId(sourceRefs: KnowledgeDocument["sourceRefs"]) {
  for (const sourceRef of sourceRefs ?? []) {
    if (sourceRef.kind === "queue_run") {
      return sourceRef.runId;
    }
  }
  return undefined;
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
