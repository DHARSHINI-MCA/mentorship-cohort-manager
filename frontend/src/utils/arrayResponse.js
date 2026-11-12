/** Return a list from a plain response or common nested/paginated API envelope. */
export function unwrapArrayResponse(payload, resourceKey, depth = 0) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object' || depth > 3) return null;

  const candidates = [
    payload[resourceKey],
    payload.items,
    payload.results,
    payload.records,
    payload.docs,
    payload.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    const nested = unwrapArrayResponse(candidate, resourceKey, depth + 1);
    if (nested) return nested;
  }
  return null;
}

export function requireArrayResponse(payload, resourceKey) {
  const items = unwrapArrayResponse(payload, resourceKey);
  if (items) return items;
  throw new Error(`Unexpected ${resourceKey} response from the server.`);
}
