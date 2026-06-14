import { describe, expect, it } from "vitest";

import {
  AGENT_QUEUE_WIDGET_DEFINITION_ID,
  AGENT_RUN_PLACEHOLDER_COMPONENT_KEY,
  AGENT_RUN_WIDGET_DEFINITION_ID,
  GIT_PLACEHOLDER_COMPONENT_KEY,
  GIT_WIDGET_DEFINITION_ID,
  INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
  NOTES_WIDGET_DEFINITION_ID,
  TERMINAL_WIDGET_DEFINITION_ID,
  compatibilityWidgetDefinitions,
  findWorkspaceSingletonDefinition,
  getWidgetDefinition,
  getWidgetLayoutDefaults,
  internalCompatibilityWidgetDefinitionIds,
  internalDeprecatedWidgetDefinitionIds,
  isUserFacingWidgetDefinition,
  productWidgetDefinitions,
  userFacingWidgetDefinitionIds,
  widgetRegistry,
} from "./widgetRegistry";

describe("widgetRegistry compatibility isolation", () => {
  it("keeps compatibility definitions out of the product definition group", () => {
    expect(
      productWidgetDefinitions.some(
        (definition) => definition.id === AGENT_RUN_WIDGET_DEFINITION_ID,
      ),
    ).toBe(false);
    expect(
      productWidgetDefinitions.some(
        (definition) => definition.id === GIT_WIDGET_DEFINITION_ID,
      ),
    ).toBe(false);
  });

  it("keeps persisted compatibility ids registered for lookup", () => {
    expect(compatibilityWidgetDefinitions.map((definition) => definition.id)).toEqual([
      AGENT_RUN_WIDGET_DEFINITION_ID,
      GIT_WIDGET_DEFINITION_ID,
    ]);
    expect(widgetRegistry.map((definition) => definition.id)).toEqual([
      ...productWidgetDefinitions.map((definition) => definition.id),
      ...compatibilityWidgetDefinitions.map((definition) => definition.id),
    ]);
    expect(getWidgetDefinition(AGENT_RUN_WIDGET_DEFINITION_ID)).toMatchObject({
      componentKey: AGENT_RUN_PLACEHOLDER_COMPONENT_KEY,
      defaultTitle: "Agent Executor",
      title: "Agent Executor",
    });
    expect(getWidgetDefinition(GIT_WIDGET_DEFINITION_ID)).toMatchObject({
      componentKey: GIT_PLACEHOLDER_COMPONENT_KEY,
      defaultTitle: "Git",
      title: "Git",
    });
  });

  it("marks compat definitions as non-user-facing without changing their layouts", () => {
    expect(userFacingWidgetDefinitionIds.has(AGENT_RUN_WIDGET_DEFINITION_ID)).toBe(
      false,
    );
    expect(userFacingWidgetDefinitionIds.has(GIT_WIDGET_DEFINITION_ID)).toBe(
      false,
    );
    expect(isUserFacingWidgetDefinition(AGENT_RUN_WIDGET_DEFINITION_ID)).toBe(
      false,
    );
    expect(isUserFacingWidgetDefinition(GIT_WIDGET_DEFINITION_ID)).toBe(false);
    expect(
      internalCompatibilityWidgetDefinitionIds.has(
        AGENT_RUN_WIDGET_DEFINITION_ID,
      ),
    ).toBe(true);
    expect(internalCompatibilityWidgetDefinitionIds.has(GIT_WIDGET_DEFINITION_ID)).toBe(
      true,
    );
    expect(internalDeprecatedWidgetDefinitionIds.has(GIT_WIDGET_DEFINITION_ID)).toBe(
      true,
    );
    expect(getWidgetLayoutDefaults(AGENT_RUN_WIDGET_DEFINITION_ID)).toEqual({
      defaultHeight: 600,
      defaultWidth: 672,
      minHeight: 480,
      minWidth: 576,
    });
    expect(getWidgetLayoutDefaults(GIT_WIDGET_DEFINITION_ID)).toEqual({
      defaultHeight: 600,
      defaultWidth: 768,
      minHeight: 456,
      minWidth: 576,
    });
  });
});

describe("widgetRegistry Queue singleton metadata", () => {
  it("marks Agent Queue as the workspace singleton Queue surface", () => {
    expect(getWidgetDefinition(AGENT_QUEUE_WIDGET_DEFINITION_ID)).toMatchObject({
      id: AGENT_QUEUE_WIDGET_DEFINITION_ID,
      singleton: true,
      singletonKey: "workspace-queue",
      singletonScope: "workspace",
      title: "Agent Queue",
    });
  });

  it("does not mark expected multi-instance widgets as singleton", () => {
    for (const id of [
      INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
      NOTES_WIDGET_DEFINITION_ID,
      TERMINAL_WIDGET_DEFINITION_ID,
    ]) {
      const definition = getWidgetDefinition(id);

      expect(definition?.id).toBe(id);
      expect(definition?.singleton).toBeUndefined();
      expect(definition?.singletonKey).toBeUndefined();
      expect(definition?.singletonScope).toBeUndefined();
    }
  });

  it("does not turn compatibility or deprecated widgets into Queue surfaces", () => {
    for (const definition of compatibilityWidgetDefinitions) {
      expect(definition.id).not.toBe(AGENT_QUEUE_WIDGET_DEFINITION_ID);
      expect(definition.singleton).toBeUndefined();
      expect(definition.singletonKey).toBeUndefined();
      expect(definition.singletonScope).toBeUndefined();
      expect(findWorkspaceSingletonDefinition(definition.id)).toBeUndefined();
    }
  });

  it("resolves only Agent Queue through workspace singleton metadata", () => {
    expect(
      findWorkspaceSingletonDefinition(AGENT_QUEUE_WIDGET_DEFINITION_ID),
    ).toMatchObject({
      id: AGENT_QUEUE_WIDGET_DEFINITION_ID,
      singletonKey: "workspace-queue",
      singletonScope: "workspace",
    });
    expect(
      findWorkspaceSingletonDefinition(INTERACTIVE_AGENT_WIDGET_DEFINITION_ID),
    ).toBeUndefined();
    expect(findWorkspaceSingletonDefinition("queue-v2")).toBeUndefined();
  });

  it("keeps exactly one workspace singleton definition", () => {
    expect(
      widgetRegistry
        .filter((definition) => definition.singleton === true)
        .map((definition) => ({
          id: definition.id,
          singletonKey: definition.singletonKey,
          singletonScope: definition.singletonScope,
        })),
    ).toEqual([
      {
        id: AGENT_QUEUE_WIDGET_DEFINITION_ID,
        singletonKey: "workspace-queue",
        singletonScope: "workspace",
      },
    ]);
  });
});
