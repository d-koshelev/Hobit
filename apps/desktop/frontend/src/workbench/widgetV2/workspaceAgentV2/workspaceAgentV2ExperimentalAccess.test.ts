import { describe, expect, it } from "vitest";

import { widgetCatalogTemplates } from "../../catalogTemplates";
import {
  INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
  getWidgetDefinition,
} from "../../widgetRegistry";
import { getWidgetV2Manifest } from "../widgetV2Registry";
import {
  WORKSPACE_AGENT_V2_EXPERIMENTAL_ENTRY,
  workspaceAgentV2ExperimentalAccessSummary,
} from "./workspaceAgentV2ExperimentalAccess";

describe("Workspace Agent v2 experimental access", () => {
  it("exposes a dev-only smoke entry without adding a stable catalog template", () => {
    expect(WORKSPACE_AGENT_V2_EXPERIMENTAL_ENTRY).toMatchObject({
      label: "Workspace Agent v2",
      mode: "Codex Direct Run only",
      route: "/smoke/dev/workspace-agent-v2-direct-run-smoke.html",
      status: "Experimental",
    });
    expect(workspaceAgentV2ExperimentalAccessSummary()).toContain(
      "Workspace Agent v2",
    );
    expect(workspaceAgentV2ExperimentalAccessSummary()).toContain(
      "Experimental",
    );
    expect(workspaceAgentV2ExperimentalAccessSummary()).toContain(
      "Codex Direct Run only",
    );
    expect(
      widgetCatalogTemplates.some(
        (template) => template.id === WORKSPACE_AGENT_V2_EXPERIMENTAL_ENTRY.id,
      ),
    ).toBe(false);
  });

  it("preserves the Workspace Agent V1 registry identity", () => {
    expect(getWidgetDefinition(INTERACTIVE_AGENT_WIDGET_DEFINITION_ID)).toMatchObject({
      componentKey: "interactive-agent-placeholder",
      defaultTitle: "Workspace Agent",
      id: "interactive-agent",
      title: "Workspace Agent",
    });
  });

  it("keeps WorkspaceAgentV2 experimental in the Widget V2 registry", () => {
    expect(getWidgetV2Manifest("workspace-agent-v2")).toMatchObject({
      kind: "workspace-agent-v2",
      status: "experimental",
      title: "Workspace Agent v2",
    });
  });
});
