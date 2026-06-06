import { describe, expect, it } from "vitest";

import type { KnowledgeDocument } from "../workspace/types";
import {
  knowledgeDocumentRequestFromDraft,
  refreshQueueTaskRequestFromDocument,
} from "./SkillLibraryDocumentsPanel.helpers";
import { EMPTY_DOCUMENT_DRAFT } from "./skillLibraryModel";

describe("SkillLibraryDocumentsPanel source refs", () => {
  it("uses existing Knowledge sourceRefs when creating a refresh Queue task", () => {
    const document = knowledgeDocument({
      sourceRefs: [
        {
          caps: ["Use only selected docs"],
          kind: "docs_path",
          label: "Selected contract",
          path: "docs/KNOWLEDGE_GENERATION_WORKFLOW_CONTRACT.md",
          reason: "Refresh against the original selected docs source.",
          warnings: ["No background docs scan."],
          workspaceScope: "workspace-local",
        },
      ],
    });

    const request = refreshQueueTaskRequestFromDocument(document);

    expect(request.prompt).toContain("Structured source refs from current Knowledge item:");
    expect(request.prompt).toContain("kind=docs_path");
    expect(request.prompt).toContain(
      "path=docs/KNOWLEDGE_GENERATION_WORKFLOW_CONTRACT.md",
    );
    expect(request.prompt).toContain(
      "reason=Refresh against the original selected docs source.",
    );
  });

  it("adds typed manual/import source refs to document create requests", () => {
    const manualRequest = knowledgeDocumentRequestFromDraft(
      {
        ...EMPTY_DOCUMENT_DRAFT,
        sourceKind: "operator_authored",
        sourceLabel: "Manual note",
        sourceRef: "operator paste",
      },
      "Manual Knowledge",
    );
    const importRequest = knowledgeDocumentRequestFromDraft(
      {
        ...EMPTY_DOCUMENT_DRAFT,
        sourceKind: "import_file",
        sourceLabel: "README.md",
        sourceRef: "README.md",
      },
      "Imported Knowledge",
    );

    expect(manualRequest.sourceRefs?.[0]).toMatchObject({
      kind: "manual",
      reason: "Operator manually authored or entered this Knowledge source.",
      refText: "operator paste",
      workspaceScope: "workspace-local",
    });
    expect(importRequest.sourceRefs?.[0]).toMatchObject({
      kind: "import_file",
      path: "README.md",
      reason: "Operator imported one selected text/Markdown file.",
      workspaceScope: "workspace-local",
    });
  });
});

function knowledgeDocument(
  overrides: Partial<KnowledgeDocument> = {},
): KnowledgeDocument {
  return {
    catalogItemType: "documentation_knowledge",
    content: "Document content.",
    createdAt: "2026-06-06T10:00:00.000Z",
    enabled: true,
    knowledgeDocumentId: "kdoc_1",
    lifecycleStatus: "active",
    quickSummary: "Document summary.",
    scope: "workspace",
    searchable: true,
    sourceKind: "docs_path",
    sourceLabel: "Selected contract",
    sourceRef: "docs/KNOWLEDGE_GENERATION_WORKFLOW_CONTRACT.md",
    tags: "knowledge",
    title: "Knowledge document",
    updatedAt: "2026-06-06T10:00:00.000Z",
    version: 1,
    workspaceId: "ws_1",
    ...overrides,
  };
}
