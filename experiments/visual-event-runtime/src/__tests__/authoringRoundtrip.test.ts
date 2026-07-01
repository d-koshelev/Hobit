import { describe, expect, it } from "vitest";
import {
  cloneJson,
  parseBindingRulesJson,
  parseEventFeedJsonl,
  parseScenarioDocumentJson,
  parseSceneConfigJson,
  serializeBindingRules,
  serializeEventFeedJsonl,
  serializeScenarioDocument,
  serializeSceneConfig,
} from "../authoringSerialization";
import {
  getAssetPackDiagnostics,
  getExpectedPublicSpriteSheetPaths,
} from "../assetDiagnostics";
import {
  validateAuthoringState,
  validateScenarioDocument,
} from "../authoringValidation";
import type {
  AssetPackManifest,
  BindingRule,
  ScenarioDocument,
  SceneConfig,
  VisualEvent,
} from "../contracts";
import {
  eventWithOffsetMs,
  normalizeEventTimeline,
  sortEventsByTimestamp,
} from "../eventAuthoring";
import { getPresenterShortcutAction } from "../presenterMode";
import { getPresentationReadinessChecklist } from "../presentationReadiness";
import { buildSceneRuntimeState } from "../runtimeState";
import { localAssetPacks } from "../sampleAssetPacks";
import {
  navalRealisticFallbackSprites,
  navalRealisticPack,
} from "../sampleAssetPacks/navalRealisticPack";
import { navalPlaceholderPack } from "../sampleAssetPacks/navalPlaceholderPack";
import { sceneConfig } from "../sampleData";
import { sampleBindingRules } from "../samples/bindingRules";
import { sampleEventFeed } from "../samples/eventFeed";
import { navalIncidentScenario } from "../samples/navalIncidentScenario";

function getRuntimeStateAt(virtualTimeMs: number) {
  return buildSceneRuntimeState({
    assetPack: navalRealisticPack,
    events: sampleEventFeed,
    rules: sampleBindingRules,
    sceneConfig,
    virtualTimeMs,
  });
}

function getObjectAt(virtualTimeMs: number, objectId: string) {
  return getRuntimeStateAt(virtualTimeMs).objects.find(
    (object) => object.id === objectId,
  );
}

function distanceBetween(
  left: { x: number; y: number },
  right: { x: number; y: number },
) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

describe("authoring serialization roundtrip", () => {
  it("roundtrips scene JSON without mutating the fixture", () => {
    const text = serializeSceneConfig(sceneConfig);
    const imported = parseSceneConfigJson(text);

    expect(imported).toEqual(sceneConfig);

    imported.objects[0].x = 999;
    expect(sceneConfig.objects[0].x).not.toBe(999);
  });

  it("roundtrips bindings JSON without mutating the fixture", () => {
    const text = serializeBindingRules(sampleBindingRules);
    const imported = parseBindingRulesJson(text);

    expect(imported).toEqual(sampleBindingRules);

    imported[0].actions = [];
    expect(sampleBindingRules[0].actions.length).toBeGreaterThan(0);
  });

  it("roundtrips event feed JSONL and ignores blank lines", () => {
    const text = serializeEventFeedJsonl(sampleEventFeed);
    const imported = parseEventFeedJsonl(`\n${text}\n`);

    expect(imported).toEqual(sampleEventFeed);
    expect(text.trim().split("\n")).toHaveLength(sampleEventFeed.length);
  });

  it("roundtrips a complete ScenarioDocument", () => {
    const text = serializeScenarioDocument(navalIncidentScenario);
    const imported = parseScenarioDocumentJson(text);

    expect(imported).toEqual(navalIncidentScenario);
    expect(imported.scene.objects.map((object) => object.id)).toContain(
      "database_123",
    );
    expect(imported.bindings.length).toBeGreaterThan(0);
    expect(imported.events.length).toBeGreaterThan(0);
  });
});

describe("authoring validation", () => {
  it("warns for duplicate ids and missing referenced assets, animations, targets, paths, and presets", () => {
    const invalidScene: SceneConfig = cloneJson(sceneConfig);
    invalidScene.objects = [
      {
        ...invalidScene.objects[0],
        entityId: "duplicate_entity",
        id: "duplicate_object",
      },
      {
        ...invalidScene.objects[1],
        entityId: "duplicate_entity",
        id: "duplicate_object",
      },
      {
        ...invalidScene.objects[2],
        animationsByState: {
          broken: "missing_state_clip",
        },
        assetKey: "missing_asset",
        currentAnimationId: "missing_clip",
        entityId: "",
        id: "bad_object",
      },
      cloneJson(sceneConfig.objects[2]),
    ];

    const invalidPack: AssetPackManifest = {
      ...cloneJson(navalRealisticPack),
      animations: [
        ...navalRealisticPack.animations,
        {
          assetKey: "missing_clip_asset",
          fps: 8,
          frameCount: 2,
          frameHeight: 64,
          frameWidth: 64,
          id: "clip_with_missing_asset",
          playback: "loop",
        },
      ],
      objectPresets: [
        ...(navalRealisticPack.objectPresets ?? []),
        {
          animationsByState: {
            idle: "missing_preset_state_clip",
          },
          defaultAnimationId: "missing_preset_clip",
          defaultAssetKey: "missing_preset_asset",
          defaultHeight: 64,
          defaultWidth: 64,
          id: "preset.invalid",
          kind: "effect",
          name: "Invalid Preset",
        },
      ],
    };

    const invalidRules: BindingRule[] = [
      {
        actions: [
          {
            kind: "setState",
            state: "active",
            targetId: "missing_object",
          },
          {
            animationId: "missing_action_clip",
            kind: "playAnimation",
            targetId: "database_123",
          },
          {
            kind: "spawnEffect",
            presetId: "missing_preset",
            targetId: "database_123",
          },
          {
            durationMs: 0,
            kind: "moveAlongPath",
            path: [{ x: 1, y: 1 }],
            targetId: "database_123",
          },
          {
            kind: "showRouteTrail",
            path: [
              { x: Number.NaN, y: 1 },
              { x: 2, y: 2 },
            ],
            targetId: "database_123",
          },
          {
            durationMs: 1000,
            kind: "orbitAround",
            radius: 10,
            targetId: "database_123",
            targetObjectId: "missing_target_object",
          },
          {
            kind: "spawnEffect",
            onCompleteTargetId: "missing_complete_target",
            presetId: "preset.explosion_effect",
            targetId: "database_123",
          },
        ],
        id: "duplicate-rule",
        name: "Invalid binding",
        when: {
          type: "sample.invalid",
        },
      },
      {
        actions: [],
        id: "duplicate-rule",
        name: "Duplicate binding",
        when: {
          type: "sample.duplicate",
        },
      },
    ];

    const warnings = validateAuthoringState(
      invalidScene,
      invalidRules,
      invalidPack,
    );

    expect(warnings).toContain("Duplicate object id: duplicate_object.");
    expect(warnings).toContain("Duplicate entityId: duplicate_entity.");
    expect(warnings).toContain("Duplicate binding rule id: duplicate-rule.");
    expect(warnings).toContain("bad_object is missing entityId.");
    expect(warnings).toContain("bad_object references missing asset missing_asset.");
    expect(warnings).toContain(
      "bad_object references missing animation missing_clip.",
    );
    expect(warnings).toContain(
      "bad_object maps state broken to missing animation missing_state_clip.",
    );
    expect(warnings).toContain(
      "preset.invalid references missing asset missing_preset_asset.",
    );
    expect(warnings).toContain(
      "preset.invalid references missing animation missing_preset_clip.",
    );
    expect(warnings).toContain(
      "preset.invalid maps state idle to missing animation missing_preset_state_clip.",
    );
    expect(warnings).toContain(
      "clip_with_missing_asset references missing asset missing_clip_asset.",
    );
    expect(warnings).toContain("duplicate-rule targets missing object missing_object.");
    expect(warnings).toContain(
      "duplicate-rule references missing animation missing_action_clip.",
    );
    expect(warnings).toContain(
      "duplicate-rule references missing preset missing_preset.",
    );
    expect(warnings).toContain(
      "duplicate-rule has a moveAlongPath path with fewer than 2 points.",
    );
    expect(warnings).toContain(
      "duplicate-rule has invalid durationMs on moveAlongPath.",
    );
    expect(warnings).toContain(
      "duplicate-rule has an invalid showRouteTrail point at index 0.",
    );
    expect(warnings).toContain(
      "duplicate-rule targets missing object missing_target_object.",
    );
    expect(warnings).toContain(
      "duplicate-rule targets missing object missing_complete_target.",
    );
  });
});

describe("scenario event timing helpers", () => {
  it("converts offsetMs to deterministic timestamps", () => {
    const event = cloneJson(sampleEventFeed[0]);
    const updated = eventWithOffsetMs(event, 2500, 1000);

    expect(updated.offsetMs).toBe(2500);
    expect(updated.ts).toBe(3500);
  });

  it("sorts events by timestamp and applies offsets during normalization", () => {
    const unsortedEvents: VisualEvent[] = [
      {
        ...cloneJson(sampleEventFeed[1]),
        eventId: "late",
        offsetMs: 2000,
        ts: 0,
      },
      {
        ...cloneJson(sampleEventFeed[0]),
        eventId: "early",
        offsetMs: 500,
        ts: 0,
      },
    ];

    const normalized = normalizeEventTimeline(unsortedEvents);

    expect(normalized.map((event) => event.eventId)).toEqual(["early", "late"]);
    expect(normalized.map((event) => event.ts)).toEqual([500, 2000]);
    expect(sortEventsByTimestamp([...normalized].reverse())).toEqual(normalized);
  });
});

describe("scenario validation", () => {
  it("warns for scenario-level event and asset-pack problems", () => {
    const invalidScenario: ScenarioDocument = {
      ...cloneJson(navalIncidentScenario),
      assetPackId: "missing-pack",
      events: [
        {
          ...cloneJson(sampleEventFeed[1]),
          eventId: "duplicate-event",
          offsetMs: -1,
          ts: 1000,
        },
        {
          ...cloneJson(sampleEventFeed[0]),
          eventId: "duplicate-event",
          ts: 500,
        },
        {
          ...cloneJson(sampleEventFeed[2]),
          entity: {
            id: "",
            kind: "",
          },
          eventId: "",
          ts: Number.NaN,
          type: "",
        },
      ],
    };

    const warnings = validateScenarioDocument(invalidScenario, [
      navalRealisticPack,
    ]);

    expect(warnings).toContain("Scenario assetPackId missing-pack is unknown.");
    expect(warnings).toContain("duplicate-event has an invalid offsetMs.");
    expect(warnings).toContain(" has an invalid timestamp.");
    expect(warnings).toContain("Duplicate event id: duplicate-event.");
    expect(warnings).toContain("Scenario events are not sorted by timestamp.");
    expect(warnings).toContain("Scenario has an event with a missing eventId.");
    expect(warnings).toContain(" is missing type.");
    expect(warnings).toContain(" is missing entity.id.");
    expect(warnings).toContain(" is missing entity.kind.");
  });
});

describe("asset pack diagnostics", () => {
  it("provides recognizable fallback sprites for every expected naval asset key", () => {
    const requiredFallbackKeys = [
      "coordinator_carrier_idle",
      "queue_carrier_idle",
      "deck_fighter_flying",
      "db_ship_healthy",
      "db_ship_down",
      "db_ship_recovering",
      "codebase_target",
      "scanner_drone_loop",
      "scan_ring_loop",
      "explosion_once",
      "smoke_loop",
      "repair_dock_loop",
      "oil_rig_idle",
    ];
    const spriteSheetAssetKeys = navalRealisticPack.assets
      .filter((asset) => asset.kind === "spriteSheet")
      .map((asset) => asset.key);

    expect(spriteSheetAssetKeys).toEqual(
      expect.arrayContaining(requiredFallbackKeys),
    );
    expect(Object.keys(navalRealisticFallbackSprites)).toEqual(
      expect.arrayContaining(spriteSheetAssetKeys),
    );

    for (const assetKey of requiredFallbackKeys) {
      const fallback = navalRealisticFallbackSprites[assetKey];

      expect(fallback).toBeDefined();
      expect(fallback.kind).toBe("spriteSheet");
      expect(fallback.src.startsWith("data:image/svg+xml,")).toBe(true);
      expect(fallback.frameCount).toBeGreaterThan(0);
    }
  });

  it("detects duplicate assets, missing refs, invalid clips, and scene object refs", () => {
    const invalidPack: AssetPackManifest = {
      ...cloneJson(navalRealisticPack),
      animations: [
        ...navalRealisticPack.animations,
        {
          assetKey: "missing_asset",
          fps: 0,
          frameCount: 0,
          frameHeight: 0,
          frameWidth: 0,
          id: "broken_clip",
          playback: "loop",
        },
        {
          ...navalRealisticPack.animations[0],
          id: navalRealisticPack.animations[0].id,
        },
      ],
      assets: [
        ...navalRealisticPack.assets,
        {
          ...navalRealisticPack.assets[0],
          key: navalRealisticPack.assets[0].key,
        },
      ],
      objectPresets: [
        ...(navalRealisticPack.objectPresets ?? []),
        {
          defaultAnimationId: "missing_preset_animation",
          defaultAssetKey: "missing_preset_asset",
          defaultHeight: 64,
          defaultWidth: 64,
          id: "preset.broken",
          kind: "effect",
          name: "Broken Preset",
          animationsByState: {
            active: "missing_state_animation",
          },
        },
      ],
    };
    const invalidScenario: ScenarioDocument = {
      ...cloneJson(navalIncidentScenario),
      scene: {
        ...cloneJson(navalIncidentScenario.scene),
        objects: [
          {
            ...cloneJson(navalIncidentScenario.scene.objects[0]),
            animationsByState: {
              idle: "missing_scene_state_animation",
            },
            assetKey: "missing_scene_asset",
            currentAnimationId: "missing_scene_animation",
            id: "broken_scene_object",
          },
        ],
      },
    };
    const diagnostics = getAssetPackDiagnostics({
      assetPack: invalidPack,
      scenario: invalidScenario,
      selectedAssetPackId: invalidPack.id,
    });
    const codes = diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).toContain("duplicateAssetKey");
    expect(codes).toContain("duplicateAnimationClipId");
    expect(codes).toContain("animationMissingAsset");
    expect(codes).toContain("invalidClipFrameWidth");
    expect(codes).toContain("invalidClipFrameHeight");
    expect(codes).toContain("invalidClipFrameCount");
    expect(codes).toContain("invalidClipFps");
    expect(codes).toContain("presetMissingAsset");
    expect(codes).toContain("presetMissingAnimation");
    expect(codes).toContain("presetStateMissingAnimation");
    expect(codes).toContain("sceneObjectMissingAsset");
    expect(codes).toContain("sceneObjectMissingAnimation");
    expect(codes).toContain("sceneObjectStateMissingAnimation");
  });

  it("reports missing high-fidelity PNGs as fallback-backed warnings for the sample pack", () => {
    const localPack = localAssetPacks[0];
    const expectedPaths = getExpectedPublicSpriteSheetPaths(localPack.manifest);
    const diagnostics = getAssetPackDiagnostics({
      assetPack: localPack.manifest,
      fallbackAssetKeys: Object.keys(localPack.fallbackSpritesByAssetKey),
      knownPublicAssetPaths: [],
      scenario: navalIncidentScenario,
      selectedAssetPackId: localPack.manifest.id,
    });
    const missingPngWarnings = diagnostics.filter(
      (diagnostic) => diagnostic.code === "missingPublicSpriteSheet",
    );
    const structuralErrors = diagnostics.filter(
      (diagnostic) => diagnostic.severity === "error",
    );

    expect(expectedPaths).toHaveLength(localPack.manifest.assets.length);
    expect(missingPngWarnings).toHaveLength(expectedPaths.length);
    expect(missingPngWarnings.every((warning) => warning.message.includes("fallback"))).toBe(
      true,
    );
    expect(structuralErrors).toHaveLength(0);
  });

  it("keeps the placeholder naval pack manifest structurally valid", () => {
    const expectedPaths = getExpectedPublicSpriteSheetPaths(navalPlaceholderPack);
    const diagnostics = getAssetPackDiagnostics({
      assetPack: navalPlaceholderPack,
      knownPublicAssetPaths: expectedPaths.map((asset) => asset.publicPath),
      scenario: {
        ...cloneJson(navalIncidentScenario),
        assetPackId: navalPlaceholderPack.id,
      },
      selectedAssetPackId: navalPlaceholderPack.id,
    });

    expect(navalPlaceholderPack.id).toBe("naval-placeholder-v1");
    expect(diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toHaveLength(
      0,
    );
    expect(
      diagnostics.filter(
        (diagnostic) => diagnostic.code === "missingPublicSpriteSheet",
      ),
    ).toHaveLength(0);
  });
});

describe("scanner drone lifecycle", () => {
  it("spawns scanner drones at the sampled request fighter position", () => {
    const fighter = getObjectAt(2200, "request_fighter");
    const alpha = getObjectAt(2200, "scan_drone_alpha");
    const beta = getObjectAt(2200, "scan_drone_beta");

    expect(fighter).toBeDefined();
    expect(alpha).toBeDefined();
    expect(beta).toBeDefined();
    expect(alpha?.x).toBeCloseTo(fighter?.x ?? 0, 5);
    expect(alpha?.y).toBeCloseTo(fighter?.y ?? 0, 5);
    expect(beta?.x).toBeCloseTo(fighter?.x ?? 0, 5);
    expect(beta?.y).toBeCloseTo(fighter?.y ?? 0, 5);
  });

  it("moves scanner drones toward the codebase target", () => {
    const start = getObjectAt(2200, "scan_drone_alpha");
    const midApproach = getObjectAt(3000, "scan_drone_alpha");
    const target = getObjectAt(3000, "codebase_target");

    expect(start).toBeDefined();
    expect(midApproach).toBeDefined();
    expect(target).toBeDefined();
    expect(distanceBetween(midApproach!, target!)).toBeLessThan(
      distanceBetween(start!, target!),
    );
  });

  it("returns scanner drones to the request fighter after scan completion", () => {
    const returnStart = getObjectAt(7500, "scan_drone_beta");
    const returning = getObjectAt(8300, "scan_drone_beta");
    const fighterAtStart = getObjectAt(7500, "request_fighter");
    const fighterWhileReturning = getObjectAt(8300, "request_fighter");

    expect(returnStart).toBeDefined();
    expect(returning).toBeDefined();
    expect(fighterAtStart).toBeDefined();
    expect(fighterWhileReturning).toBeDefined();
    expect(distanceBetween(returning!, fighterWhileReturning!)).toBeLessThan(
      distanceBetween(returnStart!, fighterAtStart!),
    );
  });

  it("removes scanner drones after they dock at the request fighter", () => {
    expect(getObjectAt(8999, "scan_drone_alpha")).toBeDefined();
    expect(getObjectAt(8999, "scan_drone_beta")).toBeDefined();
    expect(getObjectAt(9000, "scan_drone_alpha")).toBeUndefined();
    expect(getObjectAt(9000, "scan_drone_beta")).toBeUndefined();
  });

  it("rebuilds the same drone lifecycle when replay is scrubbed", () => {
    const first = getRuntimeStateAt(8300);
    const second = getRuntimeStateAt(8300);
    const firstAlpha = first.objects.find((object) => object.id === "scan_drone_alpha");
    const secondAlpha = second.objects.find((object) => object.id === "scan_drone_alpha");
    const firstBeta = first.objects.find((object) => object.id === "scan_drone_beta");
    const secondBeta = second.objects.find((object) => object.id === "scan_drone_beta");

    expect(first.warnings).toHaveLength(0);
    expect(second.warnings).toHaveLength(0);
    expect(firstAlpha?.x).toBeCloseTo(secondAlpha?.x ?? 0, 5);
    expect(firstAlpha?.y).toBeCloseTo(secondAlpha?.y ?? 0, 5);
    expect(firstBeta?.x).toBeCloseTo(secondBeta?.x ?? 0, 5);
    expect(firstBeta?.y).toBeCloseTo(secondBeta?.y ?? 0, 5);
  });
});

describe("presentation readiness", () => {
  it("passes the sample scenario readiness checklist", () => {
    const checklist = getPresentationReadinessChecklist({
      assetPack: navalRealisticPack,
      presenterModeAvailable: true,
      runtimeWarnings: [],
      scenario: navalIncidentScenario,
      selectedAssetPackId: navalRealisticPack.id,
    });

    expect(checklist.every((item) => item.status === "pass")).toBe(true);
  });

  it("keeps the default replay free of missing binding target warnings", () => {
    const finalTimestamp = Math.max(...sampleEventFeed.map((event) => event.ts));
    const scenarioWarnings = validateScenarioDocument(navalIncidentScenario, [
      navalRealisticPack,
    ]);
    const runtimeState = buildSceneRuntimeState({
      assetPack: navalRealisticPack,
      events: sampleEventFeed,
      rules: sampleBindingRules,
      sceneConfig,
      virtualTimeMs: finalTimestamp,
    });
    const runtimeTargetWarnings = runtimeState.warnings.filter((warning) =>
      /target .*not found|target .*was not found|missing object/i.test(
        warning.message,
      ),
    );
    const checklist = getPresentationReadinessChecklist({
      assetPack: navalRealisticPack,
      presenterModeAvailable: true,
      runtimeWarnings: runtimeState.warnings,
      scenario: navalIncidentScenario,
      selectedAssetPackId: navalRealisticPack.id,
    });

    expect(
      scenarioWarnings.filter((warning) =>
        warning.includes("targets missing object"),
      ),
    ).toHaveLength(0);
    expect(runtimeTargetWarnings).toHaveLength(0);
    expect(runtimeState.warnings).toHaveLength(0);
    expect(checklist.every((item) => item.status === "pass")).toBe(true);
  });

  it("warns for missing scenario data and binding targets", () => {
    const brokenScenario: ScenarioDocument = {
      ...cloneJson(navalIncidentScenario),
      bindings: [
        {
          actions: [
            {
              kind: "setState",
              state: "active",
              targetId: "missing_target",
            },
          ],
          id: "broken-binding",
          name: "Broken binding",
          when: {
            type: "sample",
          },
        },
      ],
      events: [
        cloneJson(navalIncidentScenario.events[0]),
        cloneJson(navalIncidentScenario.events[0]),
      ],
      scene: {
        ...cloneJson(navalIncidentScenario.scene),
        objects: [],
      },
    };
    const checklist = getPresentationReadinessChecklist({
      assetPack: navalRealisticPack,
      presenterModeAvailable: false,
      runtimeWarnings: [],
      scenario: brokenScenario,
      selectedAssetPackId: navalRealisticPack.id,
    });

    expect(checklist.filter((item) => item.status === "warn").map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "scene-objects",
        "duplicate-event-ids",
        "binding-targets",
        "presenter-mode",
      ]),
    );
  });
});

describe("presenter mode helpers", () => {
  it("maps keyboard shortcuts without touching runtime inputs", () => {
    const eventsBefore = cloneJson(sampleEventFeed);

    expect(getPresenterShortcutAction(" ")).toEqual({ kind: "togglePlay" });
    expect(getPresenterShortcutAction("r")).toEqual({ kind: "restart" });
    expect(getPresenterShortcutAction("5")).toEqual({ kind: "setSpeed", speed: 5 });
    expect(getPresenterShortcutAction("x")).toEqual({ kind: "none" });
    expect(eventsBefore).toEqual(sampleEventFeed);
  });
});

describe("replay input separation", () => {
  it("builds replay state from local events, bindings, and scene config", () => {
    const finalTimestamp = Math.max(...sampleEventFeed.map((event) => event.ts));
    const runtimeState = buildSceneRuntimeState({
      assetPack: navalRealisticPack,
      events: sampleEventFeed,
      rules: sampleBindingRules,
      sceneConfig,
      virtualTimeMs: finalTimestamp,
    });

    expect(runtimeState.dispatchedEvents.map((entry) => entry.event.eventId)).toEqual(
      sampleEventFeed.map((event) => event.eventId),
    );
    expect(
      runtimeState.dispatchedEvents.some((entry) => entry.matchedRuleIds.length > 0),
    ).toBe(true);
    expect(
      runtimeState.objects.find((object) => object.id === "database_123")
        ?.visualState,
    ).toBe("healthy");
    expect(
      runtimeState.objects.find((object) => object.id === "request_fighter")
        ?.visualState,
    ).toBe("completed");
  });

  it("keeps authored draft edits separate until a draft is used as replay input", () => {
    const replayScene = cloneJson(sceneConfig);
    const draftScene = cloneJson(sceneConfig);
    const databaseDraft = draftScene.objects.find(
      (object) => object.id === "database_123",
    );

    if (!databaseDraft) {
      throw new Error("Fixture is missing database_123.");
    }

    databaseDraft.visualState = "down";
    databaseDraft.state = "down";

    const runtimeFromReplayScene = buildSceneRuntimeState({
      assetPack: navalRealisticPack,
      events: [],
      rules: [],
      sceneConfig: replayScene,
      virtualTimeMs: 0,
    });
    const runtimeFromDraftScene = buildSceneRuntimeState({
      assetPack: navalRealisticPack,
      events: [],
      rules: [],
      sceneConfig: draftScene,
      virtualTimeMs: 0,
    });

    expect(
      runtimeFromReplayScene.objects.find((object) => object.id === "database_123")
        ?.visualState,
    ).toBe("healthy");
    expect(
      runtimeFromDraftScene.objects.find((object) => object.id === "database_123")
        ?.visualState,
    ).toBe("down");
    expect(sceneConfig.objects.find((object) => object.id === "database_123")?.state).toBe(
      "healthy",
    );
  });
});
