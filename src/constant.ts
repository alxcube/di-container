import type { ConstantToken } from "./ServiceContainer";

export function constant<T>(value: T): ConstantToken<T> {
  return { constant: value };
}
