import type { Constructor } from "./ServiceResolver";

/**
 * Returns service name, using ServiceKey - either constructor, or string key of ServicesMap.
 *
 * @param key
 * @param classNames
 *
 * @internal
 */
export function stringifyServiceKey(
  key: unknown,
  classNames: Map<Constructor<object>, string>
): string {
  if (typeof key === "function") {
    if (classNames.has(key as Constructor<object>)) {
      return classNames.get(key as Constructor<object>) || key.name;
    }
    return key.name;
  }

  return String(key);
}
