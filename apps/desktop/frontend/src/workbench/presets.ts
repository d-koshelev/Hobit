import type { WorkbenchPreset } from "./types";

export const emptyWorkbenchPreset: WorkbenchPreset = {
  id: "empty",
  title: "Empty Workbench",
  description: "Empty workbench surface for composing widgets.",
  widgets: [],
};

export const workbenchPresets = [emptyWorkbenchPreset];
