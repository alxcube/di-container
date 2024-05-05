import { beforeEach, describe, expect, it } from "vitest";
import {
  circular,
  ServiceResolutionError,
  Context,
  type ServiceRegistration,
  type ServiceKey,
  type ServicesMap,
  classNames,
} from "../src";

describe("Context class", () => {
  class DummyService {}
  class DummyServiceContainer {
    constructor(private readonly DummyService: DummyService) {}

    getService(): DummyService {
      return this.DummyService;
    }
  }

  class CircularA {
    constructor(
      public circularB?: CircularB,
      public circularC?: CircularC
    ) {}
  }

  class CircularB {
    constructor(
      public circularA?: CircularA,
      public circularC?: CircularC
    ) {}
  }

  class CircularC {
    constructor(
      public circularA?: CircularA,
      public circularB?: CircularB
    ) {}
  }

  interface TestServicesMap extends ServicesMap {
    DummyService: DummyService;
    TransientDummyService: DummyService;
    SingletonDummyService: DummyService;
    RequestDummyService: DummyService;
    NamedDummyService: DummyService;
    AlwaysNamedDummyService: DummyService;
    DummyServiceContainer: DummyServiceContainer;
    CircularA: CircularA;
    CircularB: CircularB;
    CircularC: CircularC;
  }

  let dummyServiceInstance: DummyService;
  let registry: Map<
    ServiceKey<TestServicesMap>,
    ServiceRegistration<TestServicesMap, unknown>[]
  >;
  let resolver: Context<TestServicesMap>;

  beforeEach(() => {
    dummyServiceInstance = new DummyService();
    const DummyServiceFactory = () => new DummyService();
    registry = new Map();
    registry.set("DummyService", [
      {
        name: "default",
        instance: dummyServiceInstance,
        lifecycle: "singleton",
      },
    ]);
    registry.set("TransientDummyService", [
      { name: "default", factory: DummyServiceFactory, lifecycle: "transient" },
    ]);
    registry.set("SingletonDummyService", [
      { name: "default", factory: DummyServiceFactory, lifecycle: "singleton" },
    ]);
    registry.set("RequestDummyService", [
      { name: "default", factory: DummyServiceFactory, lifecycle: "request" },
    ]);
    registry.set("NamedDummyService", [
      { name: "default", factory: DummyServiceFactory, lifecycle: "transient" },
      {
        factory: DummyServiceFactory,
        lifecycle: "singleton",
        name: "Singleton",
      },
      {
        factory: DummyServiceFactory,
        lifecycle: "request",
        name: "Request",
      },
    ]);
    registry.set("AlwaysNamedDummyService", [
      { name: "name", factory: DummyServiceFactory, lifecycle: "singleton" },
    ]);
    registry.set("DummyServiceContainer", [
      {
        name: "default",
        factory: (res) =>
          new DummyServiceContainer(res.resolve("DummyService")),
        lifecycle: "transient",
      },
    ]);

    // Register using constructor as key
    registry.set(DummyService, [
      {
        name: "default",
        factory: () => new DummyService(),
        lifecycle: "transient",
      },
      {
        name: "alt",
        factory: () => new DummyService(),
        lifecycle: "transient",
      },
    ]);
    registry.set(DummyServiceContainer, [
      {
        name: "default",
        factory: (context) =>
          new DummyServiceContainer(context.resolve(DummyService)),
        lifecycle: "transient",
      },
    ]);

    resolver = new Context<TestServicesMap>(registry);
  });

  describe("resolve() method", () => {
    it("should return registered service instance", () => {
      expect(resolver.resolve("DummyService")).toBe(dummyServiceInstance);
    });

    it("should return registered service, created dynamically", () => {
      expect(resolver.resolve("TransientDummyService")).toBeInstanceOf(
        DummyService
      );
    });

    it("should always create new instance when service lifecycle is 'transient'", () => {
      const service1 = resolver.resolve("TransientDummyService");
      const service2 = resolver.resolve("TransientDummyService");
      expect(service1).toBeInstanceOf(DummyService);
      expect(service2).toBeInstanceOf(DummyService);
      expect(service2).not.toBe(service1);
    });

    it("should always return same instance when service lifecycle is 'singleton'", () => {
      const service1 = resolver.resolve("SingletonDummyService");
      const service2 = resolver.resolve("SingletonDummyService");
      expect(service1).toBeInstanceOf(DummyService);
      expect(service1).toBe(service2);
    });

    it("should always return same instance when service lifecycle is 'request'", () => {
      const service1 = resolver.resolve("RequestDummyService");
      const service2 = resolver.resolve("RequestDummyService");
      expect(service1).toBeInstanceOf(DummyService);
      expect(service1).toBe(service2);
    });

    it("should return different services for named registrations", () => {
      const transientService = resolver.resolve("NamedDummyService"); // without name
      const singletonService = resolver.resolve(
        "NamedDummyService",
        "Singleton"
      );
      const requestService = resolver.resolve("NamedDummyService", "Request");

      expect(transientService).toBeInstanceOf(DummyService);
      expect(singletonService).toBeInstanceOf(DummyService);
      expect(requestService).toBeInstanceOf(DummyService);
      expect(transientService).not.toBe(singletonService);
      expect(transientService).not.toBe(requestService);
      expect(requestService).not.toBe(singletonService);
    });

    it("should return same instance, when service is requested with same name, and lifecycle is 'singleton'", () => {
      const service = resolver.resolve("NamedDummyService", "Singleton");
      expect(resolver.resolve("NamedDummyService", "Singleton")).toBe(service);
    });

    it("should return same instance, when service is requested with same name, and lifecycle is 'request'", () => {
      const service = resolver.resolve("NamedDummyService", "Request");
      expect(resolver.resolve("NamedDummyService", "Request")).toBe(service);
    });

    it("should throw RangeError, when requested service is not registered", () => {
      // @ts-expect-error testing unknown service key
      expect(() => resolver.resolve("UnknownService")).toThrow(RangeError);
    });

    it("should throw RangeError, when requested named service is not registered", () => {
      expect(() =>
        resolver.resolve("NamedDummyService", "UnknownName")
      ).toThrow(RangeError);
    });

    it("should throw RangeError, when requesting service without name, but registered service is named", () => {
      expect(() => resolver.resolve("AlwaysNamedDummyService")).toThrow(
        RangeError
      );
    });

    it("should resolve services with dependencies", () => {
      const container = resolver.resolve("DummyServiceContainer");
      expect(container).toBeInstanceOf(DummyServiceContainer);
      expect(container.getService()).toBeInstanceOf(DummyService);
    });

    it("should throw ServiceResolutionError, when error occur in service factory", () => {
      registry.set("SingletonDummyService", [
        {
          lifecycle: "singleton",
          name: "default",
          factory: () => {
            throw new Error("test error");
          },
        },
      ]);

      expect(() => resolver.resolve("SingletonDummyService")).toThrow(
        ServiceResolutionError
      );
    });

    it("should throw ServiceResolutionError, when circular dependency detected", () => {
      registry.set("DummyService", [
        {
          name: "default",
          lifecycle: "transient",
          factory: (context) => {
            context.resolve("DummyServiceContainer"); // fake circular dependency
            return new DummyService();
          },
        },
      ]);

      expect(() => resolver.resolve("DummyServiceContainer")).toThrow(
        ServiceResolutionError
      );
    });

    it("should throw ServiceResolutionError, containing given class name, when class names map contains record for that class", () => {
      classNames.set(DummyService, "AwesomeService");
      registry.set(DummyService, [
        {
          factory: () => {
            throw new Error("Error");
          },
          lifecycle: "transient",
          name: "default",
        },
      ]);
      expect(() => resolver.resolve(DummyService)).toThrow("AwesomeService");
    });

    it("should resolve services by constructor as key", () => {
      expect(resolver.resolve(DummyService)).toBeInstanceOf(DummyService);
    });

    it("should resolve services with dependencies by constructor as key", () => {
      const container = resolver.resolve(DummyServiceContainer);
      expect(container).toBeInstanceOf(DummyServiceContainer);
      expect(container.getService()).toBeInstanceOf(DummyService);
    });

    describe("circular dependencies resolution using delay() method", () => {
      beforeEach(() => {
        registry.set("CircularA", [
          {
            name: "default",
            lifecycle: "request",
            factory: (context) => {
              const circularA = new CircularA();
              context.delay(() => {
                circularA.circularB = context.resolve("CircularB");
                circularA.circularC = context.resolve("CircularC");
              });
              return circularA;
            },
          },
        ]);

        registry.set("CircularB", [
          {
            name: "default",
            lifecycle: "request",
            factory: (context) => {
              const circularB = new CircularB();
              context.delay(() => {
                circularB.circularA = context.resolve("CircularA");
                circularB.circularC = context.resolve("CircularC");
              });
              return circularB;
            },
          },
        ]);

        registry.set("CircularC", [
          {
            name: "default",
            lifecycle: "request",
            factory: (context) => {
              const circularC = new CircularC();
              context.delay(() => {
                circularC.circularA = context.resolve("CircularA");
                circularC.circularB = context.resolve("CircularB");
              });
              return circularC;
            },
          },
        ]);
      });

      it("should resolve circular dependencies, using delayed injection of dependency", () => {
        const circularA = resolver.resolve("CircularA");
        expect(circularA).toBeInstanceOf(CircularA);
        expect(circularA.circularB).toBeInstanceOf(CircularB);
        expect(circularA.circularC).toBeInstanceOf(CircularC);
      });

      it("should resolve circular dependencies in different order", () => {
        const circularB = resolver.resolve("CircularB");
        expect(circularB).toBeInstanceOf(CircularB);
        expect(circularB.circularA).toBeInstanceOf(CircularA);
        expect(circularB.circularC).toBeInstanceOf(CircularC);
      });

      it("should resolve circular dependencies in another different order", () => {
        const circularC = resolver.resolve("CircularC");
        expect(circularC).toBeInstanceOf(CircularC);
        expect(circularC.circularA).toBeInstanceOf(CircularA);
        expect(circularC.circularB).toBeInstanceOf(CircularB);
      });
    });

    describe("circular dependencies resolution using circular() helper function", () => {
      beforeEach(() => {
        registry.set("CircularA", [
          {
            name: "default",
            lifecycle: "request",
            factory: circular((context) => {
              return new CircularA(
                context.resolve("CircularB"),
                context.resolve("CircularC")
              );
            }),
          },
        ]);

        registry.set("CircularB", [
          {
            name: "default",
            lifecycle: "request",
            factory: circular((context) => {
              return new CircularB(
                context.resolve("CircularA"),
                context.resolve("CircularC")
              );
            }),
          },
        ]);

        registry.set("CircularC", [
          {
            name: "default",
            lifecycle: "request",
            factory: circular((context) => {
              return new CircularC(
                context.resolve("CircularA"),
                context.resolve("CircularB")
              );
            }),
          },
        ]);
      });

      it("should resolve circular dependencies, using delayed injection of dependency", () => {
        const circularA = resolver.resolve("CircularA");
        expect(circularA).toBeInstanceOf(CircularA);
        expect(circularA.circularB).toBeInstanceOf(CircularB);
        expect(circularA.circularC).toBeInstanceOf(CircularC);
      });

      it("should resolve circular dependencies in different order", () => {
        const circularB = resolver.resolve("CircularB");
        expect(circularB).toBeInstanceOf(CircularB);
        expect(circularB.circularA).toBeInstanceOf(CircularA);
        expect(circularB.circularC).toBeInstanceOf(CircularC);
      });

      it("should resolve circular dependencies in another different order", () => {
        const circularC = resolver.resolve("CircularC");
        expect(circularC).toBeInstanceOf(CircularC);
        expect(circularC.circularA).toBeInstanceOf(CircularA);
        expect(circularC.circularB).toBeInstanceOf(CircularB);
      });
    });
  });

  describe("has() method", () => {
    it("should return true, when registry has registered service instance", () => {
      expect(resolver.has("DummyService")).toBe(true);
    });

    it("should return true, when registry has registered service factory", () => {
      expect(resolver.has("TransientDummyService")).toBe(true);
    });

    it("should return true, when registry has registered named service", () => {
      expect(resolver.has("NamedDummyService", "Singleton")).toBe(true);
    });

    it("should return false, when registry has not requested service", () => {
      // @ts-expect-error testing unknown service key
      expect(resolver.has("NotRegistered")).toBe(false);
    });

    it("should return false, when registry has not service with given name", () => {
      expect(resolver.has("NamedDummyService", "NotRegisteredName")).toBe(
        false
      );
    });
  });

  describe("getStack() method", () => {
    it("should return empty array, unless is resolving service", () => {
      expect(resolver.getStack()).toEqual([]);
    });

    it("should return array with single record of service being resolved, when resolving root service", () => {
      registry.set("DummyService", [
        {
          name: "default",
          factory: (context) => {
            expect(context.getStack()).toEqual([
              { service: "DummyService", name: "default" },
            ]);
            return new DummyService();
          },
          lifecycle: "transient",
        },
      ]);

      resolver.resolve("DummyService");

      expect.hasAssertions();
    });

    it("should return array with all services being resolved, when resolving nested service", () => {
      registry.set("DummyService", [
        {
          name: "default",
          factory: (context) => {
            expect(context.getStack()).toEqual([
              { service: "DummyServiceContainer", name: "named" },
              { service: "DummyService", name: "default" },
            ]);
            return new DummyService();
          },
          lifecycle: "transient",
        },
      ]);
      registry.set("DummyServiceContainer", [
        {
          name: "named",
          factory: (context) => {
            expect(context.getStack()).toEqual([
              { service: "DummyServiceContainer", name: "named" },
            ]);
            return new DummyServiceContainer(context.resolve("DummyService"));
          },
          lifecycle: "transient",
        },
      ]);

      resolver.resolve("DummyServiceContainer", "named");

      expect(resolver.getStack()).toEqual([]);
    });
  });

  describe("isResolvingFor() method", () => {
    it("should return false, when nothing is being resolved", () => {
      expect(resolver.isResolvingFor("DummyService")).toBe(false);
      expect(resolver.isResolvingFor("NamedDummyService", "Singleton")).toBe(
        false
      );
    });

    it("should return true, when given service is somewhere in resolution stack", () => {
      registry.set("SingletonDummyService", [
        {
          name: "default",
          lifecycle: "singleton",
          factory: (context) => {
            expect(context.isResolvingFor("DummyService")).toBe(true);
            expect(context.isResolvingFor("DummyService", "default")).toBe(
              true
            );
            expect(context.isResolvingFor("DummyService", "notDefault")).toBe(
              false
            );
            expect(context.isResolvingFor("DummyServiceContainer")).toBe(true);
            expect(
              context.isResolvingFor("DummyServiceContainer", "default")
            ).toBe(true);
            expect(
              context.isResolvingFor("DummyServiceContainer", "notDefault")
            ).toBe(false);
            return new DummyService();
          },
        },
      ]);
      registry.set("DummyService", [
        {
          name: "default",
          lifecycle: "transient",
          factory: (context) => {
            context.resolve("SingletonDummyService"); // just call to execute expectations on deeper level of resolution
            return new DummyService();
          },
        },
      ]);

      resolver.resolve("DummyServiceContainer");

      expect.hasAssertions();
    });
  });

  describe("isDirectlyResolvingFor() method", () => {
    it("should return false, when nothing is being resolved", () => {
      expect(resolver.isDirectlyResolvingFor("DummyService")).toBe(false);
      expect(
        resolver.isDirectlyResolvingFor("NamedDummyService", "Singleton")
      ).toBe(false);
    });

    it("should return true, when requested service is previous in resolution stack and false otherwise", () => {
      registry.set("SingletonDummyService", [
        {
          name: "default",
          lifecycle: "singleton",
          factory: (context) => {
            expect(context.isDirectlyResolvingFor("DummyService")).toBe(true);
            expect(
              context.isDirectlyResolvingFor("DummyService", "default")
            ).toBe(true);
            expect(
              context.isDirectlyResolvingFor("DummyService", "notDefault")
            ).toBe(false);
            expect(
              context.isDirectlyResolvingFor("DummyServiceContainer")
            ).toBe(false);
            expect(
              context.isDirectlyResolvingFor("DummyServiceContainer", "default")
            ).toBe(false);
            expect(
              context.isDirectlyResolvingFor(
                "DummyServiceContainer",
                "notDefault"
              )
            ).toBe(false);
            return new DummyService();
          },
        },
      ]);
      registry.set("DummyService", [
        {
          name: "default",
          lifecycle: "transient",
          factory: (context) => {
            context.resolve("SingletonDummyService"); // just call to execute expectations on deeper level of resolution
            return new DummyService();
          },
        },
      ]);

      resolver.resolve("DummyServiceContainer");

      expect.hasAssertions();
    });
  });

  describe("resolveAll() method", () => {
    it("should return array of single element, when there is only one service registered", () => {
      expect(resolver.resolveAll("DummyService")).toEqual([
        dummyServiceInstance,
      ]);
    });

    it("should return array of all services, registered under given key by different names", () => {
      expect(resolver.resolveAll("NamedDummyService")).toEqual([
        expect.any(DummyService),
        expect.any(DummyService),
        expect.any(DummyService),
      ]);
    });

    it("should return empty array, when requested service is not registered", () => {
      // @ts-expect-error testing unknown service key
      expect(resolver.resolveAll("NotRegistered")).toEqual([]);
    });

    it("should throw ServiceResolutionError, when error occur in service factory", () => {
      const registrations = registry.get("NamedDummyService");
      registrations![2].factory = () => {
        throw new Error("Test error");
      };
      expect(() => resolver.resolveAll("NamedDummyService")).toThrow(
        ServiceResolutionError
      );
    });

    it("should resolve array of services by constructor as key", () => {
      expect(resolver.resolveAll(DummyService)).toEqual([
        expect.any(DummyService),
        expect.any(DummyService),
      ]);
    });
  });

  describe("resolveTuple() method", () => {
    it("should resolve tuple of services by service keys", () => {
      const [service1, service2] = resolver.resolveTuple([
        "DummyService",
        "SingletonDummyService",
      ] as const);
      expect(service1).toBeInstanceOf(DummyService);
      expect(service2).toBeInstanceOf(DummyService);
    });

    it("should resolve tuple of services by NamedServiceKey", () => {
      const [service1, service2] = resolver.resolveTuple([
        { service: "DummyService", name: "default" },
        { service: "DummyServiceContainer", name: "default" },
      ] as const);
      expect(service1).toBeInstanceOf(DummyService);
      expect(service2).toBeInstanceOf(DummyServiceContainer);
    });

    it("should resolve tuple of services in same request context", () => {
      const [service1, service2] = resolver.resolveTuple([
        { service: "NamedDummyService", name: "Request" },
        { service: "NamedDummyService", name: "Request" },
      ] as const);

      expect(service1).toBeInstanceOf(DummyService);
      expect(service2).toBeInstanceOf(DummyService);
      expect(service2).toBe(service1);
    });

    it("should resolve tuple of services, using constructors as keys", () => {
      const [dummyService1, dummyService2] = resolver.resolveTuple([
        DummyService,
        { service: DummyService, name: "alt" },
      ]);
      expect(dummyService1).toBeInstanceOf(DummyService);
      expect(dummyService2).toBeInstanceOf(DummyService);
    });
  });

  describe("getServiceNames() method", () => {
    it("should return names of service registrations by given service key", () => {
      expect(resolver.getServiceNames("DummyService")).toEqual(["default"]);
      expect(resolver.getServiceNames("NamedDummyService")).toEqual([
        "default",
        "Singleton",
        "Request",
      ]);
    });

    it("should return empty array when there is no registrations of given service", () => {
      // @ts-expect-error testing unknown service key
      expect(resolver.getServiceNames("NotRegistered")).toEqual([]);
    });
  });
});
