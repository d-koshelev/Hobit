import type { BindingRule } from "../contracts";

export const sampleBindingRules: BindingRule[] = [
  {
    id: "rule.agent-run-started",
    name: "Agent run starts fighter route",
    description:
      "Shows the request fighter and starts its flying visual state.",
    when: {
      type: "agent.run.started",
    },
    actions: [
      {
        kind: "showObject",
        targetId: "request_fighter",
      },
      {
        kind: "setState",
        targetId: "request_fighter",
        state: "flying",
      },
      {
        kind: "setProperty",
        targetId: "request_fighter",
        property: "metadata.routeProgress",
        value: 0.1,
      },
      {
        kind: "showRouteTrail",
        targetId: "request_fighter",
        path: [
          { x: 20, y: 62 },
          { x: 31, y: 55 },
          { x: 38, y: 44 },
          { x: 40, y: 36 },
        ],
      },
      {
        kind: "moveAlongPath",
        targetId: "request_fighter",
        path: [
          { x: 20, y: 62 },
          { x: 31, y: 55 },
          { x: 38, y: 44 },
          { x: 40, y: 36 },
        ],
        durationMs: 5200,
        easing: "easeInOut",
        metadata: {
          motion: "carrier-to-scan-staging",
        },
      },
    ],
  },
  {
    id: "rule.queue-item-started",
    name: "Queue item activates carrier",
    description: "Marks the queue carrier as active.",
    when: {
      type: "queue.item.started",
    },
    actions: [
      {
        kind: "setState",
        targetId: "queue_carrier",
        state: "active",
      },
    ],
  },
  {
    id: "rule-codebase-scan-started",
    name: "Codebase scan spawns scanner effects",
    description:
      "Launches scanner drones from the active request fighter and starts a scan ring on the codebase target.",
    when: {
      type: "codebase.scan.started",
      "entity.id": "codebase_target",
    },
    actions: [
      {
        kind: "setState",
        targetId: "codebase_target",
        state: "scanning",
      },
      {
        kind: "spawnFromObject",
        presetId: "preset.scanner_drone",
        objectId: "scan_drone_alpha",
        sourceObjectId: "request_fighter",
        tag: "scan-drone",
        state: "scanning",
        metadata: {
          layer: "scanner-drone-alpha",
          launcherObjectId: "request_fighter",
        },
      },
      {
        kind: "moveToObject",
        targetId: "scan_drone_alpha",
        targetObjectId: "codebase_target",
        durationMs: 1600,
        easing: "easeOut",
        metadata: {
          motion: "scan-drone-approach",
          targetObjectId: "codebase_target",
        },
      },
      {
        kind: "orbitAround",
        targetId: "scan_drone_alpha",
        targetObjectId: "codebase_target",
        radius: 8,
        speed: 1.5,
        durationMs: 3700,
        delayMs: 1600,
      },
      {
        kind: "spawnFromObject",
        presetId: "preset.scanner_drone",
        objectId: "scan_drone_beta",
        sourceObjectId: "request_fighter",
        tag: "scan-drone",
        state: "scanning",
        metadata: {
          layer: "scanner-drone-beta",
          launcherObjectId: "request_fighter",
        },
      },
      {
        kind: "moveToObject",
        targetId: "scan_drone_beta",
        targetObjectId: "codebase_target",
        durationMs: 1800,
        easing: "easeOut",
        metadata: {
          motion: "support-scan-approach",
          targetObjectId: "codebase_target",
        },
      },
      {
        kind: "orbitAround",
        targetId: "scan_drone_beta",
        targetObjectId: "codebase_target",
        radius: 12,
        speed: 1,
        durationMs: 3500,
        delayMs: 1800,
      },
      {
        kind: "spawnAttachedEffect",
        presetId: "preset.scan_ring_effect",
        targetId: "codebase_target",
        objectId: "codebase_scan_ring",
        tag: "scan-ring",
        offset: {
          x: 0,
          y: 5,
        },
        metadata: {
          layer: "scan-ring",
        },
      },
    ],
  },
  {
    id: "rule-codebase-scan-completed",
    name: "Codebase scan docks scanner drones",
    description:
      "Stops the scan ring, returns scanner drones to the active request fighter, and despawns them at docking.",
    when: {
      type: "codebase.scan.completed",
      "entity.id": "codebase_target",
    },
    actions: [
      {
        kind: "setState",
        targetId: "codebase_target",
        state: "idle",
      },
      {
        kind: "removeObject",
        targetId: "codebase_scan_ring",
      },
      {
        kind: "moveToObject",
        targetId: "scan_drone_alpha",
        targetObjectId: "request_fighter",
        durationMs: 1500,
        easing: "easeInOut",
        metadata: {
          motion: "scan-drone-return",
          dockObjectId: "request_fighter",
        },
      },
      {
        kind: "moveToObject",
        targetId: "scan_drone_beta",
        targetObjectId: "request_fighter",
        durationMs: 1500,
        easing: "easeInOut",
        metadata: {
          motion: "scan-drone-return",
          dockObjectId: "request_fighter",
        },
      },
      {
        kind: "despawnAtObject",
        targetId: "scan_drone_alpha",
        targetObjectId: "request_fighter",
        delayMs: 1500,
      },
      {
        kind: "despawnAtObject",
        targetId: "scan_drone_beta",
        targetObjectId: "request_fighter",
        delayMs: 1500,
      },
    ],
  },
  {
    id: "rule-database-down",
    name: "Database ship goes down",
    description:
      "Spawns explosion, then switches the database ship to down and starts smoke.",
    when: {
      type: "monitoring.target.status_changed",
      "entity.id": "database_123",
      "transition.from": "healthy",
      "transition.to": "down",
      severity: "critical",
    },
    actions: [
      {
        kind: "spawnEffect",
        presetId: "preset.explosion_effect",
        targetId: "database_123",
        tag: "database-explosion",
        lifetimeMs: 850,
        metadata: {
          overlay: "explosion",
        },
      },
      {
        kind: "setState",
        targetId: "database_123",
        state: "down",
        delayMs: 850,
      },
      {
        kind: "spawnAttachedEffect",
        presetId: "preset.smoke_effect",
        targetId: "database_123",
        tag: "database-smoke",
        offset: {
          x: 5,
          y: -8,
        },
        delayMs: 850,
        metadata: {
          overlay: "smoke",
        },
      },
    ],
  },
  {
    id: "rule-database-recovering",
    name: "Database ship starts recovering",
    description:
      "Switches to recovering, reduces smoke, and spawns repair effects.",
    when: {
      type: "monitoring.target.status_changed",
      "entity.id": "database_123",
      "transition.from": "down",
      "transition.to": "recovering",
    },
    actions: [
      {
        kind: "setState",
        targetId: "database_123",
        state: "recovering",
      },
      {
        kind: "setProperty",
        targetId: "database_123",
        property: "metadata.repairProgress",
        value: 0.35,
      },
      {
        kind: "setProperty",
        targetId: "database_123",
        property: "opacity",
        value: 0.95,
      },
      {
        kind: "removeObject",
        tag: "database-smoke",
        delayMs: 500,
      },
      {
        kind: "spawnAttachedEffect",
        presetId: "preset.repair_dock_effect",
        targetId: "database_123",
        tag: "database-repair",
        offset: {
          x: -4,
          y: 8,
        },
        metadata: {
          overlay: "repair",
        },
      },
      {
        kind: "spawnObject",
        presetId: "preset.scanner_drone",
        objectId: "repair_drone_alpha",
        targetId: "database_123",
        tag: "database-repair",
        state: "scanning",
        x: 63,
        y: 46,
        metadata: {
          layer: "repair-drone",
        },
      },
      {
        kind: "orbitAround",
        targetId: "repair_drone_alpha",
        targetObjectId: "database_123",
        radius: 11,
        speed: 1.2,
        durationMs: 3600,
      },
    ],
  },
  {
    id: "rule-database-healthy",
    name: "Database ship returns healthy",
    description: "Restores healthy state and removes repair/smoke overlays.",
    when: {
      type: "monitoring.target.status_changed",
      "entity.id": "database_123",
      "transition.from": "recovering",
      "transition.to": "healthy",
    },
    actions: [
      {
        kind: "setState",
        targetId: "database_123",
        state: "healthy",
      },
      {
        kind: "setProperty",
        targetId: "database_123",
        property: "metadata.repairProgress",
        value: 1,
      },
      {
        kind: "removeObject",
        tag: "database-repair",
      },
    ],
  },
  {
    id: "rule-queue-item-completed",
    name: "Queue item completes",
    description:
      "Marks the fighter complete and returns the queue carrier to idle.",
    when: {
      type: "queue.item.completed",
      "payload.activeItems": 0,
    },
    actions: [
      {
        kind: "setState",
        targetId: "request_fighter",
        state: "completed",
      },
      {
        kind: "setProperty",
        targetId: "request_fighter",
        property: "metadata.routeProgress",
        value: 1,
      },
      {
        kind: "hideRouteTrail",
        targetId: "request_fighter",
      },
      {
        kind: "setState",
        targetId: "queue_carrier",
        state: "idle",
      },
      {
        kind: "setState",
        targetId: "codebase_target",
        state: "idle",
      },
    ],
  },
];
