# Asset Production Pipeline

This prototype is prepared for externally produced, presentation-quality sprite sheets. The runtime should not generate final art in code. Code-generated sprites are technical placeholders only.

## Visual Bible

Style: realistic 2.5D naval operations.

Camera: near-orthographic, slightly elevated, consistent across all objects. Avoid dramatic perspective, wide-angle distortion, and inconsistent object tilt.

Lighting: consistent direction, contrast, and color temperature across the whole pack. Use one shared lighting setup for carriers, ships, aircraft, rigs, and effects.

Scale: keep object scale coherent. A fighter should read as smaller than a support ship; a support ship should read as smaller than a carrier.

Asset contents: no text, labels, icons, UI panels, watermarks, borders, or status badges inside the rendered asset. UI state belongs in the runtime layer.

Background: transparent PNG only. Do not bake ocean, grid, glow cards, UI backgrounds, or scene shadows into base object sprite sheets unless the asset is explicitly an effect overlay.

## Recommended Frame Sizes

- Carrier: 512 or 1024 px per frame.
- Small ships: 256 or 512 px per frame.
- Fighter/drone: 128 or 256 px per frame.
- Effects: 256 or 512 px per frame.

Use one frame size per sprite sheet. Pack frames in row-major order and record `frameWidth`, `frameHeight`, `frameCount`, `columns`, and `rows` in the asset-pack manifest.

## Base Object And Effect Overlay Rule

Base ships and objects should be separate from smoke, fire, explosion, repair dock, and scanner effects.

Examples:

- `db_ship_healthy` is a base object.
- `db_ship_down` may be a damaged base object, but heavy smoke should usually be `smoke_loop`.
- `explosion_once` is a one-shot effect overlay.
- `repair_dock_loop` is an effect overlay.
- `scanner_drone_loop` is an object animation if the drone itself moves; scanner rings should be separate overlays when they need independent timing.

This separation keeps event replay deterministic. Timeline time can drive object state and effect overlays independently.

## Recommended Tools

- ChatGPT Images for quick isolated object concepts.
- Blender for consistent production-quality renders.
- Krita or GIMP for cleanup.
- Python/Pillow or ImageMagick for packing frames into sprite sheets.

## Export Checklist

- Transparent PNG sprite sheet.
- No text, labels, UI, or watermarks.
- Near-orthographic camera.
- Consistent lighting, camera, and scale.
- One frame size per sheet.
- Frames packed left to right, then top to bottom if multiple rows are needed.
- Manifest updated with final frame dimensions, frame count, fps, playback mode, and asset key.

## Import Steps

1. Export each sprite sheet as a transparent PNG.
2. Place PNG files under `public/asset-packs/naval-realistic-v1/spritesheets/`.
3. Keep file names aligned with manifest asset keys, for example `db_ship_healthy.png`.
4. Update `public/asset-packs/naval-realistic-v1/manifest.json` if frame dimensions, counts, fps, or clip IDs change.
5. Mirror the same manifest changes in `src/sampleAssetPacks/navalRealisticPack.ts` while this prototype remains static-import only.
6. Run `npm.cmd run build -- --emptyOutDir`.

## Replacing Placeholder Sprite Sheets

Place final PNG sprite sheets here:

```text
public/asset-packs/naval-realistic-v1/spritesheets/
```

Use these filenames for the current v1 manifest:

```text
coordinator_carrier_idle.png
queue_carrier_idle.png
deck_fighter_flying.png
db_ship_healthy.png
db_ship_down.png
db_ship_recovering.png
codebase_target.png
support_ship_healthy.png
oil_rig_idle.png
explosion_once.png
smoke_loop.png
repair_dock_loop.png
scanner_drone_loop.png
scan_ring_loop.png
```

Frame layout for v1:

- horizontal strip preferred;
- `columns = frameCount`;
- `rows = 1`;
- every frame in a sheet must use the same `frameWidth` and `frameHeight`;
- update both manifest copies if dimensions, frame count, or fps change.

Final asset requirements:

- transparent PNG;
- near-orthographic render;
- consistent camera, lighting, and scale across the pack;
- no text, labels, watermarks, borders, UI, or status badges inside assets.

Validate references with:

```bash
npm run validate:assets
```

The validator checks manifest references and reports missing expected PNG files. It does not inspect PNG dimensions yet; confirm dimensions manually in the image tool or packing script before demo use.
