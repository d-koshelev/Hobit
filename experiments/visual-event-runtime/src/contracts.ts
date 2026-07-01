export type AssetDefinition =
  | BuiltinAssetDefinition
  | ImageAssetDefinition
  | SvgAssetDefinition
  | SpriteSheetAssetDefinition;

export type BuiltinAssetDefinition = {
  key: string;
  kind: "builtin";
  name: string;
  description?: string;
};

export type ImageAssetDefinition = {
  key: string;
  kind: "image";
  src: string;
  description?: string;
};

export type SvgAssetDefinition = {
  key: string;
  kind: "svg";
  src: string;
  description?: string;
};

export type SpriteSheetAssetDefinition = {
  key: string;
  kind: "spriteSheet";
  src: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  columns?: number;
  rows?: number;
  description?: string;
};

export type SceneObjectPreset = {
  id: string;
  name: string;
  kind: string;
  defaultAssetKey: string;
  defaultAnimationId?: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultVisualState?: string;
  animationsByState?: Record<string, string>;
  metadata?: Record<string, unknown>;
};

export type AssetPackManifest = {
  id: string;
  name: string;
  version: string;
  description?: string;
  style: string;
  basePath: string;
  assets: AssetDefinition[];
  animations: AnimationClipDefinition[];
  objectPresets?: SceneObjectPreset[];
};

export type AnimationClipDefinition = {
  id: string;
  assetKey: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
  playback: "once" | "loop";
  onCompleteState?: string;
};

export type SceneObjectKind = string;

export type SceneObject = {
  id: string;
  entityId?: string;
  label: string;
  name?: string;
  kind: SceneObjectKind;
  state: string;
  visualState?: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  accent: string;
  detail: string;
  hidden?: boolean;
  opacity?: number;
  rotation?: number;
  zIndex?: number;
  assetKey?: string;
  currentAnimationId?: string;
  animationsByState?: Record<string, string>;
  animationStartedAt?: number;
  metadata?: Record<string, unknown>;
};

export type SceneConfig = {
  id: string;
  title: string;
  description: string;
  lanes: string[];
  assets: AssetDefinition[];
  animations: AnimationClipDefinition[];
  objects: SceneObject[];
};

export type VisualEvent = {
  eventId: string;
  ts: number;
  offsetMs?: number;
  type: string;
  entity: {
    id: string;
    kind: string;
    name?: string;
    label?: string;
  };
  transition?: {
    from?: string;
    to?: string;
  };
  severity?: string;
  payload?: Record<string, unknown>;
};

export type ScenarioDocument = {
  version: number;
  scenarioId: string;
  name: string;
  description?: string;
  assetPackId: string;
  scene: SceneConfig;
  bindings: BindingRule[];
  events: VisualEvent[];
  metadata?: Record<string, unknown>;
};

export type BindingRule = {
  id: string;
  name: string;
  description?: string;
  when: Record<string, unknown>;
  actions: VisualAction[];
};

export type ActionOffset = {
  x?: number;
  y?: number;
};

export type MetadataSelector = {
  key: string;
  value: unknown;
};

export type TrackEasing = "linear" | "easeIn" | "easeOut" | "easeInOut";

export type TrackPoint = {
  x: number;
  y: number;
};

export type VisualTrack = {
  id: string;
  kind:
    | "moveTo"
    | "moveAlongPath"
    | "property"
    | "orbit"
    | "attach"
    | "routeTrail";
  objectId: string;
  startTimeMs: number;
  durationMs: number;
  easing?: TrackEasing;
  from?: Record<string, number>;
  to?: Record<string, number>;
  path?: TrackPoint[];
  targetObjectId?: string;
  offset?: ActionOffset;
  radius?: number;
  speed?: number;
  persistent?: boolean;
  property?: "opacity" | "rotation" | "x" | "y" | "zIndex";
  metadata?: Record<string, unknown>;
};

export type VisualAction =
  | {
      kind: "setState";
      targetId: string;
      state: string;
      delayMs?: number;
    }
  | {
      kind: "showObject";
      targetId: string;
      delayMs?: number;
    }
  | {
      kind: "hideObject";
      targetId: string;
      delayMs?: number;
    }
  | {
      kind: "playAnimation";
      targetId: string;
      animationId: string;
      delayMs?: number;
      lifetimeMs?: number;
      onCompleteState?: string;
    }
  | {
      kind: "spawnEffect";
      presetId: string;
      targetId?: string;
      objectId?: string;
      tag?: string;
      state?: string;
      animationId?: string;
      offset?: ActionOffset;
      delayMs?: number;
      lifetimeMs?: number;
      onCompleteState?: string;
      onCompleteTargetId?: string;
      metadata?: Record<string, unknown>;
    }
  | {
      kind: "spawnObject";
      presetId: string;
      objectId: string;
      targetId?: string;
      tag?: string;
      state?: string;
      x?: number;
      y?: number;
      offset?: ActionOffset;
      delayMs?: number;
      metadata?: Record<string, unknown>;
    }
  | {
      kind: "spawnFromObject";
      presetId: string;
      objectId: string;
      sourceObjectId: string;
      tag?: string;
      state?: string;
      offset?: ActionOffset;
      delayMs?: number;
      lifetimeMs?: number;
      metadata?: Record<string, unknown>;
    }
  | {
      kind: "removeObject";
      targetId?: string;
      tag?: string;
      metadataSelector?: MetadataSelector;
      delayMs?: number;
    }
  | {
      kind: "setProperty";
      targetId: string;
      property: "opacity" | "rotation" | "x" | "y" | "zIndex" | `metadata.${string}`;
      value: unknown;
      delayMs?: number;
    }
  | {
      kind: "moveTo";
      targetId: string;
      to: TrackPoint;
      from?: TrackPoint;
      durationMs: number;
      easing?: TrackEasing;
      delayMs?: number;
      metadata?: Record<string, unknown>;
    }
  | {
      kind: "moveToObject";
      targetId: string;
      targetObjectId: string;
      durationMs: number;
      easing?: TrackEasing;
      offset?: ActionOffset;
      delayMs?: number;
      metadata?: Record<string, unknown>;
    }
  | {
      kind: "moveAlongPath";
      targetId: string;
      path: TrackPoint[];
      durationMs: number;
      easing?: TrackEasing;
      delayMs?: number;
      metadata?: Record<string, unknown>;
    }
  | {
      kind: "orbitAround";
      targetId: string;
      targetObjectId: string;
      radius: number;
      durationMs: number;
      speed?: number;
      offset?: ActionOffset;
      delayMs?: number;
      metadata?: Record<string, unknown>;
    }
  | {
      kind: "attachToObject";
      targetId: string;
      targetObjectId: string;
      offset?: ActionOffset;
      durationMs?: number;
      delayMs?: number;
      metadata?: Record<string, unknown>;
    }
  | {
      kind: "detachFromObject";
      targetId: string;
      delayMs?: number;
    }
  | {
      kind: "despawnAtObject";
      targetId: string;
      targetObjectId: string;
      offset?: ActionOffset;
      delayMs?: number;
    }
  | {
      kind: "spawnAttachedEffect";
      presetId: string;
      targetId: string;
      objectId?: string;
      tag?: string;
      state?: string;
      animationId?: string;
      offset?: ActionOffset;
      delayMs?: number;
      lifetimeMs?: number;
      metadata?: Record<string, unknown>;
    }
  | {
      kind: "showRouteTrail";
      targetId: string;
      path: TrackPoint[];
      durationMs?: number;
      delayMs?: number;
      metadata?: Record<string, unknown>;
    }
  | {
      kind: "hideRouteTrail";
      targetId: string;
      delayMs?: number;
    };

export type RuntimeSceneObject = SceneObject & {
  visualState: string;
  hidden: boolean;
  spawned?: boolean;
  sourceEventId?: string;
  tag?: string;
};

export type DispatchedVisualEvent = {
  event: VisualEvent;
  matchedRuleIds: string[];
  actionCount: number;
};

export type RuntimeWarning = {
  id: string;
  message: string;
  eventId?: string;
  ruleId?: string;
  actionKind?: VisualAction["kind"];
};

export type SceneRuntimeState = {
  objects: RuntimeSceneObject[];
  spawnedObjects: RuntimeSceneObject[];
  activeEffects: RuntimeSceneObject[];
  visualTracks: VisualTrack[];
  dispatchedEvents: DispatchedVisualEvent[];
  warnings: RuntimeWarning[];
};

export type BindingActionDefinition =
  | {
      kind: "playAnimation";
      objectId: string;
      animationId: string;
      playback: AnimationClipDefinition["playback"];
      onCompleteState?: string;
    }
  | {
      kind: "setObjectState";
      objectId: string;
      state: string;
    }
  | {
      kind: "showObject";
      objectId: string;
      state?: string;
    };

export type SampleBindingDefinition = {
  id: string;
  eventName: string;
  label: string;
  description: string;
  actions: BindingActionDefinition[];
};
