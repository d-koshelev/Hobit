import type {
  AssetDefinition,
  AssetPackManifest,
  BindingRule,
  ScenarioDocument,
  SceneConfig,
  SceneObject,
  VisualAction,
} from "./contracts";

export type AssetDiagnosticSeverity = "error" | "warning";

export type AssetDiagnostic = {
  id: string;
  code: string;
  severity: AssetDiagnosticSeverity;
  message: string;
  assetKey?: string;
  animationId?: string;
  objectId?: string;
  presetId?: string;
  path?: string;
};

export type ExpectedPublicSpriteSheet = {
  assetKey: string;
  publicPath: string;
  src: string;
};

export type AssetPackDiagnosticsInput = {
  assetPack: AssetPackManifest;
  fallbackAssetKeys?: Iterable<string>;
  knownPublicAssetPaths?: Iterable<string>;
  scenario?: ScenarioDocument;
  scene?: SceneConfig;
  selectedAssetPackId?: string;
};

function addDiagnostic(
  diagnostics: AssetDiagnostic[],
  diagnostic: Omit<AssetDiagnostic, "id">,
) {
  diagnostics.push({
    id: [
      diagnostic.code,
      diagnostic.assetKey,
      diagnostic.animationId,
      diagnostic.objectId,
      diagnostic.presetId,
      diagnostic.path,
      diagnostics.length,
    ]
      .filter((part) => part !== undefined && part !== "")
      .join(":"),
    ...diagnostic,
  });
}

function getDuplicateValues(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }

    seen.add(value);
  }

  return [...duplicates];
}

function isFinitePositive(value: number) {
  return Number.isFinite(value) && value > 0;
}

function isExpectedPublicAssetSource(src: string) {
  return (
    !src.startsWith("data:") &&
    !src.startsWith("blob:") &&
    !src.startsWith("http://") &&
    !src.startsWith("https://")
  );
}

export function resolveAssetPublicPath(
  assetPack: AssetPackManifest,
  src: string,
) {
  if (src.startsWith("/")) {
    return src;
  }

  const basePath = assetPack.basePath.endsWith("/")
    ? assetPack.basePath
    : `${assetPack.basePath}/`;

  return `${basePath}${src.replace(/^\.?\//, "")}`;
}

export function getExpectedPublicSpriteSheetPaths(
  assetPack: AssetPackManifest,
): ExpectedPublicSpriteSheet[] {
  return assetPack.assets.flatMap((asset) => {
    if (asset.kind !== "spriteSheet" || !isExpectedPublicAssetSource(asset.src)) {
      return [];
    }

    return [
      {
        assetKey: asset.key,
        publicPath: resolveAssetPublicPath(assetPack, asset.src),
        src: asset.src,
      },
    ];
  });
}

function getAnimationAssetKey(assetPack: AssetPackManifest, animationId: string) {
  return assetPack.animations.find((clip) => clip.id === animationId)?.assetKey;
}

function getObjectAssetKeys(object: SceneObject, assetPack: AssetPackManifest) {
  const assetKeys = new Set<string>();

  if (object.assetKey) {
    assetKeys.add(object.assetKey);
  }

  for (const animationId of [
    object.currentAnimationId,
    ...Object.values(object.animationsByState ?? {}),
  ]) {
    if (!animationId) {
      continue;
    }

    const assetKey = getAnimationAssetKey(assetPack, animationId);

    if (assetKey) {
      assetKeys.add(assetKey);
    }
  }

  return assetKeys;
}

function getPresetAssetKeys(
  presetId: string,
  assetPack: AssetPackManifest,
) {
  const preset = assetPack.objectPresets?.find((candidate) => candidate.id === presetId);
  const assetKeys = new Set<string>();

  if (!preset) {
    return assetKeys;
  }

  assetKeys.add(preset.defaultAssetKey);

  for (const animationId of [
    preset.defaultAnimationId,
    ...Object.values(preset.animationsByState ?? {}),
  ]) {
    if (!animationId) {
      continue;
    }

    const assetKey = getAnimationAssetKey(assetPack, animationId);

    if (assetKey) {
      assetKeys.add(assetKey);
    }
  }

  return assetKeys;
}

function getActionAssetKeys(action: VisualAction, assetPack: AssetPackManifest) {
  const assetKeys = new Set<string>();

  if ("animationId" in action && action.animationId) {
    const assetKey = getAnimationAssetKey(assetPack, action.animationId);

    if (assetKey) {
      assetKeys.add(assetKey);
    }
  }

  if ("presetId" in action) {
    for (const assetKey of getPresetAssetKeys(action.presetId, assetPack)) {
      assetKeys.add(assetKey);
    }
  }

  return assetKeys;
}

export function getUsedAssetKeysForScenario(
  scenario: ScenarioDocument,
  assetPack: AssetPackManifest,
) {
  const assetKeys = new Set<string>();

  for (const object of scenario.scene.objects) {
    for (const assetKey of getObjectAssetKeys(object, assetPack)) {
      assetKeys.add(assetKey);
    }
  }

  for (const rule of scenario.bindings) {
    for (const action of rule.actions) {
      for (const assetKey of getActionAssetKeys(action, assetPack)) {
        assetKeys.add(assetKey);
      }
    }
  }

  return [...assetKeys].sort((left, right) => left.localeCompare(right));
}

function diagnoseClip(
  diagnostics: AssetDiagnostic[],
  assetPack: AssetPackManifest,
  assetKeys: Set<string>,
) {
  for (const clip of assetPack.animations) {
    if (!assetKeys.has(clip.assetKey)) {
      addDiagnostic(diagnostics, {
        animationId: clip.id,
        assetKey: clip.assetKey,
        code: "animationMissingAsset",
        message: `${clip.id} references missing asset ${clip.assetKey}.`,
        severity: "error",
      });
    }

    if (!isFinitePositive(clip.frameWidth)) {
      addDiagnostic(diagnostics, {
        animationId: clip.id,
        code: "invalidClipFrameWidth",
        message: `${clip.id} has invalid frameWidth.`,
        severity: "error",
      });
    }

    if (!isFinitePositive(clip.frameHeight)) {
      addDiagnostic(diagnostics, {
        animationId: clip.id,
        code: "invalidClipFrameHeight",
        message: `${clip.id} has invalid frameHeight.`,
        severity: "error",
      });
    }

    if (!Number.isInteger(clip.frameCount) || clip.frameCount <= 0) {
      addDiagnostic(diagnostics, {
        animationId: clip.id,
        code: "invalidClipFrameCount",
        message: `${clip.id} has invalid frameCount.`,
        severity: "error",
      });
    }

    if (!isFinitePositive(clip.fps)) {
      addDiagnostic(diagnostics, {
        animationId: clip.id,
        code: "invalidClipFps",
        message: `${clip.id} has invalid fps.`,
        severity: "error",
      });
    }
  }
}

function diagnosePresets(
  diagnostics: AssetDiagnostic[],
  assetPack: AssetPackManifest,
  assetKeys: Set<string>,
  animationIds: Set<string>,
) {
  for (const preset of assetPack.objectPresets ?? []) {
    if (!assetKeys.has(preset.defaultAssetKey)) {
      addDiagnostic(diagnostics, {
        assetKey: preset.defaultAssetKey,
        code: "presetMissingAsset",
        message: `${preset.id} references missing asset ${preset.defaultAssetKey}.`,
        presetId: preset.id,
        severity: "error",
      });
    }

    if (
      preset.defaultAnimationId &&
      !animationIds.has(preset.defaultAnimationId)
    ) {
      addDiagnostic(diagnostics, {
        animationId: preset.defaultAnimationId,
        code: "presetMissingAnimation",
        message: `${preset.id} references missing animation ${preset.defaultAnimationId}.`,
        presetId: preset.id,
        severity: "error",
      });
    }

    for (const [state, animationId] of Object.entries(
      preset.animationsByState ?? {},
    )) {
      if (!animationIds.has(animationId)) {
        addDiagnostic(diagnostics, {
          animationId,
          code: "presetStateMissingAnimation",
          message: `${preset.id} maps state ${state} to missing animation ${animationId}.`,
          presetId: preset.id,
          severity: "error",
        });
      }
    }
  }
}

function diagnoseSceneObjects(
  diagnostics: AssetDiagnostic[],
  scene: SceneConfig | undefined,
  assetKeys: Set<string>,
  animationIds: Set<string>,
) {
  if (!scene) {
    return;
  }

  for (const object of scene.objects) {
    if (object.assetKey && !assetKeys.has(object.assetKey)) {
      addDiagnostic(diagnostics, {
        assetKey: object.assetKey,
        code: "sceneObjectMissingAsset",
        message: `${object.id} references missing asset ${object.assetKey}.`,
        objectId: object.id,
        severity: "error",
      });
    }

    if (object.currentAnimationId && !animationIds.has(object.currentAnimationId)) {
      addDiagnostic(diagnostics, {
        animationId: object.currentAnimationId,
        code: "sceneObjectMissingAnimation",
        message: `${object.id} references missing animation ${object.currentAnimationId}.`,
        objectId: object.id,
        severity: "error",
      });
    }

    for (const [state, animationId] of Object.entries(
      object.animationsByState ?? {},
    )) {
      if (!animationIds.has(animationId)) {
        addDiagnostic(diagnostics, {
          animationId,
          code: "sceneObjectStateMissingAnimation",
          message: `${object.id} maps state ${state} to missing animation ${animationId}.`,
          objectId: object.id,
          severity: "error",
        });
      }
    }
  }
}

function diagnoseMissingPublicSprites(
  diagnostics: AssetDiagnostic[],
  assetPack: AssetPackManifest,
  knownPublicAssetPaths: Iterable<string> | undefined,
  fallbackAssetKeys: Set<string>,
) {
  if (!knownPublicAssetPaths) {
    return;
  }

  const knownPaths = new Set(knownPublicAssetPaths);

  for (const expectedPath of getExpectedPublicSpriteSheetPaths(assetPack)) {
    if (knownPaths.has(expectedPath.publicPath)) {
      continue;
    }

    addDiagnostic(diagnostics, {
      assetKey: expectedPath.assetKey,
      code: "missingPublicSpriteSheet",
      message: fallbackAssetKeys.has(expectedPath.assetKey)
        ? `${expectedPath.assetKey} is missing high-fidelity PNG ${expectedPath.publicPath}; fallback sprite is available.`
        : `${expectedPath.assetKey} is missing high-fidelity PNG ${expectedPath.publicPath}.`,
      path: expectedPath.publicPath,
      severity: "warning",
    });
  }
}

export function getAssetPackDiagnostics({
  assetPack,
  fallbackAssetKeys,
  knownPublicAssetPaths,
  scenario,
  scene,
  selectedAssetPackId,
}: AssetPackDiagnosticsInput) {
  const diagnostics: AssetDiagnostic[] = [];
  const assetKeys = new Set(assetPack.assets.map((asset) => asset.key));
  const animationIds = new Set(assetPack.animations.map((clip) => clip.id));
  const fallbackKeys = new Set(fallbackAssetKeys ?? []);
  const sceneForDiagnostics = scene ?? scenario?.scene;

  for (const duplicateKey of getDuplicateValues(
    assetPack.assets.map((asset) => asset.key),
  )) {
    addDiagnostic(diagnostics, {
      assetKey: duplicateKey,
      code: "duplicateAssetKey",
      message: `Duplicate asset key: ${duplicateKey}.`,
      severity: "error",
    });
  }

  for (const duplicateId of getDuplicateValues(
    assetPack.animations.map((clip) => clip.id),
  )) {
    addDiagnostic(diagnostics, {
      animationId: duplicateId,
      code: "duplicateAnimationClipId",
      message: `Duplicate animation clip id: ${duplicateId}.`,
      severity: "error",
    });
  }

  diagnoseClip(diagnostics, assetPack, assetKeys);
  diagnosePresets(diagnostics, assetPack, assetKeys, animationIds);
  diagnoseSceneObjects(diagnostics, sceneForDiagnostics, assetKeys, animationIds);
  diagnoseMissingPublicSprites(
    diagnostics,
    assetPack,
    knownPublicAssetPaths,
    fallbackKeys,
  );

  if (scenario && selectedAssetPackId && scenario.assetPackId !== selectedAssetPackId) {
    addDiagnostic(diagnostics, {
      code: "scenarioAssetPackMismatch",
      message: `Scenario assetPackId ${scenario.assetPackId} does not match selected pack ${selectedAssetPackId}.`,
      severity: "warning",
    });
  }

  return diagnostics;
}

export function getAssetCountByKind(assets: AssetDefinition[]) {
  return assets.reduce<Record<string, number>>((counts, asset) => {
    counts[asset.kind] = (counts[asset.kind] ?? 0) + 1;
    return counts;
  }, {});
}
