import type { Constructor } from "./ServiceResolver";

/**
 * Class names map for keeping meaningful class names in error messages, after code minification.
 */
export const classNames: Map<Constructor<object>, string> = new Map();
