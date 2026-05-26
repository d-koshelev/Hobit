import type { GenerateCoordinatorProviderResponse } from "../workspace/types";

export function providerResponseAllowsCatalogDrafts(
  response: GenerateCoordinatorProviderResponse | null,
) {
  return Boolean(
    response &&
      response.providerStatus === "completed" &&
      response.allowedTools.length === 0 &&
      response.noToolsExecuted &&
      response.noMutationsPerformed &&
      response.noHiddenContextUsed,
  );
}

export function errorToMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
