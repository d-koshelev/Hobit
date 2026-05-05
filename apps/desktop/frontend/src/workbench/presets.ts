import type { WorkbenchPreset } from "./types";

export const minimalWorkbenchPreset: WorkbenchPreset = {
  id: "minimal",
  title: "Minimal Workbench",
  description: "Empty workbench surface for composing widgets.",
  widgets: [],
};

export const workbenchPresets = [minimalWorkbenchPreset];
