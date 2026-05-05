import type { WorkbenchPreset } from "./types";

export const minimalWorkbenchPreset: WorkbenchPreset = {
  id: "minimal",
  title: "Minimal Workbench",
  description: "Terminal and Agent CLI side by side.",
  widgets: [
    {
      id: "minimal-terminal",
      definitionId: "terminal",
      title: "Terminal Widget",
      config: {},
      layout: {
        area: "main",
        order: 1,
        minWidth: 360,
        minHeight: 440,
      },
      visible: true,
    },
    {
      id: "minimal-agent-cli",
      definitionId: "agent-cli",
      title: "Agent CLI Widget",
      config: {},
      layout: {
        area: "main",
        order: 2,
        minWidth: 360,
        minHeight: 440,
      },
      visible: true,
    },
  ],
};

// Additional presets such as Codebase, Database, and Design Workbench will be
// added when those capabilities exist as real widgets.
export const workbenchPresets = [minimalWorkbenchPreset];
