type Snapshot = { fetchedAt: string; stale: boolean };

export function isFreshSnapshot(snapshot: Snapshot | null, now = Date.now(), maxAgeMs = 90_000): boolean {
  if (!snapshot || snapshot.stale) return false;
  const age = now - Date.parse(snapshot.fetchedAt);
  return Number.isFinite(age) && age >= -30_000 && age <= maxAgeMs;
}
