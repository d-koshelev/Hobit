# Hobit Visual Event Runtime Prototype

This directory is an isolated local prototype. It is a standalone Vite + React + TypeScript app and is not wired into the Hobit desktop app, Tauri runtime, Queue, agents, storage, backend, APIs, or WebSockets.

The prototype consumes local sample data only:

- scenario documents;
- scene config;
- local asset-pack manifests;
- asset definitions;
- sprite-sheet animation clips;
- visual events;
- binding rules.

Hobit core and the visual layer are expected to communicate only through a future event feed contract. This prototype sketches the visual-side contract in browser-local data. No production integration exists yet.

## Scenario Documents

A `ScenarioDocument` is a complete local demo scenario:

```ts
{
  version: number;
  scenarioId: string;
  name: string;
  description?: string;
  assetPackId: string;
  scene: SceneConfig;
  bindings: BindingRule[];
  events: VisualEvent[];
  metadata?: Record<string, unknown>;
}
```

The preferred bundled sample scenario is `Space Operations Scenario`. It includes a mothership, launch bay carrier, scout shuttle, maintenance shuttle, asteroid data vault, database freighter, scanner drones, repair drones, research pods, and local outage/recovery events. It is the default because spacecraft, drones, pods, repair, and return-to-carrier behavior naturally show a coherent lifecycle.

`Naval Incident Scenario` remains available from the scenario selector as the older sample.

The lifecycle rule for the preferred demo is:

```text
launch from a visible source -> perform the task -> return to home/source -> dock/despawn at that source
```

No active mobile visual unit in the space scenario is spawned at its task target or removed at its task target.

## Asset Packs

Asset packs are local and presentation-only. They do not change canonical event/runtime behavior, state transitions, or business rules. The selected pack only changes which visual assets and animation clips the prototype can render.

The public folder convention is:

```text
public/asset-packs/naval-realistic-v1/
  manifest.json
  spritesheets/
  previews/
  README.md

public/asset-packs/naval-placeholder-v1/
  manifest.json
  source-manifest.json
  clips/
  spritesheets/
  previews/
  README.md
```

The runtime does not fetch manifests. While this experiment remains isolated, known packs are statically imported from `src/sampleAssetPacks/`.

The default demo selects `space-placeholder-v1`, which is an inline deterministic SVG sprite-sheet pack. It does not require public PNG files. The naval packs remain available for the older scenario; `naval-realistic-v1` attempts high-fidelity assets first and can fall back to `naval-placeholder-v1` and built-in debug sprites when those PNGs are not present.

Built-in fallback sprites, `space-placeholder-v1`, and `naval-placeholder-v1` are zero-setup demo aids. High-fidelity assets should be produced externally and imported through a matching asset-pack manifest later.

The `Asset Pack Health` panel reports selected pack identity, asset/clip/preset counts, broken manifest references, currently used scenario assets, missing observed high-fidelity PNGs, and fallback usage. Missing PNGs do not break the prototype while fallback sprites are available, but they should be resolved before a polished demo.

The `Presentation Readiness` checklist checks whether the current active scenario has objects, events, bindings, unique object and event IDs, valid animation references, resolvable binding targets, and Presenter Mode available.

## Sprite Sheets

Sprite sheets are the primary animation format from the beginning. The runtime chooses the displayed frame from elapsed timeline time:

```ts
frame = Math.floor((elapsedMs / 1000) * fps)
```

Loop clips wrap with `frame % frameCount`. One-shot clips clamp to `frameCount - 1`.

GIFs are not the core runtime format because replay, pause, speed changes, and timeline scrubbing require deterministic frame control. Future event replay should drive animation time from timeline time, not from uncontrolled media playback.

## Replay Demo

Run locally:

```bash
npm install
npm run dev
```

Open the Vite URL and use:

- the left-side `Scenario` selector to switch between `Space Operations Scenario` and `Naval Incident Scenario`;
- the left-side `Replay` panel to play, pause, restart, change speed, or scrub virtual time;
- the left-side `Event Timeline` panel to inspect the local semantic event feed;
- the left-side `Asset Pack` panel to select a local pack and inspect assets/clips;
- the right-side `Asset Pack Health` and `Presentation Readiness` panels to verify demo readiness;
- the right-side `Dispatched Events` panel to see events already crossed by virtual time;
- the right-side `Binding Rules` panel to inspect rule conditions and configured actions;
- the right-side `Sprite Preview` panel to choose a clip, play or pause, and scrub elapsed time.

## Authoring Mode

Use the `Mode` switch to move between `Replay` and `Authoring`.

Replay Mode consumes the current draft scene, draft bindings, and draft event feed. Authoring Mode pauses replay automatically and lets you edit those draft inputs without mutating the original sample constants.

In Authoring Mode:

- select an object on the stage or in the editor;
- drag an object on the stage to update its `x` and `y`;
- edit object fields including `id`, `entityId`, `kind`, name, asset key, animation, size, rotation, z-index, visual state, hidden flag, and metadata JSON;
- add objects from the selected asset-pack preset palette;
- duplicate or delete the selected object.

`entityId` is the semantic event identity. Binding actions can target either object `id` or `entityId`.

Path authoring:

- click `Start path`;
- click points on the stage to append path points;
- use `Copy path JSON` to copy a `moveAlongPath`-compatible point array;
- use `Clear path` to reset the draft path.

Binding authoring:

- add or select a binding rule;
- edit `when.type`, `when.entity.id`, `when.entity.kind`, and `when.transition.to`;
- add common action types such as `setState`, `showObject`, `hideObject`, `playAnimation`, `spawnFromObject`, `moveToObject`, `moveAlongPath`, `orbitAround`, `attachToObject`, `despawnAtObject`, `spawnEffect`, `spawnAttachedEffect`, `removeObject`, `showRouteTrail`, and `hideRouteTrail`;
- configure targets, presets, animation IDs, state values, and path JSON in the action list.

Import/export is browser-local only:

- `Apply scenario to replay` copies the current authored draft into the active replay inputs;
- `Export scenario` / `Import scenario` as one complete Scenario JSON file;
- `Export scene` / `Import scene`;
- `Export bindings` / `Import bindings`;
- `Export events` / `Import events` as JSONL.

Scenario import updates the authoring draft only. Use `Apply scenario to replay` to make that imported scenario active in Replay or Presenter Mode. The narrower scene/bindings/events imports retain the existing behavior of updating both draft and replay inputs. Exports write the current draft data.

After editing, click `Apply scenario to replay`, then switch back to Replay Mode and press `Restart` or scrub the timeline. Replay remains data-driven from the active `SceneConfig`, `BindingRule[]`, and `VisualEvent[]`.

Roundtrip fixture tests cover scene JSON, bindings JSON, and event feed JSONL serialization. Authoring validation warns for duplicate object IDs, duplicate `entityId` values, duplicate binding rule IDs, missing assets, missing animations, missing binding targets, invalid path points, invalid track durations, and missing presets.

Event authoring:

- select an event from the ordered authoring list;
- add events from templates such as `agent.run.started`, `queue.item.started`, `codebase.scan.started`, `monitoring.target.status_changed`, and `queue.item.completed`;
- edit `eventId`, `ts`, `offsetMs`, `type`, entity fields, transition fields, severity, and payload JSON;
- `offsetMs` is converted deterministically to `ts` from scenario start and exported with the event.

Scenario validation also warns for duplicate event IDs, invalid event timestamps or offsets, unsorted imported events, missing event type/entity fields, and unknown `assetPackId`.

## Presenter Mode

Presenter Mode hides the authoring/debug side panels and shows the stage with minimal replay controls: play/pause, restart, speed, and current time. Captions are optional and off by default.

Keyboard shortcuts in Presenter Mode:

- Space: play/pause;
- `R`: restart;
- `1`, `2`, `5`: set speed.

The default Space Operations event feed replays:

- `mission.started`;
- `scout_shuttle.launch_started`;
- `scout_shuttle.enroute_to_codebase`;
- `monitoring.target.status_changed` for `database_freighter` healthy to down;
- `maintenance_shuttle.launch_started`;
- `codebase.scan.started`;
- `scanner_drones.scan_orbit_started`;
- `maintenance_shuttle.arrived`;
- `database.damage_scan.started`;
- `database.repair.started`;
- `codebase.scan.completed`;
- `scanner_drones.return_started`;
- `scout_shuttle.deploy_research_pods`;
- `monitoring.target.status_changed` for `database_freighter` recovering to healthy;
- `repair_drones.return_started`;
- `maintenance_shuttle.return_started`;
- `research_pods.return_started`;
- `scout_shuttle.return_started`;
- `mission.completed`.

Binding rules transform those semantic events into visual actions such as `setState`, `showObject`, `spawnFromObject`, `moveToObject`, `orbitAround`, `despawnAtObject`, `spawnEffect`, `removeObject`, and `setProperty`. The binding engine only evaluates dot-path rule conditions and applies configured actions; it does not hardcode Hobit, Queue, agent, or workspace business logic.

`SceneConfig`, `VisualEvent[]`, and `BindingRule[]` are immutable inputs. `SceneRuntimeState` is derived from those inputs at the selected virtual time, which makes restart and backward/forward scrubbing deterministic.

## Motion Tracks

Events can create visual tracks through binding actions such as `moveAlongPath`, `moveToObject`, `orbitAround`, `attachToObject`, `spawnAttachedEffect`, `showRouteTrail`, and `hideRouteTrail`.

Tracks are sampled from virtual replay time. The renderer does not use uncontrolled CSS keyframe animation for runtime movement. Play speed changes only affect how quickly virtual time advances; they do not change sampled positions or final motion results.

The Space Operations lifecycle is data-driven:

- `scout_shuttle.launch_started` spawns the scout shuttle from `space_mothership`, moves it to `codebase_asteroid`, and leaves it visible as the source for later child units;
- `codebase.scan.started` spawns scanner drones from the sampled virtual-time position of `scout_shuttle`, then moves them to `codebase_asteroid`;
- `scanner_drones.scan_orbit_started` orbits those drones around `codebase_asteroid`;
- `scanner_drones.return_started` moves scanner drones back to `scout_shuttle` and despawns them only at the shuttle;
- `scout_shuttle.deploy_research_pods` spawns research pods from `scout_shuttle`, attaches them to the asteroid field-lab area, and `research_pods.return_started` returns them to the shuttle before it leaves;
- `maintenance_shuttle.launch_started` spawns the maintenance shuttle from `space_mothership`, moves it to `database_freighter`, and waits while repair drones work;
- `database.damage_scan.started` spawns repair drones from the sampled virtual-time position of `maintenance_shuttle`, then `repair_drones.return_started` returns them to the maintenance shuttle and docks them there;
- `maintenance_shuttle.return_started` and `scout_shuttle.return_started` return each shuttle to `space_mothership` and despawn them at the mothership.

The demo also shows database freighter damage as an explosion plus attached smoke/damage effect, repair as an attached repair ring, and recovery as a healthy freighter state after repair completion.

If a future PNG sprite sheet is missing from `public/asset-packs/naval-realistic-v1/spritesheets/`, the UI shows an Asset Pack Health warning and uses the temporary placeholder pack or a recognizable built-in fallback sprite.

Build check:

```bash
npm run build -- --emptyOutDir
```

## Production Assets

See [docs/ASSET_PRODUCTION_PIPELINE.md](docs/ASSET_PRODUCTION_PIPELINE.md) for the visual bible, recommended resolutions, transparent PNG requirements, and packing workflow.

`space-placeholder-v1` is inline for this experiment, so it has no public PNG production folder yet. If the space scenario graduates beyond placeholder assets, add a public space asset pack and mirror it in `src/sampleAssetPacks/` while this prototype remains static-import only.

Replace temporary placeholders by dropping high-fidelity transparent PNG sprite sheets into:

```text
public/asset-packs/naval-realistic-v1/spritesheets/
```

Use filenames matching the asset keys, such as `coordinator_carrier_idle.png`, `queue_carrier_idle.png`, `deck_fighter_flying.png`, `db_ship_healthy.png`, `db_ship_down.png`, `db_ship_recovering.png`, `codebase_target.png`, `support_ship_healthy.png`, `oil_rig_idle.png`, `explosion_once.png`, `smoke_loop.png`, `repair_dock_loop.png`, `scanner_drone_loop.png`, and `scan_ring_loop.png`.

The v1 layout expects horizontal strips: `columns = frameCount`, `rows = 1`. Keep transparent backgrounds, near-orthographic camera, consistent lighting/scale, and no text or UI baked into assets.

Validate manifest references and expected filenames with:

```bash
npm run validate:assets
```

The validator checks every public asset-pack manifest. It reports missing `naval-realistic-v1` PNGs as warnings while placeholder fallbacks remain in use. It does not inspect PNG dimensions yet; verify dimensions manually or in the packing tool.

## Boundaries

- Do not import Hobit workspace, Queue, agent, storage, backend, or Tauri code here.
- Do not add routes from the desktop app to this experiment.
- Do not connect this prototype to Hobit APIs or WebSockets.
- Do not add monetization or marketplace logic.
- Keep scene config, assets, animation clips, sample events, and binding rules local until a real event feed contract is designed.

Future Hobit integration should provide a durable event feed with the same semantic shape as the local `VisualEvent[]`. The visual runtime should remain a consumer of that event contract, not a source of canonical product behavior.
