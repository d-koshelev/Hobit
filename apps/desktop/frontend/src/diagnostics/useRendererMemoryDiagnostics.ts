import { useCallback, useEffect, useRef, useState } from "react";

import {
  capRendererMemoryDiagnosticsSamples,
  collectRendererMemoryDiagnosticsSample,
  RENDERER_MEMORY_DIAGNOSTICS_MAX_SAMPLES,
  RENDERER_MEMORY_DIAGNOSTICS_SAMPLE_INTERVAL_MS,
  type RendererMemoryDiagnosticsSample,
  type RendererMemoryDiagnosticsSource,
} from "./rendererMemoryDiagnostics";

export function useRendererMemoryDiagnostics({
  enabled,
  intervalMs = RENDERER_MEMORY_DIAGNOSTICS_SAMPLE_INTERVAL_MS,
  maxSamples = RENDERER_MEMORY_DIAGNOSTICS_MAX_SAMPLES,
  source,
}: {
  enabled: boolean;
  intervalMs?: number;
  maxSamples?: number;
  source: RendererMemoryDiagnosticsSource;
}) {
  const [samples, setSamples] = useState<RendererMemoryDiagnosticsSample[]>([]);
  const sourceRef = useRef(source);
  const startedAtMsRef = useRef(Date.now());

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    if (!enabled) {
      setSamples([]);
      return undefined;
    }

    let disposed = false;
    let inFlight = false;

    async function sample() {
      if (inFlight) {
        return;
      }

      inFlight = true;

      try {
        const nextSample = await collectRendererMemoryDiagnosticsSample({
          source: sourceRef.current,
          startedAtMs: startedAtMsRef.current,
        });

        if (disposed) {
          return;
        }

        setSamples((currentSamples) =>
          capRendererMemoryDiagnosticsSamples(
            [...currentSamples, nextSample],
            maxSamples,
          ),
        );
      } finally {
        inFlight = false;
      }
    }

    void sample();
    const intervalId = window.setInterval(() => void sample(), intervalMs);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, intervalMs, maxSamples]);

  const resetSamples = useCallback(() => {
    startedAtMsRef.current = Date.now();
    setSamples([]);
  }, []);

  return {
    currentSample: samples[samples.length - 1] ?? null,
    resetSamples,
    samples,
  };
}
