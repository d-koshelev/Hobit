import type { WorkbenchViewState } from "../workbench/types";

export const RENDERER_MEMORY_DIAGNOSTICS_STORAGE_KEY =
  "hobit:diagnostics:memory";
export const RENDERER_MEMORY_DIAGNOSTICS_QUERY_FLAG =
  "hobitMemoryDiagnostics";
export const RENDERER_MEMORY_DIAGNOSTICS_SAMPLE_INTERVAL_MS = 5_000;
export const RENDERER_MEMORY_DIAGNOSTICS_MAX_SAMPLES = 120;

export type RendererDiagnosticsWidgetRef = {
  definitionId: string;
  id: string;
};

export type RendererMemoryDiagnosticsSource = {
  agentActivityEventCount?: number;
  directWorkRetainedCharCount?: number;
  directWorkRunHandoffCount?: number;
  finderPreviewContentLength?: number;
  knowledgeRetainedCount?: number;
  mountedWidgets: RendererDiagnosticsWidgetRef[];
  queueItemCount?: number;
  queueRunActivityEventCount?: number;
  queueRunActivityRawEventCount?: number;
  queueRunHistoryCount?: number;
  visibleWidgetCount: number;
  workspaceAgentTranscriptCharCount?: number;
  workspaceAgentTranscriptCount?: number;
};

export type RendererMemoryHeapSample = {
  jsHeapSizeLimit: number | null;
  totalJSHeapSize: number | null;
  usedJSHeapSize: number | null;
};

export type RendererMemoryDiagnosticsBuckets = {
  agentActivityEventCount: number | null;
  directWorkRetainedCharCount: number | null;
  directWorkRunHandoffCount: number | null;
  finderPreviewContentLength: number | null;
  knowledgeRetainedCount: number | null;
  queueItemCount: number | null;
  queueRunActivityEventCount: number | null;
  queueRunActivityRawEventCount: number | null;
  queueRunHistoryCount: number | null;
  workspaceAgentTranscriptCharCount: number | null;
  workspaceAgentTranscriptCount: number | null;
};

export type RendererMemoryDiagnosticsSample = {
  buckets: RendererMemoryDiagnosticsBuckets;
  domNodeCount: number | null;
  elapsedMs: number;
  heap: RendererMemoryHeapSample;
  mountedWidgets: RendererDiagnosticsWidgetRef[];
  timestamp: string;
  uaSpecificMemoryBytes: number | null;
  visibleWidgetCount: number;
};

export type RendererMemoryDiagnosticsGrowth = {
  domNodeDelta: number | null;
  domNodesPerMinute: number | null;
  heapUsedDeltaBytes: number | null;
  heapUsedPerMinuteBytes: number | null;
};

type DiagnosticsLocationLike = Pick<Location, "hash" | "search">;
type DiagnosticsStorageLike = Pick<Storage, "getItem">;

type PerformanceMemoryLike = Partial<RendererMemoryHeapSample>;
type PerformanceLike = Performance & {
  measureUserAgentSpecificMemory?: () => Promise<unknown>;
  memory?: PerformanceMemoryLike;
};

export function isRendererMemoryDiagnosticsEnabled({
  dev = import.meta.env.DEV,
  locationLike = typeof window === "undefined" ? null : window.location,
  storage = typeof window === "undefined" ? null : window.localStorage,
}: {
  dev?: boolean;
  locationLike?: DiagnosticsLocationLike | null;
  storage?: DiagnosticsStorageLike | null;
} = {}) {
  if (!dev) {
    return false;
  }

  if (readStorageFlag(storage) === "1") {
    return true;
  }

  return readLocationFlag(locationLike) === "1";
}

export async function collectRendererMemoryDiagnosticsSample({
  documentLike = typeof document === "undefined" ? null : document,
  nowMs = Date.now(),
  performanceLike =
    typeof performance === "undefined" ? null : (performance as PerformanceLike),
  source,
  startedAtMs,
}: {
  documentLike?: Document | null;
  nowMs?: number;
  performanceLike?: PerformanceLike | null;
  source: RendererMemoryDiagnosticsSource;
  startedAtMs: number;
}): Promise<RendererMemoryDiagnosticsSample> {
  return {
    buckets: {
      agentActivityEventCount: nullableCount(source.agentActivityEventCount),
      directWorkRetainedCharCount: nullableCount(
        source.directWorkRetainedCharCount,
      ),
      directWorkRunHandoffCount: nullableCount(source.directWorkRunHandoffCount),
      finderPreviewContentLength: nullableCount(
        source.finderPreviewContentLength,
      ),
      knowledgeRetainedCount: nullableCount(source.knowledgeRetainedCount),
      queueItemCount: nullableCount(source.queueItemCount),
      queueRunActivityEventCount: nullableCount(
        source.queueRunActivityEventCount,
      ),
      queueRunActivityRawEventCount: nullableCount(
        source.queueRunActivityRawEventCount,
      ),
      queueRunHistoryCount: nullableCount(source.queueRunHistoryCount),
      workspaceAgentTranscriptCharCount: nullableCount(
        source.workspaceAgentTranscriptCharCount,
      ),
      workspaceAgentTranscriptCount: nullableCount(
        source.workspaceAgentTranscriptCount,
      ),
    },
    domNodeCount: documentLike
      ? documentLike.getElementsByTagName("*").length
      : null,
    elapsedMs: Math.max(0, nowMs - startedAtMs),
    heap: heapSample(performanceLike),
    mountedWidgets: source.mountedWidgets.map((widget) => ({
      definitionId: widget.definitionId,
      id: widget.id,
    })),
    timestamp: new Date(nowMs).toISOString(),
    uaSpecificMemoryBytes:
      await measureUserAgentSpecificMemoryBytes(performanceLike),
    visibleWidgetCount: source.visibleWidgetCount,
  };
}

export function capRendererMemoryDiagnosticsSamples(
  samples: RendererMemoryDiagnosticsSample[],
  maxSamples = RENDERER_MEMORY_DIAGNOSTICS_MAX_SAMPLES,
) {
  if (samples.length <= maxSamples) {
    return samples;
  }

  return samples.slice(-maxSamples);
}

export function rendererMemoryDiagnosticsGrowth(
  samples: RendererMemoryDiagnosticsSample[],
): RendererMemoryDiagnosticsGrowth {
  const first = samples[0] ?? null;
  const latest = samples[samples.length - 1] ?? null;

  if (!first || !latest || latest.elapsedMs <= first.elapsedMs) {
    return {
      domNodeDelta: null,
      domNodesPerMinute: null,
      heapUsedDeltaBytes: null,
      heapUsedPerMinuteBytes: null,
    };
  }

  const elapsedMinutes = (latest.elapsedMs - first.elapsedMs) / 60_000;
  const heapUsedDeltaBytes =
    first.heap.usedJSHeapSize === null || latest.heap.usedJSHeapSize === null
      ? null
      : latest.heap.usedJSHeapSize - first.heap.usedJSHeapSize;
  const domNodeDelta =
    first.domNodeCount === null || latest.domNodeCount === null
      ? null
      : latest.domNodeCount - first.domNodeCount;

  return {
    domNodeDelta,
    domNodesPerMinute:
      domNodeDelta === null ? null : domNodeDelta / elapsedMinutes,
    heapUsedDeltaBytes,
    heapUsedPerMinuteBytes:
      heapUsedDeltaBytes === null
        ? null
        : heapUsedDeltaBytes / elapsedMinutes,
  };
}

export function topRendererMemoryRetainedBuckets(
  sample: RendererMemoryDiagnosticsSample | null,
  limit = 5,
) {
  if (!sample) {
    return [];
  }

  return Object.entries(sample.buckets)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .sort((first, second) => second[1] - first[1])
    .slice(0, limit);
}

export function rendererDiagnosticsSourceFromWorkbench({
  agentActivityEventCount,
  directWorkRetainedCharCount,
  directWorkRunHandoffCount,
  mountedWidgets,
  queueItemCount,
  queueRunActivityEventCount,
  queueRunActivityRawEventCount,
  queueRunHistoryCount,
  viewState,
}: {
  agentActivityEventCount?: number;
  directWorkRetainedCharCount?: number;
  directWorkRunHandoffCount?: number;
  mountedWidgets: RendererDiagnosticsWidgetRef[];
  queueItemCount?: number;
  queueRunActivityEventCount?: number;
  queueRunActivityRawEventCount?: number;
  queueRunHistoryCount?: number;
  viewState: WorkbenchViewState;
}): RendererMemoryDiagnosticsSource {
  return {
    agentActivityEventCount,
    directWorkRetainedCharCount,
    directWorkRunHandoffCount,
    mountedWidgets,
    queueItemCount,
    queueRunActivityEventCount,
    queueRunActivityRawEventCount,
    queueRunHistoryCount,
    visibleWidgetCount: viewState.widgets.filter((widget) => widget.visible)
      .length,
  };
}

export function retainedDirectWorkCharCount(events: readonly unknown[]): number {
  return events.reduce<number>(
    (total, event) => total + retainedEventCharCount(event),
    0,
  );
}

function readStorageFlag(storage: DiagnosticsStorageLike | null) {
  try {
    return storage?.getItem(RENDERER_MEMORY_DIAGNOSTICS_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function readLocationFlag(locationLike: DiagnosticsLocationLike | null) {
  if (!locationLike) {
    return null;
  }

  const searchValue = new URLSearchParams(locationLike.search).get(
    RENDERER_MEMORY_DIAGNOSTICS_QUERY_FLAG,
  );

  if (searchValue) {
    return searchValue;
  }

  const hash = locationLike.hash.replace(/^#\??/, "");
  return new URLSearchParams(hash).get(RENDERER_MEMORY_DIAGNOSTICS_QUERY_FLAG);
}

function heapSample(
  performanceLike: PerformanceLike | null,
): RendererMemoryHeapSample {
  const memory = performanceLike?.memory ?? null;

  return {
    jsHeapSizeLimit: finiteNumberOrNull(memory?.jsHeapSizeLimit),
    totalJSHeapSize: finiteNumberOrNull(memory?.totalJSHeapSize),
    usedJSHeapSize: finiteNumberOrNull(memory?.usedJSHeapSize),
  };
}

async function measureUserAgentSpecificMemoryBytes(
  performanceLike: PerformanceLike | null,
) {
  try {
    const measurement =
      await performanceLike?.measureUserAgentSpecificMemory?.();

    if (
      measurement &&
      typeof measurement === "object" &&
      "bytes" in measurement
    ) {
      return finiteNumberOrNull(measurement.bytes);
    }
  } catch {
    return null;
  }

  return null;
}

function retainedEventCharCount(event: unknown) {
  if (!event || typeof event !== "object") {
    return 0;
  }

  const record = event as Record<string, unknown>;
  return (
    stringLength(record.line) +
    stringLength(record.text) +
    stringLength(record.stderrPreview) +
    stringLength(record.stdoutPreview) +
    stringLength(record.errorMessage)
  );
}

function stringLength(value: unknown) {
  return typeof value === "string" ? value.length : 0;
}

function nullableCount(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function finiteNumberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
