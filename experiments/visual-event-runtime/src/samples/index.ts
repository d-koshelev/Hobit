import type { ScenarioDocument } from "../contracts";
import { navalIncidentScenario } from "./navalIncidentScenario";
import { spaceOperationsScenario } from "./spaceOperationsScenario";

export const bundledScenarios: ScenarioDocument[] = [
  spaceOperationsScenario,
  navalIncidentScenario,
];

export const defaultDemoScenario = spaceOperationsScenario;

export function getBundledScenarioLabel(scenario: ScenarioDocument) {
  if (scenario.scenarioId === navalIncidentScenario.scenarioId) {
    return "Naval Incident Scenario";
  }

  if (scenario.scenarioId === spaceOperationsScenario.scenarioId) {
    return "Space Operations Scenario";
  }

  return scenario.name;
}
