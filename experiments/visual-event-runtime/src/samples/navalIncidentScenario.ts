import type { ScenarioDocument } from "../contracts";
import { navalRealisticPack } from "../sampleAssetPacks/navalRealisticPack";
import { sceneConfig } from "../sampleData";
import { sampleBindingRules } from "./bindingRules";
import { sampleEventFeed } from "./eventFeed";

export const navalIncidentScenario: ScenarioDocument = {
  version: 1,
  scenarioId: "naval-incident-replay",
  name: "Naval Incident Replay",
  description:
    "Self-contained local demo scenario for carrier launch, scan, database outage, repair, and recovery.",
  assetPackId: navalRealisticPack.id,
  scene: sceneConfig,
  bindings: sampleBindingRules,
  events: sampleEventFeed,
  metadata: {
    kind: "local-demo",
    presentation: "sprite-sheet visual event runtime",
  },
};
