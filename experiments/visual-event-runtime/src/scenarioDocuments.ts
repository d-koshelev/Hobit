import type {
  BindingRule,
  ScenarioDocument,
  SceneConfig,
  VisualEvent,
} from "./contracts";
import { cloneJson } from "./authoringSerialization";
import { normalizeEventTimeline } from "./eventAuthoring";

export const scenarioDocumentVersion = 1;

export type ScenarioDocumentMeta = Pick<
  ScenarioDocument,
  "assetPackId" | "description" | "metadata" | "name" | "scenarioId" | "version"
>;

export function getScenarioDocumentMeta(
  scenario: ScenarioDocument,
): ScenarioDocumentMeta {
  return {
    assetPackId: scenario.assetPackId,
    description: scenario.description,
    metadata: cloneJson(scenario.metadata ?? {}),
    name: scenario.name,
    scenarioId: scenario.scenarioId,
    version: scenario.version,
  };
}

export function buildScenarioDocument(input: {
  assetPackId: string;
  bindings: BindingRule[];
  description?: string;
  events: VisualEvent[];
  metadata?: Record<string, unknown>;
  name: string;
  scenarioId: string;
  scene: SceneConfig;
  version?: number;
}): ScenarioDocument {
  return {
    assetPackId: input.assetPackId,
    bindings: cloneJson(input.bindings),
    description: input.description,
    events: normalizeEventTimeline(cloneJson(input.events)),
    metadata: cloneJson(input.metadata ?? {}),
    name: input.name,
    scenarioId: input.scenarioId,
    scene: cloneJson(input.scene),
    version: input.version ?? scenarioDocumentVersion,
  };
}
