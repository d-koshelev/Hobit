import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  getAnimationDurationMs,
  getAnimationFrame,
  isAnimationComplete,
} from "./animationRuntime";
import {
  getAssetCountByKind,
  getAssetPackDiagnostics,
  getExpectedPublicSpriteSheetPaths,
  getUsedAssetKeysForScenario,
} from "./assetDiagnostics";
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
} from "./authoringSerialization";
import { describeAction } from "./bindingEngine";
import type {
  AssetPackManifest,
  AssetDefinition,
  BindingRule,
  RuntimeSceneObject,
  SceneConfig,
  SceneObject,
  SceneObjectPreset,
  ScenarioDocument,
  SpriteSheetAssetDefinition,
  TrackPoint,
  VisualAction,
  VisualEvent,
} from "./contracts";
import {
  createEventFromTemplate,
  duplicateEvent,
  eventTemplateTypes,
  eventWithOffsetMs,
  eventWithTimestamp,
  getEventOffsetMs,
  getScenarioStartMs,
  normalizeEventTimeline,
  sortEventsByTimestamp,
  type EventTemplateType,
} from "./eventAuthoring";
import {
  getPresenterShortcutAction,
  shouldIgnorePresenterShortcut,
} from "./presenterMode";
import { getPresentationReadinessChecklist } from "./presentationReadiness";
import { buildSceneRuntimeState } from "./runtimeState";
import { validateScenarioDocument } from "./authoringValidation";
import {
  buildScenarioDocument,
  getScenarioDocumentMeta,
  type ScenarioDocumentMeta,
} from "./scenarioDocuments";
import {
  bundledScenarios,
  defaultDemoScenario,
  getBundledScenarioLabel,
} from "./samples";
import { localAssetPacks } from "./sampleAssetPacks";
import SpriteRenderer from "./SpriteRenderer";
import { isTrackVisibleAtTime } from "./trackRuntime";
import "./App.css";

type MissingAssetWarning = {
  key: string;
  src: string;
};

type AppMode = "replay" | "authoring" | "presenter";

type DragState = {
  objectId: string;
};

const replaySpeeds = [1, 2, 5, 10, 30] as const;
const defaultSelectedObjectId =
  defaultDemoScenario.scene.objects.find(
    (object) => object.id === "database_freighter",
  )?.id ??
  defaultDemoScenario.scene.objects[0]?.id ??
  "";

function downloadText(filename: string, text: string, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isSpriteSheetAsset(
  asset: AssetDefinition | undefined,
): asset is SpriteSheetAssetDefinition {
  return asset?.kind === "spriteSheet";
}

function formatMs(ms: number) {
  return `${Math.round(ms)}ms`;
}

function formatSeconds(ms: number) {
  return `${(ms / 1000).toFixed(2)}s`;
}

function toCssToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function isDirectAssetSource(src: string) {
  return (
    src.startsWith("data:") ||
    src.startsWith("blob:") ||
    src.startsWith("/")
  );
}

function resolveAssetSource(pack: AssetPackManifest, src: string) {
  if (isDirectAssetSource(src)) {
    return src;
  }

  const basePath = pack.basePath.endsWith("/")
    ? pack.basePath
    : `${pack.basePath}/`;

  return `${basePath}${src.replace(/^\.?\//, "")}`;
}

function resolvePackAssets(pack: AssetPackManifest): AssetDefinition[] {
  return pack.assets.map((asset) => {
    if (asset.kind === "builtin") {
      return asset;
    }

    return {
      ...asset,
      src: resolveAssetSource(pack, asset.src),
    };
  });
}

function getObjectAnimationId(object: RuntimeSceneObject) {
  return (
    object.animationsByState?.[object.visualState] ?? object.currentAnimationId
  );
}

function makeObjectId(base: string, objects: SceneObject[]) {
  const safeBase = base.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  let index = objects.length + 1;
  let id = `${safeBase}_${index}`;

  while (objects.some((object) => object.id === id)) {
    index += 1;
    id = `${safeBase}_${index}`;
  }

  return id;
}

function createObjectFromPreset(
  preset: SceneObjectPreset,
  objects: SceneObject[],
): SceneObject {
  const id = makeObjectId(preset.id.replace(/^preset\./, ""), objects);

  return {
    accent: "#6b79b8",
    animationStartedAt: 0,
    animationsByState: preset.animationsByState,
    assetKey: preset.defaultAssetKey,
    currentAnimationId: preset.defaultAnimationId,
    detail: `Authored from ${preset.id}.`,
    entityId: id,
    height: preset.defaultHeight,
    hidden: false,
    id,
    kind: preset.kind,
    label: preset.name,
    metadata: { ...(preset.metadata ?? {}) },
    name: preset.name,
    state: preset.defaultVisualState ?? "idle",
    visualState: preset.defaultVisualState ?? "idle",
    width: preset.defaultWidth,
    x: 50,
    y: 50,
  };
}

function getDefaultAction(kind: VisualAction["kind"], targetId: string): VisualAction {
  switch (kind) {
    case "setState":
      return { kind, targetId, state: "active" };
    case "showObject":
      return { kind, targetId };
    case "hideObject":
      return { kind, targetId };
    case "playAnimation":
      return { kind, targetId, animationId: "" };
    case "moveAlongPath":
      return {
        kind,
        targetId,
        durationMs: 2000,
        path: [
          { x: 20, y: 50 },
          { x: 70, y: 50 },
        ],
      };
    case "spawnEffect":
      return { kind, presetId: "", targetId };
    case "spawnAttachedEffect":
      return { kind, presetId: "", targetId };
    case "spawnFromObject":
      return {
        kind,
        objectId: makeObjectId("spawned", []),
        presetId: "",
        sourceObjectId: targetId,
      };
    case "removeObject":
      return { kind, targetId };
    case "showRouteTrail":
      return {
        kind,
        targetId,
        path: [
          { x: 20, y: 50 },
          { x: 70, y: 50 },
        ],
      };
    case "hideRouteTrail":
      return { kind, targetId };
    case "moveTo":
      return { kind, targetId, to: { x: 70, y: 50 }, durationMs: 2000 };
    case "moveToObject":
      return { kind, targetId, targetObjectId: targetId, durationMs: 2000 };
    case "orbitAround":
      return { kind, targetId, targetObjectId: targetId, radius: 10, durationMs: 3000 };
    case "attachToObject":
      return { kind, targetId, targetObjectId: targetId };
    case "detachFromObject":
      return { kind, targetId };
    case "despawnAtObject":
      return { kind, targetId, targetObjectId: targetId };
    case "spawnObject":
      return { kind, presetId: "", objectId: makeObjectId("spawned", []) };
    case "setProperty":
      return { kind, targetId, property: "opacity", value: 1 };
  }
}

function App() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [appMode, setAppMode] = useState<AppMode>("replay");
  const [replayScenarioMeta, setReplayScenarioMeta] =
    useState<ScenarioDocumentMeta>(() =>
      getScenarioDocumentMeta(defaultDemoScenario),
    );
  const [draftScenarioMeta, setDraftScenarioMeta] =
    useState<ScenarioDocumentMeta>(() =>
      getScenarioDocumentMeta(defaultDemoScenario),
    );
  const [replayScene, setReplayScene] = useState<SceneConfig>(() =>
    cloneJson(defaultDemoScenario.scene),
  );
  const [replayRules, setReplayRules] = useState<BindingRule[]>(() =>
    cloneJson(defaultDemoScenario.bindings),
  );
  const [replayEvents, setReplayEvents] = useState<VisualEvent[]>(() =>
    normalizeEventTimeline(cloneJson(defaultDemoScenario.events)),
  );
  const [draftScene, setDraftScene] = useState<SceneConfig>(() =>
    cloneJson(defaultDemoScenario.scene),
  );
  const [draftRules, setDraftRules] = useState<BindingRule[]>(() =>
    cloneJson(defaultDemoScenario.bindings),
  );
  const [draftEvents, setDraftEvents] = useState<VisualEvent[]>(() =>
    normalizeEventTimeline(cloneJson(defaultDemoScenario.events)),
  );
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isPathRecording, setIsPathRecording] = useState(false);
  const [draftPath, setDraftPath] = useState<TrackPoint[]>([]);

  const sortedDraftEvents = useMemo(
    () => sortEventsByTimestamp(draftEvents),
    [draftEvents],
  );
  const sortedReplayEvents = useMemo(
    () => sortEventsByTimestamp(replayEvents),
    [replayEvents],
  );
  const firstEventTs = sortedReplayEvents[0]?.ts ?? 0;
  const lastEventTs =
    sortedReplayEvents[sortedReplayEvents.length - 1]?.ts ?? firstEventTs + 1;

  const [selectedAssetPackId, setSelectedAssetPackId] = useState(
    defaultDemoScenario.assetPackId,
  );
  const selectedLocalPack =
    localAssetPacks.find(
      (assetPack) => assetPack.manifest.id === selectedAssetPackId,
    ) ?? localAssetPacks[0];
  const selectedPack = selectedLocalPack.manifest;
  const resolvedPackAssets = useMemo(
    () => resolvePackAssets(selectedPack),
    [selectedPack],
  );
  const assetsByKey = useMemo(
    () => new Map(resolvedPackAssets.map((asset) => [asset.key, asset])),
    [resolvedPackAssets],
  );
  const clipsById = useMemo(
    () => new Map(selectedPack.animations.map((clip) => [clip.id, clip])),
    [selectedPack],
  );

  const [selectedObjectId, setSelectedObjectId] = useState(defaultSelectedObjectId);
  const [selectedRuleId, setSelectedRuleId] = useState(
    defaultDemoScenario.bindings[0]?.id ?? "",
  );
  const [selectedEventId, setSelectedEventId] = useState(
    defaultDemoScenario.events[0]?.eventId ?? "",
  );
  const [virtualTimeMs, setVirtualTimeMs] = useState(firstEventTs);
  const [isReplayPlaying, setIsReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<(typeof replaySpeeds)[number]>(
    1,
  );
  const [showPresenterCaptions, setShowPresenterCaptions] = useState(false);
  const [missingAssetWarnings, setMissingAssetWarnings] = useState<
    Record<string, MissingAssetWarning>
  >({});

  const [previewClipId, setPreviewClipId] = useState(
    localAssetPacks[0].manifest.animations[0].id,
  );
  const [previewElapsedMs, setPreviewElapsedMs] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const runtimeState = useMemo(
    () =>
      buildSceneRuntimeState({
        assetPack: selectedPack,
        events: sortedReplayEvents,
        rules: replayRules,
        sceneConfig: replayScene,
        virtualTimeMs,
      }),
    [replayRules, replayScene, selectedPack, sortedReplayEvents, virtualTimeMs],
  );

  const visibleObjects = runtimeState.objects.filter((object) => !object.hidden);
  const authoringObjects = draftScene.objects.map<RuntimeSceneObject>((object) => ({
    ...object,
    hidden: object.hidden ?? false,
    metadata: { ...(object.metadata ?? {}) },
    state: object.visualState ?? object.state,
    visualState: object.visualState ?? object.state,
  }));
  const stageObjects =
    appMode === "authoring" ? authoringObjects : visibleObjects;
  const selectedObject =
    (appMode === "authoring"
      ? authoringObjects.find((object) => object.id === selectedObjectId)
      : runtimeState.objects.find((object) => object.id === selectedObjectId)) ??
    stageObjects[0];
  const selectedRule =
    draftRules.find((rule) => rule.id === selectedRuleId) ?? draftRules[0];
  const selectedDraftEvent =
    sortedDraftEvents.find((event) => event.eventId === selectedEventId) ??
    sortedDraftEvents[0];
  const draftScenarioStartMs = getScenarioStartMs(sortedDraftEvents);
  const knownAssetPackManifests = useMemo(
    () => localAssetPacks.map((assetPack) => assetPack.manifest),
    [],
  );
  const draftScenarioDocument = useMemo(
    () =>
      buildScenarioDocument({
        assetPackId: draftScenarioMeta.assetPackId,
        bindings: draftRules,
        description: draftScenarioMeta.description,
        events: draftEvents,
        metadata: draftScenarioMeta.metadata,
        name: draftScenarioMeta.name,
        scenarioId: draftScenarioMeta.scenarioId,
        scene: draftScene,
        version: draftScenarioMeta.version,
      }),
    [draftEvents, draftRules, draftScene, draftScenarioMeta],
  );
  const activeScenarioDocument = useMemo(
    () =>
      buildScenarioDocument({
        assetPackId: replayScenarioMeta.assetPackId,
        bindings: replayRules,
        description: replayScenarioMeta.description,
        events: replayEvents,
        metadata: replayScenarioMeta.metadata,
        name: replayScenarioMeta.name,
        scenarioId: replayScenarioMeta.scenarioId,
        scene: replayScene,
        version: replayScenarioMeta.version,
      }),
    [replayEvents, replayRules, replayScene, replayScenarioMeta],
  );
  const selectedBundledScenarioId = bundledScenarios.some(
    (scenario) => scenario.scenarioId === replayScenarioMeta.scenarioId,
  )
    ? replayScenarioMeta.scenarioId
    : "custom";
  const currentPresenterEvent =
    [...runtimeState.dispatchedEvents].reverse()[0]?.event;
  const selectedPreviewClip =
    clipsById.get(previewClipId) ?? selectedPack.animations[0];
  const selectedPreviewAsset = assetsByKey.get(selectedPreviewClip.assetKey);
  const selectedPreviewFallbackAsset =
    selectedLocalPack.fallbackSpritesByAssetKey[selectedPreviewClip.assetKey];
  const selectedPreviewRenderAsset = isSpriteSheetAsset(selectedPreviewAsset)
    ? selectedPreviewAsset
    : selectedPreviewFallbackAsset;
  const selectedPreviewDurationMs = getAnimationDurationMs(selectedPreviewClip);
  const selectedPreviewRangeMs =
    selectedPreviewClip.playback === "loop"
      ? Math.max(3000, selectedPreviewDurationMs * 3)
      : selectedPreviewDurationMs;
  const selectedPreviewFrame = getAnimationFrame(
    selectedPreviewClip,
    previewElapsedMs,
  );
  const selectedPreviewComplete = isAnimationComplete(
    selectedPreviewClip,
    previewElapsedMs,
  );

  const spriteSheetCount = selectedPack.assets.filter(
    (asset) => asset.kind === "spriteSheet",
  ).length;
  const fallbackSpriteKeys = useMemo(
    () => Object.keys(selectedLocalPack.fallbackSpritesByAssetKey),
    [selectedLocalPack],
  );
  const expectedPublicSpriteSheets = useMemo(
    () => getExpectedPublicSpriteSheetPaths(selectedPack),
    [selectedPack],
  );
  const missingAssetWarningList = Object.values(missingAssetWarnings);
  const missingPublicPaths = useMemo(
    () => new Set(missingAssetWarningList.map((warning) => warning.src)),
    [missingAssetWarningList],
  );
  const knownPublicSpritePaths = useMemo(
    () =>
      expectedPublicSpriteSheets
        .map((asset) => asset.publicPath)
        .filter((publicPath) => !missingPublicPaths.has(publicPath)),
    [expectedPublicSpriteSheets, missingPublicPaths],
  );
  const assetKindCounts = useMemo(
    () => getAssetCountByKind(selectedPack.assets),
    [selectedPack],
  );
  const assetPackDiagnostics = useMemo(
    () =>
      getAssetPackDiagnostics({
        assetPack: selectedPack,
        fallbackAssetKeys: fallbackSpriteKeys,
        knownPublicAssetPaths: knownPublicSpritePaths,
        scenario: activeScenarioDocument,
        selectedAssetPackId: selectedPack.id,
      }),
    [
      activeScenarioDocument,
      fallbackSpriteKeys,
      knownPublicSpritePaths,
      selectedPack,
    ],
  );
  const missingHighFidelityPngCount = assetPackDiagnostics.filter(
    (diagnostic) => diagnostic.code === "missingPublicSpriteSheet",
  ).length;
  const placeholderFallbackCount = Object.values(
    selectedLocalPack.fallbackSourceByAssetKey ?? {},
  ).filter((source) => source === "placeholder").length;
  const builtinFallbackCount = Object.values(
    selectedLocalPack.fallbackSourceByAssetKey ?? {},
  ).filter((source) => source === "builtin").length;
  const demoStatusItems = [
    `${replayScenarioMeta.name} loaded`,
    placeholderFallbackCount > 0
      ? "Placeholder fallback sprites are available"
      : "Inline or high-fidelity sprites selected",
    missingHighFidelityPngCount > 0
      ? "Observed missing PNGs are using fallback sprites"
      : "No missing public PNGs observed for selected assets",
    builtinFallbackCount > 0
      ? "Built-in fallback sprites are available"
      : "No built-in fallback needed for selected pack",
  ];
  const activeUsedAssetKeys = useMemo(
    () => getUsedAssetKeysForScenario(activeScenarioDocument, selectedPack),
    [activeScenarioDocument, selectedPack],
  );
  const presentationReadiness = useMemo(
    () =>
      getPresentationReadinessChecklist({
        assetPack: selectedPack,
        presenterModeAvailable: true,
        runtimeWarnings: runtimeState.warnings,
        scenario: activeScenarioDocument,
        selectedAssetPackId: selectedPack.id,
      }),
    [activeScenarioDocument, runtimeState.warnings, selectedPack],
  );
  const packReferenceWarnings = useMemo(() => {
    const warnings: string[] = [];

    for (const clip of selectedPack.animations) {
      if (!assetsByKey.has(clip.assetKey)) {
        warnings.push(`${clip.id} references missing asset ${clip.assetKey}`);
      }
    }

    for (const object of draftScene.objects) {
      const animationIds = new Set([
        object.currentAnimationId,
        ...Object.values(object.animationsByState ?? {}),
      ]);

      for (const animationId of animationIds) {
        if (animationId && !clipsById.has(animationId)) {
          warnings.push(`${object.id} references missing clip ${animationId}`);
        }
      }
    }

    return warnings;
  }, [assetsByKey, clipsById, draftScene, selectedPack]);
  const scenarioWarnings = useMemo(
    () =>
      validateScenarioDocument(draftScenarioDocument, knownAssetPackManifests),
    [draftScenarioDocument, knownAssetPackManifests],
  );
  const routeTrails = runtimeState.visualTracks.filter(
    (track) => track.kind === "routeTrail" && track.path,
  );
  const activeTracks = runtimeState.visualTracks.filter((track) =>
    isTrackVisibleAtTime(track, virtualTimeMs),
  );
  const timelineEvents =
    appMode === "authoring" ? sortedDraftEvents : sortedReplayEvents;
  const stageScene = appMode === "authoring" ? draftScene : replayScene;

  function restartReplay() {
    setVirtualTimeMs(firstEventTs);
    setIsReplayPlaying(false);
  }

  function setMode(mode: AppMode) {
    setAppMode(mode);
    if (mode === "authoring") {
      setIsReplayPlaying(false);
    }
  }

  function updateDraftObject(
    objectId: string,
    updater: (object: SceneObject) => SceneObject,
  ) {
    setDraftScene((current) => ({
      ...current,
      objects: current.objects.map((object) =>
        object.id === objectId ? updater(object) : object,
      ),
    }));
  }

  function updateDraftObjectField<K extends keyof SceneObject>(
    objectId: string,
    field: K,
    value: SceneObject[K],
  ) {
    updateDraftObject(objectId, (object) => ({
      ...object,
      [field]: value,
      ...(field === "id" ? { label: String(value) } : {}),
    }));
    if (field === "id") {
      setSelectedObjectId(String(value));
    }
  }

  function addObjectFromPreset(preset: SceneObjectPreset) {
    const nextObject = createObjectFromPreset(preset, draftScene.objects);
    setDraftScene((current) => ({
      ...current,
      objects: [...current.objects, nextObject],
    }));
    setSelectedObjectId(nextObject.id);
  }

  function duplicateSelectedObject() {
    if (!selectedObject) {
      return;
    }

    const nextId = makeObjectId(selectedObject.id, draftScene.objects);
    const duplicate: SceneObject = {
      ...cloneJson(selectedObject),
      entityId: nextId,
      id: nextId,
      label: `${selectedObject.label} copy`,
      name: `${selectedObject.name ?? selectedObject.label} copy`,
      x: selectedObject.x + 4,
      y: selectedObject.y + 4,
    };

    setDraftScene((current) => ({
      ...current,
      objects: [...current.objects, duplicate],
    }));
    setSelectedObjectId(nextId);
  }

  function deleteSelectedObject() {
    if (!selectedObject) {
      return;
    }

    setDraftScene((current) => ({
      ...current,
      objects: current.objects.filter((object) => object.id !== selectedObject.id),
    }));
    setSelectedObjectId(draftScene.objects[0]?.id ?? "");
  }

  function getStagePoint(clientX: number, clientY: number): TrackPoint | null {
    const bounds = stageRef.current?.getBoundingClientRect();

    if (!bounds) {
      return null;
    }

    return {
      x: Number((((clientX - bounds.left) / bounds.width) * 100).toFixed(2)),
      y: Number((((clientY - bounds.top) / bounds.height) * 100).toFixed(2)),
    };
  }

  function updateDraggedObject(clientX: number, clientY: number) {
    if (!dragState) {
      return;
    }

    const point = getStagePoint(clientX, clientY);

    if (!point) {
      return;
    }

    updateDraftObject(dragState.objectId, (object) => ({
      ...object,
      x: point.x,
      y: point.y,
    }));
  }

  function handleStageClick(clientX: number, clientY: number) {
    if (appMode !== "authoring" || !isPathRecording) {
      return;
    }

    const point = getStagePoint(clientX, clientY);

    if (point) {
      setDraftPath((current) => [...current, point]);
    }
  }

  function updateSelectedRule(updater: (rule: BindingRule) => BindingRule) {
    setDraftRules((current) =>
      current.map((rule) => (rule.id === selectedRuleId ? updater(rule) : rule)),
    );
  }

  function addBindingRule() {
    const id = `rule.authored.${draftRules.length + 1}`;
    const targetId = selectedObject?.id ?? draftScene.objects[0]?.id ?? "";
    const rule: BindingRule = {
      actions: [{ kind: "setState", targetId, state: "active" }],
      description: "Authored binding rule.",
      id,
      name: "Authored binding",
      when: {
        type: "agent.run.started",
      },
    };

    setDraftRules((current) => [...current, rule]);
    setSelectedRuleId(id);
  }

  function addActionToSelectedRule(kind: VisualAction["kind"]) {
    const targetId = selectedObject?.id ?? draftScene.objects[0]?.id ?? "";
    updateSelectedRule((rule) => ({
      ...rule,
      actions: [...rule.actions, getDefaultAction(kind, targetId)],
    }));
  }

  function updateSelectedRuleAction(
    actionIndex: number,
    updater: (action: VisualAction) => VisualAction,
  ) {
    updateSelectedRule((rule) => ({
      ...rule,
      actions: rule.actions.map((action, index) =>
        index === actionIndex ? updater(action) : action,
      ),
    }));
  }

  function removeSelectedRuleAction(actionIndex: number) {
    updateSelectedRule((rule) => ({
      ...rule,
      actions: rule.actions.filter((_, index) => index !== actionIndex),
    }));
  }

  function exportSceneJson() {
    downloadText("visual-event-runtime-scene.json", serializeSceneConfig(draftScene));
  }

  function exportBindingsJson() {
    downloadText(
      "visual-event-runtime-bindings.json",
      serializeBindingRules(draftRules),
    );
  }

  function exportEventsJsonl() {
    downloadText(
      "visual-event-runtime-events.jsonl",
      serializeEventFeedJsonl(draftEvents),
      "text/plain",
    );
  }

  function exportScenarioJson() {
    downloadText(
      "visual-event-runtime-scenario.json",
      serializeScenarioDocument(draftScenarioDocument),
    );
  }

  function selectBundledScenario(scenarioId: string) {
    const scenario = bundledScenarios.find(
      (candidate) => candidate.scenarioId === scenarioId,
    );

    if (!scenario) {
      return;
    }

    const normalizedEvents = normalizeEventTimeline(cloneJson(scenario.events));
    const nextFirstEventTs = sortEventsByTimestamp(normalizedEvents)[0]?.ts ?? 0;
    const knownPack = localAssetPacks.find(
      (assetPack) => assetPack.manifest.id === scenario.assetPackId,
    );

    setReplayScenarioMeta(getScenarioDocumentMeta(scenario));
    setDraftScenarioMeta(getScenarioDocumentMeta(scenario));
    setReplayScene(cloneJson(scenario.scene));
    setDraftScene(cloneJson(scenario.scene));
    setReplayRules(cloneJson(scenario.bindings));
    setDraftRules(cloneJson(scenario.bindings));
    setReplayEvents(cloneJson(normalizedEvents));
    setDraftEvents(cloneJson(normalizedEvents));
    setSelectedObjectId(scenario.scene.objects[0]?.id ?? "");
    setSelectedRuleId(scenario.bindings[0]?.id ?? "");
    setSelectedEventId(normalizedEvents[0]?.eventId ?? "");
    setVirtualTimeMs(nextFirstEventTs);
    setIsReplayPlaying(false);
    setMissingAssetWarnings({});

    if (knownPack) {
      setSelectedAssetPackId(knownPack.manifest.id);
      setPreviewClipId(knownPack.manifest.animations[0]?.id ?? "");
      setPreviewElapsedMs(0);
      setIsPreviewPlaying(false);
    }
  }

  function applyScenarioToReplay() {
    const nextEvents = normalizeEventTimeline(cloneJson(draftEvents));
    const nextFirstEventTs = sortEventsByTimestamp(nextEvents)[0]?.ts ?? 0;
    const knownPack = localAssetPacks.find(
      (assetPack) => assetPack.manifest.id === draftScenarioMeta.assetPackId,
    );

    setReplayScenarioMeta(cloneJson(draftScenarioMeta));
    setReplayScene(cloneJson(draftScene));
    setReplayRules(cloneJson(draftRules));
    setReplayEvents(nextEvents);
    setVirtualTimeMs(nextFirstEventTs);
    setIsReplayPlaying(false);

    if (knownPack) {
      setSelectedAssetPackId(knownPack.manifest.id);
    }
  }

  function importScenarioDocument(scenario: ScenarioDocument) {
    const normalizedEvents = normalizeEventTimeline(scenario.events);

    setDraftScenarioMeta(getScenarioDocumentMeta(scenario));
    setDraftScene(cloneJson(scenario.scene));
    setDraftRules(cloneJson(scenario.bindings));
    setDraftEvents(cloneJson(normalizedEvents));
    setSelectedObjectId(scenario.scene.objects[0]?.id ?? "");
    setSelectedRuleId(scenario.bindings[0]?.id ?? "");
    setSelectedEventId(normalizedEvents[0]?.eventId ?? "");
    setIsReplayPlaying(false);
  }

  function importFileText(file: File | undefined, onText: (text: string) => void) {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => onText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  function updateDraftEvent(
    eventId: string,
    updater: (event: VisualEvent) => VisualEvent,
  ) {
    setDraftEvents((current) =>
      sortEventsByTimestamp(
        current.map((event) => (event.eventId === eventId ? updater(event) : event)),
      ),
    );
  }

  function addEventFromTemplate(templateType: EventTemplateType) {
    const nextEvent = createEventFromTemplate(templateType, draftEvents);

    setDraftEvents((current) => sortEventsByTimestamp([...current, nextEvent]));
    setSelectedEventId(nextEvent.eventId);
  }

  function addBlankEvent() {
    addEventFromTemplate("agent.run.started");
  }

  function duplicateSelectedEvent() {
    if (!selectedDraftEvent) {
      return;
    }

    const nextEvent = duplicateEvent(selectedDraftEvent, draftEvents);

    setDraftEvents((current) => sortEventsByTimestamp([...current, nextEvent]));
    setSelectedEventId(nextEvent.eventId);
  }

  function deleteSelectedEvent() {
    if (!selectedDraftEvent) {
      return;
    }

    const remainingEvents = draftEvents.filter(
      (event) => event.eventId !== selectedDraftEvent.eventId,
    );

    setDraftEvents(sortEventsByTimestamp(remainingEvents));
    setSelectedEventId(sortEventsByTimestamp(remainingEvents)[0]?.eventId ?? "");
  }

  function updateSelectedEventId(nextEventId: string) {
    if (!selectedDraftEvent) {
      return;
    }

    updateDraftEvent(selectedDraftEvent.eventId, (event) => ({
      ...event,
      eventId: nextEventId,
    }));
    setSelectedEventId(nextEventId);
  }

  function updateSelectedEventTimestamp(ts: number) {
    if (!selectedDraftEvent) {
      return;
    }

    updateDraftEvent(selectedDraftEvent.eventId, (event) =>
      eventWithTimestamp(event, ts, draftScenarioStartMs),
    );
  }

  function updateSelectedEventOffset(offsetMs: number) {
    if (!selectedDraftEvent) {
      return;
    }

    updateDraftEvent(selectedDraftEvent.eventId, (event) =>
      eventWithOffsetMs(event, offsetMs, draftScenarioStartMs),
    );
  }

  function updateSelectedEventEntity(
    field: keyof VisualEvent["entity"],
    value: string,
  ) {
    if (!selectedDraftEvent) {
      return;
    }

    updateDraftEvent(selectedDraftEvent.eventId, (event) => ({
      ...event,
      entity: {
        ...event.entity,
        [field]: value,
        ...(field === "name" ? { label: value } : {}),
      },
    }));
  }

  function updateSelectedEventTransition(
    field: "from" | "to",
    value: string,
  ) {
    if (!selectedDraftEvent) {
      return;
    }

    updateDraftEvent(selectedDraftEvent.eventId, (event) => ({
      ...event,
      transition: {
        ...(event.transition ?? {}),
        [field]: value,
      },
    }));
  }

  function selectPreviewClip(clipId: string) {
    setPreviewClipId(clipId);
    setPreviewElapsedMs(0);
    setIsPreviewPlaying(false);
  }

  function selectAssetPack(assetPackId: string) {
    const assetPack =
      localAssetPacks.find((pack) => pack.manifest.id === assetPackId) ??
      localAssetPacks[0];

    setSelectedAssetPackId(assetPack.manifest.id);
    setDraftScenarioMeta((current) => ({
      ...current,
      assetPackId: assetPack.manifest.id,
    }));
    setPreviewClipId(assetPack.manifest.animations[0].id);
    setPreviewElapsedMs(0);
    setIsPreviewPlaying(false);
    setMissingAssetWarnings({});
  }

  function getFallbackAsset(assetKey: string) {
    return selectedLocalPack.fallbackSpritesByAssetKey[assetKey];
  }

  function handleAssetMissing(asset: SpriteSheetAssetDefinition) {
    setMissingAssetWarnings((current) => ({
      ...current,
      [asset.key]: {
        key: asset.key,
        src: asset.src,
      },
    }));
  }

  useEffect(() => {
    if (appMode === "authoring") {
      setIsReplayPlaying(false);
    }
  }, [appMode]);

  useEffect(() => {
    setVirtualTimeMs((current) =>
      Math.max(firstEventTs, Math.min(lastEventTs, current)),
    );
  }, [firstEventTs, lastEventTs]);

  useEffect(() => {
    if (!isReplayPlaying) {
      return;
    }

    let frameId = 0;
    let previous = performance.now();

    const tick = (now: number) => {
      const delta = (now - previous) * replaySpeed;
      previous = now;

      setVirtualTimeMs((current) => {
        const next = Math.min(lastEventTs, current + delta);

        if (next >= lastEventTs) {
          setIsReplayPlaying(false);
        }

        return next;
      });

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frameId);
  }, [isReplayPlaying, lastEventTs, replaySpeed]);

  useEffect(() => {
    if (!isPreviewPlaying) {
      return;
    }

    let frameId = 0;
    let previous = performance.now();

    const tick = (now: number) => {
      const delta = now - previous;
      previous = now;

      setPreviewElapsedMs((current) => {
        const next = current + delta;

        if (
          selectedPreviewClip.playback === "once" &&
          isAnimationComplete(selectedPreviewClip, next)
        ) {
          setIsPreviewPlaying(false);
          return selectedPreviewDurationMs;
        }

        if (
          selectedPreviewClip.playback === "loop" &&
          next > selectedPreviewRangeMs
        ) {
          return next % selectedPreviewDurationMs;
        }

        return next;
      });

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frameId);
  }, [
    isPreviewPlaying,
    selectedPreviewClip,
    selectedPreviewDurationMs,
    selectedPreviewRangeMs,
  ]);

  useEffect(() => {
    if (appMode !== "presenter") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      if (shouldIgnorePresenterShortcut(target?.tagName)) {
        return;
      }

      const action = getPresenterShortcutAction(event.key);

      switch (action.kind) {
        case "togglePlay":
          event.preventDefault();
          setIsReplayPlaying((playing) => !playing);
          break;
        case "restart":
          event.preventDefault();
          restartReplay();
          break;
        case "setSpeed":
          event.preventDefault();
          setReplaySpeed(action.speed);
          break;
        case "none":
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [appMode, firstEventTs]);

  return (
    <main
      className={[
        "app-shell",
        appMode === "presenter" ? "presenter-shell" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {appMode === "presenter" ? (
        <section className="presenter-controls" aria-label="Presenter controls">
          <button
            type="button"
            onClick={() => setIsReplayPlaying((playing) => !playing)}
          >
            {isReplayPlaying ? "Pause" : "Play"}
          </button>
          <button type="button" className="secondary" onClick={restartReplay}>
            Restart
          </button>
          <div className="speed-row" aria-label="Presenter speed">
            {[1, 2, 5].map((speed) => (
              <button
                className={speed === replaySpeed ? "selected-speed" : "secondary"}
                key={speed}
                onClick={() =>
                  setReplaySpeed(speed as (typeof replaySpeeds)[number])
                }
                type="button"
              >
                {speed}x
              </button>
            ))}
          </div>
          <span className="metric">Time {formatSeconds(virtualTimeMs)}</span>
          <label className="checkbox-row presenter-caption-toggle">
            <input
              checked={showPresenterCaptions}
              onChange={(event) =>
                setShowPresenterCaptions(event.currentTarget.checked)
              }
              type="checkbox"
            />
            <span>Captions</span>
          </label>
          {showPresenterCaptions && currentPresenterEvent ? (
            <span className="presenter-caption">
              {currentPresenterEvent.type} / {currentPresenterEvent.entity.id}
            </span>
          ) : null}
        </section>
      ) : null}
      {appMode !== "presenter" ? (
      <aside className="side-panel left-panel" aria-label="Replay controls">
        <header className="panel-header">
          <span className="panel-kicker">Prototype</span>
          <h1>Visual Event Runtime</h1>
        </header>

        <section className="panel-section">
          <div className="section-heading">
            <h2>Mode</h2>
            <span className="metric">{appMode}</span>
          </div>
          <div className="control-row">
            <button
              className={appMode === "replay" ? "selected-speed" : "secondary"}
              onClick={() => setMode("replay")}
              type="button"
            >
              Replay
            </button>
            <button
              className={appMode === "authoring" ? "selected-speed" : "secondary"}
              onClick={() => setMode("authoring")}
              type="button"
            >
              Authoring
            </button>
            <button
              className="secondary"
              onClick={() => setMode("presenter")}
              type="button"
            >
              Presenter
            </button>
          </div>
        </section>

        <section className="panel-section">
          <div className="section-heading">
            <h2>Scenario</h2>
            <span className="metric">{replayScenarioMeta.version}</span>
          </div>
          <label className="select-control">
            <span>Demo Scenario</span>
            <select
              onChange={(event) => selectBundledScenario(event.currentTarget.value)}
              value={selectedBundledScenarioId}
            >
              {bundledScenarios.map((scenario) => (
                <option key={scenario.scenarioId} value={scenario.scenarioId}>
                  {getBundledScenarioLabel(scenario)}
                </option>
              ))}
              {selectedBundledScenarioId === "custom" ? (
                <option value="custom">Imported / authored scenario</option>
              ) : null}
            </select>
          </label>
        </section>

        {appMode === "authoring" ? (
          <section className="panel-section authoring-form">
            <div className="section-heading">
              <h2>Import / Export</h2>
              <span className="metric">local</span>
            </div>
            <div className="form-grid-2">
              <label>
                <span>Scenario ID</span>
                <input
                  value={draftScenarioMeta.scenarioId}
                  onChange={(event) =>
                    setDraftScenarioMeta((current) => ({
                      ...current,
                      scenarioId: event.currentTarget.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Name</span>
                <input
                  value={draftScenarioMeta.name}
                  onChange={(event) =>
                    setDraftScenarioMeta((current) => ({
                      ...current,
                      name: event.currentTarget.value,
                    }))
                  }
                />
              </label>
            </div>
            <label>
              <span>Description</span>
              <textarea
                value={draftScenarioMeta.description ?? ""}
                onChange={(event) =>
                  setDraftScenarioMeta((current) => ({
                    ...current,
                    description: event.currentTarget.value,
                  }))
                }
              />
            </label>
            <div className="control-row">
              <button type="button" onClick={applyScenarioToReplay}>
                Apply scenario to replay
              </button>
              <button type="button" onClick={exportScenarioJson}>
                Export scenario
              </button>
              <label className="file-button">
                Import scenario
                <input
                  accept="application/json,.json"
                  onChange={(event) =>
                    importFileText(event.currentTarget.files?.[0], (text) => {
                      importScenarioDocument(parseScenarioDocumentJson(text));
                      event.currentTarget.value = "";
                    })
                  }
                  type="file"
                />
              </label>
              <button type="button" onClick={exportSceneJson}>
                Export scene
              </button>
              <label className="file-button">
                Import scene
                <input
                  accept="application/json,.json"
                  onChange={(event) =>
                    importFileText(event.currentTarget.files?.[0], (text) => {
                      const importedScene = parseSceneConfigJson(text);
                      setDraftScene(cloneJson(importedScene));
                      setReplayScene(cloneJson(importedScene));
                      setSelectedObjectId(importedScene.objects[0]?.id ?? "");
                      setIsReplayPlaying(false);
                      event.currentTarget.value = "";
                    })
                  }
                  type="file"
                />
              </label>
              <button type="button" onClick={exportBindingsJson}>
                Export bindings
              </button>
              <label className="file-button">
                Import bindings
                <input
                  accept="application/json,.json"
                  onChange={(event) =>
                    importFileText(event.currentTarget.files?.[0], (text) => {
                      const importedRules = parseBindingRulesJson(text);
                      setDraftRules(cloneJson(importedRules));
                      setReplayRules(cloneJson(importedRules));
                      setSelectedRuleId(importedRules[0]?.id ?? "");
                      setIsReplayPlaying(false);
                      event.currentTarget.value = "";
                    })
                  }
                  type="file"
                />
              </label>
              <button type="button" onClick={exportEventsJsonl}>
                Export events
              </button>
              <label className="file-button">
                Import events
                <input
                  accept=".jsonl,text/plain"
                  onChange={(event) =>
                    importFileText(event.currentTarget.files?.[0], (text) => {
                      const importedEvents = normalizeEventTimeline(
                        parseEventFeedJsonl(text),
                      );
                      const nextFirstEventTs =
                        sortEventsByTimestamp(importedEvents)[0]?.ts ?? 0;

                      setDraftEvents(cloneJson(importedEvents));
                      setReplayEvents(cloneJson(importedEvents));
                      setSelectedEventId(importedEvents[0]?.eventId ?? "");
                      setVirtualTimeMs(nextFirstEventTs);
                      setIsReplayPlaying(false);
                      event.currentTarget.value = "";
                    })
                  }
                  type="file"
                />
              </label>
            </div>
          </section>
        ) : null}

        <section className="panel-section">
          <div className="section-heading">
            <h2>Replay</h2>
            <span className="metric">{formatSeconds(virtualTimeMs)}</span>
          </div>
          <div className="control-row replay-buttons">
            <button
              type="button"
              onClick={() => setIsReplayPlaying((playing) => !playing)}
            >
              {isReplayPlaying ? "Pause" : "Play"}
            </button>
            <button type="button" className="secondary" onClick={restartReplay}>
              Restart
            </button>
          </div>
          <label className="range-control">
            <span>
              Virtual time {formatMs(virtualTimeMs)} / {formatMs(lastEventTs)}
            </span>
            <input
              max={lastEventTs}
              min={firstEventTs}
              onChange={(event) => {
                setIsReplayPlaying(false);
                setVirtualTimeMs(Number(event.currentTarget.value));
              }}
              type="range"
              value={Math.round(virtualTimeMs)}
            />
          </label>
          <div className="speed-row" aria-label="Replay speed">
            {replaySpeeds.map((speed) => (
              <button
                className={speed === replaySpeed ? "selected-speed" : "secondary"}
                key={speed}
                onClick={() => setReplaySpeed(speed)}
                type="button"
              >
                {speed}x
              </button>
            ))}
          </div>
        </section>

        <section className="panel-section">
          <div className="section-heading">
            <h2>Asset Pack</h2>
            <span className="metric">{selectedPack.version}</span>
          </div>
          <label className="select-control">
            <span>Local Pack</span>
            <select
              onChange={(event) => selectAssetPack(event.currentTarget.value)}
              value={selectedPack.id}
            >
              {localAssetPacks.map((assetPack) => (
                <option
                  key={assetPack.manifest.id}
                  value={assetPack.manifest.id}
                >
                  {assetPack.manifest.name}
                </option>
              ))}
            </select>
          </label>
          <dl className="scene-meta">
            <div>
              <dt>Scene</dt>
              <dd>{replayScene.id}</dd>
            </div>
            <div>
              <dt>Assets</dt>
              <dd>
                {selectedPack.assets.length} total, {spriteSheetCount} sprite
                sheets
              </dd>
            </div>
            <div>
              <dt>Animations</dt>
              <dd>{selectedPack.animations.length} clips</dd>
            </div>
          </dl>
        </section>

        {appMode === "authoring" ? (
          <>
            <section className="panel-section pack-list-section">
              <div className="section-heading">
                <h2>Preset Palette</h2>
                <span className="metric">
                  {selectedPack.objectPresets?.length ?? 0}
                </span>
              </div>
              <ul className="pack-list">
                {(selectedPack.objectPresets ?? []).map((preset) => (
                  <li key={preset.id}>
                    <strong>{preset.name}</strong>
                    <span>{preset.kind}</span>
                    <button
                      className="secondary"
                      onClick={() => addObjectFromPreset(preset)}
                      type="button"
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel-section">
              <div className="section-heading">
                <h2>Path Editor</h2>
                <span className="metric">{draftPath.length} points</span>
              </div>
              <div className="control-row">
                <button
                  type="button"
                  onClick={() => setIsPathRecording((recording) => !recording)}
                >
                  {isPathRecording ? "Stop path" : "Start path"}
                </button>
                <button
                  className="secondary"
                  onClick={() => setDraftPath([])}
                  type="button"
                >
                  Clear path
                </button>
              </div>
              <button
                className="secondary"
                onClick={() =>
                  navigator.clipboard?.writeText(JSON.stringify(draftPath, null, 2))
                }
                type="button"
              >
                Copy path JSON
              </button>
              <pre className="json-preview">{JSON.stringify(draftPath, null, 2)}</pre>
            </section>
          </>
        ) : null}

        <section className="panel-section event-list-section">
          <div className="section-heading">
            <h2>Event Timeline</h2>
            <span className="metric">{timelineEvents.length}</span>
          </div>
          <ol className="event-list">
            {timelineEvents.map((event) => (
              <li
                className={[
                  "event-item",
                  event.ts <= virtualTimeMs ? "past" : "",
                  Math.abs(event.ts - virtualTimeMs) < 200 ? "current" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={event.eventId}
              >
                <span className="event-time">{formatSeconds(event.ts)}</span>
                <span className="event-label">{event.type}</span>
                <span className="event-type">
                  {event.entity.id}
                  {event.transition?.to ? ` -> ${event.transition.to}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel-section pack-list-section">
          <div className="section-heading">
            <h2>Pack Assets</h2>
            <span className="metric">{selectedPack.assets.length}</span>
          </div>
          <ul className="pack-list">
            {selectedPack.assets.map((asset) => (
              <li key={asset.key}>
                <strong>{asset.key}</strong>
                <span>{asset.kind}</span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
      ) : null}

      <section
        className={[
          "stage-shell",
          appMode === "presenter" ? "presenter-stage-shell" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Visual runtime stage"
      >
        <header className="stage-header">
          <div>
            <span className="panel-kicker">Stage</span>
            <h2>{stageScene.title}</h2>
          </div>
          <div className="stage-header-status">
            <p>{stageScene.description}</p>
            <ul className="demo-status-list" aria-label="Demo status">
              {demoStatusItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </header>

        <div
          className={[
            "stage-window",
            appMode === "authoring" ? "authoring-stage" : "demo-stage",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={(event) => handleStageClick(event.clientX, event.clientY)}
          onPointerMove={(event) => updateDraggedObject(event.clientX, event.clientY)}
          onPointerUp={() => setDragState(null)}
          ref={stageRef}
        >
          <svg
            aria-hidden="true"
            className="route-layer"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            {routeTrails.map((track) => (
              <polyline
                className="route-trail"
                key={track.id}
                points={(track.path ?? [])
                  .map((point) => `${point.x},${point.y}`)
                .join(" ")}
              />
            ))}
            {appMode === "authoring" && draftPath.length > 0 ? (
              <polyline
                className="draft-route-trail"
                points={draftPath.map((point) => `${point.x},${point.y}`).join(" ")}
              />
            ) : null}
          </svg>

          {stageScene.lanes.map((lane, index) => (
            <div
              className="stage-lane"
              key={lane}
              style={{ left: `${(index / stageScene.lanes.length) * 100}%` }}
            >
              <span>{lane}</span>
            </div>
          ))}

          {stageObjects.map((object) => {
            const clipId = getObjectAnimationId(object);
            const clip = clipId ? clipsById.get(clipId) : undefined;
            const asset = clip ? assetsByKey.get(clip.assetKey) : undefined;
            const fallbackAsset = clip ? getFallbackAsset(clip.assetKey) : undefined;
            const objectElapsedMs = Math.max(
              0,
              virtualTimeMs - (object.animationStartedAt ?? 0),
            );
            const frame =
              clip === undefined ? undefined : getAnimationFrame(clip, objectElapsedMs);
            const renderAsset = isSpriteSheetAsset(asset)
              ? asset
              : fallbackAsset;
            const objectHeight = object.height ?? object.width * 0.72;
            const spriteDisplayWidth =
              appMode === "authoring"
                ? 64
                : Math.max(52, Math.min(object.width * 0.86, objectHeight * 0.92));

            const style = {
              "--accent-color": object.accent,
              height: appMode === "authoring" ? undefined : objectHeight,
              left: `${object.x}%`,
              opacity: object.opacity ?? 1,
              rotate:
                object.rotation === undefined
                  ? undefined
                  : `${object.rotation}deg`,
              top: `${object.y}%`,
              width: object.width,
              zIndex: object.zIndex,
            } as CSSProperties;

            return (
              <button
                type="button"
                className={[
                  "stage-object",
                  object.spawned ? "spawned-object" : "",
                  `kind-${object.kind}`,
                  `state-${toCssToken(object.visualState)}`,
                  selectedObject?.id === object.id ? "selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={object.id}
                onPointerDown={(event) => {
                  if (appMode === "authoring") {
                    event.stopPropagation();
                    setDragState({ objectId: object.id });
                    setSelectedObjectId(object.id);
                  }
                }}
                style={style}
                onClick={(event) => {
                  if (appMode === "authoring") {
                    event.stopPropagation();
                  }
                  setSelectedObjectId(object.id);
                }}
              >
                {clip && renderAsset ? (
                  <SpriteRenderer
                    asset={renderAsset}
                    className="stage-sprite"
                    clip={clip}
                    displayWidth={spriteDisplayWidth}
                    elapsedMs={objectElapsedMs}
                    fallbackAsset={fallbackAsset}
                    label={`${object.label} ${clip.id}`}
                    onAssetMissing={handleAssetMissing}
                  />
                ) : (
                  <span className="stage-sprite fallback-sprite" />
                )}
                <span className="object-kind">{object.kind}</span>
                <strong>{object.label}</strong>
                <span className="object-status">{object.visualState}</span>
                {appMode === "authoring" && frame !== undefined ? (
                  <span className="frame-chip">frame {frame}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {appMode !== "presenter" ? (
      <aside className="side-panel right-panel" aria-label="Runtime debug panels">
        <header className="panel-header">
          <span className="panel-kicker">Runtime</span>
          <h2>{selectedObject?.label ?? "No object"}</h2>
        </header>

        {selectedObject ? (
          <section className="panel-section">
            <div className="section-heading">
              <h2>Selected Object</h2>
              <span
                className={`status-pill state-${toCssToken(
                  selectedObject.visualState,
                )}`}
              >
                {selectedObject.visualState}
              </span>
            </div>
            <dl className="detail-grid">
              <div>
                <dt>ID</dt>
                <dd>{selectedObject.id}</dd>
              </div>
              <div>
                <dt>Kind</dt>
                <dd>{selectedObject.kind}</dd>
              </div>
              <div>
                <dt>Animation</dt>
                <dd>{selectedObject.currentAnimationId ?? "none"}</dd>
              </div>
              <div>
                <dt>Position</dt>
                <dd>
                  {selectedObject.x.toFixed(1)}, {selectedObject.y.toFixed(1)}
                </dd>
              </div>
            </dl>
            <p className="detail-note">{selectedObject.detail}</p>
          </section>
        ) : null}

        {appMode === "authoring" ? (
          <section className="panel-section authoring-form">
            <div className="section-heading">
              <h2>Event Authoring</h2>
              <span className="metric">{sortedDraftEvents.length}</span>
            </div>
            <label>
              <span>Event</span>
              <select
                value={selectedDraftEvent?.eventId ?? ""}
                onChange={(event) => setSelectedEventId(event.currentTarget.value)}
              >
                {sortedDraftEvents.map((event) => (
                  <option key={event.eventId} value={event.eventId}>
                    {formatMs(event.ts)} / {event.type}
                  </option>
                ))}
              </select>
            </label>
            <div className="control-row">
              <button type="button" onClick={addBlankEvent}>
                Add event
              </button>
              <button
                className="secondary"
                disabled={!selectedDraftEvent}
                onClick={duplicateSelectedEvent}
                type="button"
              >
                Duplicate
              </button>
            </div>
            <div className="control-row">
              <label>
                <span>Template</span>
                <select
                  defaultValue=""
                  onChange={(event) => {
                    if (event.currentTarget.value) {
                      addEventFromTemplate(
                        event.currentTarget.value as EventTemplateType,
                      );
                      event.currentTarget.value = "";
                    }
                  }}
                >
                  <option value="">add from template</option>
                  {eventTemplateTypes.map((templateType) => (
                    <option key={templateType} value={templateType}>
                      {templateType}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="secondary"
                disabled={!selectedDraftEvent}
                onClick={deleteSelectedEvent}
                type="button"
              >
                Delete event
              </button>
            </div>
            {selectedDraftEvent ? (
              <>
                <div className="form-grid-2">
                  <label>
                    <span>eventId</span>
                    <input
                      value={selectedDraftEvent.eventId}
                      onChange={(event) =>
                        updateSelectedEventId(event.currentTarget.value)
                      }
                    />
                  </label>
                  <label>
                    <span>type</span>
                    <input
                      value={selectedDraftEvent.type}
                      onChange={(event) =>
                        updateDraftEvent(selectedDraftEvent.eventId, (current) => ({
                          ...current,
                          type: event.currentTarget.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="form-grid-2">
                  <label>
                    <span>ts</span>
                    <input
                      type="number"
                      value={selectedDraftEvent.ts}
                      onChange={(event) =>
                        updateSelectedEventTimestamp(
                          Number(event.currentTarget.value),
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>offsetMs</span>
                    <input
                      type="number"
                      value={getEventOffsetMs(
                        selectedDraftEvent,
                        draftScenarioStartMs,
                      )}
                      onChange={(event) =>
                        updateSelectedEventOffset(
                          Number(event.currentTarget.value),
                        )
                      }
                    />
                  </label>
                </div>
                <div className="form-grid-2">
                  <label>
                    <span>entity.id</span>
                    <input
                      value={selectedDraftEvent.entity.id}
                      onChange={(event) =>
                        updateSelectedEventEntity("id", event.currentTarget.value)
                      }
                    />
                  </label>
                  <label>
                    <span>entity.kind</span>
                    <input
                      value={selectedDraftEvent.entity.kind}
                      onChange={(event) =>
                        updateSelectedEventEntity("kind", event.currentTarget.value)
                      }
                    />
                  </label>
                </div>
                <label>
                  <span>entity.name</span>
                  <input
                    value={
                      selectedDraftEvent.entity.name ??
                      selectedDraftEvent.entity.label ??
                      ""
                    }
                    onChange={(event) =>
                      updateSelectedEventEntity("name", event.currentTarget.value)
                    }
                  />
                </label>
                <div className="form-grid-2">
                  <label>
                    <span>transition.from</span>
                    <input
                      value={selectedDraftEvent.transition?.from ?? ""}
                      onChange={(event) =>
                        updateSelectedEventTransition(
                          "from",
                          event.currentTarget.value,
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>transition.to</span>
                    <input
                      value={selectedDraftEvent.transition?.to ?? ""}
                      onChange={(event) =>
                        updateSelectedEventTransition(
                          "to",
                          event.currentTarget.value,
                        )
                      }
                    />
                  </label>
                </div>
                <label>
                  <span>severity</span>
                  <input
                    value={selectedDraftEvent.severity ?? ""}
                    onChange={(event) =>
                      updateDraftEvent(selectedDraftEvent.eventId, (current) => ({
                        ...current,
                        severity: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Payload JSON</span>
                  <textarea
                    key={`${selectedDraftEvent.eventId}-payload`}
                    defaultValue={JSON.stringify(
                      selectedDraftEvent.payload ?? {},
                      null,
                      2,
                    )}
                    onBlur={(event) => {
                      try {
                        const payload = JSON.parse(event.currentTarget.value) as Record<
                          string,
                          unknown
                        >;

                        updateDraftEvent(selectedDraftEvent.eventId, (current) => ({
                          ...current,
                          payload,
                        }));
                      } catch {
                        return;
                      }
                    }}
                  />
                </label>
              </>
            ) : (
              <p className="empty-state">No event selected.</p>
            )}
          </section>
        ) : null}

        {appMode === "authoring" && selectedObject ? (
          <>
            <section className="panel-section authoring-form">
              <div className="section-heading">
                <h2>Object Authoring</h2>
                <span className="metric">draft</span>
              </div>
              <label>
                <span>ID</span>
                <input
                  value={selectedObject.id}
                  onChange={(event) =>
                    updateDraftObjectField(
                      selectedObject.id,
                      "id",
                      event.currentTarget.value,
                    )
                  }
                />
              </label>
              <label>
                <span>Entity ID</span>
                <input
                  value={selectedObject.entityId ?? ""}
                  onChange={(event) =>
                    updateDraftObjectField(
                      selectedObject.id,
                      "entityId",
                      event.currentTarget.value,
                    )
                  }
                />
              </label>
              <label>
                <span>Name</span>
                <input
                  value={selectedObject.name ?? selectedObject.label}
                  onChange={(event) =>
                    updateDraftObject(selectedObject.id, (object) => ({
                      ...object,
                      label: event.currentTarget.value,
                      name: event.currentTarget.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Kind</span>
                <input
                  value={selectedObject.kind}
                  onChange={(event) =>
                    updateDraftObjectField(
                      selectedObject.id,
                      "kind",
                      event.currentTarget.value,
                    )
                  }
                />
              </label>
              <label>
                <span>Asset Key</span>
                <select
                  value={selectedObject.assetKey ?? ""}
                  onChange={(event) =>
                    updateDraftObjectField(
                      selectedObject.id,
                      "assetKey",
                      event.currentTarget.value,
                    )
                  }
                >
                  <option value="">none</option>
                  {selectedPack.assets.map((asset) => (
                    <option key={asset.key} value={asset.key}>
                      {asset.key}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Animation</span>
                <select
                  value={selectedObject.currentAnimationId ?? ""}
                  onChange={(event) =>
                    updateDraftObjectField(
                      selectedObject.id,
                      "currentAnimationId",
                      event.currentTarget.value,
                    )
                  }
                >
                  <option value="">none</option>
                  {selectedPack.animations.map((clip) => (
                    <option key={clip.id} value={clip.id}>
                      {clip.id}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid-2">
                {(["x", "y", "width", "height", "rotation", "zIndex"] as const).map(
                  (field) => (
                    <label key={field}>
                      <span>{field}</span>
                      <input
                        type="number"
                        value={Number(selectedObject[field] ?? 0)}
                        onChange={(event) =>
                          updateDraftObjectField(
                            selectedObject.id,
                            field,
                            Number(event.currentTarget.value),
                          )
                        }
                      />
                    </label>
                  ),
                )}
              </div>
              <label>
                <span>Visual State</span>
                <input
                  value={selectedObject.visualState}
                  onChange={(event) =>
                    updateDraftObject(selectedObject.id, (object) => ({
                      ...object,
                      state: event.currentTarget.value,
                      visualState: event.currentTarget.value,
                    }))
                  }
                />
              </label>
              <label className="checkbox-row">
                <input
                  checked={selectedObject.hidden}
                  onChange={(event) =>
                    updateDraftObjectField(
                      selectedObject.id,
                      "hidden",
                      event.currentTarget.checked,
                    )
                  }
                  type="checkbox"
                />
                <span>Hidden</span>
              </label>
              <label>
                <span>Metadata JSON</span>
                <textarea
                  defaultValue={JSON.stringify(selectedObject.metadata ?? {}, null, 2)}
                  onBlur={(event) => {
                    try {
                      updateDraftObjectField(
                        selectedObject.id,
                        "metadata",
                        JSON.parse(event.currentTarget.value) as Record<
                          string,
                          unknown
                        >,
                      );
                    } catch {
                      // Validation panel surfaces malformed authored data after import.
                    }
                  }}
                />
              </label>
              <div className="control-row">
                <button type="button" onClick={duplicateSelectedObject}>
                  Duplicate
                </button>
                <button className="secondary" type="button" onClick={deleteSelectedObject}>
                  Delete
                </button>
              </div>
            </section>

            <section className="panel-section authoring-form">
              <div className="section-heading">
                <h2>Binding Authoring</h2>
                <span className="metric">{draftRules.length}</span>
              </div>
              <label>
                <span>Rule</span>
                <select
                  value={selectedRule?.id ?? ""}
                  onChange={(event) => setSelectedRuleId(event.currentTarget.value)}
                >
                  {draftRules.map((rule) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.id}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={addBindingRule}>
                Add binding rule
              </button>
              {selectedRule ? (
                <>
                  <label>
                    <span>ID</span>
                    <input
                      value={selectedRule.id}
                      onChange={(event) => {
                        const nextId = event.currentTarget.value;
                        updateSelectedRule((rule) => ({ ...rule, id: nextId }));
                        setSelectedRuleId(nextId);
                      }}
                    />
                  </label>
                  <label>
                    <span>Description</span>
                    <textarea
                      value={selectedRule.description ?? ""}
                      onChange={(event) =>
                        updateSelectedRule((rule) => ({
                          ...rule,
                          description: event.currentTarget.value,
                        }))
                      }
                    />
                  </label>
                  {(["type", "entity.id", "entity.kind", "transition.to"] as const).map(
                    (field) => (
                      <label key={field}>
                        <span>when.{field}</span>
                        <input
                          value={String(selectedRule.when[field] ?? "")}
                          onChange={(event) =>
                            updateSelectedRule((rule) => ({
                              ...rule,
                              when: {
                                ...rule.when,
                                [field]: event.currentTarget.value,
                              },
                            }))
                          }
                        />
                      </label>
                    ),
                  )}
                  <label>
                    <span>Add action</span>
                    <select
                      defaultValue=""
                      onChange={(event) => {
                        if (event.currentTarget.value) {
                          addActionToSelectedRule(
                            event.currentTarget.value as VisualAction["kind"],
                          );
                          event.currentTarget.value = "";
                        }
                      }}
                    >
                      <option value="">select action</option>
                      {[
                        "setState",
                        "showObject",
                        "hideObject",
                        "playAnimation",
                        "spawnFromObject",
                        "moveTo",
                        "moveToObject",
                        "moveAlongPath",
                        "orbitAround",
                        "attachToObject",
                        "detachFromObject",
                        "despawnAtObject",
                        "spawnEffect",
                        "spawnAttachedEffect",
                        "removeObject",
                        "showRouteTrail",
                        "hideRouteTrail",
                      ].map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </select>
                  </label>
                  <ul className="action-editor-list">
                    {selectedRule.actions.map((action, actionIndex) => (
                      <li key={`${selectedRule.id}-${actionIndex}`}>
                        <div className="section-heading">
                          <strong>{action.kind}</strong>
                          <button
                            className="secondary"
                            onClick={() => removeSelectedRuleAction(actionIndex)}
                            type="button"
                          >
                            Remove
                          </button>
                        </div>
                        {"targetId" in action ? (
                          <label>
                            <span>target objectId/entityId</span>
                            <input
                              value={action.targetId}
                              onChange={(event) =>
                                updateSelectedRuleAction(actionIndex, (current) => ({
                                  ...current,
                                  targetId: event.currentTarget.value,
                                }) as VisualAction)
                              }
                            />
                          </label>
                        ) : null}
                        {"objectId" in action ? (
                          <label>
                            <span>spawned objectId</span>
                            <input
                              value={action.objectId ?? ""}
                              onChange={(event) =>
                                updateSelectedRuleAction(actionIndex, (current) => ({
                                  ...current,
                                  objectId: event.currentTarget.value,
                                }) as VisualAction)
                              }
                            />
                          </label>
                        ) : null}
                        {"sourceObjectId" in action ? (
                          <label>
                            <span>source objectId/entityId</span>
                            <input
                              value={action.sourceObjectId}
                              onChange={(event) =>
                                updateSelectedRuleAction(actionIndex, (current) => ({
                                  ...current,
                                  sourceObjectId: event.currentTarget.value,
                                }) as VisualAction)
                              }
                            />
                          </label>
                        ) : null}
                        {"targetObjectId" in action ? (
                          <label>
                            <span>target objectId/entityId</span>
                            <input
                              value={action.targetObjectId}
                              onChange={(event) =>
                                updateSelectedRuleAction(actionIndex, (current) => ({
                                  ...current,
                                  targetObjectId: event.currentTarget.value,
                                }) as VisualAction)
                              }
                            />
                          </label>
                        ) : null}
                        {"durationMs" in action ? (
                          <label>
                            <span>durationMs</span>
                            <input
                              min={0}
                              type="number"
                              value={action.durationMs ?? 0}
                              onChange={(event) =>
                                updateSelectedRuleAction(actionIndex, (current) => ({
                                  ...current,
                                  durationMs: Number(event.currentTarget.value),
                                }) as VisualAction)
                              }
                            />
                          </label>
                        ) : null}
                        {"state" in action ? (
                          <label>
                            <span>state</span>
                            <input
                              value={action.state ?? ""}
                              onChange={(event) =>
                                updateSelectedRuleAction(actionIndex, (current) => ({
                                  ...current,
                                  state: event.currentTarget.value,
                                }) as VisualAction)
                              }
                            />
                          </label>
                        ) : null}
                        {"animationId" in action ? (
                          <label>
                            <span>animationId</span>
                            <select
                              value={action.animationId ?? ""}
                              onChange={(event) =>
                                updateSelectedRuleAction(actionIndex, (current) => ({
                                  ...current,
                                  animationId: event.currentTarget.value,
                                }) as VisualAction)
                              }
                            >
                              <option value="">none</option>
                              {selectedPack.animations.map((clip) => (
                                <option key={clip.id} value={clip.id}>
                                  {clip.id}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        {"presetId" in action ? (
                          <label>
                            <span>presetId</span>
                            <select
                              value={action.presetId}
                              onChange={(event) =>
                                updateSelectedRuleAction(actionIndex, (current) => ({
                                  ...current,
                                  presetId: event.currentTarget.value,
                                }) as VisualAction)
                              }
                            >
                              <option value="">select preset</option>
                              {(selectedPack.objectPresets ?? []).map((preset) => (
                                <option key={preset.id} value={preset.id}>
                                  {preset.id}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        {"path" in action ? (
                          <label>
                            <span>path JSON</span>
                            <textarea
                              value={JSON.stringify(action.path ?? [], null, 2)}
                              onChange={(event) => {
                                try {
                                  const path = JSON.parse(
                                    event.currentTarget.value,
                                  ) as TrackPoint[];
                                  updateSelectedRuleAction(
                                    actionIndex,
                                    (current) =>
                                      ({
                                        ...current,
                                        path,
                                      }) as VisualAction,
                                  );
                                } catch {
                                  return;
                                }
                              }}
                            />
                          </label>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          </>
        ) : null}

        <section className="panel-section">
          <div className="section-heading">
            <h2>Runtime Warnings</h2>
            <span className="metric">
              {runtimeState.warnings.length +
                packReferenceWarnings.length +
                scenarioWarnings.length}
            </span>
          </div>
          {runtimeState.warnings.length > 0 ||
          packReferenceWarnings.length > 0 ||
          scenarioWarnings.length > 0 ? (
            <div className="warning-panel">
              <ul>
                {runtimeState.warnings.map((warning) => (
                  <li key={warning.id}>{warning.message}</li>
                ))}
                {packReferenceWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
                {scenarioWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="empty-state">No runtime warnings.</p>
          )}
        </section>

        <section className="panel-section pack-list-section">
          <div className="section-heading">
            <h2>Asset Pack Health</h2>
            <span className="metric">{assetPackDiagnostics.length}</span>
          </div>
          <dl className="detail-grid compact-detail-grid">
            <div>
              <dt>ID</dt>
              <dd>{selectedPack.id}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{selectedPack.version}</dd>
            </div>
            <div>
              <dt>Style</dt>
              <dd>{selectedPack.style}</dd>
            </div>
            <div>
              <dt>Assets</dt>
              <dd>
                {selectedPack.assets.length} total / {assetKindCounts.spriteSheet ?? 0} sheets
              </dd>
            </div>
            <div>
              <dt>Clips</dt>
              <dd>{selectedPack.animations.length}</dd>
            </div>
            <div>
              <dt>Presets</dt>
              <dd>{selectedPack.objectPresets?.length ?? 0}</dd>
            </div>
          </dl>
          {assetPackDiagnostics.length > 0 ? (
            <ul className="diagnostic-list">
              {assetPackDiagnostics.map((diagnostic) => (
                <li
                  className={`diagnostic-${diagnostic.severity}`}
                  key={diagnostic.id}
                >
                  <strong>{diagnostic.code}</strong>
                  <span>{diagnostic.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No asset-pack reference issues detected.</p>
          )}
          <div className="section-heading">
            <h2>Used Assets</h2>
            <span className="metric">{activeUsedAssetKeys.length}</span>
          </div>
          <ul className="asset-chip-list">
            {activeUsedAssetKeys.map((assetKey) => (
              <li key={assetKey}>{assetKey}</li>
            ))}
          </ul>
          <div className="section-heading">
            <h2>Missing PNGs</h2>
            <span className="metric">{missingAssetWarningList.length}</span>
          </div>
          {missingAssetWarningList.length > 0 ? (
            <ul className="pack-list">
              {missingAssetWarningList.map((warning) => (
                <li key={warning.key}>
                  <strong>{warning.key}</strong>
                  <span>{warning.src}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">
              No missing high-fidelity PNGs observed during this session.
            </p>
          )}
        </section>

        <section className="panel-section pack-list-section">
          <div className="section-heading">
            <h2>Presentation Readiness</h2>
            <span className="metric">
              {
                presentationReadiness.filter((item) => item.status === "pass")
                  .length
              }
              /{presentationReadiness.length}
            </span>
          </div>
          <ul className="readiness-list">
            {presentationReadiness.map((item) => (
              <li className={`readiness-${item.status}`} key={item.id}>
                <strong>{item.label}</strong>
                <span>{item.message}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel-section pack-list-section">
          <div className="section-heading">
            <h2>Active Tracks</h2>
            <span className="metric">{activeTracks.length}</span>
          </div>
          {activeTracks.length > 0 ? (
            <ul className="pack-list">
              {activeTracks.map((track) => (
                <li key={track.id}>
                  <strong>{track.kind}</strong>
                  <span>
                    {track.objectId}
                    {track.targetObjectId ? ` -> ${track.targetObjectId}` : ""}
                  </span>
                  <span>
                    {formatSeconds(track.startTimeMs)} /{" "}
                    {formatMs(track.durationMs)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No active tracks at this time.</p>
          )}
        </section>

        <section className="panel-section pack-list-section">
          <div className="section-heading">
            <h2>Dispatched Events</h2>
            <span className="metric">{runtimeState.dispatchedEvents.length}</span>
          </div>
          {runtimeState.dispatchedEvents.length > 0 ? (
            <ul className="pack-list">
              {runtimeState.dispatchedEvents.map((entry) => (
                <li key={entry.event.eventId}>
                  <strong>{entry.event.type}</strong>
                  <span>
                    {formatSeconds(entry.event.ts)} / {entry.matchedRuleIds.length} rules /{" "}
                    {entry.actionCount} actions
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No events dispatched yet.</p>
          )}
        </section>

        <section className="panel-section pack-list-section">
          <div className="section-heading">
            <h2>Binding Rules</h2>
            <span className="metric">{replayRules.length}</span>
          </div>
          <ul className="pack-list">
            {replayRules.map((rule) => (
              <li key={rule.id}>
                <strong>{rule.name}</strong>
                <span>{JSON.stringify(rule.when)}</span>
                <span>
                  {rule.actions.map((action) => describeAction(action)).join(" | ")}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel-section preview-panel">
          <div className="section-heading">
            <h2>Sprite Preview</h2>
            <span className="metric">frame {selectedPreviewFrame}</span>
          </div>
          <label className="select-control">
            <span>Clip</span>
            <select
              onChange={(event) => selectPreviewClip(event.currentTarget.value)}
              value={selectedPreviewClip.id}
            >
              {selectedPack.animations.map((clip) => (
                <option key={clip.id} value={clip.id}>
                  {clip.id}
                </option>
              ))}
            </select>
          </label>
          <div className="preview-stage">
            {selectedPreviewRenderAsset ? (
              <SpriteRenderer
                asset={selectedPreviewRenderAsset}
                className="preview-sprite"
                clip={selectedPreviewClip}
                displayWidth={96}
                elapsedMs={previewElapsedMs}
                fallbackAsset={selectedPreviewFallbackAsset}
                label={`${selectedPreviewClip.id} preview`}
                onAssetMissing={handleAssetMissing}
              />
            ) : null}
          </div>
          <div className="control-row">
            <button
              type="button"
              onClick={() => setIsPreviewPlaying((playing) => !playing)}
            >
              {isPreviewPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setIsPreviewPlaying(false);
                setPreviewElapsedMs(0);
              }}
            >
              Reset
            </button>
          </div>
          <label className="range-control">
            <span>Elapsed {formatMs(previewElapsedMs)}</span>
            <input
              max={selectedPreviewRangeMs}
              min={0}
              onChange={(event) => {
                setIsPreviewPlaying(false);
                setPreviewElapsedMs(Number(event.currentTarget.value));
              }}
              type="range"
              value={Math.min(
                Math.round(previewElapsedMs),
                selectedPreviewRangeMs,
              )}
            />
          </label>
          <dl className="detail-grid compact-detail-grid">
            <div>
              <dt>Playback</dt>
              <dd>{selectedPreviewClip.playback}</dd>
            </div>
            <div>
              <dt>FPS</dt>
              <dd>{selectedPreviewClip.fps}</dd>
            </div>
            <div>
              <dt>Complete</dt>
              <dd>{selectedPreviewComplete ? "true" : "false"}</dd>
            </div>
          </dl>
        </section>
      </aside>
      ) : null}

      {appMode !== "presenter" ? (
      <footer className="status-bar">
        <span>Scenario {replayScenarioMeta.name}</span>
        <span>Scene {stageScene.id}</span>
        <span>{runtimeState.dispatchedEvents.length} dispatched events</span>
        <span>Virtual time {formatSeconds(virtualTimeMs)}</span>
        <span>
          {appMode === "authoring"
            ? "Authoring"
            : isReplayPlaying
              ? `Playing ${replaySpeed}x`
              : "Paused"}
        </span>
      </footer>
      ) : null}
    </main>
  );
}

export default App;
