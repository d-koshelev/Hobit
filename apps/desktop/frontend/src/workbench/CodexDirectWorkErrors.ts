import { unknownErrorToMessage } from "../workspace/errorDetails";

const DIRECT_WORK_ERROR_FALLBACK = "Unable to run Codex Direct Work.";

export function codexDirectWorkErrorToMessage(error: unknown): string {
  return unknownErrorToMessage(error, DIRECT_WORK_ERROR_FALLBACK);
}

export function streamingFallbackSuccessMessage(
  streamingErrorMessage: string,
): string {
  return [
    "Streaming start failed before a run id was returned.",
    "One-shot fallback was attempted and completed.",
    `Streaming error: ${streamingErrorMessage}`,
  ].join(" ");
}

export function streamingFallbackFailureMessage(
  streamingErrorMessage: string,
  fallbackErrorMessage: string,
): string {
  return [
    "Streaming start failed before a run id was returned.",
    "One-shot fallback was attempted and failed.",
    `Streaming error: ${streamingErrorMessage}`,
    `Fallback error: ${fallbackErrorMessage}`,
  ].join(" ");
}

export function streamingNoFallbackMessage(
  streamingErrorMessage: string,
): string {
  return [
    "Streaming start failed before a run id was returned.",
    "One-shot fallback was not available.",
    `Streaming error: ${streamingErrorMessage}`,
  ].join(" ");
}
