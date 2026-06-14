import { describe, expect, it } from "vitest";

import { AgentRunPlaceholderWidget } from "./AgentRunPlaceholderWidget";
import { AgentQueuePlaceholderWidget } from "./AgentQueuePlaceholderWidget";
import { GitPlaceholderWidget } from "./GitPlaceholderWidget";
import { QueueV2SmokeCompatWidget } from "./widgetV2";
import * as queueV2CompatExports from "./widgetV2/queueV2";
import {
  AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
  AGENT_RUN_PLACEHOLDER_COMPONENT_KEY,
  GIT_PLACEHOLDER_COMPONENT_KEY,
  TERMINAL_PLACEHOLDER_COMPONENT_KEY,
} from "./widgetRegistry";
import {
  compatibilityWidgetComponents,
  getWidgetHostComponent,
  productWidgetComponents,
} from "./widgetHostComponents";

describe("WidgetHost compatibility renderer registry", () => {
  it("routes the product Agent Queue key to the active singleton Queue surface", () => {
    expect(productWidgetComponents[AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY]).toBe(
      AgentQueuePlaceholderWidget,
    );
    expect(getWidgetHostComponent(AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY)).toBe(
      AgentQueuePlaceholderWidget,
    );
    expect(
      compatibilityWidgetComponents[AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY],
    ).toBeUndefined();
    expect(getWidgetHostComponent("queue-v2")).toBeUndefined();
  });

  it("exports the inactive QueueV2 shell only as a smoke/compat scaffold", () => {
    expect(QueueV2SmokeCompatWidget).toBe(
      queueV2CompatExports.QueueV2SmokeCompatWidget,
    );
    expect("QueueV2Widget" in queueV2CompatExports).toBe(false);
    expect(productWidgetComponents["queue-v2"]).toBeUndefined();
    expect(compatibilityWidgetComponents["queue-v2"]).toBeUndefined();
  });

  it("keeps persisted compatibility component keys renderable", () => {
    expect(
      compatibilityWidgetComponents[AGENT_RUN_PLACEHOLDER_COMPONENT_KEY],
    ).toBe(AgentRunPlaceholderWidget);
    expect(compatibilityWidgetComponents[GIT_PLACEHOLDER_COMPONENT_KEY]).toBe(
      GitPlaceholderWidget,
    );
    expect(getWidgetHostComponent(AGENT_RUN_PLACEHOLDER_COMPONENT_KEY)).toBe(
      AgentRunPlaceholderWidget,
    );
    expect(getWidgetHostComponent(GIT_PLACEHOLDER_COMPONENT_KEY)).toBe(
      GitPlaceholderWidget,
    );
  });

  it("keeps compatibility renderers separate from product renderers", () => {
    expect(productWidgetComponents[AGENT_RUN_PLACEHOLDER_COMPONENT_KEY]).toBeUndefined();
    expect(productWidgetComponents[GIT_PLACEHOLDER_COMPONENT_KEY]).toBeUndefined();
    expect(productWidgetComponents[TERMINAL_PLACEHOLDER_COMPONENT_KEY]).toBeDefined();
  });

  it("preserves the missing-component fallback path for unmapped keys", () => {
    expect(getWidgetHostComponent("missing-widget-component")).toBeUndefined();
  });
});
