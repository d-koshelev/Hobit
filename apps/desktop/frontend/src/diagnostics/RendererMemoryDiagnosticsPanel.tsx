import { useMemo, useState } from "react";

import {
  RENDERER_MEMORY_DIAGNOSTICS_MAX_SAMPLES,
  RENDERER_MEMORY_DIAGNOSTICS_SAMPLE_INTERVAL_MS,
  rendererMemoryDiagnosticsGrowth,
  topRendererMemoryRetainedBuckets,
  type RendererMemoryDiagnosticsSource,
} from "./rendererMemoryDiagnostics";
import { useRendererMemoryDiagnostics } from "./useRendererMemoryDiagnostics";

export function RendererMemoryDiagnosticsPanel({
  source,
}: {
  source: RendererMemoryDiagnosticsSource;
}) {
  const { currentSample, resetSamples, samples } =
    useRendererMemoryDiagnostics({
      enabled: true,
      source,
    });
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const growth = useMemo(
    () => rendererMemoryDiagnosticsGrowth(samples),
    [samples],
  );
  const topBuckets = topRendererMemoryRetainedBuckets(currentSample);
  const recentSamples = samples.slice(-10);

  async function copySnapshot() {
    const snapshot = JSON.stringify(
      {
        currentSample,
        generatedAt: new Date().toISOString(),
        growth,
        maxSamples: RENDERER_MEMORY_DIAGNOSTICS_MAX_SAMPLES,
        sampleIntervalMs: RENDERER_MEMORY_DIAGNOSTICS_SAMPLE_INTERVAL_MS,
        samples,
      },
      null,
      2,
    );

    try {
      await navigator.clipboard?.writeText(snapshot);
      setCopyMessage("Snapshot copied.");
    } catch {
      setCopyMessage("Clipboard unavailable.");
    }
  }

  return (
    <aside
      aria-label="Renderer memory diagnostics"
      className="renderer-memory-diagnostics"
    >
      <div className="renderer-memory-diagnostics-header">
        <div>
          <h2>Memory diagnostics</h2>
          <p>
            {samples.length}/{RENDERER_MEMORY_DIAGNOSTICS_MAX_SAMPLES} samples,
            every 5s
          </p>
        </div>
        <div className="renderer-memory-diagnostics-actions">
          <button onClick={() => void copySnapshot()} type="button">
            Copy diagnostics snapshot
          </button>
          <button onClick={resetSamples} type="button">
            Reset samples
          </button>
        </div>
      </div>

      <div className="renderer-memory-diagnostics-grid">
        <Metric
          label="Heap used"
          value={formatBytes(currentSample?.heap.usedJSHeapSize)}
        />
        <Metric
          label="Heap total"
          value={formatBytes(currentSample?.heap.totalJSHeapSize)}
        />
        <Metric
          label="Heap limit"
          value={formatBytes(currentSample?.heap.jsHeapSizeLimit)}
        />
        <Metric
          label="UA memory"
          value={formatBytes(currentSample?.uaSpecificMemoryBytes)}
        />
        <Metric
          label="DOM nodes"
          value={formatNumber(currentSample?.domNodeCount)}
        />
        <Metric
          label="Visible widgets"
          value={formatNumber(currentSample?.visibleWidgetCount)}
        />
        <Metric
          label="Heap delta/min"
          value={formatBytesPerMinute(growth.heapUsedPerMinuteBytes)}
        />
        <Metric
          label="DOM delta/min"
          value={formatRate(growth.domNodesPerMinute)}
        />
      </div>

      <section className="renderer-memory-diagnostics-section">
        <h3>Mounted widgets</h3>
        <p>{formatWidgetRefs(currentSample?.mountedWidgets ?? [])}</p>
      </section>

      <section className="renderer-memory-diagnostics-section">
        <h3>Suspected retained buckets</h3>
        {topBuckets.length > 0 ? (
          <ul>
            {topBuckets.map(([label, value]) => (
              <li key={label}>
                <span>{label}</span>
                <strong>{value.toLocaleString()}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p>No numeric retained buckets available yet.</p>
        )}
      </section>

      <section className="renderer-memory-diagnostics-section">
        <h3>Known unavailable buckets</h3>
        <p>{unavailableBucketLabels(currentSample).join(", ") || "None"}</p>
      </section>

      <section className="renderer-memory-diagnostics-section">
        <h3>Last samples</h3>
        <table>
          <thead>
            <tr>
              <th>Elapsed</th>
              <th>Heap</th>
              <th>DOM</th>
              <th>Queue</th>
              <th>Activity</th>
            </tr>
          </thead>
          <tbody>
            {recentSamples.map((sample) => (
              <tr key={`${sample.timestamp}-${sample.elapsedMs}`}>
                <td>{formatElapsed(sample.elapsedMs)}</td>
                <td>{formatBytes(sample.heap.usedJSHeapSize)}</td>
                <td>{formatNumber(sample.domNodeCount)}</td>
                <td>{formatNumber(sample.buckets.queueItemCount)}</td>
                <td>{formatNumber(sample.buckets.agentActivityEventCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {copyMessage ? (
        <p className="renderer-memory-diagnostics-message">{copyMessage}</p>
      ) : null}
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="renderer-memory-diagnostics-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatBytes(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "Unavailable";
  }

  if (value < 1024) {
    return `${value.toLocaleString()} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatBytesPerMinute(value: number | null) {
  return value === null ? "Unavailable" : `${formatBytes(value)}/min`;
}

function formatElapsed(value: number) {
  return `${Math.round(value / 1000).toLocaleString()}s`;
}

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "Unavailable";
}

function formatRate(value: number | null) {
  return value === null ? "Unavailable" : `${value.toFixed(1)}/min`;
}

function formatWidgetRefs(widgets: { definitionId: string; id: string }[]) {
  if (widgets.length === 0) {
    return "None mounted.";
  }

  return widgets
    .map((widget) => `${widget.definitionId}:${widget.id}`)
    .join(", ");
}

function unavailableBucketLabels(
  sample: ReturnType<typeof useRendererMemoryDiagnostics>["currentSample"],
) {
  if (!sample) {
    return ["All buckets pending first sample"];
  }

  return Object.entries(sample.buckets)
    .filter(([, value]) => value === null)
    .map(([label]) => label);
}
