import { describe, expect, it } from "vitest";

import type { KnowledgeDocument } from "../../../workspace/types/knowledgeDocuments";
import type { Skill } from "../../../workspace/types/skills";
import {
  buildKnowledgeV2CatalogViewModel,
  filterKnowledgeV2CatalogItems,
  normalizeKnowledgeV2CatalogItems,
  normalizeKnowledgeV2DocumentItem,
  normalizeKnowledgeV2SkillItem,
} from "./knowledgeV2CatalogModel";

describe("knowledgeV2CatalogModel", () => {
  it("normalizes a document fixture", () => {
    const item = normalizeKnowledgeV2DocumentItem(
      documentFixture({
        catalogItemType: "runbook",
        quickSummary: "Release procedure.",
        sourceRefs: [
          {
            kind: "docs_path",
            label: "Runbook docs",
            path: "docs/release.md",
          },
        ],
        tags: "release, ops",
      }),
    );

    expect(item).toMatchObject({
      description: "Release procedure.",
      documentSubtype: "runbook",
      enabled: true,
      id: "document:kdoc_1",
      lifecycleState: "active",
      recordId: "kdoc_1",
      recordKind: "document",
      searchable: true,
      source: {
        kind: "docs_path",
        label: "Release docs",
        ref: "docs/release.md",
        scope: "workspace",
      },
      sourceRefCount: 1,
      summary: "Release procedure.",
      title: "Release guide",
      type: "runbook",
    });
    expect(item.tags).toEqual(["release", "ops"]);
    expect(item.sourceRefs.count).toBe(1);
  });

  it("normalizes a skill fixture", () => {
    const item = normalizeKnowledgeV2SkillItem(
      skillFixture({
        reviewStatus: "reviewed",
        tags: "frontend, review",
        whenToUse: "Use when reviewing React changes.",
      }),
    );

    expect(item).toMatchObject({
      description: "Use when reviewing React changes.",
      enabled: true,
      id: "skill:skill_1",
      lifecycleState: "active",
      recordId: "skill_1",
      recordKind: "skill",
      reviewState: "reviewed",
      searchable: true,
      source: {
        kind: "operator_authored",
        label: "Workspace Skill",
        scope: "workspace",
      },
      sourceRefCount: 0,
      summary: "Use when reviewing React changes.",
      title: "React review",
      type: "skill",
    });
    expect(item.tags).toEqual(["frontend", "review"]);
  });

  it("filters by type", () => {
    const items = normalizeKnowledgeV2CatalogItems({
      documents: [documentFixture()],
      skills: [skillFixture()],
    });

    expect(filterKnowledgeV2CatalogItems(items, { types: ["skill"] })).toEqual([
      expect.objectContaining({ id: "skill:skill_1" }),
    ]);
  });

  it("filters disabled and rejected items", () => {
    const items = normalizeKnowledgeV2CatalogItems({
      documents: [
        documentFixture({ knowledgeDocumentId: "active", title: "Active" }),
        documentFixture({
          enabled: false,
          knowledgeDocumentId: "disabled",
          title: "Disabled",
        }),
        documentFixture({
          knowledgeDocumentId: "rejected",
          lifecycleStatus: "rejected",
          title: "Rejected",
        }),
      ],
      skills: [],
    });

    expect(
      filterKnowledgeV2CatalogItems(items, { enabled: "enabled" }).map(
        (item) => item.id,
      ),
    ).toEqual(["document:active", "document:rejected"]);
    expect(
      filterKnowledgeV2CatalogItems(items, {
        lifecycleStates: ["active"],
      }).map((item) => item.id),
    ).toEqual(["document:active", "document:disabled"]);
  });

  it("searches text across normalized fields", () => {
    const items = normalizeKnowledgeV2CatalogItems({
      documents: [
        documentFixture({
          knowledgeDocumentId: "docs",
          quickSummary: "Explains knowledge retrieval safety.",
        }),
      ],
      skills: [skillFixture({ skillId: "skill", steps: "Run focused tests." })],
    });

    expect(
      filterKnowledgeV2CatalogItems(items, { text: "retrieval SAFETY" }).map(
        (item) => item.id,
      ),
    ).toEqual(["document:docs"]);
    expect(
      filterKnowledgeV2CatalogItems(items, { text: "focused tests" }).map(
        (item) => item.id,
      ),
    ).toEqual(["skill:skill"]);
  });

  it("keeps selected item stable across filtering while still present", () => {
    const viewModel = buildKnowledgeV2CatalogViewModel({
      documents: [documentFixture()],
      filters: { types: ["skill"] },
      selection: {
        selectedItemId: "skill:skill_1",
        selectedPreviewKind: "details",
      },
      skills: [skillFixture()],
      sort: "title-asc",
    });

    expect(viewModel.filteredItems.map((item) => item.id)).toEqual([
      "skill:skill_1",
    ]);
    expect(viewModel.selection).toEqual({
      selectedItemId: "skill:skill_1",
      selectedPreviewKind: "details",
    });
  });

  it("does not mutate input arrays", () => {
    const documents = [documentFixture()];
    const skills = [skillFixture()];
    const originalDocuments = [...documents];
    const originalSkills = [...skills];

    const items = normalizeKnowledgeV2CatalogItems({ documents, skills });
    filterKnowledgeV2CatalogItems(items, { text: "react" });
    buildKnowledgeV2CatalogViewModel({
      documents,
      filters: { types: ["document"] },
      selection: {
        selectedItemId: "document:kdoc_1",
        selectedPreviewKind: "summary",
      },
      skills,
    });

    expect(documents).toEqual(originalDocuments);
    expect(skills).toEqual(originalSkills);
  });
});

function documentFixture(
  overrides: Partial<KnowledgeDocument> = {},
): KnowledgeDocument {
  return {
    catalogItemType: "documentation_knowledge",
    content: "Release process content.",
    createdAt: "2026-01-01T00:00:00.000Z",
    enabled: true,
    knowledgeDocumentId: "kdoc_1",
    lifecycleStatus: "active",
    quickSummary: "Release guide summary.",
    scope: "workspace",
    searchable: true,
    sourceKind: "docs_path",
    sourceLabel: "Release docs",
    sourceRef: "docs/release.md",
    tags: "release",
    title: "Release guide",
    updatedAt: "2026-01-02T00:00:00.000Z",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function skillFixture(overrides: Partial<Skill> = {}): Skill {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    prerequisites: "Know the changed files.",
    reviewStatus: "draft",
    risks: "Missing regression coverage.",
    skillId: "skill_1",
    steps: "Read the diff.",
    tags: "review",
    title: "React review",
    updatedAt: "2026-01-03T00:00:00.000Z",
    validation: "Run relevant tests.",
    whenToUse: "Use when reviewing React changes.",
    workspaceId: "workspace_1",
    ...overrides,
  };
}
