import type { WidgetV2Manifest } from "./widgetV2Types";

export interface WidgetV2ManifestValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

function hasText(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasItems<T>(value: readonly T[] | undefined): boolean {
  return Array.isArray(value) && value.length > 0;
}

export function validateWidgetV2Manifest(
  manifest: WidgetV2Manifest,
): WidgetV2ManifestValidationResult {
  const errors: string[] = [];

  if (!hasText(manifest.kind)) {
    errors.push("Widget V2 manifest requires a non-empty kind.");
  }

  if (!hasText(manifest.name)) {
    errors.push("Widget V2 manifest requires a non-empty name.");
  }

  if (!hasText(manifest.productRole)) {
    errors.push("Widget V2 manifest requires a non-empty product role.");
  }

  if (!hasItems(manifest.capabilities)) {
    errors.push("Widget V2 manifest requires at least one capability.");
  }

  if (!hasItems(manifest.supportedLayoutKinds)) {
    errors.push("Widget V2 manifest requires at least one supported layout kind.");
  }

  if (!hasItems(manifest.requiredPanelSlots)) {
    errors.push("Widget V2 manifest requires at least one required panel slot.");
  }

  for (const action of manifest.actions ?? []) {
    if (!hasText(action.type)) {
      errors.push("Widget V2 manifest actions require non-empty action types.");
    }

    if (!hasText(action.label)) {
      errors.push("Widget V2 manifest actions require non-empty labels.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function assertUniqueWidgetV2Kinds(
  manifests: readonly WidgetV2Manifest[],
): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const manifest of manifests) {
    const kind = manifest.kind.trim();

    if (seen.has(kind)) {
      duplicates.add(kind);
    }

    seen.add(kind);
  }

  if (duplicates.size > 0) {
    throw new Error(
      `Duplicate Widget V2 manifest kind(s): ${Array.from(duplicates).join(", ")}`,
    );
  }
}
