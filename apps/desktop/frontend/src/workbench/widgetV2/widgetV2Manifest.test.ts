import { describe, expect, it } from "vitest";

import {
  assertUniqueWidgetV2Kinds,
  validateWidgetV2Manifest,
} from "./widgetV2Manifest";
import type { WidgetV2Manifest } from "./widgetV2Types";

function manifest(overrides: Partial<WidgetV2Manifest> = {}): WidgetV2Manifest {
  return {
    kind: "queue-v2",
    name: "Queue V2",
    title: "Queue V2",
    description: "Future Queue V2 metadata contract.",
    productRole: "Organize promoted async work with visible operator control.",
    capabilities: ["render-primary-surface", "dispatch-typed-action"],
    layoutKind: "operational",
    supportedLayoutKinds: ["minimal", "operational"],
    status: "planned",
    productOwnerDomain: "agent-queue",
    safetyBoundaries: ["No hidden execution."],
    requiredPanelSlots: ["header", "primary"],
    optionalPanelSlots: ["toolbar", "right-inspector", "bottom-drawer"],
    actions: [
      {
        type: "queue.create-draft",
        label: "Create draft",
        requiresApproval: true,
        risk: "low",
      },
    ],
    domainBoundary: "Queue-owned state and explicit typed actions only.",
    safeContextSummary: "No hidden cross-widget reads.",
    runtimeLimitations: ["No backend scheduler."],
    nonGoals: ["No hidden execution."],
    ...overrides,
  };
}

describe("Widget V2 manifest foundation", () => {
  it("accepts a complete static manifest", () => {
    const result = validateWidgetV2Manifest(manifest());

    expect(result).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("reports missing required manifest fields", () => {
    const result = validateWidgetV2Manifest(
      manifest({
        kind: "",
        name: " ",
        title: "",
        description: "",
        productRole: "",
        capabilities: [],
        layoutKind: "" as WidgetV2Manifest["layoutKind"],
        supportedLayoutKinds: [],
        status: "retired" as WidgetV2Manifest["status"],
        productOwnerDomain: "",
        safetyBoundaries: [],
        requiredPanelSlots: [],
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      "Widget V2 manifest requires a non-empty kind.",
      "Widget V2 manifest requires a non-empty name.",
      "Widget V2 manifest requires a non-empty title.",
      "Widget V2 manifest requires a non-empty description.",
      "Widget V2 manifest requires a non-empty product role.",
      "Widget V2 manifest requires at least one capability.",
      "Widget V2 manifest requires at least one supported layout kind.",
      "Widget V2 manifest requires a non-empty layout kind.",
      "Widget V2 manifest status must be planned, experimental, or available.",
      "Widget V2 manifest requires a non-empty product owner domain.",
      "Widget V2 manifest requires at least one safety boundary.",
      "Widget V2 manifest requires at least one required panel slot.",
    ]);
  });

  it("reports incomplete action intents", () => {
    const result = validateWidgetV2Manifest(
      manifest({
        actions: [
          {
            type: "",
            label: "",
          },
        ],
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      "Widget V2 manifest actions require non-empty action types.",
      "Widget V2 manifest actions require non-empty labels.",
    ]);
  });

  it("allows unique Widget V2 kinds", () => {
    expect(() =>
      assertUniqueWidgetV2Kinds([
        manifest({ kind: "queue-v2" }),
        manifest({ kind: "knowledge-v2" }),
      ]),
    ).not.toThrow();
  });

  it("throws on duplicate Widget V2 kinds", () => {
    expect(() =>
      assertUniqueWidgetV2Kinds([
        manifest({ kind: "queue-v2" }),
        manifest({ kind: "queue-v2" }),
      ]),
    ).toThrow("Duplicate Widget V2 manifest kind(s): queue-v2");
  });
});
