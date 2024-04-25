import { describe, expect, it } from "vitest";
import { circular } from "../src";

describe("circular() function", () => {
  class TestClass {
    hello(): string {
      return "world";
    }
  }

  it("should take ServiceFactory and return ServiceFactory, which returns Proxy of interface, built by given ServiceFactory", () => {
    const factory = circular(() => new TestClass());
    // @ts-expect-error Argument is unnecessary for test case
    const instance = factory();
    expect(instance).toBeInstanceOf(TestClass);
    expect(instance.hello()).toBe("world");
  });
});
