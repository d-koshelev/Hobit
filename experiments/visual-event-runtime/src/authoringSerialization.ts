import type {
  BindingRule,
  ScenarioDocument,
  SceneConfig,
  VisualEvent,
} from "./contracts";

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function serializeSceneConfig(scene: SceneConfig) {
  return `${JSON.stringify(scene, null, 2)}\n`;
}

export function parseSceneConfigJson(text: string): SceneConfig {
  return JSON.parse(text) as SceneConfig;
}

export function serializeBindingRules(rules: BindingRule[]) {
  return `${JSON.stringify(rules, null, 2)}\n`;
}

export function parseBindingRulesJson(text: string): BindingRule[] {
  return JSON.parse(text) as BindingRule[];
}

export function serializeEventFeedJsonl(events: VisualEvent[]) {
  return `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
}

export function parseEventFeedJsonl(text: string): VisualEvent[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as VisualEvent);
}

export function serializeScenarioDocument(scenario: ScenarioDocument) {
  return `${JSON.stringify(scenario, null, 2)}\n`;
}

export function parseScenarioDocumentJson(text: string): ScenarioDocument {
  return JSON.parse(text) as ScenarioDocument;
}
