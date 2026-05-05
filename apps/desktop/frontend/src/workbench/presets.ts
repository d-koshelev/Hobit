import type { WorkbenchPreset } from "./types";

export const minimalWorkbenchPreset: WorkbenchPreset = {
  id: "minimal",
  title: "Minimal Workbench",
  description: "Empty workbench surface.",
  widgets: [],
};

// Additional presets such as Codebase, Database, and Design Workbench will be
// added when those capabilities exist as real widgets.
export const workbenchPresets = [minimalWorkbenchPreset];
