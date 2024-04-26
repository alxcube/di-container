import { beforeEach, describe, expect, it } from "vitest";
import { type Constructor } from "../src";
import { stringifyServiceKey } from "../src/stringifyServiceKey";

describe("stringifyServiceKey() function", () => {
  class DummyClass {}

  let classNames: Map<Constructor<object>, string>;

  beforeEach(() => {
    classNames = new Map();
  });

  it("should return given string, when string is given", () => {
    expect(stringifyServiceKey("string value", classNames)).toBe(
      "string value"
    );
  });

  it("should return constructor name, when constructor is given", () => {
    expect(stringifyServiceKey(Date, classNames)).toBe("Date");
  });

  it("should return class name from given class names storage, if it has name, assigned to given constructor", () => {
    classNames.set(DummyClass, "DummyClassName");
    expect(stringifyServiceKey(DummyClass, classNames)).toBe("DummyClassName");
  });
});
