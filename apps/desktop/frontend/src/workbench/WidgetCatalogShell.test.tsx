import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  widgetCatalogTemplates,
  type WidgetCatalogTemplate,
} from "./catalogTemplates";
import { WidgetCatalogShell } from "./WidgetCatalogShell";
import {
  AGENT_ACTIVITY_WIDGET_DEFINITION_ID,
  AGENT_QUEUE_WIDGET_DEFINITION_ID,
  AGENT_RUN_WIDGET_DEFINITION_ID,
  GIT_WIDGET_DEFINITION_ID,
  INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
  JDBC_WIDGET_DEFINITION_ID,
  NOTES_WIDGET_DEFINITION_ID,
  RUNBOOK_WIDGET_DEFINITION_ID,
  SKILL_LIBRARY_WIDGET_DEFINITION_ID,
  TERMINAL_WIDGET_DEFINITION_ID,
  isUserFacingWidgetDefinition,
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

describe("WidgetCatalogShell", () => {
  it("renders current product-facing widget names without Coordinator Chat", () => {
    renderCatalog();

    expect(document.body.textContent).toContain("Workspace Agent");
    expect(document.body.textContent).toContain("Agent Activity");
    expect(document.body.textContent).toContain("Knowledge / Skills");
    expect(document.body.textContent).toContain("Notes");
    expect(document.body.textContent).not.toContain("Git");
    expect(document.body.textContent).toContain("Terminal");
    expect(document.body.textContent).toContain("Agent Queue");
    expect(document.body.textContent).not.toContain("Agent Executor");
    expect(document.body.textContent).toContain("Database / JDBC");
    expect(document.body.textContent).toContain("Runbook");
    expect(document.body.textContent).not.toContain("Coordinator Chat");
  });

  it("renders compact category groups and current catalog copy", () => {
    renderCatalog();

    expect(document.body.textContent).toContain("Add tools to this workspace.");
    expect(groupTitles()).toEqual([
      "Agents",
      "Knowledge",
      "Developer Tools",
      "Operations / Planned",
    ]);
  });

  it("keeps current cards addable and routes the unchanged widget id", () => {
    const onAddTemplate = vi.fn();
    renderCatalog({ onAddTemplate });

    act(() => {
      buttonInCard(INTERACTIVE_AGENT_WIDGET_DEFINITION_ID).dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(onAddTemplate).toHaveBeenCalledTimes(1);
    expect(onAddTemplate.mock.calls[0][0]).toMatchObject({
      availability: "available",
      futureWidgetDefinitionId: INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
      title: "Workspace Agent",
    });
  });

  it("keeps already-added catalog cards disabled when the shell marks them unavailable", () => {
    renderCatalog({
      unavailableTemplateMessages: {
        [AGENT_QUEUE_WIDGET_DEFINITION_ID]: {
          actionLabel: "Already added",
          reason: "One Agent Queue per workspace",
        },
      },
    });

    const queueButton = buttonInCard(AGENT_QUEUE_WIDGET_DEFINITION_ID);

    expect(queueButton.textContent).toBe("Already added");
    expect(queueButton.disabled).toBe(true);
    expect(cardFor(AGENT_QUEUE_WIDGET_DEFINITION_ID)?.textContent).toContain(
      "One Agent Queue per workspace",
    );
  });
});

describe("widgetCatalogTemplates", () => {
  it("preserves current catalog insertion ids", () => {
    expect(catalogIds()).toEqual([
      INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
      AGENT_ACTIVITY_WIDGET_DEFINITION_ID,
      AGENT_QUEUE_WIDGET_DEFINITION_ID,
      SKILL_LIBRARY_WIDGET_DEFINITION_ID,
      NOTES_WIDGET_DEFINITION_ID,
      TERMINAL_WIDGET_DEFINITION_ID,
      JDBC_WIDGET_DEFINITION_ID,
      RUNBOOK_WIDGET_DEFINITION_ID,
    ]);
  });

  it("exposes widget-specific default and minimum layout metadata", () => {
    expect(templateFor(INTERACTIVE_AGENT_WIDGET_DEFINITION_ID).layoutDefaults).toEqual({
      defaultHeight: 672,
      defaultWidth: 840,
      minHeight: 480,
      minWidth: 672,
    });
    expect(templateFor(TERMINAL_WIDGET_DEFINITION_ID).layoutDefaults).toEqual({
      defaultHeight: 600,
      defaultWidth: 816,
      minHeight: 432,
      minWidth: 672,
    });
    expect(templateFor(AGENT_ACTIVITY_WIDGET_DEFINITION_ID).layoutDefaults).toEqual({
      defaultHeight: 600,
      defaultWidth: 600,
      minHeight: 432,
      minWidth: 480,
    });
    expect(templateFor(NOTES_WIDGET_DEFINITION_ID).layoutDefaults).toEqual({
      defaultHeight: 552,
      defaultWidth: 480,
      minHeight: 432,
      minWidth: 384,
    });
    expect(templateFor(SKILL_LIBRARY_WIDGET_DEFINITION_ID).layoutDefaults).toEqual({
      defaultHeight: 600,
      defaultWidth: 744,
      minHeight: 480,
      minWidth: 576,
    });
    expect(templateFor(JDBC_WIDGET_DEFINITION_ID).layoutDefaults).toEqual({
      defaultHeight: 600,
      defaultWidth: 768,
      minHeight: 456,
      minWidth: 576,
    });
    expect(templateFor(AGENT_QUEUE_WIDGET_DEFINITION_ID).layoutDefaults).toEqual({
      defaultHeight: 680,
      defaultWidth: 1160,
      minHeight: 432,
      minWidth: 720,
    });
  });

  it("keeps preview/planned status honest", () => {
    expect(templateFor(AGENT_QUEUE_WIDGET_DEFINITION_ID).readiness).toBe(
      "preview",
    );
    expect(templateFor(JDBC_WIDGET_DEFINITION_ID).readiness).toBe("preview");
    expect(templateFor(RUNBOOK_WIDGET_DEFINITION_ID).readiness).toBe("preview");
    expect(
      widgetCatalogTemplates.every(
        (template) =>
          template.readiness !== "planned" ||
          template.availability === "disabled",
      ),
    ).toBe(true);
  });

  it("does not offer Agent Executor or Git as normal catalog widgets", () => {
    expect(
      widgetCatalogTemplates.some(
        (template) => template.id === AGENT_RUN_WIDGET_DEFINITION_ID,
      ),
    ).toBe(false);
    expect(isUserFacingWidgetDefinition(AGENT_RUN_WIDGET_DEFINITION_ID)).toBe(
      false,
    );
    expect(widgetCatalogTemplates.some((template) => template.id === GIT_WIDGET_DEFINITION_ID))
      .toBe(false);
    expect(isUserFacingWidgetDefinition(GIT_WIDGET_DEFINITION_ID)).toBe(false);
  });

  it("describes Terminal with the current MVP surface", () => {
    const terminalDescription = templateFor(
      TERMINAL_WIDGET_DEFINITION_ID,
    ).description;

    expect(terminalDescription).toMatch(/terminal commands/i);
    expect(terminalDescription).toMatch(/working directory/i);
  });

  it("describes Database / JDBC as an honest mock read-only preview", () => {
    const template = templateFor(JDBC_WIDGET_DEFINITION_ID);

    expect(template.readiness).toBe("preview");
    expect(template.description).toMatch(/preview/i);
    expect(template.description).toMatch(/mock read-only SQL/i);
    expect(template.capabilitySummary.join(" ")).toMatch(/No credentials/i);
    expect(template.capabilitySummary.join(" ")).toMatch(/writes/i);
    expect(template.capabilitySummary.join(" ")).toMatch(
      /production database execution/i,
    );
  });
});

function renderCatalog(
  overrides: Partial<Parameters<typeof WidgetCatalogShell>[0]> = {},
) {
  render(
    <WidgetCatalogShell
      isOpen
      onAddTemplate={() => undefined}
      onClose={() => undefined}
      {...overrides}
    />,
  );
}

function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(element);
  });
}

function groupTitles() {
  return Array.from(
    document.querySelectorAll(".catalog-template-group-title"),
  ).map((element) => element.textContent);
}

function cardFor(widgetDefinitionId: string) {
  return document.querySelector<HTMLElement>(
    `[data-catalog-template-id="${widgetDefinitionId}"]`,
  );
}

function buttonInCard(widgetDefinitionId: string) {
  const button = cardFor(widgetDefinitionId)?.querySelector("button");

  if (!button) {
    throw new Error(`Catalog card button not found: ${widgetDefinitionId}`);
  }

  return button;
}

function templateFor(widgetDefinitionId: string): WidgetCatalogTemplate {
  const template = widgetCatalogTemplates.find(
    (candidate) => candidate.futureWidgetDefinitionId === widgetDefinitionId,
  );

  if (!template) {
    throw new Error(`Catalog template not found: ${widgetDefinitionId}`);
  }

  return template;
}

function catalogIds() {
  return widgetCatalogTemplates.map(
    (template) => template.futureWidgetDefinitionId,
  );
}
