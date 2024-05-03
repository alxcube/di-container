import { classNames } from "./classNames";
import type { Constructor } from "./ServiceResolver";

/**
 * Returns service name, using ServiceKey - either constructor, or string key of ServicesMap.
 *
 * @param key
 *
 * @internal
 */
export function stringifyServiceKey(key: unknown): string {
  if (typeof key === "function") {
    if (classNames.has(key as Constructor<object>)) {
      return classNames.get(key as Constructor<object>) || key.name;
    }
    return key.name;
  }

  return String(key);
}
