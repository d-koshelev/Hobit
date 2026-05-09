import { useState } from "react";
import { Button } from "../design-system/Button";
import type { WidgetInstance, WidgetLayout } from "./types";

type WidgetSizePreset = {
  id: "compact" | "normal" | "wide";
  label: string;
  width: number;
  height: number;
};

const DOCKED_SIZE_PRESETS: WidgetSizePreset[] = [
  { id: "compact", label: "Compact", width: 320, height: 200 },
  { id: "normal", label: "Normal", width: 360, height: 240 },
  { id: "wide", label: "Wide", width: 520, height: 280 },
];

type WidgetSizePresetControlsProps = {
  instance: WidgetInstance;
  onUpdateLayout: (
    widgetInstanceId: WidgetInstance["id"],
    layout: WidgetLayout,
  ) => Promise<void>;
};

export function WidgetSizePresetControls({
  instance,
  onUpdateLayout,
}: WidgetSizePresetControlsProps) {
  const [pendingPresetId, setPendingPresetId] = useState<
    WidgetSizePreset["id"] | null
  >(null);

  if (instance.layout.mode !== "docked") {
    return null;
  }

  async function applyPreset(preset: WidgetSizePreset) {
    if (pendingPresetId) {
      return;
    }

    setPendingPresetId(preset.id);

    try {
      await onUpdateLayout(instance.id, {
        ...instance.layout,
        height: preset.height,
        mode: "docked",
        width: preset.width,
      });
    } catch (error) {
      console.error("Failed to update widget layout.", error);
    } finally {
      setPendingPresetId(null);
    }
  }

  return (
    <>
      {DOCKED_SIZE_PRESETS.map((preset) => {
        const isActive =
          instance.layout.width === preset.width &&
          instance.layout.height === preset.height;

        return (
          <Button
            aria-pressed={isActive}
            disabled={pendingPresetId !== null}
            key={preset.id}
            onClick={() => void applyPreset(preset)}
            title={`${preset.width} x ${preset.height}`}
            variant={isActive ? "secondary" : "ghost"}
          >
            {pendingPresetId === preset.id ? "..." : preset.label}
          </Button>
        );
      })}
    </>
  );
}
