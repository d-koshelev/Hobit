import type {
  AssetPackManifest,
  SpriteSheetAssetDefinition,
} from "../contracts";
import { navalRealisticPack } from "./navalRealisticPack";

type PlaceholderSource = {
  file: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
  description: string;
};

const placeholderBasePath = "/asset-packs/naval-placeholder-v1/";

const placeholderSources = {
  carrier: {
    description: "Temporary placeholder aircraft carrier sprite sheet.",
    file: "hobit_aircraft_carrier_v1_spritesheet.png",
    fps: 10,
    frameCount: 12,
    frameHeight: 256,
    frameWidth: 256,
  },
  destroyer: {
    description: "Temporary placeholder escort destroyer sprite sheet.",
    file: "hobit_escort_destroyer_v1_spritesheet.png",
    fps: 10,
    frameCount: 12,
    frameHeight: 160,
    frameWidth: 160,
  },
  fighter: {
    description: "Temporary placeholder deck fighter sprite sheet.",
    file: "hobit_deck_fighter_v1_spritesheet.png",
    fps: 15,
    frameCount: 16,
    frameHeight: 128,
    frameWidth: 128,
  },
  freighter: {
    description: "Temporary placeholder support freighter sprite sheet.",
    file: "hobit_support_freighter_v1_spritesheet.png",
    fps: 10,
    frameCount: 12,
    frameHeight: 160,
    frameWidth: 160,
  },
} satisfies Record<string, PlaceholderSource>;

const placeholderAssignments: Record<string, PlaceholderSource> = {
  codebase_target: placeholderSources.freighter,
  coordinator_carrier_idle: placeholderSources.carrier,
  db_ship_down: placeholderSources.destroyer,
  db_ship_healthy: placeholderSources.destroyer,
  db_ship_recovering: placeholderSources.freighter,
  deck_fighter_flying: placeholderSources.fighter,
  explosion_once: placeholderSources.destroyer,
  oil_rig_idle: placeholderSources.freighter,
  queue_carrier_idle: placeholderSources.carrier,
  repair_dock_loop: placeholderSources.freighter,
  scan_ring_loop: placeholderSources.freighter,
  scanner_drone_loop: placeholderSources.fighter,
  smoke_loop: placeholderSources.destroyer,
  support_ship_healthy: placeholderSources.freighter,
};

const meaningfulPlaceholderAssetKeys = [
  "codebase_target",
  "coordinator_carrier_idle",
  "db_ship_down",
  "db_ship_healthy",
  "db_ship_recovering",
  "deck_fighter_flying",
  "oil_rig_idle",
  "queue_carrier_idle",
  "support_ship_healthy",
];

function placeholderSpriteSheet(
  key: string,
  source: PlaceholderSource,
  absolute: boolean,
): SpriteSheetAssetDefinition {
  return {
    columns: source.frameCount,
    description: `${source.description} Used by ${key}.`,
    frameCount: source.frameCount,
    frameHeight: source.frameHeight,
    frameWidth: source.frameWidth,
    key,
    kind: "spriteSheet",
    rows: 1,
    src: `${absolute ? placeholderBasePath : ""}spritesheets/${source.file}`,
  };
}

export const navalPlaceholderPack: AssetPackManifest = {
  ...navalRealisticPack,
  assets: navalRealisticPack.assets.map((asset) => {
    const source = placeholderAssignments[asset.key];

    return source ? placeholderSpriteSheet(asset.key, source, false) : asset;
  }),
  basePath: placeholderBasePath,
  description:
    "Temporary low-fidelity local naval placeholder pack for zero-setup demos.",
  id: "naval-placeholder-v1",
  name: "Naval Placeholder V1",
  style: "temporary low-fidelity naval placeholders, debug/demo fallback",
  version: "0.1.0",
  animations: navalRealisticPack.animations.map((clip) => {
    const source = placeholderAssignments[clip.assetKey];

    if (!source) {
      return clip;
    }

    return {
      ...clip,
      fps: source.fps,
      frameCount: source.frameCount,
      frameHeight: source.frameHeight,
      frameWidth: source.frameWidth,
    };
  }),
  objectPresets: navalRealisticPack.objectPresets,
};

export const navalPlaceholderFallbackSprites: Record<
  string,
  SpriteSheetAssetDefinition
> = meaningfulPlaceholderAssetKeys.reduce<Record<string, SpriteSheetAssetDefinition>>(
  (sprites, assetKey) => {
    sprites[assetKey] = placeholderSpriteSheet(
      assetKey,
      placeholderAssignments[assetKey],
      true,
    );

    return sprites;
  },
  {},
);
