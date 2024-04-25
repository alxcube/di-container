import { describe, expect, it } from "vitest";
import { constant } from "../src";

describe("constant() function", () => {
  it("should return object with `constant` property, equal to given value", () => {
    expect(constant(10)).toEqual({ constant: 10 });
    expect(constant(undefined)).toEqual({ constant: undefined });
    expect(constant("string")).toEqual({ constant: "string" });
    const obj = { prop: "value" };
    expect(constant(obj)).toEqual({ constant: obj });
  });
});
