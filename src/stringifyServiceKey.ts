export function stringifyServiceKey(key: unknown): string {
  if (typeof key === "function") {
    return key.name;
  }

  return String(key);
}
