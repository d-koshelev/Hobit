import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeDocument, Skill } from "../workspace/types";
import { SkillLibraryWidget } from "./SkillLibraryWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("SkillLibraryWidget Knowledge / Queue attachments", () => {
  it("attaches the selected saved Skill to the selected Queue task from the Skills tab", async () => {
    const skill = skillFixture({
      reviewStatus: "reviewed",
      skillId: "skill_queue",
      steps: "Use the Queue context panel.",
      title: "Queue planning skill",
      whenToUse: "Before running a queued frontend task",
    });
    const attachKnowledgeContextToQueueTask = vi.fn(() => ({
      message: "Queue planning skill attached to Frontend test task.",
      status: "attached" as const,
      taskTitle: "Frontend test task",
    }));

    renderWidget({
      onAttachKnowledgeContextToQueueTask: attachKnowledgeContextToQueueTask,
      onGetSkill: vi.fn(async () => skill),
      onListSkills: vi.fn(async () => [skill]),
    });

    await flush();
    await clickButton("Skills");
    await clickButton("Attach to Queue task");

    expect(attachKnowledgeContextToQueueTask).toHaveBeenCalledTimes(1);
    expect(attachKnowledgeContextToQueueTask).toHaveBeenCalledWith({
      kind: "skill",
      skill: expect.objectContaining({
        reviewStatus: "reviewed",
        skillId: "skill_queue",
        title: "Queue planning skill",
      }),
    });
    expect(document.body.textContent).toContain(
      "Queue planning skill attached to Frontend test task.",
    );
  });

  it("attaches selected Knowledge to Queue and shows blocked disabled-document feedback", async () => {
    const documents = [
      knowledgeDocumentFixture({
        content: "Use the active document body for bounded Queue context.",
        enabled: true,
        knowledgeDocumentId: "doc_active_queue",
        quickSummary: "Active Queue context.",
        sourceLabel: "docs/active.md",
        title: "Active Queue docs",
      }),
      knowledgeDocumentFixture({
        content: "Disabled body must not be accepted for Queue context.",
        enabled: false,
        knowledgeDocumentId: "doc_disabled_queue",
        quickSummary: "Disabled Queue context.",
        sourceLabel: "docs/disabled.md",
        title: "Disabled Queue docs",
      }),
    ];
    const attachKnowledgeContextToQueueTask = vi.fn(
      (
        request:
          | { document: KnowledgeDocument; kind: "knowledge_document" }
          | { kind: "skill"; skill: Skill },
      ) => {
        if (
          request.kind === "knowledge_document" &&
          !request.document.enabled
        ) {
          return {
            message:
              "Disabled Queue docs is disabled and cannot be used as Queue context.",
            status: "blocked" as const,
          };
        }

        return {
          message: "Active Queue docs attached to Frontend test task.",
          status: "attached" as const,
          taskTitle: "Frontend test task",
        };
      },
    );

    renderWidget({
      onAttachKnowledgeContextToQueueTask: attachKnowledgeContextToQueueTask,
      onGetKnowledgeDocument: vi.fn(
        async (knowledgeDocumentId) =>
          documents.find(
            (document) => document.knowledgeDocumentId === knowledgeDocumentId,
          ) ?? null,
      ),
      onListKnowledgeDocuments: vi.fn(async () => documents),
    });

    await flush();

    expect(document.body.textContent).toContain("Active Queue docs");
    expect(document.body.textContent).toContain(
      "Use the active document body for bounded Queue context.",
    );

    await clickButton("Attach to Queue task");

    expect(attachKnowledgeContextToQueueTask).toHaveBeenCalledWith({
      document: expect.objectContaining({
        enabled: true,
        knowledgeDocumentId: "doc_active_queue",
      }),
      kind: "knowledge_document",
    });
    expect(document.body.textContent).toContain(
      "Active Queue docs attached to Frontend test task.",
    );
    expect(document.body.textContent).toContain(
      "Attached Queue task: Frontend test task",
    );

    await clickListRow("Disabled Queue docs");
    await clickButton("Attach to Queue task");

    expect(attachKnowledgeContextToQueueTask).toHaveBeenLastCalledWith({
      document: expect.objectContaining({
        enabled: false,
        knowledgeDocumentId: "doc_disabled_queue",
      }),
      kind: "knowledge_document",
    });
    expect(document.body.textContent).toContain(
      "Disabled Queue docs is disabled and cannot be used as Queue context.",
    );
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "Disabled Queue docs is disabled and cannot be used as Queue context.",
    );
  });
});

function renderWidget(
  overrides: Partial<Parameters<typeof SkillLibraryWidget>[0]> = {},
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <SkillLibraryWidget
        config={{}}
        definition={definition()}
        instance={instance()}
        onCreateSkill={vi.fn(async (request) => skillFixture(request))}
        onDeleteSkill={vi.fn(async () => true)}
        onGetSkill={vi.fn(async () => null)}
        onListSkills={vi.fn(async () => [])}
        onUpdateSkill={vi.fn(async (request) => skillFixture(request))}
        onCreateKnowledgeDocument={vi.fn(async (request) =>
          knowledgeDocumentFixture(request),
        )}
        onDeleteKnowledgeDocument={vi.fn(async () => true)}
        onGetKnowledgeDocument={vi.fn(async () => null)}
        onListKnowledgeDocuments={vi.fn(async () => [])}
        onUpdateKnowledgeDocument={vi.fn(async (request) =>
          knowledgeDocumentFixture(request),
        )}
        title="Skill Library"
        {...overrides}
      />,
    );
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function clickButton(text: string) {
  await act(async () => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) => !isHidden(candidate) && candidate.textContent === text,
    );
    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function clickListRow(text: string) {
  await act(async () => {
    const row = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".skill-list-row"),
    ).find(
      (candidate) =>
        !isHidden(candidate) && candidate.textContent?.includes(text),
    );
    if (!row) {
      throw new Error(`List row not found: ${text}`);
    }
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

function isHidden(element: Element) {
  return Boolean(element.closest("[hidden]"));
}

function skillFixture(
  overrides: Partial<Skill> & {
    reviewStatus?: Skill["reviewStatus"];
    title?: string;
  } = {},
): Skill {
  return {
    createdAt: "2026-05-24T00:00:00Z",
    prerequisites: "",
    reviewStatus: "draft",
    risks: "",
    skillId: "skill_1",
    steps: "",
    tags: "",
    title: "Skill",
    updatedAt: "2026-05-24T00:00:00Z",
    validation: "",
    whenToUse: "",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function knowledgeDocumentFixture(
  overrides: Partial<KnowledgeDocument> & {
    title?: string;
  } = {},
): KnowledgeDocument {
  return {
    catalogItemType: "documentation_knowledge",
    content: "",
    createdAt: "2026-05-24T00:00:00Z",
    enabled: true,
    knowledgeDocumentId: "doc_1",
    lifecycleStatus: "active",
    quickSummary: "",
    scope: "workspace",
    sourceKind: "operator_authored",
    sourceLabel: "Workspace document",
    sourceRef: "",
    tags: "",
    title: "Document",
    updatedAt: "2026-05-24T00:00:00Z",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function definition(): WidgetDefinition {
  return {
    category: "knowledge",
    componentKey: "skill-library-widget",
    defaultConfig: {},
    defaultTitle: "Skill Library",
    description: "Skill Library",
    id: "skill-library",
    title: "Skill Library",
  };
}

function instance(): WidgetInstance {
  return {
    config: {},
    definitionId: "skill-library",
    id: "skill_widget",
    layout: {
      area: "main",
      height: 720,
      mode: "docked",
      order: 0,
      width: 760,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Skill Library",
    visible: true,
  };
}
