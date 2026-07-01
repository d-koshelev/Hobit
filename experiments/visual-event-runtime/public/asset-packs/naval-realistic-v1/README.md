# Naval Realistic V1 Asset Pack

This folder is the local presentation asset-pack convention for the visual event runtime prototype.

Expected structure:

```text
public/asset-packs/naval-realistic-v1/
  manifest.json
  spritesheets/
  previews/
  README.md
```

The current manifest references expected future high-fidelity PNG sprite sheets. Those production assets are not committed yet. During prototype preview, the statically imported sample pack uses this manifest shape and the runtime falls back to recognizable built-in sprite sheets when the PNG files are missing.

Place final transparent PNG sprite sheets in `spritesheets/` using the keys from `manifest.json`, for example `db_ship_healthy.png` or `explosion_once.png`.
