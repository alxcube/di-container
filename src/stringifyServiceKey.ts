/**
 * Returns service name, using ServiceKey - either constructor, or string key of ServicesMap.
 *
 * @param key
 */
export function stringifyServiceKey(key: unknown): string {
  if (typeof key === "function") {
    return key.name;
  }

  return String(key);
}
