import type {
  BindingRule,
  ScenarioDocument,
  SceneConfig,
  VisualEvent,
} from "../contracts";
import { spacePlaceholderPack } from "../sampleAssetPacks/spacePlaceholderPack";

export const spaceOperationsScene: SceneConfig = {
  id: "visual-event-runtime-space-001",
  title: "Space Operations Scenario",
  description:
    "Local visual event replay where every mobile unit launches from a source, performs a task, returns, and docks.",
  lanes: ["Carrier", "Asteroid Belt", "Freighter Orbit"],
  assets: spacePlaceholderPack.assets,
  animations: spacePlaceholderPack.animations,
  objects: [
    {
      accent: "#5aa9c2",
      animationStartedAt: 0,
      animationsByState: {
        active: "space_mothership_idle_loop",
        idle: "space_mothership_idle_loop",
      },
      assetKey: "space_mothership_idle",
      currentAnimationId: "space_mothership_idle_loop",
      detail:
        "Large carrier that acts as the home source and docking destination for shuttles.",
      entityId: "space_mothership",
      height: 150,
      id: "space_mothership",
      kind: "mothership",
      label: "Mothership Carrier",
      name: "Mothership Carrier",
      state: "idle",
      visualState: "idle",
      width: 220,
      x: 18,
      y: 50,
      zIndex: 2,
    },
    {
      accent: "#d39342",
      animationStartedAt: 0,
      animationsByState: {
        active: "launch_bay_or_queue_carrier_idle_loop",
        idle: "launch_bay_or_queue_carrier_idle_loop",
      },
      assetKey: "launch_bay_or_queue_carrier_idle",
      currentAnimationId: "launch_bay_or_queue_carrier_idle_loop",
      detail:
        "Mission-control carrier and launch bay for queued local work in this demo.",
      entityId: "launch_bay_carrier",
      height: 92,
      id: "launch_bay_carrier",
      kind: "launch_bay",
      label: "Launch Bay",
      name: "Launch Bay",
      state: "idle",
      visualState: "idle",
      width: 142,
      x: 25,
      y: 72,
      zIndex: 3,
    },
    {
      accent: "#79c8dd",
      animationStartedAt: 0,
      animationsByState: {
        docked: "scout_shuttle_flying_loop",
        enroute: "scout_shuttle_flying_loop",
        flying: "scout_shuttle_flying_loop",
        returning: "scout_shuttle_flying_loop",
      },
      assetKey: "scout_shuttle_flying",
      currentAnimationId: "scout_shuttle_flying_loop",
      detail: "Initially docked; spawned from the mothership when launched.",
      entityId: "scout_shuttle",
      height: 62,
      hidden: true,
      id: "scout_shuttle",
      kind: "shuttle",
      label: "Scout Shuttle",
      metadata: {
        homeObjectId: "space_mothership",
        mobileUnit: true,
        role: "scout-shuttle",
      },
      name: "Scout Shuttle",
      state: "docked",
      visualState: "docked",
      width: 88,
      x: 22,
      y: 48,
      zIndex: 12,
    },
    {
      accent: "#71b66a",
      animationStartedAt: 0,
      animationsByState: {
        docked: "maintenance_shuttle_flying_loop",
        flying: "maintenance_shuttle_flying_loop",
        holding: "maintenance_shuttle_flying_loop",
        returning: "maintenance_shuttle_flying_loop",
      },
      assetKey: "maintenance_shuttle_flying",
      currentAnimationId: "maintenance_shuttle_flying_loop",
      detail: "Initially docked; spawned from the mothership for repair work.",
      entityId: "maintenance_shuttle",
      height: 64,
      hidden: true,
      id: "maintenance_shuttle",
      kind: "shuttle",
      label: "Maintenance Shuttle",
      metadata: {
        homeObjectId: "space_mothership",
        mobileUnit: true,
        role: "maintenance-shuttle",
      },
      name: "Maintenance Shuttle",
      state: "docked",
      visualState: "docked",
      width: 92,
      x: 22,
      y: 54,
      zIndex: 12,
    },
    {
      accent: "#8fd8e8",
      animationStartedAt: 0,
      animationsByState: {
        idle: "codebase_asteroid_idle_loop",
        scanning: "codebase_asteroid_idle_loop",
      },
      assetKey: "codebase_asteroid_idle",
      currentAnimationId: "codebase_asteroid_idle_loop",
      detail:
        "Asteroid data vault used as the local codebase/research target.",
      entityId: "codebase_asteroid",
      height: 112,
      id: "codebase_asteroid",
      kind: "codebase_asteroid",
      label: "Asteroid Data Vault",
      name: "Asteroid Data Vault",
      state: "idle",
      visualState: "idle",
      width: 150,
      x: 70,
      y: 31,
      zIndex: 4,
    },
    {
      accent: "#68c58d",
      animationStartedAt: 0,
      animationsByState: {
        down: "database_freighter_down_loop",
        healthy: "database_freighter_healthy_loop",
        recovering: "database_freighter_recovering_loop",
      },
      assetKey: "database_freighter_healthy",
      currentAnimationId: "database_freighter_healthy_loop",
      detail:
        "Database freighter with healthy, down, and recovering visual states.",
      entityId: "database_freighter",
      height: 104,
      id: "database_freighter",
      kind: "database_freighter",
      label: "Database Freighter",
      metadata: {
        repairProgress: 0,
      },
      name: "Database Freighter",
      state: "healthy",
      visualState: "healthy",
      width: 154,
      x: 76,
      y: 64,
      zIndex: 4,
    },
  ],
};

export const spaceOperationsBindingRules: BindingRule[] = [
  {
    actions: [
      {
        kind: "setState",
        state: "active",
        targetId: "space_mothership",
      },
      {
        kind: "setState",
        state: "active",
        targetId: "launch_bay_carrier",
      },
    ],
    id: "rule.space.mission-started",
    name: "Mission starts carrier operations",
    when: {
      type: "mission.started",
    },
  },
  {
    actions: [
      {
        kind: "spawnFromObject",
        metadata: {
          homeObjectId: "space_mothership",
          lifecycle: "launch-from-mothership",
          mobileUnit: true,
          role: "scout-shuttle",
        },
        objectId: "scout_shuttle",
        offset: {
          x: 6,
          y: -3,
        },
        presetId: "preset.scout_shuttle",
        sourceObjectId: "space_mothership",
        state: "flying",
        tag: "mobile-shuttle",
      },
      {
        durationMs: 2500,
        easing: "easeInOut",
        kind: "moveToObject",
        metadata: {
          dockObjectId: "codebase_asteroid",
          motion: "scout-to-codebase",
        },
        offset: {
          x: -6,
          y: 6,
        },
        targetId: "scout_shuttle",
        targetObjectId: "codebase_asteroid",
      },
      {
        durationMs: 13500,
        kind: "showRouteTrail",
        path: [
          { x: 24, y: 47 },
          { x: 42, y: 38 },
          { x: 58, y: 34 },
          { x: 64, y: 37 },
        ],
        targetId: "scout_shuttle",
      },
    ],
    id: "rule.space.scout-launch",
    name: "Scout shuttle undocks from mothership",
    when: {
      type: "scout_shuttle.launch_started",
    },
  },
  {
    actions: [
      {
        kind: "setState",
        state: "enroute",
        targetId: "scout_shuttle",
      },
    ],
    id: "rule.space.scout-enroute",
    name: "Scout shuttle continues to codebase",
    when: {
      type: "scout_shuttle.enroute_to_codebase",
    },
  },
  {
    actions: [
      {
        animationId: "space_explosion_once",
        kind: "spawnEffect",
        lifetimeMs: 700,
        objectId: "database_initial_explosion",
        presetId: "preset.explosion_effect",
        tag: "database-explosion",
        targetId: "database_freighter",
      },
      {
        delayMs: 700,
        kind: "setState",
        state: "down",
        targetId: "database_freighter",
      },
      {
        delayMs: 700,
        kind: "spawnAttachedEffect",
        objectId: "database_damage_smoke",
        offset: {
          x: 5,
          y: -7,
        },
        presetId: "preset.damage_effect",
        tag: "database-damage",
        targetId: "database_freighter",
      },
    ],
    id: "rule.space.database-down",
    name: "Database freighter goes down with visible damage",
    when: {
      "entity.id": "database_freighter",
      "transition.from": "healthy",
      "transition.to": "down",
      severity: "critical",
      type: "monitoring.target.status_changed",
    },
  },
  {
    actions: [
      {
        kind: "spawnFromObject",
        metadata: {
          homeObjectId: "space_mothership",
          lifecycle: "launch-from-mothership",
          mobileUnit: true,
          role: "maintenance-shuttle",
        },
        objectId: "maintenance_shuttle",
        offset: {
          x: 7,
          y: 5,
        },
        presetId: "preset.maintenance_shuttle",
        sourceObjectId: "space_mothership",
        state: "flying",
        tag: "mobile-shuttle",
      },
      {
        durationMs: 3000,
        easing: "easeInOut",
        kind: "moveToObject",
        metadata: {
          dockObjectId: "database_freighter",
          motion: "maintenance-to-database",
        },
        offset: {
          x: -11,
          y: -10,
        },
        targetId: "maintenance_shuttle",
        targetObjectId: "database_freighter",
      },
      {
        durationMs: 10000,
        kind: "showRouteTrail",
        path: [
          { x: 25, y: 55 },
          { x: 45, y: 62 },
          { x: 62, y: 63 },
          { x: 65, y: 54 },
        ],
        targetId: "maintenance_shuttle",
      },
    ],
    id: "rule.space.maintenance-launch",
    name: "Maintenance shuttle undocks from mothership",
    when: {
      type: "maintenance_shuttle.launch_started",
    },
  },
  {
    actions: [
      {
        kind: "setState",
        state: "holding",
        targetId: "maintenance_shuttle",
      },
    ],
    id: "rule.space.maintenance-arrived",
    name: "Maintenance shuttle holds beside database freighter",
    when: {
      type: "maintenance_shuttle.arrived",
    },
  },
  {
    actions: [
      {
        kind: "setState",
        state: "scanning",
        targetId: "codebase_asteroid",
      },
      {
        kind: "spawnFromObject",
        metadata: {
          launcherObjectId: "scout_shuttle",
          lifecycle: "scanner-launch-from-scout",
          mobileUnit: true,
          role: "scanner-drone",
        },
        objectId: "scan_drone_alpha",
        offset: {
          x: -1,
          y: -1,
        },
        presetId: "preset.scanner_drone",
        sourceObjectId: "scout_shuttle",
        state: "scanning",
        tag: "scanner-drone",
      },
      {
        durationMs: 900,
        easing: "easeOut",
        kind: "moveToObject",
        offset: {
          x: -8,
          y: -2,
        },
        targetId: "scan_drone_alpha",
        targetObjectId: "codebase_asteroid",
      },
      {
        kind: "spawnFromObject",
        metadata: {
          launcherObjectId: "scout_shuttle",
          lifecycle: "scanner-launch-from-scout",
          mobileUnit: true,
          role: "scanner-drone",
        },
        objectId: "scan_drone_beta",
        offset: {
          x: 1,
          y: 1,
        },
        presetId: "preset.scanner_drone",
        sourceObjectId: "scout_shuttle",
        state: "scanning",
        tag: "scanner-drone",
      },
      {
        durationMs: 900,
        easing: "easeOut",
        kind: "moveToObject",
        offset: {
          x: 8,
          y: 4,
        },
        targetId: "scan_drone_beta",
        targetObjectId: "codebase_asteroid",
      },
      {
        kind: "spawnFromObject",
        metadata: {
          launcherObjectId: "scout_shuttle",
          lifecycle: "scanner-launch-from-scout",
          mobileUnit: true,
          role: "scanner-drone",
        },
        objectId: "scan_drone_gamma",
        offset: {
          x: 0,
          y: 2,
        },
        presetId: "preset.scanner_drone",
        sourceObjectId: "scout_shuttle",
        state: "scanning",
        tag: "scanner-drone",
      },
      {
        durationMs: 900,
        easing: "easeOut",
        kind: "moveToObject",
        offset: {
          x: 0,
          y: 9,
        },
        targetId: "scan_drone_gamma",
        targetObjectId: "codebase_asteroid",
      },
    ],
    id: "rule.space.codebase-scan-started",
    name: "Scout launches scanner drones from its current position",
    when: {
      "entity.id": "codebase_asteroid",
      type: "codebase.scan.started",
    },
  },
  {
    actions: [
      {
        durationMs: 4500,
        kind: "orbitAround",
        radius: 8,
        speed: 1.4,
        targetId: "scan_drone_alpha",
        targetObjectId: "codebase_asteroid",
      },
      {
        durationMs: 4500,
        kind: "orbitAround",
        radius: 12,
        speed: 1,
        targetId: "scan_drone_beta",
        targetObjectId: "codebase_asteroid",
      },
      {
        durationMs: 4500,
        kind: "orbitAround",
        radius: 16,
        speed: 0.8,
        targetId: "scan_drone_gamma",
        targetObjectId: "codebase_asteroid",
      },
    ],
    id: "rule.space.scanner-orbit-started",
    name: "Scanner drones orbit the asteroid data vault",
    when: {
      type: "scanner_drones.scan_orbit_started",
    },
  },
  {
    actions: [
      {
        kind: "spawnFromObject",
        metadata: {
          launcherObjectId: "maintenance_shuttle",
          lifecycle: "repair-launch-from-maintenance",
          mobileUnit: true,
          role: "repair-drone",
        },
        objectId: "repair_drone_alpha",
        offset: {
          x: -1,
          y: 1,
        },
        presetId: "preset.repair_drone",
        sourceObjectId: "maintenance_shuttle",
        state: "scanning",
        tag: "repair-drone",
      },
      {
        durationMs: 700,
        easing: "easeOut",
        kind: "moveToObject",
        offset: {
          x: -8,
          y: -5,
        },
        targetId: "repair_drone_alpha",
        targetObjectId: "database_freighter",
      },
      {
        kind: "spawnFromObject",
        metadata: {
          launcherObjectId: "maintenance_shuttle",
          lifecycle: "repair-launch-from-maintenance",
          mobileUnit: true,
          role: "repair-drone",
        },
        objectId: "repair_drone_beta",
        offset: {
          x: 1,
          y: -1,
        },
        presetId: "preset.repair_drone",
        sourceObjectId: "maintenance_shuttle",
        state: "scanning",
        tag: "repair-drone",
      },
      {
        durationMs: 700,
        easing: "easeOut",
        kind: "moveToObject",
        offset: {
          x: 9,
          y: 5,
        },
        targetId: "repair_drone_beta",
        targetObjectId: "database_freighter",
      },
    ],
    id: "rule.space.database-damage-scan",
    name: "Maintenance shuttle launches repair drones",
    when: {
      "entity.id": "database_freighter",
      type: "database.damage_scan.started",
    },
  },
  {
    actions: [
      {
        kind: "setState",
        state: "recovering",
        targetId: "database_freighter",
      },
      {
        kind: "setProperty",
        property: "metadata.repairProgress",
        targetId: "database_freighter",
        value: 0.45,
      },
      {
        durationMs: 4500,
        kind: "orbitAround",
        radius: 10,
        speed: 1.2,
        targetId: "repair_drone_alpha",
        targetObjectId: "database_freighter",
      },
      {
        durationMs: 4500,
        kind: "orbitAround",
        radius: 15,
        speed: 0.85,
        targetId: "repair_drone_beta",
        targetObjectId: "database_freighter",
      },
      {
        kind: "spawnAttachedEffect",
        objectId: "database_repair_ring",
        offset: {
          x: 0,
          y: 3,
        },
        presetId: "preset.repair_ring_effect",
        tag: "database-repair-ring",
        targetId: "database_freighter",
      },
    ],
    id: "rule.space.database-repair-started",
    name: "Repair ring starts on the database freighter",
    when: {
      "entity.id": "database_freighter",
      type: "database.repair.started",
    },
  },
  {
    actions: [
      {
        kind: "setState",
        state: "idle",
        targetId: "codebase_asteroid",
      },
    ],
    id: "rule.space.codebase-scan-completed",
    name: "Codebase scan completes before drone recovery",
    when: {
      "entity.id": "codebase_asteroid",
      type: "codebase.scan.completed",
    },
  },
  {
    actions: [
      {
        durationMs: 700,
        easing: "easeInOut",
        kind: "moveToObject",
        metadata: {
          dockObjectId: "scout_shuttle",
          motion: "scanner-return-to-scout",
        },
        targetId: "scan_drone_alpha",
        targetObjectId: "scout_shuttle",
      },
      {
        durationMs: 700,
        easing: "easeInOut",
        kind: "moveToObject",
        metadata: {
          dockObjectId: "scout_shuttle",
          motion: "scanner-return-to-scout",
        },
        targetId: "scan_drone_beta",
        targetObjectId: "scout_shuttle",
      },
      {
        durationMs: 700,
        easing: "easeInOut",
        kind: "moveToObject",
        metadata: {
          dockObjectId: "scout_shuttle",
          motion: "scanner-return-to-scout",
        },
        targetId: "scan_drone_gamma",
        targetObjectId: "scout_shuttle",
      },
      {
        delayMs: 700,
        kind: "despawnAtObject",
        targetId: "scan_drone_alpha",
        targetObjectId: "scout_shuttle",
      },
      {
        delayMs: 700,
        kind: "despawnAtObject",
        targetId: "scan_drone_beta",
        targetObjectId: "scout_shuttle",
      },
      {
        delayMs: 700,
        kind: "despawnAtObject",
        targetId: "scan_drone_gamma",
        targetObjectId: "scout_shuttle",
      },
    ],
    id: "rule.space.scanner-return",
    name: "Scanner drones return to the scout shuttle and dock",
    when: {
      type: "scanner_drones.return_started",
    },
  },
  {
    actions: [
      {
        kind: "spawnFromObject",
        metadata: {
          launcherObjectId: "scout_shuttle",
          lifecycle: "research-pod-launch-from-scout",
          mobileUnit: true,
          role: "research-pod",
        },
        objectId: "research_pod_alpha",
        offset: {
          x: -1,
          y: 1,
        },
        presetId: "preset.research_pod",
        sourceObjectId: "scout_shuttle",
        state: "flying",
        tag: "research-pod",
      },
      {
        durationMs: 800,
        easing: "easeOut",
        kind: "moveToObject",
        offset: {
          x: -10,
          y: 10,
        },
        targetId: "research_pod_alpha",
        targetObjectId: "codebase_asteroid",
      },
      {
        delayMs: 800,
        durationMs: 4200,
        kind: "attachToObject",
        offset: {
          x: -10,
          y: 10,
        },
        targetId: "research_pod_alpha",
        targetObjectId: "codebase_asteroid",
      },
      {
        delayMs: 850,
        kind: "setState",
        state: "attached",
        targetId: "research_pod_alpha",
      },
      {
        kind: "spawnFromObject",
        metadata: {
          launcherObjectId: "scout_shuttle",
          lifecycle: "research-pod-launch-from-scout",
          mobileUnit: true,
          role: "research-pod",
        },
        objectId: "research_pod_beta",
        offset: {
          x: 1,
          y: -1,
        },
        presetId: "preset.research_pod",
        sourceObjectId: "scout_shuttle",
        state: "flying",
        tag: "research-pod",
      },
      {
        durationMs: 800,
        easing: "easeOut",
        kind: "moveToObject",
        offset: {
          x: 10,
          y: 8,
        },
        targetId: "research_pod_beta",
        targetObjectId: "codebase_asteroid",
      },
      {
        delayMs: 800,
        durationMs: 4200,
        kind: "attachToObject",
        offset: {
          x: 10,
          y: 8,
        },
        targetId: "research_pod_beta",
        targetObjectId: "codebase_asteroid",
      },
      {
        delayMs: 850,
        kind: "setState",
        state: "attached",
        targetId: "research_pod_beta",
      },
      {
        kind: "spawnFromObject",
        metadata: {
          launcherObjectId: "scout_shuttle",
          lifecycle: "research-pod-launch-from-scout",
          mobileUnit: true,
          role: "research-pod",
        },
        objectId: "research_pod_gamma",
        offset: {
          x: 0,
          y: 2,
        },
        presetId: "preset.research_pod",
        sourceObjectId: "scout_shuttle",
        state: "flying",
        tag: "research-pod",
      },
      {
        durationMs: 800,
        easing: "easeOut",
        kind: "moveToObject",
        offset: {
          x: 0,
          y: 15,
        },
        targetId: "research_pod_gamma",
        targetObjectId: "codebase_asteroid",
      },
      {
        delayMs: 800,
        durationMs: 4200,
        kind: "attachToObject",
        offset: {
          x: 0,
          y: 15,
        },
        targetId: "research_pod_gamma",
        targetObjectId: "codebase_asteroid",
      },
      {
        delayMs: 850,
        kind: "setState",
        state: "attached",
        targetId: "research_pod_gamma",
      },
    ],
    id: "rule.space.research-pods-deployed",
    name: "Scout shuttle deploys research pods at the asteroid",
    when: {
      type: "scout_shuttle.deploy_research_pods",
    },
  },
  {
    actions: [
      {
        kind: "setState",
        state: "healthy",
        targetId: "database_freighter",
      },
      {
        kind: "setProperty",
        property: "metadata.repairProgress",
        targetId: "database_freighter",
        value: 1,
      },
      {
        kind: "removeObject",
        tag: "database-damage",
      },
      {
        kind: "removeObject",
        targetId: "database_repair_ring",
      },
    ],
    id: "rule.space.database-healthy",
    name: "Database freighter becomes healthy and clears repair effects",
    when: {
      "entity.id": "database_freighter",
      "transition.from": "recovering",
      "transition.to": "healthy",
      type: "monitoring.target.status_changed",
    },
  },
  {
    actions: [
      {
        durationMs: 450,
        easing: "easeInOut",
        kind: "moveToObject",
        metadata: {
          dockObjectId: "maintenance_shuttle",
          motion: "repair-drone-return",
        },
        targetId: "repair_drone_alpha",
        targetObjectId: "maintenance_shuttle",
      },
      {
        durationMs: 450,
        easing: "easeInOut",
        kind: "moveToObject",
        metadata: {
          dockObjectId: "maintenance_shuttle",
          motion: "repair-drone-return",
        },
        targetId: "repair_drone_beta",
        targetObjectId: "maintenance_shuttle",
      },
      {
        delayMs: 450,
        kind: "despawnAtObject",
        targetId: "repair_drone_alpha",
        targetObjectId: "maintenance_shuttle",
      },
      {
        delayMs: 450,
        kind: "despawnAtObject",
        targetId: "repair_drone_beta",
        targetObjectId: "maintenance_shuttle",
      },
    ],
    id: "rule.space.repair-drone-return",
    name: "Repair drones return to the maintenance shuttle and dock",
    when: {
      type: "repair_drones.return_started",
    },
  },
  {
    actions: [
      {
        kind: "setState",
        state: "returning",
        targetId: "maintenance_shuttle",
      },
      {
        kind: "hideRouteTrail",
        targetId: "maintenance_shuttle",
      },
      {
        durationMs: 900,
        easing: "easeInOut",
        kind: "moveToObject",
        metadata: {
          dockObjectId: "space_mothership",
          motion: "maintenance-return-home",
        },
        offset: {
          x: 7,
          y: 5,
        },
        targetId: "maintenance_shuttle",
        targetObjectId: "space_mothership",
      },
      {
        delayMs: 900,
        kind: "despawnAtObject",
        offset: {
          x: 7,
          y: 5,
        },
        targetId: "maintenance_shuttle",
        targetObjectId: "space_mothership",
      },
    ],
    id: "rule.space.maintenance-return",
    name: "Maintenance shuttle returns to mothership and docks",
    when: {
      type: "maintenance_shuttle.return_started",
    },
  },
  {
    actions: [
      {
        kind: "detachFromObject",
        targetId: "research_pod_alpha",
      },
      {
        kind: "detachFromObject",
        targetId: "research_pod_beta",
      },
      {
        kind: "detachFromObject",
        targetId: "research_pod_gamma",
      },
      {
        kind: "setState",
        state: "flying",
        targetId: "research_pod_alpha",
      },
      {
        kind: "setState",
        state: "flying",
        targetId: "research_pod_beta",
      },
      {
        kind: "setState",
        state: "flying",
        targetId: "research_pod_gamma",
      },
      {
        durationMs: 700,
        easing: "easeInOut",
        kind: "moveToObject",
        metadata: {
          dockObjectId: "scout_shuttle",
          motion: "research-pod-return",
        },
        targetId: "research_pod_alpha",
        targetObjectId: "scout_shuttle",
      },
      {
        durationMs: 700,
        easing: "easeInOut",
        kind: "moveToObject",
        metadata: {
          dockObjectId: "scout_shuttle",
          motion: "research-pod-return",
        },
        targetId: "research_pod_beta",
        targetObjectId: "scout_shuttle",
      },
      {
        durationMs: 700,
        easing: "easeInOut",
        kind: "moveToObject",
        metadata: {
          dockObjectId: "scout_shuttle",
          motion: "research-pod-return",
        },
        targetId: "research_pod_gamma",
        targetObjectId: "scout_shuttle",
      },
      {
        delayMs: 700,
        kind: "despawnAtObject",
        targetId: "research_pod_alpha",
        targetObjectId: "scout_shuttle",
      },
      {
        delayMs: 700,
        kind: "despawnAtObject",
        targetId: "research_pod_beta",
        targetObjectId: "scout_shuttle",
      },
      {
        delayMs: 700,
        kind: "despawnAtObject",
        targetId: "research_pod_gamma",
        targetObjectId: "scout_shuttle",
      },
    ],
    id: "rule.space.research-pod-return",
    name: "Research pods return to the scout shuttle and dock",
    when: {
      type: "research_pods.return_started",
    },
  },
  {
    actions: [
      {
        kind: "setState",
        state: "returning",
        targetId: "scout_shuttle",
      },
      {
        kind: "hideRouteTrail",
        targetId: "scout_shuttle",
      },
      {
        durationMs: 800,
        easing: "easeInOut",
        kind: "moveToObject",
        metadata: {
          dockObjectId: "space_mothership",
          motion: "scout-return-home",
        },
        offset: {
          x: 6,
          y: -3,
        },
        targetId: "scout_shuttle",
        targetObjectId: "space_mothership",
      },
      {
        delayMs: 800,
        kind: "despawnAtObject",
        offset: {
          x: 6,
          y: -3,
        },
        targetId: "scout_shuttle",
        targetObjectId: "space_mothership",
      },
    ],
    id: "rule.space.scout-return",
    name: "Scout shuttle returns to mothership and docks",
    when: {
      type: "scout_shuttle.return_started",
    },
  },
  {
    actions: [
      {
        kind: "setState",
        state: "idle",
        targetId: "space_mothership",
      },
      {
        kind: "setState",
        state: "idle",
        targetId: "launch_bay_carrier",
      },
      {
        kind: "setState",
        state: "idle",
        targetId: "codebase_asteroid",
      },
      {
        kind: "setState",
        state: "healthy",
        targetId: "database_freighter",
      },
    ],
    id: "rule.space.mission-completed",
    name: "Mission ends with all launched units docked",
    when: {
      type: "mission.completed",
    },
  },
];

export const spaceOperationsEventFeed: VisualEvent[] = [
  {
    entity: {
      id: "mission_001",
      kind: "mission",
      label: "Mission 001",
    },
    eventId: "evt-space-mission-started",
    payload: {
      objective: "scan-and-repair",
    },
    severity: "info",
    ts: 0,
    type: "mission.started",
  },
  {
    entity: {
      id: "scout_shuttle",
      kind: "scout_shuttle",
      label: "Scout Shuttle",
    },
    eventId: "evt-space-scout-launch-started",
    severity: "info",
    transition: {
      from: "docked",
      to: "flying",
    },
    ts: 500,
    type: "scout_shuttle.launch_started",
  },
  {
    entity: {
      id: "scout_shuttle",
      kind: "scout_shuttle",
      label: "Scout Shuttle",
    },
    eventId: "evt-space-scout-enroute",
    severity: "info",
    transition: {
      from: "flying",
      to: "enroute",
    },
    ts: 1500,
    type: "scout_shuttle.enroute_to_codebase",
  },
  {
    entity: {
      id: "database_freighter",
      kind: "database",
      label: "Database Freighter",
    },
    eventId: "evt-space-database-down",
    payload: {
      targetObjectId: "database_freighter",
    },
    severity: "critical",
    transition: {
      from: "healthy",
      to: "down",
    },
    ts: 2200,
    type: "monitoring.target.status_changed",
  },
  {
    entity: {
      id: "maintenance_shuttle",
      kind: "maintenance_shuttle",
      label: "Maintenance Shuttle",
    },
    eventId: "evt-space-maintenance-launch-started",
    severity: "info",
    transition: {
      from: "docked",
      to: "flying",
    },
    ts: 2500,
    type: "maintenance_shuttle.launch_started",
  },
  {
    entity: {
      id: "codebase_asteroid",
      kind: "codebase",
      label: "Asteroid Data Vault",
    },
    eventId: "evt-space-codebase-scan-started",
    payload: {
      launcherObjectId: "scout_shuttle",
      targetObjectId: "codebase_asteroid",
    },
    severity: "info",
    transition: {
      from: "idle",
      to: "scanning",
    },
    ts: 3000,
    type: "codebase.scan.started",
  },
  {
    entity: {
      id: "scanner_drone_group",
      kind: "drone_group",
      label: "Scanner Drones",
    },
    eventId: "evt-space-scanner-orbit-started",
    payload: {
      launcherObjectId: "scout_shuttle",
      targetObjectId: "codebase_asteroid",
    },
    severity: "info",
    ts: 4000,
    type: "scanner_drones.scan_orbit_started",
  },
  {
    entity: {
      id: "maintenance_shuttle",
      kind: "maintenance_shuttle",
      label: "Maintenance Shuttle",
    },
    eventId: "evt-space-maintenance-arrived",
    severity: "info",
    transition: {
      from: "flying",
      to: "holding",
    },
    ts: 5500,
    type: "maintenance_shuttle.arrived",
  },
  {
    entity: {
      id: "database_freighter",
      kind: "database",
      label: "Database Freighter",
    },
    eventId: "evt-space-database-damage-scan-started",
    payload: {
      launcherObjectId: "maintenance_shuttle",
      targetObjectId: "database_freighter",
    },
    severity: "warning",
    transition: {
      from: "down",
      to: "assessing",
    },
    ts: 6000,
    type: "database.damage_scan.started",
  },
  {
    entity: {
      id: "database_freighter",
      kind: "database",
      label: "Database Freighter",
    },
    eventId: "evt-space-database-repair-started",
    payload: {
      repairProgress: 0.45,
      targetObjectId: "database_freighter",
    },
    severity: "warning",
    transition: {
      from: "down",
      to: "recovering",
    },
    ts: 7000,
    type: "database.repair.started",
  },
  {
    entity: {
      id: "codebase_asteroid",
      kind: "codebase",
      label: "Asteroid Data Vault",
    },
    eventId: "evt-space-codebase-scan-completed",
    payload: {
      launcherObjectId: "scout_shuttle",
      targetObjectId: "codebase_asteroid",
    },
    severity: "info",
    transition: {
      from: "scanning",
      to: "idle",
    },
    ts: 8000,
    type: "codebase.scan.completed",
  },
  {
    entity: {
      id: "scanner_drone_group",
      kind: "drone_group",
      label: "Scanner Drones",
    },
    eventId: "evt-space-scanner-return-started",
    payload: {
      dockObjectId: "scout_shuttle",
      targetObjectId: "scout_shuttle",
    },
    severity: "info",
    ts: 8500,
    type: "scanner_drones.return_started",
  },
  {
    entity: {
      id: "scout_shuttle",
      kind: "scout_shuttle",
      label: "Scout Shuttle",
    },
    eventId: "evt-space-research-pods-deployed",
    payload: {
      launcherObjectId: "scout_shuttle",
      targetObjectId: "codebase_asteroid",
    },
    severity: "info",
    ts: 9000,
    type: "scout_shuttle.deploy_research_pods",
  },
  {
    entity: {
      id: "database_freighter",
      kind: "database",
      label: "Database Freighter",
    },
    eventId: "evt-space-database-recovered",
    payload: {
      repairProgress: 1,
      targetObjectId: "database_freighter",
    },
    severity: "info",
    transition: {
      from: "recovering",
      to: "healthy",
    },
    ts: 11000,
    type: "monitoring.target.status_changed",
  },
  {
    entity: {
      id: "repair_drone_group",
      kind: "drone_group",
      label: "Repair Drones",
    },
    eventId: "evt-space-repair-drones-return-started",
    payload: {
      dockObjectId: "maintenance_shuttle",
      targetObjectId: "maintenance_shuttle",
    },
    severity: "info",
    ts: 11500,
    type: "repair_drones.return_started",
  },
  {
    entity: {
      id: "maintenance_shuttle",
      kind: "maintenance_shuttle",
      label: "Maintenance Shuttle",
    },
    eventId: "evt-space-maintenance-return-started",
    severity: "info",
    transition: {
      from: "holding",
      to: "returning",
    },
    ts: 12000,
    type: "maintenance_shuttle.return_started",
  },
  {
    entity: {
      id: "research_pod_group",
      kind: "research_pod_group",
      label: "Research Pods",
    },
    eventId: "evt-space-research-pods-return-started",
    payload: {
      dockObjectId: "scout_shuttle",
      targetObjectId: "scout_shuttle",
    },
    severity: "info",
    ts: 13000,
    type: "research_pods.return_started",
  },
  {
    entity: {
      id: "scout_shuttle",
      kind: "scout_shuttle",
      label: "Scout Shuttle",
    },
    eventId: "evt-space-scout-return-started",
    severity: "info",
    transition: {
      from: "field_lab",
      to: "returning",
    },
    ts: 14000,
    type: "scout_shuttle.return_started",
  },
  {
    entity: {
      id: "mission_001",
      kind: "mission",
      label: "Mission 001",
    },
    eventId: "evt-space-mission-completed",
    payload: {
      allMobileUnitsDocked: true,
    },
    severity: "info",
    transition: {
      from: "running",
      to: "completed",
    },
    ts: 15000,
    type: "mission.completed",
  },
];

export const spaceOperationsScenario: ScenarioDocument = {
  assetPackId: spacePlaceholderPack.id,
  bindings: spaceOperationsBindingRules,
  description:
    "Preferred coherent local demo for source-driven launch, task, return, and docking lifecycles in a space operations theme.",
  events: spaceOperationsEventFeed,
  metadata: {
    kind: "local-demo",
    lifecycleRule: "launch-task-return-dock",
    presentation: "inline space placeholder sprite sheets",
    preferredDefault: true,
  },
  name: "Space Operations Scenario",
  scenarioId: "space-operations-scenario",
  scene: spaceOperationsScene,
  version: 1,
};
