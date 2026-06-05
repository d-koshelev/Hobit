import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  flushHookEffects,
  renderHook,
} from "../workbench/test-utils/renderHook";
import { useRendererMemoryDiagnostics } from "./useRendererMemoryDiagnostics";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("useRendererMemoryDiagnostics", () => {
  it("does not start a sampler when disabled", async () => {
    vi.useFakeTimers();
    const hook = renderHook(useRendererMemoryDiagnostics, {
      enabled: false,
      intervalMs: 5_000,
      source: source(),
    });
    await flushHookEffects();

    expect(vi.getTimerCount()).toBe(0);
    expect(hook.result.current.samples).toEqual([]);

    hook.unmount();
  });

  it("starts one sampler and cleans it up on unmount", async () => {
    vi.useFakeTimers();
    const hook = renderHook(useRendererMemoryDiagnostics, {
      enabled: true,
      intervalMs: 5_000,
      source: source(),
    });
    await flushHookEffects();

    expect(vi.getTimerCount()).toBe(1);

    hook.unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops sampling when diagnostics are disabled after being enabled", async () => {
    vi.useFakeTimers();
    const hook = renderHook(useRendererMemoryDiagnostics, {
      enabled: true,
      intervalMs: 5_000,
      source: source(),
    });
    await flushHookEffects();

    expect(vi.getTimerCount()).toBe(1);

    hook.rerender({
      enabled: false,
      intervalMs: 5_000,
      source: source(),
    });
    await flushHookEffects();

    expect(vi.getTimerCount()).toBe(0);
    expect(hook.result.current.samples).toEqual([]);

    hook.unmount();
  });

  it("is safe under StrictMode-like remounts", async () => {
    vi.useFakeTimers();
    const first = renderHook(useRendererMemoryDiagnostics, {
      enabled: true,
      intervalMs: 5_000,
      source: source(),
    });
    await flushHookEffects();
    expect(vi.getTimerCount()).toBe(1);

    first.unmount();
    expect(vi.getTimerCount()).toBe(0);

    const second = renderHook(useRendererMemoryDiagnostics, {
      enabled: true,
      intervalMs: 5_000,
      source: source(),
    });
    await flushHookEffects();

    expect(vi.getTimerCount()).toBe(1);

    second.unmount();
  });

  it("caps samples and reset clears them", async () => {
    vi.useFakeTimers();
    const hook = renderHook(useRendererMemoryDiagnostics, {
      enabled: true,
      intervalMs: 5_000,
      maxSamples: 2,
      source: source(),
    });
    await flushHookEffects();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(hook.result.current.samples).toHaveLength(2);

    act(() => {
      hook.result.current.resetSamples();
    });

    expect(hook.result.current.samples).toEqual([]);

    hook.unmount();
  });
});

function source() {
  return {
    mountedWidgets: [],
    visibleWidgetCount: 0,
  };
}
