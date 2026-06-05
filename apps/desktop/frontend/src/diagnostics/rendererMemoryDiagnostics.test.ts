import { describe, expect, it, vi } from "vitest";

import {
  capRendererMemoryDiagnosticsSamples,
  collectRendererMemoryDiagnosticsSample,
  isRendererMemoryDiagnosticsEnabled,
  retainedDirectWorkCharCount,
  rendererMemoryDiagnosticsGrowth,
  RENDERER_MEMORY_DIAGNOSTICS_STORAGE_KEY,
  topRendererMemoryRetainedBuckets,
  type RendererMemoryDiagnosticsSample,
} from "./rendererMemoryDiagnostics";

describe("renderer memory diagnostics flags", () => {
  it("stays disabled by default and in production mode", () => {
    expect(
      isRendererMemoryDiagnosticsEnabled({
        dev: true,
        locationLike: { hash: "", search: "" },
        storage: storageLike(null),
      }),
    ).toBe(false);
    expect(
      isRendererMemoryDiagnosticsEnabled({
        dev: false,
        locationLike: { hash: "", search: "?hobitMemoryDiagnostics=1" },
        storage: storageLike("1"),
      }),
    ).toBe(false);
  });

  it("can be enabled through localStorage, query, or hash flags", () => {
    expect(
      isRendererMemoryDiagnosticsEnabled({
        dev: true,
        locationLike: { hash: "", search: "" },
        storage: storageLike("1"),
      }),
    ).toBe(true);
    expect(
      isRendererMemoryDiagnosticsEnabled({
        dev: true,
        locationLike: { hash: "", search: "?hobitMemoryDiagnostics=1" },
        storage: storageLike(null),
      }),
    ).toBe(true);
    expect(
      isRendererMemoryDiagnosticsEnabled({
        dev: true,
        locationLike: { hash: "#hobitMemoryDiagnostics=1", search: "" },
        storage: storageLike(null),
      }),
    ).toBe(true);
  });
});

describe("renderer memory diagnostics samples", () => {
  it("collects bounded derived renderer metrics without retaining payloads", async () => {
    document.body.innerHTML = "<main><section><p>sample</p></section></main>";

    const sample = await collectRendererMemoryDiagnosticsSample({
      nowMs: 1_700_000_000_000,
      performanceLike: {
        measureUserAgentSpecificMemory: vi.fn().mockResolvedValue({
          breakdown: [{ bytes: 999 }],
          bytes: 512,
        }),
        memory: {
          jsHeapSizeLimit: 300,
          totalJSHeapSize: 200,
          usedJSHeapSize: 100,
        },
      } as unknown as Performance,
      source: {
        agentActivityEventCount: 2,
        directWorkRetainedCharCount: 42,
        mountedWidgets: [{ definitionId: "notes", id: "widget_notes_1" }],
        queueItemCount: 3,
        visibleWidgetCount: 1,
      },
      startedAtMs: 1_699_999_940_000,
    });

    expect(sample).toMatchObject({
      buckets: {
        agentActivityEventCount: 2,
        directWorkRetainedCharCount: 42,
        queueItemCount: 3,
        workspaceAgentTranscriptCount: null,
      },
      domNodeCount: 6,
      elapsedMs: 60_000,
      heap: {
        jsHeapSizeLimit: 300,
        totalJSHeapSize: 200,
        usedJSHeapSize: 100,
      },
      mountedWidgets: [{ definitionId: "notes", id: "widget_notes_1" }],
      uaSpecificMemoryBytes: 512,
      visibleWidgetCount: 1,
    });
  });

  it("does not crash when optional memory APIs are unavailable or throw", async () => {
    const sample = await collectRendererMemoryDiagnosticsSample({
      performanceLike: {
        measureUserAgentSpecificMemory: vi.fn().mockRejectedValue(
          new Error("blocked"),
        ),
      } as unknown as Performance,
      source: {
        mountedWidgets: [],
        visibleWidgetCount: 0,
      },
      startedAtMs: Date.now(),
    });

    expect(sample.heap.usedJSHeapSize).toBeNull();
    expect(sample.uaSpecificMemoryBytes).toBeNull();
  });

  it("caps samples to the newest max count", () => {
    const samples = Array.from({ length: 5 }, (_, index) =>
      sample({ elapsedMs: index }),
    );

    expect(capRendererMemoryDiagnosticsSamples(samples, 3).map((item) => item.elapsedMs)).toEqual([
      2, 3, 4,
    ]);
  });

  it("calculates growth per minute and top retained buckets", () => {
    const samples = [
      sample({ domNodeCount: 10, elapsedMs: 0, heapUsed: 1_000 }),
      sample({ domNodeCount: 16, elapsedMs: 120_000, heapUsed: 4_000 }),
    ];

    expect(rendererMemoryDiagnosticsGrowth(samples)).toMatchObject({
      domNodeDelta: 6,
      domNodesPerMinute: 3,
      heapUsedDeltaBytes: 3_000,
      heapUsedPerMinuteBytes: 1_500,
    });
    expect(topRendererMemoryRetainedBuckets(samples[1], 2)).toEqual([
      ["directWorkRetainedCharCount", 25],
      ["queueItemCount", 5],
    ]);
  });

  it("counts retained Direct Work text fields by length only", () => {
    expect(
      retainedDirectWorkCharCount([
        { line: "abc", stderrPreview: "de" },
        { errorMessage: "f", ignored: "payload not counted" },
      ]),
    ).toBe(6);
  });
});

function storageLike(value: string | null) {
  return {
    getItem: (key: string) =>
      key === RENDERER_MEMORY_DIAGNOSTICS_STORAGE_KEY ? value : null,
  };
}

function sample({
  domNodeCount = 1,
  elapsedMs,
  heapUsed = 1,
}: {
  domNodeCount?: number;
  elapsedMs: number;
  heapUsed?: number;
}): RendererMemoryDiagnosticsSample {
  return {
    buckets: {
      agentActivityEventCount: 2,
      directWorkRetainedCharCount: 25,
      directWorkRunHandoffCount: 1,
      finderPreviewContentLength: null,
      knowledgeRetainedCount: null,
      queueItemCount: 5,
      queueRunActivityEventCount: 3,
      queueRunActivityRawEventCount: 4,
      queueRunHistoryCount: 1,
      workspaceAgentTranscriptCharCount: null,
      workspaceAgentTranscriptCount: null,
    },
    domNodeCount,
    elapsedMs,
    heap: {
      jsHeapSizeLimit: null,
      totalJSHeapSize: null,
      usedJSHeapSize: heapUsed,
    },
    mountedWidgets: [],
    timestamp: "2026-06-05T00:00:00.000Z",
    uaSpecificMemoryBytes: null,
    visibleWidgetCount: 0,
  };
}
