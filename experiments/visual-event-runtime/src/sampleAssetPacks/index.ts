import type {
  AssetPackManifest,
  SpriteSheetAssetDefinition,
} from "../contracts";
import {
  navalRealisticFallbackSprites,
  navalRealisticPack,
} from "./navalRealisticPack";
import {
  navalPlaceholderFallbackSprites,
  navalPlaceholderPack,
} from "./navalPlaceholderPack";
import {
  spacePlaceholderFallbackSprites,
  spacePlaceholderPack,
} from "./spacePlaceholderPack";

export type LocalAssetPack = {
  manifest: AssetPackManifest;
  fallbackSpritesByAssetKey: Record<string, SpriteSheetAssetDefinition>;
  fallbackSourceByAssetKey?: Record<string, "builtin" | "placeholder">;
};

const navalRealisticDemoFallbackSprites = {
  ...navalRealisticFallbackSprites,
  ...navalPlaceholderFallbackSprites,
};

const navalRealisticFallbackSources = Object.fromEntries(
  Object.keys(navalRealisticDemoFallbackSprites).map((assetKey) => [
    assetKey,
    assetKey in navalPlaceholderFallbackSprites ? "placeholder" : "builtin",
  ]),
) as Record<string, "builtin" | "placeholder">;

const navalPlaceholderFallbackSources = Object.fromEntries(
  Object.keys(navalRealisticFallbackSprites).map((assetKey) => [
    assetKey,
    "builtin",
  ]),
) as Record<string, "builtin" | "placeholder">;

const spacePlaceholderFallbackSources = Object.fromEntries(
  Object.keys(spacePlaceholderFallbackSprites).map((assetKey) => [
    assetKey,
    "builtin",
  ]),
) as Record<string, "builtin" | "placeholder">;

export const localAssetPacks: LocalAssetPack[] = [
  {
    manifest: navalRealisticPack,
    fallbackSourceByAssetKey: navalRealisticFallbackSources,
    fallbackSpritesByAssetKey: navalRealisticDemoFallbackSprites,
  },
  {
    manifest: navalPlaceholderPack,
    fallbackSourceByAssetKey: navalPlaceholderFallbackSources,
    fallbackSpritesByAssetKey: navalRealisticFallbackSprites,
  },
  {
    manifest: spacePlaceholderPack,
    fallbackSourceByAssetKey: spacePlaceholderFallbackSources,
    fallbackSpritesByAssetKey: spacePlaceholderFallbackSprites,
  },
];
