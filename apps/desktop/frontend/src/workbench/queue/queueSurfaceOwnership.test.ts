import { describe, expect, it } from "vitest";

import { widgetCatalogTemplates } from "../catalogTemplates";
import { AgentQueuePlaceholderWidget } from "../AgentQueuePlaceholderWidget";
import { QueueV2SmokeCompatWidget } from "../widgetV2";
import * as queueV2Barrel from "../widgetV2/queueV2";
import {
  getAvailableWidgetV2Manifests,
  getWidgetV2Manifest,
} from "../widgetV2/widgetV2Registry";
import {
  compatibilityWidgetComponents,
  getWidgetHostComponent,
  productWidgetComponents,
} from "../widgetHostComponents";
import { getWidgetDefinition } from "../widgetRegistry";
import {
  activeQueueProductSurface,
  isActiveQueueProductWidgetId,
  isQueueV2SmokeCompatKind,
  queueV2SmokeCompatSurface,
} from "./queueSurfaceOwnership";

describe("Queue UI surface ownership", () => {
  it("documents the active product Queue route through the saved-compatible widget id", () => {
    expect(activeQueueProductSurface.route).toEqual([
      "WidgetHost",
      "AgentQueuePlaceholderWidget",
      "AgentQueueV2Board",
    ]);
    expect(activeQueueProductSurface.widgetDefinitionId).toBe("agent-queue");
    expect(activeQueueProductSurface.componentKey).toBe(
      "agent-queue-placeholder",
    );
    expect(activeQueueProductSurface.cssNamespaces).toEqual([
      "agent-queue",
      "agent-queue-v2",
    ]);
    expect(isActiveQueueProductWidgetId("agent-queue")).toBe(true);
    expect(isActiveQueueProductWidgetId("queue-v2")).toBe(false);
  });

  it("keeps registry, catalog, and WidgetHost pointed at one Queue product surface", () => {
    expect(
      getWidgetDefinition(activeQueueProductSurface.widgetDefinitionId),
    ).toMatchObject({
      componentKey: activeQueueProductSurface.componentKey,
      id: activeQueueProductSurface.widgetDefinitionId,
      singleton: true,
      singletonKey: "workspace-queue",
      singletonScope: "workspace",
    });
    expect(
      widgetCatalogTemplates.filter(
        (template) =>
          template.futureWidgetDefinitionId ===
            activeQueueProductSurface.widgetDefinitionId ||
          template.id === activeQueueProductSurface.widgetDefinitionId,
      ),
    ).toHaveLength(1);
    expect(productWidgetComponents[activeQueueProductSurface.componentKey]).toBe(
      AgentQueuePlaceholderWidget,
    );
    expect(getWidgetHostComponent(activeQueueProductSurface.componentKey)).toBe(
      AgentQueuePlaceholderWidget,
    );
  });

  it("does not expose QueueV2 as a second product widget, catalog entry, or host component", () => {
    expect(queueV2SmokeCompatSurface).toMatchObject({
      barrelExportName: "QueueV2SmokeCompatWidget",
      userCreatable: false,
      widgetDefinitionId: null,
      widgetV2Kind: "queue-v2",
    });
    expect(isQueueV2SmokeCompatKind("queue-v2")).toBe(true);
    expect(getWidgetDefinition(queueV2SmokeCompatSurface.widgetV2Kind)).toBeUndefined();
    expect(
      widgetCatalogTemplates.some(
        (template) =>
          template.id === queueV2SmokeCompatSurface.widgetV2Kind ||
          template.futureWidgetDefinitionId ===
            queueV2SmokeCompatSurface.widgetV2Kind,
      ),
    ).toBe(false);
    expect(
      productWidgetComponents[queueV2SmokeCompatSurface.widgetV2Kind],
    ).toBeUndefined();
    expect(
      compatibilityWidgetComponents[queueV2SmokeCompatSurface.widgetV2Kind],
    ).toBeUndefined();
    expect(
      getWidgetHostComponent(queueV2SmokeCompatSurface.widgetV2Kind),
    ).toBeUndefined();
  });

  it("keeps the WidgetV2 Queue shell available only through the smoke/compat export", () => {
    expect(QueueV2SmokeCompatWidget).toBe(
      queueV2Barrel.QueueV2SmokeCompatWidget,
    );
    expect("QueueV2Widget" in queueV2Barrel).toBe(false);
    expect(getWidgetV2Manifest(queueV2SmokeCompatSurface.widgetV2Kind)).toMatchObject({
      kind: queueV2SmokeCompatSurface.widgetV2Kind,
      productOwnerDomain: "agent-queue",
      status: "experimental",
    });
    expect(
      getAvailableWidgetV2Manifests().some(
        (manifest) => manifest.kind === queueV2SmokeCompatSurface.widgetV2Kind,
      ),
    ).toBe(false);
  });
});
