import { describe, expect, it } from "vitest";

import { AgentRunPlaceholderWidget } from "./AgentRunPlaceholderWidget";
import { GitPlaceholderWidget } from "./GitPlaceholderWidget";
import {
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
