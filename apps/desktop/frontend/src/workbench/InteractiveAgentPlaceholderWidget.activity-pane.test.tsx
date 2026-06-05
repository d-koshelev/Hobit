import { describe, expect, it } from "vitest";
import {
  clickButton,
  renderWidget,
} from "./InteractiveAgentPlaceholderWidget.test-utils";

describe("InteractiveAgentPlaceholderWidget Agent Activity side pane", () => {
  it("renders Agent Activity as a permanent collapsible side pane", async () => {
    renderWidget({
      agentActivityEvents: [
        {
          id: "activity-started",
          runId: "run_side_pane",
          severity: "info",
          sourceKind: "workspace-agent",
          sourceLabel: "Workspace Agent",
          sourceWidgetInstanceId: "coordinator_widget",
          status: "running",
          timestamp: 1,
          timestampLabel: "0s",
          title: "Started run",
          workspaceId: "workspace_1",
        },
        {
          id: "activity-command",
          runId: "run_side_pane",
          severity: "info",
          sourceKind: "workspace-agent",
          sourceLabel: "Workspace Agent",
          sourceWidgetInstanceId: "coordinator_widget",
          status: "running",
          summary: "Running git status",
          timestamp: 2,
          timestampLabel: "1s",
          title: "Ran command",
          workspaceId: "workspace_1",
        },
      ],
    });

    expect(document.body.textContent).toContain("Agent Activity");
    expect(document.body.textContent).toContain("Read-only run lifecycle");
    expect(document.body.textContent).toContain("Agent run");
    expect(document.body.textContent).toContain(
      "1 step - latest: Running command",
    );
    expect(document.querySelector(".agent-activity-event-details")).toBeNull();

    await clickButton("Collapse");

    expect(document.body.textContent).toContain("Activity");
    expect(document.body.textContent).not.toContain("Read-only run lifecycle");
    expect(document.body.textContent).not.toContain(
      "1 step - latest: Running command",
    );

    await clickButton("Activity");

    expect(document.body.textContent).toContain("Read-only run lifecycle");
    expect(document.body.textContent).toContain(
      "1 step - latest: Running command",
    );
  });
});
