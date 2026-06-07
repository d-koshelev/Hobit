import { describe, expect, it } from "vitest";

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

  it("keeps Widget V2 kinds unique", () => {
    const kinds = widgetV2Manifests.map((manifest) => manifest.kind);

    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("does not make planned or experimental V2 widgets available by default", () => {
    expect(widgetV2Manifests.every((manifest) => manifest.status !== "available")).toBe(
      true,
    );
    expect(getAvailableWidgetV2Manifests()).toEqual([]);
  });

  it("returns manifests by kind without using the V1 widget registry", () => {
    expect(getWidgetV2Manifest("queue-v2")?.title).toBe("Queue V2");
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
