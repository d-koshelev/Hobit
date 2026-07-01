import { getAssetPackDiagnostics } from "./assetDiagnostics";
import type {
  AssetPackManifest,
  RuntimeWarning,
  ScenarioDocument,
  VisualAction,
} from "./contracts";

export type ReadinessStatus = "pass" | "warn";

export type ReadinessChecklistItem = {
  id: string;
  label: string;
  status: ReadinessStatus;
  message: string;
};

function hasDuplicates(values: string[]) {
  return new Set(values).size !== values.length;
}

function getActionTargetIds(action: VisualAction) {
  const targetIds: string[] = [];

  if ("targetId" in action && action.targetId) {
    targetIds.push(action.targetId);
  }

  if ("targetObjectId" in action && action.targetObjectId) {
    targetIds.push(action.targetObjectId);
  }

  if ("sourceObjectId" in action && action.sourceObjectId) {
    targetIds.push(action.sourceObjectId);
  }

  if ("onCompleteTargetId" in action && action.onCompleteTargetId) {
    targetIds.push(action.onCompleteTargetId);
  }

  return targetIds;
}

export function getMissingBindingTargets(scenario: ScenarioDocument) {
  const objectIds = new Set(
    scenario.scene.objects.flatMap((object) =>
      [object.id, object.entityId].filter((value): value is string => Boolean(value)),
    ),
  );
  const missingTargets = new Set<string>();

  for (const rule of scenario.bindings) {
    for (const action of rule.actions) {
      if ("objectId" in action && action.objectId) {
        objectIds.add(action.objectId);
      }
    }
  }

  for (const rule of scenario.bindings) {
    for (const action of rule.actions) {
      for (const targetId of getActionTargetIds(action)) {
        if (!objectIds.has(targetId)) {
          missingTargets.add(targetId);
        }
      }
    }
  }

  return [...missingTargets].sort((left, right) => left.localeCompare(right));
}

function item(
  id: string,
  label: string,
  passed: boolean,
  passMessage: string,
  warnMessage: string,
): ReadinessChecklistItem {
  return {
    id,
    label,
    message: passed ? passMessage : warnMessage,
    status: passed ? "pass" : "warn",
  };
}

export function getPresentationReadinessChecklist(input: {
  assetPack: AssetPackManifest;
  presenterModeAvailable: boolean;
  runtimeWarnings?: RuntimeWarning[];
  scenario: ScenarioDocument;
  selectedAssetPackId: string;
}) {
  const objectIds = input.scenario.scene.objects.map((object) => object.id);
  const eventIds = input.scenario.events.map((event) => event.eventId);
  const missingBindingTargets = getMissingBindingTargets(input.scenario);
  const assetDiagnostics = getAssetPackDiagnostics({
    assetPack: input.assetPack,
    scenario: input.scenario,
    selectedAssetPackId: input.selectedAssetPackId,
  });
  const brokenAnimationReferenceCount = assetDiagnostics.filter((diagnostic) =>
    [
      "animationMissingAsset",
      "duplicateAnimationClipId",
      "invalidClipFrameWidth",
      "invalidClipFrameHeight",
      "invalidClipFrameCount",
      "invalidClipFps",
    ].includes(diagnostic.code),
  ).length;
  const runtimeTargetWarnings =
    input.runtimeWarnings?.filter((warning) =>
      /target .*not found|target .*was not found|missing object/i.test(
        warning.message,
      ),
    ) ?? [];

  return [
    item(
      "scene-objects",
      "Scene has objects",
      input.scenario.scene.objects.length > 0,
      `${input.scenario.scene.objects.length} scene objects.`,
      "Scenario has no scene objects.",
    ),
    item(
      "events",
      "Scenario has events",
      input.scenario.events.length > 0,
      `${input.scenario.events.length} events.`,
      "Scenario has no events.",
    ),
    item(
      "bindings",
      "Scenario has bindings",
      input.scenario.bindings.length > 0,
      `${input.scenario.bindings.length} binding rules.`,
      "Scenario has no binding rules.",
    ),
    item(
      "duplicate-object-ids",
      "Object IDs are unique",
      !hasDuplicates(objectIds),
      "No duplicate object IDs.",
      "Duplicate object IDs found.",
    ),
    item(
      "duplicate-event-ids",
      "Event IDs are unique",
      !hasDuplicates(eventIds),
      "No duplicate event IDs.",
      "Duplicate event IDs found.",
    ),
    item(
      "asset-animation-refs",
      "Asset pack animation refs are valid",
      brokenAnimationReferenceCount === 0,
      "No broken animation references.",
      `${brokenAnimationReferenceCount} broken animation references.`,
    ),
    item(
      "binding-targets",
      "Replay binding targets resolve",
      missingBindingTargets.length === 0 && runtimeTargetWarnings.length === 0,
      "Binding targets resolve in the scene.",
      missingBindingTargets.length > 0
        ? `Missing binding targets: ${missingBindingTargets.join(", ")}.`
        : `${runtimeTargetWarnings.length} runtime target warnings.`,
    ),
    item(
      "presenter-mode",
      "Presenter Mode available",
      input.presenterModeAvailable,
      "Presenter Mode is available.",
      "Presenter Mode is not available.",
    ),
  ];
}
