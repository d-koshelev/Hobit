import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const assetPacksDir = join(root, "public", "asset-packs");
const manifestPaths = readdirSync(assetPacksDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(assetPacksDir, entry.name, "manifest.json"))
  .filter((manifestPath) => existsSync(manifestPath));
const errors = [];
const warnings = [];
const totals = {
  assets: 0,
  clips: 0,
  manifests: 0,
  presets: 0,
};

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      repeated.add(value);
    }

    seen.add(value);
  }

  return [...repeated];
}

function isPositive(value) {
  return Number.isFinite(value) && value > 0;
}

function isExternalSource(src) {
  return (
    src.startsWith("data:") ||
    src.startsWith("blob:") ||
    src.startsWith("http://") ||
    src.startsWith("https://")
  );
}

for (const manifestPath of manifestPaths) {
  const manifestDir = dirname(manifestPath);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const prefix = manifest.id ?? manifestPath;

  totals.assets += manifest.assets.length;
  totals.clips += manifest.animations.length;
  totals.manifests += 1;
  totals.presets += manifest.objectPresets?.length ?? 0;

  for (const duplicate of duplicates(manifest.assets.map((asset) => asset.key))) {
    errors.push(`${prefix}: Duplicate asset key: ${duplicate}`);
  }

  for (const duplicate of duplicates(manifest.animations.map((clip) => clip.id))) {
    errors.push(`${prefix}: Duplicate animation clip id: ${duplicate}`);
  }

  const assetKeys = new Set(manifest.assets.map((asset) => asset.key));
  const animationIds = new Set(manifest.animations.map((clip) => clip.id));

  for (const clip of manifest.animations) {
    if (!assetKeys.has(clip.assetKey)) {
      errors.push(`${prefix}: ${clip.id} references missing asset ${clip.assetKey}`);
    }

    for (const field of ["frameWidth", "frameHeight", "frameCount", "fps"]) {
      if (!isPositive(clip[field])) {
        errors.push(`${prefix}: ${clip.id} has invalid ${field}`);
      }
    }
  }

  for (const preset of manifest.objectPresets ?? []) {
    if (!assetKeys.has(preset.defaultAssetKey)) {
      errors.push(
        `${prefix}: ${preset.id} references missing asset ${preset.defaultAssetKey}`,
      );
    }

    if (
      preset.defaultAnimationId &&
      !animationIds.has(preset.defaultAnimationId)
    ) {
      errors.push(
        `${prefix}: ${preset.id} references missing animation ${preset.defaultAnimationId}`,
      );
    }

    for (const [state, animationId] of Object.entries(
      preset.animationsByState ?? {},
    )) {
      if (!animationIds.has(animationId)) {
        errors.push(
          `${prefix}: ${preset.id} maps ${state} to missing animation ${animationId}`,
        );
      }
    }
  }

  for (const asset of manifest.assets) {
    if (asset.kind !== "spriteSheet" || isExternalSource(asset.src)) {
      continue;
    }

    const assetPath = asset.src.startsWith("/")
      ? join(root, "public", asset.src.replace(/^\/+/, ""))
      : join(manifestDir, asset.src);

    if (!existsSync(assetPath)) {
      warnings.push(`${prefix}: ${asset.key} missing PNG: ${asset.src}`);
    }
  }
}

if (errors.length === 0) {
  console.log("Asset manifest references are structurally valid.");
} else {
  console.error("Asset manifest errors:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
}

if (warnings.length > 0) {
  console.warn("Asset file warnings:");
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

console.log(
  `Checked ${totals.manifests} manifests, ${totals.assets} assets, ${totals.clips} clips, ${totals.presets} presets.`,
);

process.exitCode = errors.length > 0 ? 1 : 0;
