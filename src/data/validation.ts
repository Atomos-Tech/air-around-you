export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isLatitude(value: unknown): value is number {
  return typeof value === "number" && Math.abs(value) <= 90;
}

export function isLongitude(value: unknown): value is number {
  return typeof value === "number" && Math.abs(value) <= 180;
}

export function nonnegative(value: unknown, max = Infinity): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max
    ? value
    : null;
}
