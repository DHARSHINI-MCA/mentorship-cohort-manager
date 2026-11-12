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
    payload.rows,
    payload.entries,
    payload.content,
    payload.value,
    payload.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    const nested = unwrapArrayResponse(candidate, resourceKey, depth + 1);
    if (nested) return nested;
  }

  // Some API versions wrap a list under a resource-specific key that differs
  // between deployments (for example `results` vs `sessions`). If the object
  // has exactly one array-valued property, it is unambiguous to unwrap it.
  const arrays = Object.values(payload).filter(Array.isArray);
  if (arrays.length === 1) return arrays[0];

  // Handle a further envelope layer such as { response: { payload: [...] } }.
  for (const value of Object.values(payload)) {
    if (value && typeof value === 'object') {
      const nested = unwrapArrayResponse(value, resourceKey, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

export function requireArrayResponse(payload, resourceKey) {
  const items = unwrapArrayResponse(payload, resourceKey);
  if (items) return items;
  const shape = Array.isArray(payload)
    ? 'array'
    : payload === null
      ? 'null'
      : typeof payload === 'object'
        ? `object with keys: ${Object.keys(payload).slice(0, 8).join(', ') || 'none'}`
        : typeof payload;
  throw new Error(`Unexpected ${resourceKey} response (${shape}).`);
}
