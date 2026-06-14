import type { ComponentType } from "react";
import { AgentActivityWidget } from "./AgentActivityWidget";
import { AgentQueuePlaceholderWidget } from "./AgentQueuePlaceholderWidget";
import { AgentRunPlaceholderWidget } from "./AgentRunPlaceholderWidget";
import { FinderWidget } from "./FinderWidget";
import { GitPlaceholderWidget } from "./GitPlaceholderWidget";
import { InteractiveAgentPlaceholderWidget } from "./InteractiveAgentPlaceholderWidget";
import { JdbcConnectorWidget } from "./JdbcConnectorWidget";
import { KnowledgeSkillsV2Widget } from "./KnowledgeSkillsV2Widget";
import { NotesPlaceholderWidget } from "./NotesPlaceholderWidget";
import { RunbookPlaceholderWidget } from "./RunbookPlaceholderWidget";
import { TerminalPlaceholderWidget } from "./TerminalPlaceholderWidget";
import type { WidgetRenderProps } from "./types";
import {
  AGENT_ACTIVITY_COMPONENT_KEY,
  AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
  AGENT_RUN_PLACEHOLDER_COMPONENT_KEY,
  FINDER_WIDGET_COMPONENT_KEY,
  GIT_PLACEHOLDER_COMPONENT_KEY,
  INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY,
  JDBC_WIDGET_COMPONENT_KEY,
  NOTES_PLACEHOLDER_COMPONENT_KEY,
  RUNBOOK_PLACEHOLDER_COMPONENT_KEY,
  SKILL_LIBRARY_COMPONENT_KEY,
  TERMINAL_PLACEHOLDER_COMPONENT_KEY,
} from "./widgetRegistry";

export const productWidgetComponents: Record<
  string,
  ComponentType<WidgetRenderProps>
> = {
  [AGENT_ACTIVITY_COMPONENT_KEY]: AgentActivityWidget,
  [AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY]: AgentQueuePlaceholderWidget,
  [FINDER_WIDGET_COMPONENT_KEY]: FinderWidget,
  [INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY]:
    InteractiveAgentPlaceholderWidget,
  [JDBC_WIDGET_COMPONENT_KEY]: JdbcConnectorWidget,
  [NOTES_PLACEHOLDER_COMPONENT_KEY]: NotesPlaceholderWidget,
  [RUNBOOK_PLACEHOLDER_COMPONENT_KEY]: RunbookPlaceholderWidget,
  [SKILL_LIBRARY_COMPONENT_KEY]: KnowledgeSkillsV2Widget,
  [TERMINAL_PLACEHOLDER_COMPONENT_KEY]: TerminalPlaceholderWidget,
};

// Compatibility renderers remain mapped for persisted instances only. These
// entries are not normal product catalog or canvas surfaces.
export const compatibilityWidgetComponents: Record<
  string,
  ComponentType<WidgetRenderProps>
> = {
  [AGENT_RUN_PLACEHOLDER_COMPONENT_KEY]: AgentRunPlaceholderWidget,
  [GIT_PLACEHOLDER_COMPONENT_KEY]: GitPlaceholderWidget,
};

export const widgetComponents: Record<string, ComponentType<WidgetRenderProps>> =
  {
    ...productWidgetComponents,
    ...compatibilityWidgetComponents,
  };

export function getWidgetHostComponent(componentKey: string) {
  return widgetComponents[componentKey];
}
