const UNIT_MS = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

export function durationToMs(value: string): number {
  const match = /^([1-9]\d*)(s|m|h|d)$/.exec(value);
  const amountText = match?.[1];
  const unit = match?.[2];

  if (!amountText || (unit !== "s" && unit !== "m" && unit !== "h" && unit !== "d")) {
    throw new Error(`Invalid duration: ${value}`);
  }

  return Number(amountText) * UNIT_MS[unit];
}
