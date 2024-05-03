import { beforeEach, describe, expect, it } from "vitest";
import { classNames } from "../src";
import { stringifyServiceKey } from "../src/stringifyServiceKey";

describe("stringifyServiceKey() function", () => {
  class DummyClass {}

  beforeEach(() => {
    classNames.clear();
  });

  it("should return given string, when string is given", () => {
    expect(stringifyServiceKey("string value")).toBe("string value");
  });

  it("should return constructor name, when constructor is given", () => {
    expect(stringifyServiceKey(Date)).toBe("Date");
  });

  it("should return class name from given class names storage, if it has name, assigned to given constructor", () => {
    classNames.set(DummyClass, "DummyClassName");
    expect(stringifyServiceKey(DummyClass)).toBe("DummyClassName");
  });
});
