# Naval Placeholder V1 Asset Pack

This pack is a temporary, low-fidelity local fallback for the visual event runtime demo.

Expected structure:

```text
public/asset-packs/naval-placeholder-v1/
  manifest.json
  source-manifest.json
  clips/
  previews/
  spritesheets/
  README.md
```

The included sprite sheets were supplied as a temporary naval pack:

- `hobit_deck_fighter_v1_spritesheet.png`
- `hobit_aircraft_carrier_v1_spritesheet.png`
- `hobit_escort_destroyer_v1_spritesheet.png`
- `hobit_support_freighter_v1_spritesheet.png`

This pack is intentionally not `naval-realistic-v1`. It exists so the zero-setup demo can render visible naval objects while future high-fidelity transparent PNG sprite sheets are still absent.

The default demo attempts `naval-realistic-v1` assets first, uses these placeholder sheets for provided naval objects when realistic PNGs are missing, and falls back to built-in debug sprites for effects or temporary gaps.
