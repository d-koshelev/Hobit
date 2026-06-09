import { describe, expect, it } from "vitest";

import {
  getWidgetDefinition,
  INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY,
  INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
} from "../widgetRegistry";
import {
  getAvailableWidgetV2Manifests,
  getWidgetV2Manifest,
  validateWidgetV2Registry,
  widgetV2Manifests,
  widgetV2Registry,
} from "./widgetV2Registry";

describe("Widget V2 registry", () => {
  it("defines the planned V2 candidates as metadata only", () => {
    expect(widgetV2Manifests.map((manifest) => manifest.name)).toEqual([
      "QueueV2",
      "KnowledgeV2",
      "WorkspaceAgentV2",
      "TerminalV2",
      "FinderV2",
      "NotesV2",
    ]);
    expect(widgetV2Registry.size).toBe(widgetV2Manifests.length);
  });

  it("defines QueueV2 as the available Agent Queue visual manifest", () => {
    expect(getWidgetV2Manifest("queue-v2")).toMatchObject({
      kind: "queue-v2",
      name: "QueueV2",
      productOwnerDomain: "agent-queue",
      status: "available",
      title: "Agent Queue",
    });
  });

  it("defines KnowledgeV2 as the experimental Knowledge / Skills route target", () => {
    expect(getWidgetV2Manifest("knowledge-v2")).toMatchObject({
      kind: "knowledge-v2",
      name: "KnowledgeV2",
      productOwnerDomain: "knowledge",
      status: "experimental",
      title: "Knowledge Catalog v2",
    });
    expect(
      getAvailableWidgetV2Manifests().some(
        (manifest) => manifest.kind === "knowledge-v2",
      ),
    ).toBe(false);
    expect(getWidgetDefinition("skill-library")).toMatchObject({
      componentKey: "skill-library-widget",
      defaultTitle: "Knowledge / Skills",
      id: "skill-library",
      title: "Knowledge / Skills",
    });
    expect(getWidgetDefinition("knowledge-v2")).toBeUndefined();
  });

  it("keeps Widget V2 kinds unique", () => {
    const kinds = widgetV2Manifests.map((manifest) => manifest.kind);

    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("keeps only QueueV2 available while future V2 widgets remain unavailable", () => {
    expect(getAvailableWidgetV2Manifests().map((manifest) => manifest.kind)).toEqual([
      "queue-v2",
    ]);
    expect(
      widgetV2Manifests
        .filter((manifest) => manifest.kind !== "queue-v2")
        .every((manifest) => manifest.status !== "available"),
    ).toBe(true);
  });

  it("keeps WorkspaceAgentV2 experimental and outside available manifests", () => {
    expect(getWidgetV2Manifest("workspace-agent-v2")).toMatchObject({
      kind: "workspace-agent-v2",
      name: "WorkspaceAgentV2",
      productOwnerDomain: "workspace-agent",
      status: "experimental",
      title: "Workspace Agent v2",
    });
    expect(
      getAvailableWidgetV2Manifests().some(
        (manifest) => manifest.kind === "workspace-agent-v2",
      ),
    ).toBe(false);
  });

  it("leaves the V1 Workspace Agent registry identity unchanged", () => {
    expect(getWidgetDefinition(INTERACTIVE_AGENT_WIDGET_DEFINITION_ID)).toMatchObject({
      componentKey: INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY,
      defaultTitle: "Workspace Agent",
      id: "interactive-agent",
      title: "Workspace Agent",
    });
    expect(getWidgetDefinition("workspace-agent-v2")).toBeUndefined();
  });

  it("returns manifests by kind without using the V1 widget registry", () => {
    expect(getWidgetV2Manifest("queue-v2")?.title).toBe("Agent Queue");
    expect(getWidgetV2Manifest("notes-v2")?.productOwnerDomain).toBe("notes");
  });

  it("validates all registry manifests", () => {
    expect(validateWidgetV2Registry()).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("requires the requested registry metadata on every manifest", () => {
    for (const manifest of widgetV2Manifests) {
      expect(manifest.title.trim()).not.toBe("");
      expect(manifest.description.trim()).not.toBe("");
      expect(manifest.capabilities.length).toBeGreaterThan(0);
      expect(manifest.layoutKind.trim()).not.toBe("");
      expect(["planned", "experimental", "available"]).toContain(manifest.status);
      expect(manifest.productOwnerDomain.trim()).not.toBe("");
      expect(manifest.safetyBoundaries.length).toBeGreaterThan(0);
    }
  });
});
