import type {
  AssetPackManifest,
  BindingRule,
  ScenarioDocument,
  SceneConfig,
  TrackPoint,
  VisualAction,
} from "./contracts";

function getActionTargetId(action: VisualAction) {
  if ("targetId" in action) {
    return action.targetId;
  }

  return undefined;
}

function isValidPoint(point: TrackPoint | undefined) {
  return (
    point !== undefined &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y)
  );
}

function validatePath(
  warnings: string[],
  ruleId: string,
  actionKind: string,
  path: TrackPoint[] | undefined,
) {
  if (!path || path.length < 2) {
    warnings.push(`${ruleId} has a ${actionKind} path with fewer than 2 points.`);
    return;
  }

  path.forEach((point, index) => {
    if (!isValidPoint(point)) {
      warnings.push(`${ruleId} has an invalid ${actionKind} point at index ${index}.`);
    }
  });
}

export function validateAuthoringState(
  scene: SceneConfig,
  rules: BindingRule[],
  assetPack: AssetPackManifest,
) {
  const warnings: string[] = [];
  const objectIds = new Set<string>();
  const duplicateIds = new Set<string>();
  const entityIds = new Set<string>();
  const duplicateEntityIds = new Set<string>();
  const ruleIds = new Set<string>();
  const duplicateRuleIds = new Set<string>();
  const knownObjectIds = new Set(
    scene.objects.flatMap((object) =>
      [object.id, object.entityId].filter((value): value is string =>
        Boolean(value),
      ),
    ),
  );
  const animationIds = new Set(assetPack.animations.map((clip) => clip.id));
  const assetKeys = new Set(assetPack.assets.map((asset) => asset.key));
  const presetIds = new Set(
    (assetPack.objectPresets ?? []).map((preset) => preset.id),
  );

  for (const object of scene.objects) {
    if (objectIds.has(object.id)) {
      duplicateIds.add(object.id);
    }

    objectIds.add(object.id);

    if (object.entityId) {
      if (entityIds.has(object.entityId)) {
        duplicateEntityIds.add(object.entityId);
      }

      entityIds.add(object.entityId);
    }

    if (!object.entityId) {
      warnings.push(`${object.id} is missing entityId.`);
    }

    if (object.assetKey && !assetKeys.has(object.assetKey)) {
      warnings.push(`${object.id} references missing asset ${object.assetKey}.`);
    }

    if (object.currentAnimationId && !animationIds.has(object.currentAnimationId)) {
      warnings.push(
        `${object.id} references missing animation ${object.currentAnimationId}.`,
      );
    }

    for (const [state, animationId] of Object.entries(
      object.animationsByState ?? {},
    )) {
      if (!animationIds.has(animationId)) {
        warnings.push(
          `${object.id} maps state ${state} to missing animation ${animationId}.`,
        );
      }
    }
  }

  for (const duplicateId of duplicateIds) {
    warnings.push(`Duplicate object id: ${duplicateId}.`);
  }

  for (const duplicateEntityId of duplicateEntityIds) {
    warnings.push(`Duplicate entityId: ${duplicateEntityId}.`);
  }

  for (const preset of assetPack.objectPresets ?? []) {
    if (!assetKeys.has(preset.defaultAssetKey)) {
      warnings.push(
        `${preset.id} references missing asset ${preset.defaultAssetKey}.`,
      );
    }

    if (
      preset.defaultAnimationId &&
      !animationIds.has(preset.defaultAnimationId)
    ) {
      warnings.push(
        `${preset.id} references missing animation ${preset.defaultAnimationId}.`,
      );
    }

    for (const [state, animationId] of Object.entries(
      preset.animationsByState ?? {},
    )) {
      if (!animationIds.has(animationId)) {
        warnings.push(
          `${preset.id} maps state ${state} to missing animation ${animationId}.`,
        );
      }
    }
  }

  for (const clip of assetPack.animations) {
    if (!assetKeys.has(clip.assetKey)) {
      warnings.push(`${clip.id} references missing asset ${clip.assetKey}.`);
    }
  }

  for (const rule of rules) {
    for (const action of rule.actions) {
      if ("objectId" in action && action.objectId) {
        knownObjectIds.add(action.objectId);
      }
    }
  }

  for (const rule of rules) {
    if (ruleIds.has(rule.id)) {
      duplicateRuleIds.add(rule.id);
    }

    ruleIds.add(rule.id);

    for (const action of rule.actions) {
      const targetId = getActionTargetId(action);

      if (targetId && !knownObjectIds.has(targetId)) {
        warnings.push(`${rule.id} targets missing object ${targetId}.`);
      }

      if (
        "targetObjectId" in action &&
        action.targetObjectId &&
        !knownObjectIds.has(action.targetObjectId)
      ) {
        warnings.push(
          `${rule.id} targets missing object ${action.targetObjectId}.`,
        );
      }

      if (
        "sourceObjectId" in action &&
        action.sourceObjectId &&
        !knownObjectIds.has(action.sourceObjectId)
      ) {
        warnings.push(
          `${rule.id} targets missing object ${action.sourceObjectId}.`,
        );
      }

      if (
        "onCompleteTargetId" in action &&
        action.onCompleteTargetId &&
        !knownObjectIds.has(action.onCompleteTargetId)
      ) {
        warnings.push(
          `${rule.id} targets missing object ${action.onCompleteTargetId}.`,
        );
      }

      if (
        "animationId" in action &&
        action.animationId &&
        !animationIds.has(action.animationId)
      ) {
        warnings.push(
          `${rule.id} references missing animation ${action.animationId}.`,
        );
      }

      if ("presetId" in action && !presetIds.has(action.presetId)) {
        warnings.push(`${rule.id} references missing preset ${action.presetId}.`);
      }

      if (action.kind === "moveTo" && !isValidPoint(action.to)) {
        warnings.push(`${rule.id} has an invalid moveTo target point.`);
      }

      if (action.kind === "moveAlongPath") {
        validatePath(warnings, rule.id, "moveAlongPath", action.path);
      }

      if (action.kind === "showRouteTrail") {
        validatePath(warnings, rule.id, "showRouteTrail", action.path);
      }

      if ("durationMs" in action && action.durationMs !== undefined) {
        if (!Number.isFinite(action.durationMs) || action.durationMs <= 0) {
          warnings.push(`${rule.id} has invalid durationMs on ${action.kind}.`);
        }
      }
    }
  }

  for (const duplicateRuleId of duplicateRuleIds) {
    warnings.push(`Duplicate binding rule id: ${duplicateRuleId}.`);
  }

  return warnings;
}

export function validateScenarioDocument(
  scenario: ScenarioDocument,
  knownAssetPacks: AssetPackManifest[],
) {
  const warnings: string[] = [];
  const assetPack = knownAssetPacks.find((pack) => pack.id === scenario.assetPackId);

  if (!assetPack) {
    warnings.push(`Scenario assetPackId ${scenario.assetPackId} is unknown.`);
  } else {
    warnings.push(
      ...validateAuthoringState(scenario.scene, scenario.bindings, assetPack),
    );
  }

  const eventIds = new Set<string>();
  const duplicateEventIds = new Set<string>();
  let previousTimestamp = Number.NEGATIVE_INFINITY;
  let hasUnsortedEvents = false;

  for (const event of scenario.events) {
    if (eventIds.has(event.eventId)) {
      duplicateEventIds.add(event.eventId);
    }

    eventIds.add(event.eventId);

    if (!event.eventId) {
      warnings.push("Scenario has an event with a missing eventId.");
    }

    if (!Number.isFinite(event.ts) || event.ts < 0) {
      warnings.push(`${event.eventId} has an invalid timestamp.`);
    }

    if (
      event.offsetMs !== undefined &&
      (!Number.isFinite(event.offsetMs) || event.offsetMs < 0)
    ) {
      warnings.push(`${event.eventId} has an invalid offsetMs.`);
    }

    if (!event.type) {
      warnings.push(`${event.eventId} is missing type.`);
    }

    if (!event.entity?.id) {
      warnings.push(`${event.eventId} is missing entity.id.`);
    }

    if (!event.entity?.kind) {
      warnings.push(`${event.eventId} is missing entity.kind.`);
    }

    if (event.ts < previousTimestamp) {
      hasUnsortedEvents = true;
    }

    previousTimestamp = event.ts;
  }

  for (const duplicateEventId of duplicateEventIds) {
    warnings.push(`Duplicate event id: ${duplicateEventId}.`);
  }

  if (hasUnsortedEvents) {
    warnings.push("Scenario events are not sorted by timestamp.");
  }

  return warnings;
}
