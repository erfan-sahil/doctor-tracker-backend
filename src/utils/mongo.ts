export function isTransactionUnsupported(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const record = error as {
    code?: unknown;
    codeName?: unknown;
    message?: unknown;
    cause?: unknown;
    errorResponse?: { originalError?: unknown; errmsg?: string };
  };

  if (record.code === 20 || record.codeName === "IllegalOperation") {
    return true;
  }

  const message =
    typeof record.message === "string"
      ? record.message
      : typeof record.errorResponse?.errmsg === "string"
        ? record.errorResponse.errmsg
        : "";

  if (
    message.includes("Transaction numbers are only allowed") ||
    message.includes("does not support retryable writes")
  ) {
    return true;
  }

  const nested = record.errorResponse?.originalError;
  if (nested && nested !== error && isTransactionUnsupported(nested)) {
    return true;
  }

  return isTransactionUnsupported(record.cause);
}

export function isDuplicateKeyError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const record = error as { code?: unknown; cause?: unknown };

  if (record.code === 11000) {
    return true;
  }

  return isDuplicateKeyError(record.cause);
}
