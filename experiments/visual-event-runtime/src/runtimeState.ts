import { getAnimationDurationMs } from "./animationRuntime";
import { getMatchingBindingRules } from "./bindingEngine";
import type {
  AssetPackManifest,
  BindingRule,
  RuntimeSceneObject,
  RuntimeWarning,
  SceneConfig,
  SceneObjectPreset,
  SceneRuntimeState,
  VisualAction,
  VisualEvent,
  VisualTrack,
} from "./contracts";
import {
  applyAttachment,
  isTrackVisibleAtTime,
  sampleMoveAlongPathTrack,
  sampleMoveToTrack,
  sampleOrbitTrack,
  samplePropertyTrack,
} from "./trackRuntime";

type ScheduledAction = {
  action: VisualAction;
  actionIndex: number;
  event: VisualEvent;
  ruleId: string;
  runAt: number;
};

type RuntimeBuildInput = {
  assetPack: AssetPackManifest;
  events: VisualEvent[];
  rules: BindingRule[];
  sceneConfig: SceneConfig;
  virtualTimeMs: number;
};

function cloneInitialObject(object: SceneConfig["objects"][number]): RuntimeSceneObject {
  return {
    ...object,
    hidden: object.hidden ?? false,
    metadata: { ...(object.metadata ?? {}) },
    state: object.visualState ?? object.state,
    visualState: object.visualState ?? object.state,
  };
}

function makeWarning(
  message: string,
  scheduledAction?: ScheduledAction,
): RuntimeWarning {
  return {
    id: [
      scheduledAction?.event.eventId,
      scheduledAction?.ruleId,
      scheduledAction?.actionIndex,
      message,
    ]
      .filter(Boolean)
      .join(":"),
    message,
    eventId: scheduledAction?.event.eventId,
    ruleId: scheduledAction?.ruleId,
    actionKind: scheduledAction?.action.kind,
  };
}

function findObject(objects: RuntimeSceneObject[], objectId: string) {
  return objects.find(
    (object) => object.id === objectId || object.entityId === objectId,
  );
}

function getSampledObjectsAtTime(state: SceneRuntimeState, timeMs: number) {
  const retainedTracks = state.visualTracks.filter((track) =>
    shouldRetainTrack(track, timeMs),
  );

  return sampleObjectsFromTracks(state.objects, retainedTracks, timeMs);
}

function findSampledObject(
  state: SceneRuntimeState,
  objectId: string,
  timeMs: number,
) {
  return findObject(getSampledObjectsAtTime(state, timeMs), objectId);
}

function updateObject(
  state: SceneRuntimeState,
  objectId: string,
  updater: (object: RuntimeSceneObject) => RuntimeSceneObject,
) {
  let found = false;

  const objects = state.objects.map((object) => {
    if (object.id !== objectId && object.entityId !== objectId) {
      return object;
    }

    found = true;
    return updater(object);
  });

  return {
    found,
    state: {
      ...state,
      objects,
    },
  };
}

function resolveObjectAnimationId(object: RuntimeSceneObject, state: string) {
  return object.animationsByState?.[state] ?? object.currentAnimationId;
}

function setObjectState(
  state: SceneRuntimeState,
  targetId: string,
  visualState: string,
  actionTimeMs: number,
  scheduledAction: ScheduledAction,
) {
  const result = updateObject(state, targetId, (object) => {
    const nextAnimationId = resolveObjectAnimationId(object, visualState);

    return {
      ...object,
      animationStartedAt:
        nextAnimationId !== object.currentAnimationId
          ? actionTimeMs
          : object.animationStartedAt,
      currentAnimationId: nextAnimationId,
      state: visualState,
      visualState,
    };
  });

  if (!result.found) {
    return addWarning(
      result.state,
      makeWarning(`Binding target ${targetId} was not found.`, scheduledAction),
    );
  }

  return result.state;
}

function addWarning(state: SceneRuntimeState, warning: RuntimeWarning) {
  if (state.warnings.some((existing) => existing.id === warning.id)) {
    return state;
  }

  return {
    ...state,
    warnings: [...state.warnings, warning],
  };
}

function getPreset(assetPack: AssetPackManifest, presetId: string) {
  return assetPack.objectPresets?.find((preset) => preset.id === presetId);
}

function sanitizeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function makeTrackId(scheduledAction: ScheduledAction, suffix: string) {
  return sanitizeId(
    `${scheduledAction.event.eventId}_${scheduledAction.ruleId}_${scheduledAction.actionIndex}_${suffix}`,
  );
}

function buildSpawnedObject(
  preset: SceneObjectPreset,
  action: Extract<
    VisualAction,
    {
      kind:
        | "spawnEffect"
        | "spawnObject"
        | "spawnFromObject"
        | "spawnAttachedEffect";
    }
  >,
  scheduledAction: ScheduledAction,
  actionTimeMs: number,
  target?: RuntimeSceneObject,
): RuntimeSceneObject {
  const offset = action.offset ?? {};
  const visualState =
    action.state ?? preset.defaultVisualState ?? "active";
  const animationId =
    ("animationId" in action ? action.animationId : undefined) ??
    preset.animationsByState?.[visualState] ??
    preset.defaultAnimationId;
  const objectId =
    action.kind === "spawnObject" || action.kind === "spawnFromObject"
      ? action.objectId
      : action.objectId ??
        sanitizeId(
          `${action.tag ?? preset.id}_${scheduledAction.event.eventId}_${scheduledAction.actionIndex}`,
        );

  return {
    accent: "#6b79b8",
    animationStartedAt: actionTimeMs,
    animationsByState: preset.animationsByState,
    currentAnimationId: animationId,
    detail: `Spawned from ${preset.id}.`,
    height: preset.defaultHeight,
    hidden: false,
    id: objectId,
    kind: preset.kind,
    label: preset.name,
    metadata: {
      ...(preset.metadata ?? {}),
      ...(action.metadata ?? {}),
      spawnedAt: actionTimeMs,
    },
    sourceEventId: scheduledAction.event.eventId,
    spawned: true,
    state: visualState,
    tag: action.tag,
    visualState,
    width: preset.defaultWidth,
    x: action.kind === "spawnObject" && action.x !== undefined
      ? action.x
      : (target?.x ?? 50) + (offset.x ?? 0),
    y: action.kind === "spawnObject" && action.y !== undefined
      ? action.y
      : (target?.y ?? 50) + (offset.y ?? 0),
    zIndex: preset.metadata?.overlay === true ? 20 : 10,
  };
}

function setMetadataProperty(
  object: RuntimeSceneObject,
  metadataPath: string,
  value: unknown,
) {
  const metadata = { ...(object.metadata ?? {}) };
  metadata[metadataPath] = value;

  return {
    ...object,
    metadata,
  };
}

function setObjectProperty(
  object: RuntimeSceneObject,
  property: Extract<VisualAction, { kind: "setProperty" }>["property"],
  value: unknown,
) {
  if (property.startsWith("metadata.")) {
    return setMetadataProperty(object, property.slice("metadata.".length), value);
  }

  if (typeof value !== "number") {
    return object;
  }

  return {
    ...object,
    [property]: value,
  };
}

function removeObjects(
  state: SceneRuntimeState,
  action: Extract<VisualAction, { kind: "removeObject" }>,
  scheduledAction: ScheduledAction,
) {
  if (!action.targetId && !action.tag && !action.metadataSelector) {
    return addWarning(
      state,
      makeWarning("Remove action did not include a selector.", scheduledAction),
    );
  }

  const before = state.objects.length;
  const objects = state.objects.filter((object) => {
    if (
      action.targetId &&
      (object.id === action.targetId || object.entityId === action.targetId)
    ) {
      return false;
    }

    if (action.tag && object.tag === action.tag) {
      return false;
    }

    if (
      action.metadataSelector &&
      Object.is(
        object.metadata?.[action.metadataSelector.key],
        action.metadataSelector.value,
      )
    ) {
      return false;
    }

    return true;
  });

  if (objects.length === before) {
    return addWarning(
      { ...state, objects },
      makeWarning("Remove action did not match any objects.", scheduledAction),
    );
  }

  return {
    ...state,
    objects,
    visualTracks: state.visualTracks.filter((track) =>
      objects.some((object) => object.id === track.objectId),
    ),
  };
}

function insertOrReplaceObject(
  state: SceneRuntimeState,
  object: RuntimeSceneObject,
) {
  return {
    ...state,
    objects: [
      ...state.objects.filter((existing) => existing.id !== object.id),
      object,
    ],
  };
}

function scheduleOnceCompletion(
  scheduledActions: ScheduledAction[],
  source: ScheduledAction,
  animationId: string | undefined,
  actionTimeMs: number,
  targetId: string | undefined,
  explicitState: string | undefined,
  assetPack: AssetPackManifest,
) {
  if (!animationId || !targetId) {
    return;
  }

  const clip = assetPack.animations.find((animation) => animation.id === animationId);

  if (!clip || clip.playback !== "once") {
    return;
  }

  const onCompleteState = explicitState ?? clip.onCompleteState;

  if (!onCompleteState) {
    return;
  }

  scheduledActions.push({
    action: {
      kind: "setState",
      targetId,
      state: onCompleteState,
    },
    actionIndex: source.actionIndex + 0.1,
    event: source.event,
    ruleId: source.ruleId,
    runAt: actionTimeMs + getAnimationDurationMs(clip),
  });
}

function scheduleLifetimeRemoval(
  scheduledActions: ScheduledAction[],
  source: ScheduledAction,
  objectId: string,
  actionTimeMs: number,
  lifetimeMs: number | undefined,
) {
  if (lifetimeMs === undefined) {
    return;
  }

  scheduledActions.push({
    action: {
      kind: "removeObject",
      targetId: objectId,
    },
    actionIndex: source.actionIndex + 0.2,
    event: source.event,
    ruleId: source.ruleId,
    runAt: actionTimeMs + lifetimeMs,
  });
}

function addVisualTrack(state: SceneRuntimeState, track: VisualTrack) {
  return {
    ...state,
    visualTracks: [
      ...state.visualTracks.filter((existing) => existing.id !== track.id),
      track,
    ],
  };
}

function removeTracksForObject(
  state: SceneRuntimeState,
  objectId: string,
  kind?: VisualTrack["kind"],
) {
  const resolvedObjectId = findObject(state.objects, objectId)?.id ?? objectId;

  return {
    ...state,
    visualTracks: state.visualTracks.filter(
      (track) =>
        track.objectId !== resolvedObjectId ||
        (kind !== undefined && track.kind !== kind),
    ),
  };
}

function getTrackTargetWarning(
  state: SceneRuntimeState,
  targetId: string,
  scheduledAction: ScheduledAction,
) {
  if (findObject(state.objects, targetId)) {
    return state;
  }

  return addWarning(
    state,
    makeWarning(`Track target ${targetId} was not found.`, scheduledAction),
  );
}

function getAttachmentTargetWarning(
  state: SceneRuntimeState,
  targetObjectId: string,
  scheduledAction: ScheduledAction,
) {
  if (findObject(state.objects, targetObjectId)) {
    return state;
  }

  return addWarning(
    state,
    makeWarning(
      `Attachment target ${targetObjectId} was not found.`,
      scheduledAction,
    ),
  );
}

function applyScheduledAction(
  state: SceneRuntimeState,
  scheduledAction: ScheduledAction,
  scheduledActions: ScheduledAction[],
  assetPack: AssetPackManifest,
) {
  const { action, runAt } = scheduledAction;

  switch (action.kind) {
    case "setState":
      return setObjectState(
        state,
        action.targetId,
        action.state,
        runAt,
        scheduledAction,
      );
    case "showObject": {
      const result = updateObject(state, action.targetId, (object) => ({
        ...object,
        hidden: false,
      }));

      return result.found
        ? result.state
        : addWarning(
            result.state,
            makeWarning(
              `Binding target ${action.targetId} was not found.`,
              scheduledAction,
            ),
          );
    }
    case "hideObject": {
      const result = updateObject(state, action.targetId, (object) => ({
        ...object,
        hidden: true,
      }));

      return result.found
        ? result.state
        : addWarning(
            result.state,
            makeWarning(
              `Binding target ${action.targetId} was not found.`,
              scheduledAction,
            ),
          );
    }
    case "playAnimation": {
      const clip = assetPack.animations.find(
        (animation) => animation.id === action.animationId,
      );
      let nextState = state;

      if (!clip) {
        nextState = addWarning(
          nextState,
          makeWarning(
            `Animation ${action.animationId} was not found.`,
            scheduledAction,
          ),
        );
      }

      const result = updateObject(nextState, action.targetId, (object) => ({
        ...object,
        animationStartedAt: runAt,
        currentAnimationId: action.animationId,
      }));

      scheduleOnceCompletion(
        scheduledActions,
        scheduledAction,
        action.animationId,
        runAt,
        action.targetId,
        action.onCompleteState,
        assetPack,
      );
      scheduleLifetimeRemoval(
        scheduledActions,
        scheduledAction,
        action.targetId,
        runAt,
        action.lifetimeMs,
      );

      return result.found
        ? result.state
        : addWarning(
            result.state,
            makeWarning(
              `Binding target ${action.targetId} was not found.`,
              scheduledAction,
            ),
          );
    }
    case "spawnFromObject": {
      const preset = getPreset(assetPack, action.presetId);

      if (!preset) {
        return addWarning(
          state,
          makeWarning(`Preset ${action.presetId} was not found.`, scheduledAction),
        );
      }

      const sourceObject = findSampledObject(state, action.sourceObjectId, runAt);

      if (!sourceObject) {
        return addWarning(
          state,
          makeWarning(
            `Spawn source ${action.sourceObjectId} was not found.`,
            scheduledAction,
          ),
        );
      }

      const spawnedObject = buildSpawnedObject(
        preset,
        action,
        scheduledAction,
        runAt,
        sourceObject,
      );
      const clipId = spawnedObject.currentAnimationId;

      if (
        clipId &&
        !assetPack.animations.some((animation) => animation.id === clipId)
      ) {
        state = addWarning(
          state,
          makeWarning(`Animation ${clipId} was not found.`, scheduledAction),
        );
      }

      scheduleOnceCompletion(
        scheduledActions,
        scheduledAction,
        clipId,
        runAt,
        undefined,
        undefined,
        assetPack,
      );
      scheduleLifetimeRemoval(
        scheduledActions,
        scheduledAction,
        spawnedObject.id,
        runAt,
        action.lifetimeMs,
      );

      return insertOrReplaceObject(state, spawnedObject);
    }
    case "spawnEffect":
    case "spawnObject": {
      const preset = getPreset(assetPack, action.presetId);

      if (!preset) {
        return addWarning(
          state,
          makeWarning(`Preset ${action.presetId} was not found.`, scheduledAction),
        );
      }

      const target = action.targetId
        ? findObject(state.objects, action.targetId)
        : undefined;

      if (action.targetId && !target) {
        return addWarning(
          state,
          makeWarning(
            `Spawn target ${action.targetId} was not found.`,
            scheduledAction,
          ),
        );
      }

      const spawnedObject = buildSpawnedObject(
        preset,
        action,
        scheduledAction,
        runAt,
        target,
      );
      const clipId = spawnedObject.currentAnimationId;

      if (
        clipId &&
        !assetPack.animations.some((animation) => animation.id === clipId)
      ) {
        state = addWarning(
          state,
          makeWarning(`Animation ${clipId} was not found.`, scheduledAction),
        );
      }

      scheduleOnceCompletion(
        scheduledActions,
        scheduledAction,
        clipId,
        runAt,
        "onCompleteTargetId" in action
          ? action.onCompleteTargetId ?? action.targetId
          : undefined,
        "onCompleteState" in action ? action.onCompleteState : undefined,
        assetPack,
      );
      scheduleLifetimeRemoval(
        scheduledActions,
        scheduledAction,
        spawnedObject.id,
        runAt,
        "lifetimeMs" in action ? action.lifetimeMs : undefined,
      );

      return insertOrReplaceObject(state, spawnedObject);
    }
    case "removeObject":
      return removeObjects(state, action, scheduledAction);
    case "setProperty": {
      const result = updateObject(state, action.targetId, (object) =>
        setObjectProperty(object, action.property, action.value),
      );

      return result.found
        ? result.state
        : addWarning(
            result.state,
            makeWarning(
              `Binding target ${action.targetId} was not found.`,
              scheduledAction,
            ),
          );
    }
    case "moveTo": {
      const target = findObject(state.objects, action.targetId);
      let nextState = getTrackTargetWarning(state, action.targetId, scheduledAction);

      if (!target) {
        return nextState;
      }

      return addVisualTrack(nextState, {
        durationMs: action.durationMs,
        easing: action.easing,
        from: action.from ?? { x: target.x, y: target.y },
        id: makeTrackId(scheduledAction, "move_to"),
        kind: "moveTo",
        metadata: action.metadata,
        objectId: target.id,
        startTimeMs: runAt,
        to: action.to,
      });
    }
    case "moveToObject": {
      let nextState = getTrackTargetWarning(state, action.targetId, scheduledAction);
      nextState = getAttachmentTargetWarning(
        nextState,
        action.targetObjectId,
        scheduledAction,
      );

      const movingObject = findSampledObject(nextState, action.targetId, runAt);
      const targetObject = findSampledObject(
        nextState,
        action.targetObjectId,
        runAt,
      );

      if (!movingObject || !targetObject) {
        return nextState;
      }

      const offset = action.offset ?? {};

      return addVisualTrack(nextState, {
        durationMs: action.durationMs,
        easing: action.easing,
        from: { x: movingObject.x, y: movingObject.y },
        id: makeTrackId(scheduledAction, "move_to_object"),
        kind: "moveTo",
        metadata: action.metadata,
        objectId: movingObject.id,
        startTimeMs: runAt,
        to: {
          x: targetObject.x + (offset.x ?? 0),
          y: targetObject.y + (offset.y ?? 0),
        },
      });
    }
    case "moveAlongPath": {
      let nextState = getTrackTargetWarning(state, action.targetId, scheduledAction);
      const target = findObject(nextState.objects, action.targetId);

      if (action.path.length < 2) {
        return addWarning(
          nextState,
          makeWarning("Move path must contain at least two points.", scheduledAction),
        );
      }

      if (!target) {
        return nextState;
      }

      return addVisualTrack(nextState, {
        durationMs: action.durationMs,
        easing: action.easing,
        id: makeTrackId(scheduledAction, "move_path"),
        kind: "moveAlongPath",
        metadata: action.metadata,
        objectId: target.id,
        path: action.path,
        startTimeMs: runAt,
      });
    }
    case "orbitAround": {
      let nextState = getTrackTargetWarning(state, action.targetId, scheduledAction);
      nextState = getAttachmentTargetWarning(
        nextState,
        action.targetObjectId,
        scheduledAction,
      );
      const movingObject = findObject(nextState.objects, action.targetId);
      const targetObject = findObject(nextState.objects, action.targetObjectId);

      if (!movingObject || !targetObject) {
        return nextState;
      }

      return addVisualTrack(nextState, {
        durationMs: action.durationMs,
        id: makeTrackId(scheduledAction, "orbit"),
        kind: "orbit",
        metadata: action.metadata,
        objectId: movingObject.id,
        offset: action.offset,
        radius: action.radius,
        speed: action.speed,
        startTimeMs: runAt,
        targetObjectId: targetObject.id,
      });
    }
    case "attachToObject": {
      let nextState = getTrackTargetWarning(state, action.targetId, scheduledAction);
      nextState = getAttachmentTargetWarning(
        nextState,
        action.targetObjectId,
        scheduledAction,
      );
      const movingObject = findObject(nextState.objects, action.targetId);
      const targetObject = findObject(nextState.objects, action.targetObjectId);

      if (!movingObject || !targetObject) {
        return nextState;
      }

      return addVisualTrack(nextState, {
        durationMs: action.durationMs ?? 60_000,
        id: makeTrackId(scheduledAction, "attach"),
        kind: "attach",
        metadata: action.metadata,
        objectId: movingObject.id,
        offset: action.offset,
        persistent: action.durationMs === undefined,
        startTimeMs: runAt,
        targetObjectId: targetObject.id,
      });
    }
    case "detachFromObject":
      return removeTracksForObject(state, action.targetId, "attach");
    case "despawnAtObject": {
      let nextState = getTrackTargetWarning(state, action.targetId, scheduledAction);
      nextState = getAttachmentTargetWarning(
        nextState,
        action.targetObjectId,
        scheduledAction,
      );

      const object = findObject(nextState.objects, action.targetId);
      const targetObject = findSampledObject(
        nextState,
        action.targetObjectId,
        runAt,
      );

      if (!object || !targetObject) {
        return nextState;
      }

      const offset = action.offset ?? {};
      const dockedObject = {
        ...object,
        x: targetObject.x + (offset.x ?? 0),
        y: targetObject.y + (offset.y ?? 0),
      };
      const dockedState = insertOrReplaceObject(nextState, dockedObject);

      return removeObjects(
        dockedState,
        {
          kind: "removeObject",
          targetId: dockedObject.id,
        },
        scheduledAction,
      );
    }
    case "spawnAttachedEffect": {
      const preset = getPreset(assetPack, action.presetId);

      if (!preset) {
        return addWarning(
          state,
          makeWarning(`Preset ${action.presetId} was not found.`, scheduledAction),
        );
      }

      const target = findObject(state.objects, action.targetId);

      if (!target) {
        return addWarning(
          state,
          makeWarning(
            `Attachment target ${action.targetId} was not found.`,
            scheduledAction,
          ),
        );
      }

      const spawnedObject = buildSpawnedObject(
        preset,
        action,
        scheduledAction,
        runAt,
        target,
      );
      let nextState = insertOrReplaceObject(state, spawnedObject);

      nextState = addVisualTrack(nextState, {
        durationMs: action.lifetimeMs ?? 60_000,
        id: makeTrackId(scheduledAction, "attached_effect"),
        kind: "attach",
        metadata: action.metadata,
        objectId: spawnedObject.id,
        offset: action.offset,
        persistent: action.lifetimeMs === undefined,
        startTimeMs: runAt,
        targetObjectId: target.id,
      });
      scheduleLifetimeRemoval(
        scheduledActions,
        scheduledAction,
        spawnedObject.id,
        runAt,
        action.lifetimeMs,
      );

      return nextState;
    }
    case "showRouteTrail": {
      if (action.path.length < 2) {
        return addWarning(
          state,
          makeWarning("Route trail must contain at least two points.", scheduledAction),
        );
      }

      let nextState = getTrackTargetWarning(state, action.targetId, scheduledAction);
      const target = findObject(nextState.objects, action.targetId);

      if (!target) {
        return nextState;
      }

      return addVisualTrack(nextState, {
        durationMs: action.durationMs ?? 60_000,
        id: makeTrackId(scheduledAction, "route_trail"),
        kind: "routeTrail",
        metadata: action.metadata,
        objectId: target.id,
        path: action.path,
        persistent: action.durationMs === undefined,
        startTimeMs: runAt,
      });
    }
    case "hideRouteTrail":
      return removeTracksForObject(state, action.targetId, "routeTrail");
  }
}

function shouldRetainTrack(track: VisualTrack, virtualTimeMs: number) {
  if (virtualTimeMs < track.startTimeMs) {
    return false;
  }

  if (track.persistent) {
    return true;
  }

  if (
    track.kind === "moveTo" ||
    track.kind === "moveAlongPath" ||
    track.kind === "property"
  ) {
    return true;
  }

  return isTrackVisibleAtTime(track, virtualTimeMs);
}

function updateSampledObject(
  objects: RuntimeSceneObject[],
  objectId: string,
  updater: (object: RuntimeSceneObject) => RuntimeSceneObject,
) {
  return objects.map((object) =>
    object.id === objectId || object.entityId === objectId ? updater(object) : object,
  );
}

function sampleObjectsFromTracks(
  objects: RuntimeSceneObject[],
  tracks: VisualTrack[],
  virtualTimeMs: number,
) {
  let sampledObjects: RuntimeSceneObject[] = objects.map((object) => ({
    ...object,
    metadata: { ...(object.metadata ?? {}) },
  }));
  const orderedTracks = [...tracks].sort(
    (left, right) => left.startTimeMs - right.startTimeMs,
  );

  for (const track of orderedTracks) {
    if (virtualTimeMs < track.startTimeMs || track.kind === "routeTrail") {
      continue;
    }

    if (
      (track.kind === "orbit" || track.kind === "attach") &&
      !isTrackVisibleAtTime(track, virtualTimeMs)
    ) {
      continue;
    }

    if (track.kind === "attach") {
      continue;
    }

    sampledObjects = updateSampledObject(
      sampledObjects,
      track.objectId,
      (object) => {
        switch (track.kind) {
          case "moveTo":
            return {
              ...object,
              ...sampleMoveToTrack(track, virtualTimeMs),
            };
          case "moveAlongPath":
            return {
              ...object,
              ...sampleMoveAlongPathTrack(track, virtualTimeMs),
            };
          case "orbit": {
            const targetObject = sampledObjects.find(
              (candidate) => candidate.id === track.targetObjectId,
            );

            return {
              ...object,
              ...sampleOrbitTrack(track, virtualTimeMs, targetObject),
            };
          }
          case "property":
            return {
              ...object,
              ...samplePropertyTrack(track, virtualTimeMs),
            };
          case "attach":
          case "routeTrail":
            return object;
        }
      },
    );
  }

  for (const track of orderedTracks) {
    if (
      track.kind !== "attach" ||
      !isTrackVisibleAtTime(track, virtualTimeMs) ||
      !track.targetObjectId
    ) {
      continue;
    }

    const targetObject = sampledObjects.find(
      (object) => object.id === track.targetObjectId,
    );

    if (!targetObject) {
      continue;
    }

    sampledObjects = updateSampledObject(sampledObjects, track.objectId, (object) =>
      applyAttachment(object, targetObject, track.offset),
    );
  }

  return sampledObjects;
}

export function buildSceneRuntimeState({
  assetPack,
  events,
  rules,
  sceneConfig,
  virtualTimeMs,
}: RuntimeBuildInput): SceneRuntimeState {
  let state: SceneRuntimeState = {
    activeEffects: [],
    dispatchedEvents: [],
    objects: sceneConfig.objects.map(cloneInitialObject),
    spawnedObjects: [],
    visualTracks: [],
    warnings: [],
  };
  const scheduledActions: ScheduledAction[] = [];
  const sortedEvents = [...events].sort((left, right) => left.ts - right.ts);

  for (const event of sortedEvents) {
    if (event.ts > virtualTimeMs) {
      continue;
    }

    const matchingRules = getMatchingBindingRules(event, rules);

    state = {
      ...state,
      dispatchedEvents: [
        ...state.dispatchedEvents,
        {
          actionCount: matchingRules.reduce(
            (total, rule) => total + rule.actions.length,
            0,
          ),
          event,
          matchedRuleIds: matchingRules.map((rule) => rule.id),
        },
      ],
    };

    for (const rule of matchingRules) {
      rule.actions.forEach((action, actionIndex) => {
        scheduledActions.push({
          action,
          actionIndex,
          event,
          ruleId: rule.id,
          runAt: event.ts + (action.delayMs ?? 0),
        });
      });
    }
  }

  for (let index = 0; index < scheduledActions.length; index += 1) {
    scheduledActions.sort(
      (left, right) =>
        left.runAt - right.runAt || left.actionIndex - right.actionIndex,
    );

    const scheduledAction = scheduledActions[index];

    if (scheduledAction.runAt > virtualTimeMs) {
      continue;
    }

    state = applyScheduledAction(
      state,
      scheduledAction,
      scheduledActions,
      assetPack,
    );
  }

  const retainedTracks = state.visualTracks.filter((track) =>
    shouldRetainTrack(track, virtualTimeMs),
  );
  const sampledObjects = sampleObjectsFromTracks(
    state.objects,
    retainedTracks,
    virtualTimeMs,
  );

  return {
    ...state,
    activeEffects: sampledObjects.filter(
      (object) => object.kind === "effect" && !object.hidden,
    ),
    objects: [...sampledObjects].sort(
      (left, right) => (left.zIndex ?? 0) - (right.zIndex ?? 0),
    ),
    spawnedObjects: sampledObjects.filter((object) => object.spawned),
    visualTracks: retainedTracks,
  };
}
