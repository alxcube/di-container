import type { ConstantToken } from "./ServiceContainer";

/**
 * Helper function for creating ConstantToken objects.
 *
 * @param value
 */
export function constant<T>(value: T): ConstantToken<T> {
  return { constant: value };
}
