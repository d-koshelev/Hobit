import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeDocument } from "../workspace/types/knowledgeDocuments";
import type { Skill } from "../workspace/types/skills";
import { widgetCatalogTemplates } from "./catalogTemplates";
import { LegacyKnowledgeSkillsWidget } from "./SkillLibraryWidget";
import { WidgetCatalogShell } from "./WidgetCatalogShell";
import { WidgetHost } from "./WidgetHost";
import type { CoordinatorAttachedContextInput, WidgetInstance } from "./types";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import {
  SKILL_LIBRARY_COMPONENT_KEY,
  SKILL_LIBRARY_WIDGET_DEFINITION_ID,
  getWidgetDefinition,
} from "./widgetRegistry";

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
});

describe("Knowledge / Skills KnowledgeV2 routing", () => {
  it("keeps the Widget Catalog card on the saved-compatible Knowledge / Skills id", () => {
    const template = widgetCatalogTemplates.find(
      (candidate) =>
        candidate.futureWidgetDefinitionId === SKILL_LIBRARY_WIDGET_DEFINITION_ID,
    );

    expect(template).toMatchObject({
      futureWidgetDefinitionId: SKILL_LIBRARY_WIDGET_DEFINITION_ID,
      id: SKILL_LIBRARY_WIDGET_DEFINITION_ID,
      title: "Knowledge / Skills",
    });
    expect(getWidgetDefinition(SKILL_LIBRARY_WIDGET_DEFINITION_ID)).toMatchObject({
      componentKey: SKILL_LIBRARY_COMPONENT_KEY,
      defaultTitle: "Knowledge / Skills",
      id: SKILL_LIBRARY_WIDGET_DEFINITION_ID,
    });
  });

  it("renders the normal Widget Catalog without a legacy Knowledge / Skills card", async () => {
    await render(<WidgetCatalogShell isOpen={true} onClose={vi.fn()} />);

    expect(text()).toContain("Knowledge / Skills");
    expect(text()).toContain("Workspace and global documents plus reusable procedures.");
    expect(text()).not.toContain("Legacy Knowledge / Skills");
    expect(text()).not.toContain("Compatibility surface");
    expect(
      document.querySelector("[data-catalog-template-id='skill-library']"),
    ).not.toBeNull();
  });

  it("renders KnowledgeV2 for a normal Knowledge / Skills widget instance", async () => {
    const actions = widgetActions();

    await render(<WidgetHost {...widgetHostProps(actions)} />);
    await flush();

    expect(text()).toContain("Knowledge / Skills");
    expect(text()).toContain("Knowledge Catalog");
    expect(text()).toContain("Release guide");
    expect(text()).toContain("React review");
    expect(regionByName("Knowledge catalog items")).not.toBeNull();
    expect(document.querySelector("[data-widget-v2-shell]")).not.toBeNull();
    expect(document.querySelector(".skill-library-shell")).toBeNull();
    expect(document.querySelector(".skill-library-layout")).toBeNull();
    expect(text()).not.toContain("Legacy Knowledge / Skills");
    expect(text()).not.toContain("Compatibility surface");
  });

  it("does not mutate Knowledge data on normal KnowledgeV2 render", async () => {
    const actions = widgetActions();

    await render(<WidgetHost {...widgetHostProps(actions)} />);
    await flush();

    expect(actions.listKnowledgeDocuments).toHaveBeenCalledTimes(1);
    expect(actions.listSkills).toHaveBeenCalledTimes(1);
    expect(actions.createKnowledgeDocument).not.toHaveBeenCalled();
    expect(actions.createSkill).not.toHaveBeenCalled();
    expect(actions.readKnowledgeDocumentImportFile).not.toHaveBeenCalled();
    expect(actions.recordKnowledgeDraftReview).not.toHaveBeenCalled();
    expect(actions.createAgentQueueTask).not.toHaveBeenCalled();
    expect(actions.updateKnowledgeDocument).not.toHaveBeenCalled();
    expect(actions.updateSkill).not.toHaveBeenCalled();
    expect(actions.deleteKnowledgeDocument).not.toHaveBeenCalled();
    expect(actions.deleteSkill).not.toHaveBeenCalled();
  });

  it("opens existing Knowledge / Skills flows only from explicit KnowledgeV2 popup actions", async () => {
    const actions = widgetActions();

    await render(<WidgetHost {...widgetHostProps(actions)} />);
    await flush();

    expect(regionByName("Legacy Knowledge / Skills existing flow")).toBeNull();
    expect(actions.createKnowledgeDocument).not.toHaveBeenCalled();
    expect(actions.createSkill).not.toHaveBeenCalled();
    expect(actions.readKnowledgeDocumentImportFile).not.toHaveBeenCalled();

    await clickButton("New");
    expect(dialogByName("New")?.textContent).toContain("New document");
    expect(regionByName("Legacy Knowledge / Skills existing flow")).toBeNull();
    expect(actions.createKnowledgeDocument).not.toHaveBeenCalled();

    await clickButton("Open existing create flow");
    await flush();

    expect(regionByName("Legacy Knowledge / Skills existing flow")).not.toBeNull();
    expect(regionByName("Catalog item editor")).not.toBeNull();
    expect(text()).toContain("Legacy Knowledge / Skills");
    expect(text()).toContain("Compatibility surface");
    expect(actions.createKnowledgeDocument).not.toHaveBeenCalled();
    expect(actions.createSkill).not.toHaveBeenCalled();
    expect(actions.readKnowledgeDocumentImportFile).not.toHaveBeenCalled();
  });

  it("bridges Use as Context through the host callback once after click", async () => {
    const actions = widgetActions();
    const onAttachContextToCoordinator = vi.fn();

    await render(
      <WidgetHost
        {...widgetHostProps(actions, { onAttachContextToCoordinator })}
      />,
    );
    await flush();

    expect(onAttachContextToCoordinator).not.toHaveBeenCalled();

    await clickButton("Release guide");
    await clickButton("Use as context");
    expect(onAttachContextToCoordinator).not.toHaveBeenCalled();

    await clickButton("Attach");

    expect(onAttachContextToCoordinator).toHaveBeenCalledTimes(1);
    expect(onAttachContextToCoordinator).toHaveBeenCalledWith({
      contextText: expect.stringContaining("Release guide"),
      sourceLabel: "KnowledgeV2 / Knowledge Document",
    });
    expect(actions.createAgentQueueTask).not.toHaveBeenCalled();
  });

  it("keeps the legacy Knowledge / Skills component directly renderable", async () => {
    await render(
      <LegacyKnowledgeSkillsWidget
        config={{}}
        definition={getWidgetDefinition(SKILL_LIBRARY_WIDGET_DEFINITION_ID)!}
        instance={knowledgeWidgetInstance()}
        onGetSkill={vi.fn()}
        onListKnowledgeDocuments={vi.fn(async () => [])}
        onListSkills={vi.fn(async () => [])}
        title="Knowledge / Skills"
      />,
    );
    await flush();

    expect(text()).toContain("Legacy Knowledge / Skills");
    expect(text()).toContain("Compatibility surface");
    expect(document.querySelector(".skill-library-shell")).not.toBeNull();
    expect(document.querySelector("[data-widget-v2-shell]")).toBeNull();
    expect(text()).not.toContain("Knowledge Catalog");
  });
});

async function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function text() {
  return document.body.textContent ?? "";
}

function regionByName(name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[aria-label]")).find(
      (element) => element.getAttribute("aria-label") === name,
    ) ?? null
  );
}

async function clickButton(textContent: string) {
  const button = buttonWithText(textContent);
  expect(button).not.toBeNull();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function buttonWithText(textContent: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes(textContent),
    ) ?? null
  );
}

function dialogByName(name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']")).find(
      (element) => element.textContent?.includes(name),
    ) ?? null
  );
}

function widgetHostProps(
  actions: WorkbenchWidgetInstanceActions,
  overrides: {
    onAttachContextToCoordinator?: (
      request: CoordinatorAttachedContextInput,
    ) => void;
  } = {},
) {
  return {
    agentActivityEvents: [],
    agentExecutorRunOpenRequest: null,
    agentExecutorSlots: [],
    agentQueueItemOpenRequest: null,
    coordinatorAttachedContextRequest: null,
    directWorkGitReview: {} as never,
    directWorkRunHandoff: {} as never,
    hasGitWidget: false,
    instance: knowledgeWidgetInstance(),
    layoutMode: "editing" as const,
    onDockBack: vi.fn(),
    onAttachContextToCoordinator: overrides.onAttachContextToCoordinator,
    onOpenAgentExecutorRun: vi.fn(),
    onPopOut: vi.fn(),
    onPublishAgentActivityEvents: vi.fn(),
    onStartDockedDrag: vi.fn(),
    onStartPopoutDrag: vi.fn(),
    presentationMode: "docked" as const,
    queueReportActionCardRequest: null,
    widgetActions: actions,
    workspaceId: "workspace_1",
    workspaceQueueApi: {
      controller: {
        knowledgeContext: {
          onAttachSelected: vi.fn(),
        },
      },
      queueExecutorSlots: [],
      queueId: "queue_workspace_1",
    } as never,
    ...overrides,
  };
}

function widgetActions(): WorkbenchWidgetInstanceActions {
  return {
    createAgentQueueTask: vi.fn(),
    createKnowledgeDocument: vi.fn(),
    createSkill: vi.fn(),
    deleteKnowledgeDocument: vi.fn(),
    deleteSkill: vi.fn(),
    getKnowledgeDocument: vi.fn(),
    getSkill: vi.fn(),
    listKnowledgeDocuments: vi.fn(async () => [documentFixture()]),
    listKnowledgeDraftReviews: vi.fn(async () => []),
    listSkills: vi.fn(async () => [skillFixture()]),
    listWidgetLogs: vi.fn(async () => []),
    logRefreshTokens: {},
    readKnowledgeDocumentImportFile: vi.fn(),
    recordKnowledgeDraftReview: vi.fn(),
    removeWidgetInstance: vi.fn(),
    updateKnowledgeDocument: vi.fn(),
    updateSkill: vi.fn(),
  } as unknown as WorkbenchWidgetInstanceActions;
}

function knowledgeWidgetInstance(): WidgetInstance {
  return {
    config: {},
    definitionId: SKILL_LIBRARY_WIDGET_DEFINITION_ID,
    id: "widget_knowledge_1",
    layout: {
      area: "main",
      height: 600,
      mode: "docked",
      order: 0,
      width: 744,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Knowledge / Skills",
    visible: true,
  };
}

function documentFixture(): KnowledgeDocument {
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
    updatedAt: "2026-01-04T00:00:00.000Z",
    workspaceId: "workspace_1",
  };
}

function skillFixture(): Skill {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    prerequisites: "Know the changed files.",
    reviewStatus: "reviewed",
    risks: "Missing regression coverage.",
    skillId: "skill_1",
    steps: "Read the diff.",
    tags: "review",
    title: "React review",
    updatedAt: "2026-01-03T00:00:00.000Z",
    validation: "Run relevant tests.",
    whenToUse: "Use when reviewing React changes.",
    workspaceId: "workspace_1",
  };
}
