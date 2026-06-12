export function explicitQueueCommandWorkspaceRoot(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "~" || trimmed === ".") {
    return null;
  }

  return trimmed;
}
