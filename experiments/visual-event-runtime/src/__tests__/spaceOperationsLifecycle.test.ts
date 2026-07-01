import { describe, expect, it } from "vitest";
import { validateScenarioDocument } from "../authoringValidation";
import type { RuntimeSceneObject, VisualAction } from "../contracts";
import { buildSceneRuntimeState } from "../runtimeState";
import { localAssetPacks } from "../sampleAssetPacks";
import { spacePlaceholderPack } from "../sampleAssetPacks/spacePlaceholderPack";
import { defaultDemoScenario } from "../samples";
import {
  spaceOperationsBindingRules,
  spaceOperationsEventFeed,
  spaceOperationsScenario,
  spaceOperationsScene,
} from "../samples/spaceOperationsScenario";

function getSpaceRuntimeStateAt(virtualTimeMs: number) {
  return buildSceneRuntimeState({
    assetPack: spacePlaceholderPack,
    events: spaceOperationsEventFeed,
    rules: spaceOperationsBindingRules,
    sceneConfig: spaceOperationsScene,
    virtualTimeMs,
  });
}

function getObjectAt(virtualTimeMs: number, objectId: string) {
  return getSpaceRuntimeStateAt(virtualTimeMs).objects.find(
    (object) => object.id === objectId,
  );
}

function distanceBetween(
  left: { x: number; y: number },
  right: { x: number; y: number },
) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function expectCloseToSource(
  mobile: RuntimeSceneObject | undefined,
  source: RuntimeSceneObject | undefined,
) {
  expect(mobile).toBeDefined();
  expect(source).toBeDefined();
  expect(distanceBetween(mobile!, source!)).toBeLessThanOrEqual(3);
}

function getAllActions() {
  return spaceOperationsBindingRules.flatMap((rule) => rule.actions);
}

describe("space operations asset pack", () => {
  it("provides every required inline placeholder asset", () => {
    const requiredAssetKeys = [
      "space_mothership_idle",
      "launch_bay_or_queue_carrier_idle",
      "scout_shuttle_flying",
      "maintenance_shuttle_flying",
      "codebase_asteroid_idle",
      "database_freighter_healthy",
      "database_freighter_down",
      "database_freighter_recovering",
      "scanner_drone_loop",
      "repair_drone_loop",
      "research_pod_loop",
      "explosion_once",
      "smoke_or_damage_loop",
      "repair_ring_loop",
    ];

    expect(spacePlaceholderPack.assets.map((asset) => asset.key)).toEqual(
      expect.arrayContaining(requiredAssetKeys),
    );

    for (const asset of spacePlaceholderPack.assets) {
      expect(asset.kind).toBe("spriteSheet");
      if (asset.kind !== "spriteSheet") {
        throw new Error(`${asset.key} is not a sprite sheet.`);
      }

      expect(asset.src.startsWith("data:image/svg+xml,")).toBe(true);
    }
  });
});

describe("space operations lifecycle", () => {
  it("spawns scanner drones from the scout shuttle and returns them to it", () => {
    const scoutAtSpawn = getObjectAt(3000, "scout_shuttle");
    const alphaAtSpawn = getObjectAt(3000, "scan_drone_alpha");
    const betaAtSpawn = getObjectAt(3000, "scan_drone_beta");
    const returnStart = getObjectAt(8500, "scan_drone_alpha");
    const returning = getObjectAt(8800, "scan_drone_alpha");
    const scoutAtReturnStart = getObjectAt(8500, "scout_shuttle");
    const scoutWhileReturning = getObjectAt(8800, "scout_shuttle");

    expectCloseToSource(alphaAtSpawn, scoutAtSpawn);
    expectCloseToSource(betaAtSpawn, scoutAtSpawn);
    expect(returnStart).toBeDefined();
    expect(returning).toBeDefined();
    expect(scoutAtReturnStart).toBeDefined();
    expect(scoutWhileReturning).toBeDefined();
    expect(distanceBetween(returning!, scoutWhileReturning!)).toBeLessThan(
      distanceBetween(returnStart!, scoutAtReturnStart!),
    );
    expect(getObjectAt(9199, "scan_drone_alpha")).toBeDefined();
    expect(getObjectAt(9200, "scan_drone_alpha")).toBeUndefined();
  });

  it("spawns repair drones from the maintenance shuttle and returns them to it", () => {
    const maintenanceAtSpawn = getObjectAt(6000, "maintenance_shuttle");
    const alphaAtSpawn = getObjectAt(6000, "repair_drone_alpha");
    const betaAtSpawn = getObjectAt(6000, "repair_drone_beta");
    const returnStart = getObjectAt(11500, "repair_drone_beta");
    const returning = getObjectAt(11750, "repair_drone_beta");
    const maintenanceAtReturnStart = getObjectAt(11500, "maintenance_shuttle");
    const maintenanceWhileReturning = getObjectAt(11750, "maintenance_shuttle");

    expect(getObjectAt(5999, "repair_drone_alpha")).toBeUndefined();
    expectCloseToSource(alphaAtSpawn, maintenanceAtSpawn);
    expectCloseToSource(betaAtSpawn, maintenanceAtSpawn);
    expect(returnStart).toBeDefined();
    expect(returning).toBeDefined();
    expect(maintenanceAtReturnStart).toBeDefined();
    expect(maintenanceWhileReturning).toBeDefined();
    expect(distanceBetween(returning!, maintenanceWhileReturning!)).toBeLessThan(
      distanceBetween(returnStart!, maintenanceAtReturnStart!),
    );
    expect(getObjectAt(11949, "repair_drone_beta")).toBeDefined();
    expect(getObjectAt(11950, "repair_drone_beta")).toBeUndefined();
  });

  it("spawns research pods from the scout shuttle and returns them to it", () => {
    const scoutAtSpawn = getObjectAt(9000, "scout_shuttle");
    const alphaAtSpawn = getObjectAt(9000, "research_pod_alpha");
    const betaAtSpawn = getObjectAt(9000, "research_pod_beta");
    const returnStart = getObjectAt(13000, "research_pod_alpha");
    const returning = getObjectAt(13250, "research_pod_alpha");
    const scoutAtReturnStart = getObjectAt(13000, "scout_shuttle");
    const scoutWhileReturning = getObjectAt(13250, "scout_shuttle");

    expectCloseToSource(alphaAtSpawn, scoutAtSpawn);
    expectCloseToSource(betaAtSpawn, scoutAtSpawn);
    expect(returnStart).toBeDefined();
    expect(returning).toBeDefined();
    expect(scoutAtReturnStart).toBeDefined();
    expect(scoutWhileReturning).toBeDefined();
    expect(distanceBetween(returning!, scoutWhileReturning!)).toBeLessThan(
      distanceBetween(returnStart!, scoutAtReturnStart!),
    );
    expect(getObjectAt(13699, "research_pod_alpha")).toBeDefined();
    expect(getObjectAt(13700, "research_pod_alpha")).toBeUndefined();
  });

  it("does not create mobile units with target-side spawnObject actions", () => {
    const mobilePresetIds = new Set([
      "preset.scanner_drone",
      "preset.repair_drone",
      "preset.research_pod",
      "preset.scout_shuttle",
      "preset.maintenance_shuttle",
    ]);
    const targetSideMobileSpawns = getAllActions().filter(
      (action): action is Extract<VisualAction, { kind: "spawnObject" }> =>
        action.kind === "spawnObject" && mobilePresetIds.has(action.presetId),
    );
    const mobileSpawns = getAllActions().filter(
      (action): action is Extract<VisualAction, { kind: "spawnFromObject" }> =>
        action.kind === "spawnFromObject" && mobilePresetIds.has(action.presetId),
    );

    expect(targetSideMobileSpawns).toHaveLength(0);
    expect(mobileSpawns.map((action) => action.sourceObjectId)).toEqual(
      expect.arrayContaining([
        "space_mothership",
        "scout_shuttle",
        "maintenance_shuttle",
      ]),
    );
    expect(
      mobileSpawns.every((action) =>
        ["space_mothership", "scout_shuttle", "maintenance_shuttle"].includes(
          action.sourceObjectId,
        ),
      ),
    ).toBe(true);
  });

  it("has no orphaned spawned mobile unit at scenario end", () => {
    const finalState = getSpaceRuntimeStateAt(15000);
    const orphanedMobileUnits = finalState.spawnedObjects.filter(
      (object) => object.metadata?.mobileUnit === true,
    );

    expect(finalState.warnings).toHaveLength(0);
    expect(orphanedMobileUnits).toHaveLength(0);
    expect(finalState.spawnedObjects).toHaveLength(0);
  });

  it("rebuilds the same lifecycle deterministically during scrub replay", () => {
    const first = getSpaceRuntimeStateAt(11750);
    const second = getSpaceRuntimeStateAt(11750);

    expect(first.warnings).toHaveLength(0);
    expect(second.warnings).toHaveLength(0);
    expect(first.objects).toEqual(second.objects);
    expect(first.visualTracks).toEqual(second.visualTracks);
  });

  it("keeps the default scenario free of runtime warnings", () => {
    const knownPacks = localAssetPacks.map((assetPack) => assetPack.manifest);
    const finalTimestamp = Math.max(
      ...defaultDemoScenario.events.map((event) => event.ts),
    );
    const defaultPack = knownPacks.find(
      (assetPack) => assetPack.id === defaultDemoScenario.assetPackId,
    );
    const runtimeState = buildSceneRuntimeState({
      assetPack: defaultPack ?? spacePlaceholderPack,
      events: defaultDemoScenario.events,
      rules: defaultDemoScenario.bindings,
      sceneConfig: defaultDemoScenario.scene,
      virtualTimeMs: finalTimestamp,
    });

    expect(defaultDemoScenario.scenarioId).toBe(
      spaceOperationsScenario.scenarioId,
    );
    expect(validateScenarioDocument(defaultDemoScenario, knownPacks)).toEqual([]);
    expect(runtimeState.warnings).toHaveLength(0);
  });
});
