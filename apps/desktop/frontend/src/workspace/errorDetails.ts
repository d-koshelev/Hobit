export function unknownErrorToMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  return unknownErrorToOptionalMessage(error) ?? fallbackMessage;
}

export function unknownErrorToOptionalMessage(error: unknown): string | null {
  if (error === null || error === undefined) {
    return null;
  }

  if (typeof error === "string") {
    return error.trim() || null;
  }

  if (typeof error === "number" || typeof error === "boolean") {
    return String(error);
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    const causeMessage = unknownErrorToOptionalMessage(
      (error as { cause?: unknown }).cause,
    );

    if (message && causeMessage && causeMessage !== message) {
      return `${message} Cause: ${causeMessage}`;
    }

    return message || causeMessage || null;
  }

  try {
    const serializedError = JSON.stringify(error);
    return serializedError && serializedError !== "{}"
      ? serializedError
      : String(error);
  } catch {
    return String(error);
  }
}
