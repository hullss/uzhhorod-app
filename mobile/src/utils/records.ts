/** Stable content identity for read-only records without an upstream ID. Never a random render key. */
export function recordKey(prefix: string, parts: unknown[]): string {
  const value = JSON.stringify(parts);
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return `${prefix}-${(hash >>> 0).toString(36)}-${value.length}`;
}
export function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    const id = item.id.trim();
    if (!id) throw new Error("Сервіс повернув запис без ідентифікатора.");
    const previous = seen.get(id);
    const normalized = { ...item, id };
    if (previous && JSON.stringify(previous) !== JSON.stringify(normalized)) throw new Error("Сервіс повернув суперечливі записи.");
    seen.set(id, normalized);
  }
  return [...seen.values()];
}
