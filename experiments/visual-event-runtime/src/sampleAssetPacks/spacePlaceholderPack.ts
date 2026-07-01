import type {
  AssetPackManifest,
  SpriteSheetAssetDefinition,
} from "../contracts";

type FrameRenderer = (frame: number) => string;

const frameWidth = 96;
const frameHeight = 96;

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function buildSpriteSheet(frameCount: number, renderFrame: FrameRenderer) {
  const width = frameWidth * frameCount;
  const frames = Array.from({ length: frameCount }, (_, frame) => {
    const x = frame * frameWidth;

    return `<g transform="translate(${x} 0)">${renderFrame(frame)}</g>`;
  }).join("");

  return svgToDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${frameHeight}" viewBox="0 0 ${width} ${frameHeight}">${frames}</svg>`,
  );
}

function baseFrame() {
  return `<rect width="${frameWidth}" height="${frameHeight}" fill="transparent"/>`;
}

function thrust(frame: number, x: number, y: number, color = "#74d7ff") {
  const length = 12 + (frame % 3) * 4;

  return [
    `<path d="M${x} ${y} l-${length} -5 l5 5 l-${length} 5 Z" fill="${color}" opacity="0.72"/>`,
    `<path d="M${x - 2} ${y} l-${length * 0.62} -3 l3 3 l-${length * 0.62} 3 Z" fill="#fff4b8" opacity="0.82"/>`,
  ].join("");
}

function mothership(frame: number) {
  const glow = 0.45 + (frame % 3) * 0.1;

  return [
    baseFrame(),
    `<ellipse cx="48" cy="52" rx="42" ry="18" fill="#213947" stroke="#a8d7e8" stroke-width="2.2"/>`,
    `<path d="M14 52 C28 30 68 30 82 52 C68 65 28 65 14 52 Z" fill="#335567" stroke="#d1eef4" stroke-width="1.4"/>`,
    `<path d="M23 52 H73" stroke="#7fe7ff" stroke-width="4" stroke-linecap="round" opacity="${glow}"/>`,
    `<rect x="36" y="36" width="24" height="10" rx="3" fill="#edf9ff" opacity="0.8"/>`,
    `<path d="M39 35 V25 M57 35 V26 M46 31 H65" stroke="#d5f2ff" stroke-width="2" stroke-linecap="round"/>`,
    `<circle cx="28" cy="56" r="3" fill="#a9f4ff" opacity="${glow}"/>`,
    `<circle cx="68" cy="56" r="3" fill="#a9f4ff" opacity="${glow}"/>`,
  ].join("");
}

function launchBay(frame: number) {
  const door = 18 + (frame % 4);
  const glow = 0.5 + (frame % 3) * 0.12;

  return [
    baseFrame(),
    `<path d="M13 56 L27 36 H67 L83 56 L70 68 H27 Z" fill="#34424b" stroke="#c7dae5" stroke-width="2"/>`,
    `<rect x="28" y="43" width="40" height="${door}" rx="4" fill="#182934" stroke="#83e5ff" stroke-width="2" opacity="0.9"/>`,
    `<path d="M34 53 H62" stroke="#ffd375" stroke-width="3" stroke-linecap="round" opacity="${glow}"/>`,
    `<path d="M18 60 H78" stroke="#6fa1b5" stroke-width="2" opacity="0.52"/>`,
    `<circle cx="24" cy="50" r="2.5" fill="#ffdf8b"/>`,
    `<circle cx="72" cy="50" r="2.5" fill="#ffdf8b"/>`,
  ].join("");
}

function scoutShuttle(frame: number) {
  const bob = frame % 2 === 0 ? -1 : 1;

  return [
    baseFrame(),
    `<g transform="translate(0 ${bob})">`,
    thrust(frame, 28, 48),
    `<path d="M72 48 L34 28 L43 45 L20 39 L38 51 L23 63 L44 56 L34 70 Z" fill="#e4f8ff" stroke="#5ba9c2" stroke-width="2" stroke-linejoin="round"/>`,
    `<path d="M48 42 L64 48 L48 54 Z" fill="#4ac2ef" opacity="0.8"/>`,
    `<circle cx="66" cy="45" r="3" fill="#ffffff"/>`,
    `</g>`,
  ].join("");
}

function maintenanceShuttle(frame: number) {
  const bob = frame % 2 === 0 ? 1 : -1;

  return [
    baseFrame(),
    `<g transform="translate(0 ${bob})">`,
    thrust(frame, 27, 50, "#9af0a8"),
    `<path d="M70 49 L42 31 L22 42 L22 58 L42 68 Z" fill="#d7f5e4" stroke="#4e9a67" stroke-width="2" stroke-linejoin="round"/>`,
    `<rect x="34" y="42" width="22" height="16" rx="4" fill="#2c6848" stroke="#eafff0" stroke-width="1.5"/>`,
    `<path d="M45 38 v24 M33 50 h24" stroke="#eafff0" stroke-width="3" stroke-linecap="round"/>`,
    `<path d="M60 52 h12 l5 6" stroke="#ffd375" stroke-width="2.5" stroke-linecap="round" fill="none"/>`,
    `</g>`,
  ].join("");
}

function asteroid(frame: number) {
  const sweep = 20 + frame * 7;

  return [
    baseFrame(),
    `<path d="M17 59 L25 32 L45 22 L69 30 L82 52 L69 74 L39 78 Z" fill="#5d6160" stroke="#d8dfd2" stroke-width="2"/>`,
    `<path d="M33 43 h29 v20 h-29z" fill="#23333b" stroke="#bdf2ff" stroke-width="1.8"/>`,
    `<path d="M38 49 h19 M38 56 h14" stroke="#86e8ff" stroke-width="2" stroke-linecap="round" opacity="0.86"/>`,
    `<circle cx="${sweep}" cy="47" r="13" fill="none" stroke="#80e6ff" stroke-width="1.8" opacity="0.38"/>`,
    `<circle cx="28" cy="61" r="4" fill="#8a8e88"/>`,
    `<circle cx="66" cy="43" r="5" fill="#707574"/>`,
    `<path d="M50 22 l5 -10 l5 10" fill="#b9f5ff" opacity="0.62"/>`,
  ].join("");
}

function databaseFreighter(frame: number, mode: "healthy" | "down" | "recovering") {
  const healthy = mode === "healthy";
  const recovering = mode === "recovering";
  const body = healthy ? "#2e735d" : recovering ? "#3e6f68" : "#554442";
  const stroke = healthy ? "#b8f0d8" : recovering ? "#c9fff0" : "#e18b75";
  const core = healthy ? "#7ff3ad" : recovering ? "#95ffd0" : "#ff8b58";
  const dash = frame * 3;

  return [
    baseFrame(),
    recovering
      ? `<ellipse cx="49" cy="53" rx="38" ry="23" fill="none" stroke="#72efaa" stroke-width="2.4" stroke-dasharray="6 5" stroke-dashoffset="${dash}" opacity="0.72"/>`
      : "",
    `<path d="M12 55 L25 37 H68 L84 52 L70 68 H25 Z" fill="${body}" stroke="${stroke}" stroke-width="2"/>`,
    `<rect x="30" y="41" width="13" height="20" rx="2" fill="#dfeee9" opacity="0.78"/>`,
    `<rect x="47" y="41" width="13" height="20" rx="2" fill="#dfeee9" opacity="0.64"/>`,
    `<circle cx="67" cy="53" r="${healthy ? 5 : 4 + (frame % 2)}" fill="${core}" opacity="0.78"/>`,
    mode === "down"
      ? `<path d="M27 42 L39 61 L47 44 L59 64" stroke="#ffb05d" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="${38 + frame}" cy="${30 - frame}" rx="${9 + frame}" ry="7" fill="#9ca3a0" opacity="0.48"/>`
      : "",
    recovering
      ? `<path d="M42 31 h8 v10 h10 v8 h-10 v10 h-8 v-10 h-10 v-8 h10z" fill="#eafff1" stroke="#42c775" stroke-width="1.4" opacity="0.78"/>`
      : "",
  ].join("");
}

function scannerDrone(frame: number) {
  const angle = frame * 0.78;
  const sweepX = 48 + Math.cos(angle) * 22;
  const sweepY = 48 + Math.sin(angle) * 22;

  return [
    baseFrame(),
    `<circle cx="48" cy="48" r="15" fill="#e3fbff" stroke="#5fbcd2" stroke-width="2"/>`,
    `<circle cx="27" cy="30" r="8" fill="none" stroke="#99edff" stroke-width="2" opacity="0.72"/>`,
    `<circle cx="69" cy="30" r="8" fill="none" stroke="#99edff" stroke-width="2" opacity="0.72"/>`,
    `<circle cx="27" cy="66" r="8" fill="none" stroke="#99edff" stroke-width="2" opacity="0.72"/>`,
    `<circle cx="69" cy="66" r="8" fill="none" stroke="#99edff" stroke-width="2" opacity="0.72"/>`,
    `<line x1="48" y1="48" x2="${sweepX.toFixed(2)}" y2="${sweepY.toFixed(2)}" stroke="#46d8ff" stroke-width="2.5" stroke-linecap="round"/>`,
    `<circle cx="48" cy="48" r="4" fill="#216d80"/>`,
  ].join("");
}

function repairDrone(frame: number) {
  const glow = 0.48 + (frame % 3) * 0.12;

  return [
    baseFrame(),
    `<path d="M48 24 L66 42 L58 68 H38 L30 42 Z" fill="#e9f8da" stroke="#77aa54" stroke-width="2"/>`,
    `<circle cx="31" cy="42" r="8" fill="none" stroke="#b6f17b" stroke-width="2" opacity="${glow}"/>`,
    `<circle cx="65" cy="42" r="8" fill="none" stroke="#b6f17b" stroke-width="2" opacity="${glow}"/>`,
    `<path d="M48 35 v28 M36 49 h24" stroke="#3f8a3f" stroke-width="4" stroke-linecap="round"/>`,
    `<path d="M55 65 l10 8 M64 73 l5 -4" stroke="#ffd375" stroke-width="2.5" stroke-linecap="round"/>`,
  ].join("");
}

function researchPod(frame: number) {
  const beacon = 0.42 + (frame % 4) * 0.1;

  return [
    baseFrame(),
    `<rect x="30" y="31" width="36" height="34" rx="12" fill="#fff0d5" stroke="#d39342" stroke-width="2"/>`,
    `<rect x="38" y="38" width="20" height="14" rx="4" fill="#1e3942" stroke="#bceeff" stroke-width="1.5"/>`,
    `<path d="M36 66 l-8 10 M60 66 l8 10" stroke="#e6c48a" stroke-width="3" stroke-linecap="round"/>`,
    `<circle cx="48" cy="27" r="5" fill="#ffdc7c" opacity="${beacon}"/>`,
    `<path d="M42 56 h12 M48 50 v12" stroke="#d39342" stroke-width="2.5" stroke-linecap="round"/>`,
  ].join("");
}

function explosion(frame: number) {
  const radius = 10 + frame * 4;
  const opacity = Math.max(0.18, 0.95 - frame * 0.1);

  return [
    baseFrame(),
    `<path d="M48 8 L57 34 L85 25 L65 48 L82 76 L48 62 L16 78 L31 49 L10 25 L39 34 Z" fill="#ff7438" opacity="${opacity}"/>`,
    `<circle cx="48" cy="49" r="${radius}" fill="#ffd75d" opacity="${opacity * 0.78}"/>`,
    `<circle cx="48" cy="49" r="${Math.max(6, radius - 13)}" fill="#fff2bb" opacity="${opacity}"/>`,
  ].join("");
}

function smoke(frame: number) {
  return [
    baseFrame(),
    `<ellipse cx="${32 + frame * 3}" cy="${65 - frame * 3}" rx="${14 + frame}" ry="10" fill="#6f7772" opacity="0.66"/>`,
    `<ellipse cx="${52 - frame}" cy="${51 - frame * 3}" rx="${13 + frame}" ry="11" fill="#a6aba7" opacity="0.46"/>`,
    `<ellipse cx="${43 + frame}" cy="${36 - frame * 2}" rx="${10 + frame}" ry="8" fill="#d2d5d0" opacity="0.28"/>`,
  ].join("");
}

function repairRing(frame: number) {
  const dash = frame * 4;
  const sweep = frame * 0.78;

  return [
    baseFrame(),
    `<circle cx="48" cy="50" r="34" fill="none" stroke="#72efaa" stroke-width="3" stroke-dasharray="7 5" stroke-dashoffset="${dash}" opacity="0.82"/>`,
    `<path d="M21 38 V25 H36 M75 38 V25 H60 M21 62 V75 H36 M75 62 V75 H60" fill="none" stroke="#eafff1" stroke-width="2.4" stroke-linecap="round"/>`,
    `<circle cx="${(48 + Math.cos(sweep) * 34).toFixed(2)}" cy="${(50 + Math.sin(sweep) * 34).toFixed(2)}" r="4" fill="#fff0a8"/>`,
    `<path d="M43 35 h10 v10 h10 v10 h-10 v10 h-10 v-10 h-10 v-10 h10z" fill="#eafff1" stroke="#3bbd72" stroke-width="1.5" opacity="0.72"/>`,
  ].join("");
}

const spaceSpriteSources = {
  codebase_asteroid_idle: buildSpriteSheet(6, asteroid),
  database_freighter_down: buildSpriteSheet(6, (frame) =>
    databaseFreighter(frame, "down"),
  ),
  database_freighter_healthy: buildSpriteSheet(6, (frame) =>
    databaseFreighter(frame, "healthy"),
  ),
  database_freighter_recovering: buildSpriteSheet(6, (frame) =>
    databaseFreighter(frame, "recovering"),
  ),
  explosion_once: buildSpriteSheet(8, explosion),
  launch_bay_or_queue_carrier_idle: buildSpriteSheet(6, launchBay),
  maintenance_shuttle_flying: buildSpriteSheet(6, maintenanceShuttle),
  repair_drone_loop: buildSpriteSheet(8, repairDrone),
  repair_ring_loop: buildSpriteSheet(8, repairRing),
  research_pod_loop: buildSpriteSheet(8, researchPod),
  scanner_drone_loop: buildSpriteSheet(8, scannerDrone),
  scout_shuttle_flying: buildSpriteSheet(6, scoutShuttle),
  smoke_or_damage_loop: buildSpriteSheet(6, smoke),
  space_mothership_idle: buildSpriteSheet(6, mothership),
};

function inlineSpriteSheet(
  key: keyof typeof spaceSpriteSources,
  frameCount: number,
  description: string,
): SpriteSheetAssetDefinition {
  return {
    columns: frameCount,
    description,
    frameCount,
    frameHeight,
    frameWidth,
    key,
    kind: "spriteSheet",
    rows: 1,
    src: spaceSpriteSources[key],
  };
}

const spaceSpriteAssets = [
  inlineSpriteSheet(
    "space_mothership_idle",
    6,
    "Inline placeholder mothership idle loop.",
  ),
  inlineSpriteSheet(
    "launch_bay_or_queue_carrier_idle",
    6,
    "Inline placeholder launch bay and mission-control carrier idle loop.",
  ),
  inlineSpriteSheet(
    "scout_shuttle_flying",
    6,
    "Inline placeholder scout shuttle flying loop.",
  ),
  inlineSpriteSheet(
    "maintenance_shuttle_flying",
    6,
    "Inline placeholder maintenance shuttle flying loop.",
  ),
  inlineSpriteSheet(
    "codebase_asteroid_idle",
    6,
    "Inline placeholder research asteroid and data vault idle loop.",
  ),
  inlineSpriteSheet(
    "database_freighter_healthy",
    6,
    "Inline placeholder database freighter healthy loop.",
  ),
  inlineSpriteSheet(
    "database_freighter_down",
    6,
    "Inline placeholder database freighter down loop.",
  ),
  inlineSpriteSheet(
    "database_freighter_recovering",
    6,
    "Inline placeholder database freighter recovering loop.",
  ),
  inlineSpriteSheet(
    "scanner_drone_loop",
    8,
    "Inline placeholder scanner drone loop.",
  ),
  inlineSpriteSheet(
    "repair_drone_loop",
    8,
    "Inline placeholder repair drone loop.",
  ),
  inlineSpriteSheet(
    "research_pod_loop",
    8,
    "Inline placeholder research pod loop.",
  ),
  inlineSpriteSheet("explosion_once", 8, "Inline placeholder explosion effect."),
  inlineSpriteSheet(
    "smoke_or_damage_loop",
    6,
    "Inline placeholder smoke and damage effect loop.",
  ),
  inlineSpriteSheet(
    "repair_ring_loop",
    8,
    "Inline placeholder repair ring and dock effect loop.",
  ),
];

export const spacePlaceholderPack: AssetPackManifest = {
  id: "space-placeholder-v1",
  name: "Space Placeholder V1",
  version: "0.1.0",
  description:
    "Inline deterministic placeholder sprite sheets for the Space Operations demo.",
  style: "readable space operations placeholders, near-orthographic camera",
  basePath: "/asset-packs/space-placeholder-v1/",
  assets: spaceSpriteAssets,
  animations: [
    {
      assetKey: "space_mothership_idle",
      fps: 4,
      frameCount: 6,
      frameHeight,
      frameWidth,
      id: "space_mothership_idle_loop",
      playback: "loop",
    },
    {
      assetKey: "launch_bay_or_queue_carrier_idle",
      fps: 4,
      frameCount: 6,
      frameHeight,
      frameWidth,
      id: "launch_bay_or_queue_carrier_idle_loop",
      playback: "loop",
    },
    {
      assetKey: "scout_shuttle_flying",
      fps: 10,
      frameCount: 6,
      frameHeight,
      frameWidth,
      id: "scout_shuttle_flying_loop",
      playback: "loop",
    },
    {
      assetKey: "maintenance_shuttle_flying",
      fps: 10,
      frameCount: 6,
      frameHeight,
      frameWidth,
      id: "maintenance_shuttle_flying_loop",
      playback: "loop",
    },
    {
      assetKey: "codebase_asteroid_idle",
      fps: 5,
      frameCount: 6,
      frameHeight,
      frameWidth,
      id: "codebase_asteroid_idle_loop",
      playback: "loop",
    },
    {
      assetKey: "database_freighter_healthy",
      fps: 5,
      frameCount: 6,
      frameHeight,
      frameWidth,
      id: "database_freighter_healthy_loop",
      playback: "loop",
    },
    {
      assetKey: "database_freighter_down",
      fps: 6,
      frameCount: 6,
      frameHeight,
      frameWidth,
      id: "database_freighter_down_loop",
      playback: "loop",
    },
    {
      assetKey: "database_freighter_recovering",
      fps: 8,
      frameCount: 6,
      frameHeight,
      frameWidth,
      id: "database_freighter_recovering_loop",
      playback: "loop",
    },
    {
      assetKey: "scanner_drone_loop",
      fps: 10,
      frameCount: 8,
      frameHeight,
      frameWidth,
      id: "scanner_drone_loop",
      playback: "loop",
    },
    {
      assetKey: "repair_drone_loop",
      fps: 10,
      frameCount: 8,
      frameHeight,
      frameWidth,
      id: "repair_drone_loop",
      playback: "loop",
    },
    {
      assetKey: "research_pod_loop",
      fps: 8,
      frameCount: 8,
      frameHeight,
      frameWidth,
      id: "research_pod_loop",
      playback: "loop",
    },
    {
      assetKey: "explosion_once",
      fps: 14,
      frameCount: 8,
      frameHeight,
      frameWidth,
      id: "space_explosion_once",
      onCompleteState: "down",
      playback: "once",
    },
    {
      assetKey: "smoke_or_damage_loop",
      fps: 7,
      frameCount: 6,
      frameHeight,
      frameWidth,
      id: "smoke_or_damage_loop",
      playback: "loop",
    },
    {
      assetKey: "repair_ring_loop",
      fps: 10,
      frameCount: 8,
      frameHeight,
      frameWidth,
      id: "repair_ring_loop",
      playback: "loop",
    },
  ],
  objectPresets: [
    {
      animationsByState: {
        idle: "space_mothership_idle_loop",
      },
      defaultAnimationId: "space_mothership_idle_loop",
      defaultAssetKey: "space_mothership_idle",
      defaultHeight: 150,
      defaultVisualState: "idle",
      defaultWidth: 220,
      id: "preset.space_mothership",
      kind: "mothership",
      name: "Mothership Carrier",
    },
    {
      animationsByState: {
        active: "launch_bay_or_queue_carrier_idle_loop",
        idle: "launch_bay_or_queue_carrier_idle_loop",
      },
      defaultAnimationId: "launch_bay_or_queue_carrier_idle_loop",
      defaultAssetKey: "launch_bay_or_queue_carrier_idle",
      defaultHeight: 92,
      defaultVisualState: "idle",
      defaultWidth: 142,
      id: "preset.launch_bay_carrier",
      kind: "launch_bay",
      name: "Launch Bay Carrier",
    },
    {
      animationsByState: {
        docked: "scout_shuttle_flying_loop",
        enroute: "scout_shuttle_flying_loop",
        flying: "scout_shuttle_flying_loop",
        returning: "scout_shuttle_flying_loop",
      },
      defaultAnimationId: "scout_shuttle_flying_loop",
      defaultAssetKey: "scout_shuttle_flying",
      defaultHeight: 62,
      defaultVisualState: "flying",
      defaultWidth: 88,
      id: "preset.scout_shuttle",
      kind: "shuttle",
      name: "Scout Shuttle",
      metadata: {
        mobileUnit: true,
        role: "scout-shuttle",
      },
    },
    {
      animationsByState: {
        flying: "maintenance_shuttle_flying_loop",
        holding: "maintenance_shuttle_flying_loop",
        returning: "maintenance_shuttle_flying_loop",
      },
      defaultAnimationId: "maintenance_shuttle_flying_loop",
      defaultAssetKey: "maintenance_shuttle_flying",
      defaultHeight: 64,
      defaultVisualState: "flying",
      defaultWidth: 92,
      id: "preset.maintenance_shuttle",
      kind: "shuttle",
      name: "Maintenance Shuttle",
      metadata: {
        mobileUnit: true,
        role: "maintenance-shuttle",
      },
    },
    {
      animationsByState: {
        idle: "codebase_asteroid_idle_loop",
        scanning: "codebase_asteroid_idle_loop",
      },
      defaultAnimationId: "codebase_asteroid_idle_loop",
      defaultAssetKey: "codebase_asteroid_idle",
      defaultHeight: 112,
      defaultVisualState: "idle",
      defaultWidth: 150,
      id: "preset.codebase_asteroid",
      kind: "codebase_asteroid",
      name: "Asteroid Data Vault",
    },
    {
      animationsByState: {
        down: "database_freighter_down_loop",
        healthy: "database_freighter_healthy_loop",
        recovering: "database_freighter_recovering_loop",
      },
      defaultAnimationId: "database_freighter_healthy_loop",
      defaultAssetKey: "database_freighter_healthy",
      defaultHeight: 104,
      defaultVisualState: "healthy",
      defaultWidth: 154,
      id: "preset.database_freighter",
      kind: "database_freighter",
      name: "Database Freighter",
    },
    {
      animationsByState: {
        scanning: "scanner_drone_loop",
      },
      defaultAnimationId: "scanner_drone_loop",
      defaultAssetKey: "scanner_drone_loop",
      defaultHeight: 50,
      defaultVisualState: "scanning",
      defaultWidth: 58,
      id: "preset.scanner_drone",
      kind: "drone",
      name: "Scanner Drone",
      metadata: {
        mobileUnit: true,
        role: "scanner-drone",
      },
    },
    {
      animationsByState: {
        repairing: "repair_drone_loop",
        scanning: "repair_drone_loop",
      },
      defaultAnimationId: "repair_drone_loop",
      defaultAssetKey: "repair_drone_loop",
      defaultHeight: 52,
      defaultVisualState: "repairing",
      defaultWidth: 58,
      id: "preset.repair_drone",
      kind: "drone",
      name: "Repair Drone",
      metadata: {
        mobileUnit: true,
        role: "repair-drone",
      },
    },
    {
      animationsByState: {
        attached: "research_pod_loop",
        flying: "research_pod_loop",
      },
      defaultAnimationId: "research_pod_loop",
      defaultAssetKey: "research_pod_loop",
      defaultHeight: 54,
      defaultVisualState: "flying",
      defaultWidth: 60,
      id: "preset.research_pod",
      kind: "research_pod",
      name: "Research Pod",
      metadata: {
        mobileUnit: true,
        role: "research-pod",
      },
    },
    {
      animationsByState: {
        exploding: "space_explosion_once",
      },
      defaultAnimationId: "space_explosion_once",
      defaultAssetKey: "explosion_once",
      defaultHeight: 118,
      defaultVisualState: "exploding",
      defaultWidth: 130,
      id: "preset.explosion_effect",
      kind: "effect",
      name: "Explosion Effect",
      metadata: {
        overlay: true,
      },
    },
    {
      animationsByState: {
        damaged: "smoke_or_damage_loop",
      },
      defaultAnimationId: "smoke_or_damage_loop",
      defaultAssetKey: "smoke_or_damage_loop",
      defaultHeight: 96,
      defaultVisualState: "damaged",
      defaultWidth: 104,
      id: "preset.damage_effect",
      kind: "effect",
      name: "Smoke or Damage Effect",
      metadata: {
        overlay: true,
      },
    },
    {
      animationsByState: {
        repairing: "repair_ring_loop",
      },
      defaultAnimationId: "repair_ring_loop",
      defaultAssetKey: "repair_ring_loop",
      defaultHeight: 116,
      defaultVisualState: "repairing",
      defaultWidth: 126,
      id: "preset.repair_ring_effect",
      kind: "effect",
      name: "Repair Ring Effect",
      metadata: {
        overlay: true,
      },
    },
  ],
};

export const spacePlaceholderFallbackSprites: Record<
  string,
  SpriteSheetAssetDefinition
> = spaceSpriteAssets.reduce<Record<string, SpriteSheetAssetDefinition>>(
  (sprites, asset) => {
    sprites[asset.key] = asset;
    return sprites;
  },
  {},
);
