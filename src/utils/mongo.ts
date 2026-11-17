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
