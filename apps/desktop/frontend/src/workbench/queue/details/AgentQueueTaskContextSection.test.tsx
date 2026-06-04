import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { AgentQueueTask, KnowledgeDocument } from "../../../workspace/types";
import { attachContextToQueueTask } from "../../agentQueueKnowledgeContext";
import { AgentQueueTaskContextSection } from "./AgentQueueTaskContextSection";

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

describe("AgentQueueTaskContextSection", () => {
  it("renders current-session limitation and visible prompt preview", () => {
    const selectedTask = attachContextToQueueTask(
      queueTask(),
      {
        document: knowledgeDocument({
          content: "Visible bounded body for the run prompt.",
          title: "Queue context docs",
        }),
        kind: "knowledge_document",
      },
      "2026-06-04T10:00:00.000Z",
    );

    renderContextSection(selectedTask);

    expect(document.body.textContent).toContain(
      "Attached for this session only.",
    );
    expect(document.body.textContent).toContain(
      "not saved as Queue task context",
    );
    expect(document.body.textContent).toContain("Prepared session snapshots");
    expect(document.body.textContent).toContain("Prompt context preview");
    expect(document.body.textContent).toContain(
      "Only this visible, bounded, current-session Queue task context is included.",
    );
    expect(document.body.textContent).toContain(
      "Visible bounded body for the run prompt.",
    );
    expect(document.body.textContent).toContain(
      "Prepared: 2026-06-04T10:00:00.000Z.",
    );
  });

  it("keeps empty state scoped to this session", () => {
    renderContextSection(queueTask());

    expect(document.body.textContent).toContain(
      "No Knowledge or Skill refs are attached for this session.",
    );
  });
});

function renderContextSection(selectedTask: AgentQueueTask) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(<AgentQueueTaskContextSection selectedTask={selectedTask} />);
  });
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: "executor-1",
    createdAt: "2026-06-04T08:00:00.000Z",
    description: "Queue task description",
    executionPolicy: "manual",
    priority: 1,
    prompt: "Run the selected Queue task.",
    queueItemId: "queue-1",
    status: "ready",
    title: "Selected Queue task",
    updatedAt: "2026-06-04T08:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function knowledgeDocument(
  overrides: Partial<KnowledgeDocument> = {},
): KnowledgeDocument {
  return {
    catalogItemType: "documentation_knowledge",
    content: "Document content.",
    createdAt: "2026-06-04T08:00:00.000Z",
    enabled: true,
    knowledgeDocumentId: "doc-1",
    lifecycleStatus: "active",
    quickSummary: "Document summary.",
    scope: "workspace",
    sourceKind: "operator_authored",
    sourceLabel: "Workspace document",
    sourceRef: "",
    tags: "docs",
    title: "Knowledge document",
    updatedAt: "2026-06-04T09:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
