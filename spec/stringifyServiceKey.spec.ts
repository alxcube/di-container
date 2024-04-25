import { describe, expect, it } from "vitest";
import { stringifyServiceKey } from "../src";

describe("stringifyServiceKey() function", () => {
  it("should return given string, when string is given", () => {
    expect(stringifyServiceKey("string value")).toBe("string value");
  });

  it("should return constructor name, when constructor is given", () => {
    expect(stringifyServiceKey(Date)).toBe("Date");
  });
});
