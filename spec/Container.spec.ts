import { beforeEach, describe, expect, it } from "vitest";
import { circular, Container, ServiceResolutionError } from "../src";
import type {
  ServiceContainer,
  ServiceModule,
  ServicesMap,
} from "../src";

describe("Container class", () => {
  class DummyService {
    identity() {
      return;
    }
  }

  class DummyDependent {
    constructor(
      readonly dummyService1: DummyService,
      readonly dummyService2: DummyService
    ) {}
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
    DummyDependent: DummyDependent;
    CircularA: CircularA;
    CircularB: CircularB;
    CircularC: CircularC;
    "DummyService[]": DummyService[];
  }

  let container: Container<TestServicesMap>;
  let childContainer: Container<TestServicesMap>;

  beforeEach(() => {
    container = new Container();
    childContainer = container.createChild();
  });

  describe("registerConstant() method", () => {
    it("should register service instance", () => {
      const instance = new DummyService();
      container.registerConstant("DummyService", instance);
      expect(container.resolve("DummyService")).toBe(instance);
    });

    it("should register named service instance", () => {
      const instance = new DummyService();
      container.registerConstant("DummyService", instance, { name: "Named" });
      expect(container.resolve("DummyService", "Named")).toBe(instance);
    });

    it("should register multiple service instances under different names", () => {
      const instance1 = new DummyService();
      const instance2 = new DummyService();
      const instance3 = new DummyService();

      container.registerConstant("DummyService", instance1); // will be named 'default'
      container.registerConstant("DummyService", instance2, {
        name: "instance2",
      });
      container.registerConstant("DummyService", instance3, {
        name: "instance3",
      });

      expect(container.resolve("DummyService")).toBe(instance1);
      expect(container.resolve("DummyService", "default")).toBe(instance1);
      expect(container.resolve("DummyService", "instance2")).toBe(instance2);
      expect(container.resolve("DummyService", "instance3")).toBe(instance3);
    });

    it("should throw TypeError when trying to register service that already registered as default", () => {
      const instance = new DummyService();
      container.registerConstant("DummyService", instance);
      expect(() =>
        container.registerConstant("DummyService", instance)
      ).toThrow(TypeError);
    });

    it("should throw TypeError when trying to register named service under name, that is already taken", () => {
      const instance = new DummyService();
      const name = "TestServiceName";
      container.registerConstant("DummyService", instance, { name });
      expect(() =>
        container.registerConstant("DummyService", instance, { name })
      ).toThrow(TypeError);
    });

    it("should replace existing default service, when 'replace' option is set to true", () => {
      const instance1 = new DummyService();
      const instance2 = new DummyService();
      container.registerConstant("DummyService", instance1);
      expect(container.resolve("DummyService")).toBe(instance1);
      container.registerConstant("DummyService", instance2, { replace: true });
      expect(container.resolve("DummyService")).toBe(instance2);
    });

    it("should replace existing named service, when 'replace' option is set to true", () => {
      const instance1 = new DummyService();
      const instance2 = new DummyService();
      const name = "named";
      container.registerConstant("DummyService", instance1, { name });
      expect(container.resolve("DummyService", name)).toBe(instance1);
      container.registerConstant("DummyService", instance2, {
        name,
        replace: true,
      });
      expect(container.resolve("DummyService", name)).toBe(instance2);
    });

    it("should throw TypeError, when trying to register service instance after service factory was registered, using 'registerFactory()' method", () => {
      container.registerFactory("DummyService", () => new DummyService());
      expect(() =>
        container.registerConstant("DummyService", new DummyService())
      ).toThrow(TypeError);
    });

    it("should replace service factory registration, made earlier using 'registerFactory()' method", () => {
      const instance = new DummyService();
      container.registerFactory("DummyService", () => new DummyService());
      container.registerConstant("DummyService", instance, { replace: true });
      expect(container.resolve("DummyService")).toBe(instance);
    });

    it("should register service instance, using constructor as key", () => {
      const instance = new DummyService();
      container.registerConstant(DummyService, instance);
      expect(container.resolve(DummyService)).toBe(instance);
    });
  });

  describe("registerFactory() method", () => {
    let instance1: DummyService;
    let instance2: DummyService;
    let factory1: () => DummyService;
    let factory2: () => DummyService;

    beforeEach(() => {
      instance1 = new DummyService();
      instance2 = new DummyService();
      factory1 = () => instance1;
      factory2 = () => instance2;
    });

    it("should register service factory", () => {
      container.registerFactory("DummyService", factory1);
      expect(container.resolve("DummyService")).toBe(instance1);
    });

    it("should register named service factory", () => {
      const name = "named";
      container.registerFactory("DummyService", factory1, { name });
      expect(container.resolve("DummyService", name)).toBe(instance1);
    });

    it("should register multiple service factories under different names", () => {
      container.registerFactory("DummyService", factory1, { name: "name1" });
      container.registerFactory("DummyService", factory2, { name: "name2" });
      container.registerFactory("DummyService", () => new DummyService()); // named "default"

      const service1 = container.resolve("DummyService", "name1");
      const service2 = container.resolve("DummyService", "name2");
      const service3 = container.resolve("DummyService");

      expect(service1).toBe(instance1);
      expect(service2).toBe(instance2);
      expect(service3).toBeInstanceOf(DummyService);
      expect(service3).not.toBe(instance1);
      expect(service3).not.toBe(instance2);
    });

    it("should register service factory with transient lifecycle by default", () => {
      container.registerFactory("DummyService", () => new DummyService());
      const service1 = container.resolve("DummyService");
      const service2 = container.resolve("DummyService");
      expect(service1).toBeInstanceOf(DummyService);
      expect(service2).toBeInstanceOf(DummyService);
      expect(service2).not.toBe(service1);
    });

    it("should register service factory with singleton lifecycle, when 'lifecycle' option is set to 'singleton'", () => {
      container.registerFactory("DummyService", () => new DummyService(), {
        lifecycle: "singleton",
      });
      const service1 = container.resolve("DummyService");
      const service2 = container.resolve("DummyService");
      expect(service2).toBe(service1);
    });

    it("should register service factory with request lifecycle, when 'lifecycle' option is set to 'request'", () => {
      container.registerFactory("DummyService", () => new DummyService(), {
        lifecycle: "request",
      });
      container.registerFactory(
        "DummyDependent",
        (resolver) =>
          new DummyDependent(
            resolver.resolve("DummyService"),
            resolver.resolve("DummyService")
          )
      );

      const service1 = container.resolve("DummyDependent");
      const service2 = container.resolve("DummyDependent");

      expect(service1).toBeInstanceOf(DummyDependent);
      expect(service1.dummyService1).toBeInstanceOf(DummyService);
      expect(service1.dummyService2).toBeInstanceOf(DummyService);
      expect(service1.dummyService1).toBe(service1.dummyService2);

      expect(service2).toBeInstanceOf(DummyDependent);
      expect(service2.dummyService1).toBeInstanceOf(DummyService);
      expect(service2.dummyService2).toBeInstanceOf(DummyService);
      expect(service2.dummyService1).toBe(service2.dummyService2);

      expect(service1.dummyService1).not.toBe(service2.dummyService1);
    });

    it("should throw TypeError, when trying to register default service factory, when it is already registered", () => {
      container.registerFactory("DummyService", () => new DummyService());
      expect(() =>
        container.registerFactory("DummyService", () => new DummyService())
      ).toThrow(TypeError);
    });

    it("should throw TypeError, when trying to register named service factory under name that is already taken", () => {
      const name = "named";
      const factory = () => new DummyService();
      container.registerFactory("DummyService", factory, { name });
      expect(() =>
        container.registerFactory("DummyService", factory, { name })
      ).toThrow(TypeError);
    });

    it("should replace existing default service factory, when 'replace' option is set to true", () => {
      container.registerFactory("DummyService", factory1);
      expect(container.resolve("DummyService")).toBe(instance1);
      container.registerFactory("DummyService", factory2, { replace: true });
      expect(container.resolve("DummyService")).toBe(instance2);
    });

    it("should replace existing named service factory, when 'replace' option is set to true", () => {
      const name = "named";
      container.registerFactory("DummyService", factory1, { name });
      expect(container.resolve("DummyService", name)).toBe(instance1);
      container.registerFactory("DummyService", factory2, {
        name,
        replace: true,
      });
      expect(container.resolve("DummyService", name)).toBe(instance2);
    });

    it("should change lifecycle, when replacing service factory", () => {
      const factory = () => new DummyService();
      container.registerFactory("DummyService", factory, {
        lifecycle: "singleton",
      });
      const instance1 = container.resolve("DummyService");
      expect(container.resolve("DummyService")).toBe(instance1);

      container.registerFactory("DummyService", factory, { replace: true }); // transient lifecycle by default
      const instance2 = container.resolve("DummyService");
      expect(instance2).not.toBe(instance1);
      expect(container.resolve("DummyService")).not.toBe(instance2);
    });

    it("should throw TypeError, when trying to register factory after service instance was registered, using 'registerConstant()' method", () => {
      container.registerConstant("DummyService", instance1);
      expect(() => container.registerFactory("DummyService", factory1)).toThrow(
        TypeError
      );
    });

    it("should replace service instance registration, made using 'registerConstant()' method", () => {
      container.registerConstant("DummyService", instance1);
      expect(container.resolve("DummyService")).toBe(instance1);
      container.registerFactory("DummyService", () => new DummyService(), {
        replace: true,
      });
      expect(container.resolve("DummyService")).not.toBe(instance1);
    });

    it("should register service factory, using constructor as key", () => {
      container.registerFactory(DummyService, () => new DummyService());
      expect(container.resolve(DummyService)).toBeInstanceOf(DummyService);
    });
  });

  describe("resolve() method", () => {
    let dummyServiceInstance: DummyService;
    beforeEach(() => {
      dummyServiceInstance = new DummyService();
      container.registerConstant("DummyService", dummyServiceInstance);
      container.registerFactory("DummyService", () => new DummyService(), {
        name: "dynamic",
      });
      container.registerFactory("DummyDependent", (context) => {
        return new DummyDependent(
          context.resolve("DummyService"),
          context.resolve("DummyService", "dynamic")
        );
      });
    });

    it("should resolve service instance", () => {
      expect(container.resolve("DummyService")).toBe(dummyServiceInstance);
    });

    it("should resolve service, created by factory", () => {
      expect(container.resolve("DummyService", "dynamic")).toBeInstanceOf(
        DummyService
      );
    });

    it("should resolve service with dependencies", () => {
      const dependent = container.resolve("DummyDependent");
      expect(dependent).toBeInstanceOf(DummyDependent);
      expect(dependent.dummyService1).toBe(dummyServiceInstance);
      expect(dependent.dummyService2).toBeInstanceOf(DummyService);
    });

    it("should throw RangeError, when requested service is not registered", () => {
      // @ts-expect-error testing unknown service key
      expect(() => container.resolve("NotRegistered")).toThrow(RangeError);
    });

    it("should throw RangeError, when requested named service is not registered", () => {
      expect(() =>
        container.resolve("DummyService", "not-registered-name")
      ).toThrow(RangeError);
    });

    it("should throw ServiceResolutionError, when error occurs in service factory", () => {
      container.registerFactory(
        "DummyService",
        () => {
          throw "test error";
        },
        { replace: true }
      );

      expect(() => container.resolve("DummyService")).toThrow(
        ServiceResolutionError
      );
    });

    it("should resolve service from parent container in child container", () => {
      expect(childContainer.resolve("DummyService")).toBe(dummyServiceInstance);
    });

    it("should resolve own service, when it is registered, ignoring service in parent container", () => {
      const childDummyInstance = new DummyService();
      childContainer.registerConstant("DummyService", childDummyInstance);
      expect(container.resolve("DummyService")).toBe(dummyServiceInstance);
      expect(childContainer.resolve("DummyService")).toBe(childDummyInstance);
      // this is resolved from parent container
      expect(childContainer.resolve("DummyService", "dynamic")).toBeInstanceOf(
        DummyService
      );
    });

    it("should resolve own services, when no such services is registered in parent container", () => {
      container.unregister("DummyDependent");
      childContainer.registerFactory("DummyDependent", (context) => {
        return new DummyDependent(
          context.resolve("DummyService"),
          context.resolve("DummyService")
        );
      });
      expect(childContainer.resolve("DummyDependent")).toBeInstanceOf(
        DummyDependent
      );
      expect(() => container.resolve("DummyDependent")).toThrow(RangeError);
    });

    it("should resolve service, registered in parent container, using constructor as key", () => {
      container.registerFactory(DummyService, () => new DummyService());
      expect(childContainer.resolve(DummyService)).toBeInstanceOf(DummyService);
    });

    describe("circular dependencies resolution, using delay() method", () => {
      beforeEach(() => {
        container.registerFactory(
          "CircularA",
          (context) => {
            const circularA = new CircularA();
            context.delay(() => {
              circularA.circularB = context.resolve("CircularB");
              circularA.circularC = context.resolve("CircularC");
            });
            return circularA;
          },
          { lifecycle: "singleton" }
        );

        container.registerFactory(
          "CircularB",
          (context) => {
            const circularB = new CircularB();
            context.delay(() => {
              circularB.circularA = context.resolve("CircularA");
              circularB.circularC = context.resolve("CircularC");
            });
            return circularB;
          },
          { lifecycle: "singleton" }
        );

        container.registerFactory(
          "CircularC",
          (context) => {
            const circularC = new CircularC();
            context.delay(() => {
              circularC.circularB = context.resolve("CircularB");
              circularC.circularA = context.resolve("CircularA");
            });
            return circularC;
          },
          { lifecycle: "singleton" }
        );
      });

      it("should resolve circular dependencies, using delayed injection of dependency", () => {
        const circularA = container.resolve("CircularA");
        expect(circularA).toBeInstanceOf(CircularA);
        expect(circularA.circularB).toBeInstanceOf(CircularB);
        expect(circularA.circularC).toBeInstanceOf(CircularC);
      });

      it("should resolve circular dependencies in different order", () => {
        const circularB = container.resolve("CircularB");
        expect(circularB).toBeInstanceOf(CircularB);
        expect(circularB.circularA).toBeInstanceOf(CircularA);
        expect(circularB.circularC).toBeInstanceOf(CircularC);
      });

      it("should resolve circular dependencies in another different order", () => {
        const circularC = container.resolve("CircularC");
        expect(circularC).toBeInstanceOf(CircularC);
        expect(circularC.circularA).toBeInstanceOf(CircularA);
        expect(circularC.circularB).toBeInstanceOf(CircularB);
      });
    });

    describe("circular dependencies resolution, using circular() helper", () => {
      beforeEach(() => {
        container.registerFactory(
          "CircularA",
          circular((context) => {
            return new CircularA(
              context.resolve("CircularB"),
              context.resolve("CircularC")
            );
          }),
          { lifecycle: "singleton" }
        );

        container.registerFactory(
          "CircularB",
          circular((context) => {
            return new CircularB(
              context.resolve("CircularA"),
              context.resolve("CircularC")
            );
          }),
          { lifecycle: "singleton" }
        );

        container.registerFactory(
          "CircularC",
          circular((context) => {
            return new CircularC(
              context.resolve("CircularA"),
              context.resolve("CircularB")
            );
          }),
          { lifecycle: "singleton" }
        );
      });

      it("should resolve circular dependencies, using delayed injection of dependency", () => {
        const circularA = container.resolve("CircularA");
        expect(circularA).toBeInstanceOf(CircularA);
        expect(circularA.circularB).toBeInstanceOf(CircularB);
        expect(circularA.circularC).toBeInstanceOf(CircularC);
      });

      it("should resolve circular dependencies in different order", () => {
        const circularB = container.resolve("CircularB");
        expect(circularB).toBeInstanceOf(CircularB);
        expect(circularB.circularA).toBeInstanceOf(CircularA);
        expect(circularB.circularC).toBeInstanceOf(CircularC);
      });

      it("should resolve circular dependencies in another different order", () => {
        const circularC = container.resolve("CircularC");
        expect(circularC).toBeInstanceOf(CircularC);
        expect(circularC.circularA).toBeInstanceOf(CircularA);
        expect(circularC.circularB).toBeInstanceOf(CircularB);
      });
    });
  });

  describe("resolveAll() method", () => {
    let dummyServiceInstance: DummyService;
    beforeEach(() => {
      dummyServiceInstance = new DummyService();
      container.registerConstant("DummyService", dummyServiceInstance);
      container.registerFactory("DummyService", () => new DummyService(), {
        name: "dynamic",
      });
    });

    it("should resolve all registered services under given key", () => {
      expect(container.resolveAll("DummyService")).toEqual([
        dummyServiceInstance,
        expect.any(DummyService),
      ]);
    });

    it("should return empty array, when no services registered under given key", () => {
      // @ts-expect-error testing unknown service key
      expect(container.resolveAll("NotRegistered")).toEqual([]);
    });

    it("should resolve services from parent container, when child container has no registered services by given key", () => {
      expect(childContainer.resolveAll("DummyService")).toEqual([
        dummyServiceInstance,
        expect.any(DummyService),
      ]);
    });

    it("should resolve services from current container instead of parent, when current container has own registrations of such services", () => {
      const childDummyService = new DummyService();
      childContainer.registerConstant("DummyService", childDummyService);
      expect(container.resolveAll("DummyService")).toEqual([
        dummyServiceInstance,
        expect.any(DummyService),
      ]);
      expect(childContainer.resolveAll("DummyService")).toEqual([
        childDummyService,
        expect.any(DummyService),
      ]);
    });

    it("should resolve services from parent container and from current container", () => {
      const dummyService = new DummyService();
      childContainer.registerConstant("DummyService", dummyService, {
        name: "child",
      });
      expect(childContainer.resolveAll("DummyService")).toEqual([
        dummyServiceInstance,
        expect.any(DummyService),
        dummyService,
      ]);
    });
  });

  describe("resolveTuple() method", () => {
    beforeEach(() => {
      container.registerFactory("DummyService", () => new DummyService(), {
        lifecycle: "request",
      });
    });

    it("should resolve tuple of services in single request context", () => {
      const service1 = container.resolve("DummyService");
      const service2 = container.resolve("DummyService");
      const [service3, service4] = container.resolveTuple([
        "DummyService",
        "DummyService",
      ] as const);
      expect(service1).not.toBe(service2);
      expect(service3).toBe(service4);
    });

    it("should resolve tuple of services in single request context from parent container", () => {
      const [service1, service2] = childContainer.resolveTuple([
        "DummyService",
        "DummyService",
      ] as const);
      expect(service2).toBe(service1);
    });
  });

  describe("unregister() method", () => {
    beforeEach(() => {
      container.registerConstant("DummyService", new DummyService());
      container.registerFactory("DummyService", () => new DummyService(), {
        name: "dynamic",
      });
      container.registerFactory("DummyDependent", (resolver) => {
        return new DummyDependent(
          resolver.resolve("DummyService"),
          resolver.resolve("DummyService", "dynamic")
        );
      });
    });

    it("should unregister all services, when name is not passed", () => {
      expect(container.resolve("DummyService")).toBeInstanceOf(DummyService);
      expect(container.resolve("DummyService", "dynamic")).toBeInstanceOf(
        DummyService
      );
      container.unregister("DummyService");
      expect(() => container.resolve("DummyService")).toThrow(RangeError);
      expect(() => container.resolve("DummyService", "dynamic")).toThrow(
        RangeError
      );
    });

    it("should unregister only named service, when name is given", () => {
      expect(container.resolve("DummyService")).toBeInstanceOf(DummyService);
      expect(container.resolve("DummyService", "dynamic")).toBeInstanceOf(
        DummyService
      );

      container.unregister("DummyService", "default");
      expect(() => container.resolve("DummyService")).toThrow(RangeError);
      expect(container.resolve("DummyService", "dynamic")).toBeInstanceOf(
        DummyService
      );

      container.unregister("DummyService", "dynamic");
      expect(() => container.resolve("DummyService", "dynamic")).toThrow(
        RangeError
      );
    });

    it("should unregister services in parent container, when 'cascade' argument is set to true", () => {
      expect(childContainer.resolve("DummyService")).toBeInstanceOf(
        DummyService
      );
      expect(container.resolve("DummyService")).toBeInstanceOf(DummyService);

      childContainer.unregister("DummyService");

      expect(childContainer.resolve("DummyService")).toBeInstanceOf(
        DummyService
      );
      expect(container.resolve("DummyService")).toBeInstanceOf(DummyService);

      childContainer.unregister("DummyService", undefined, true);

      expect(() => childContainer.resolve("DummyService")).toThrow(RangeError);
      expect(() => container.resolve("DummyService")).toThrow(RangeError);
    });
  });

  describe("has() method", () => {
    it("should return true, when container has registered service instance, and false otherwise", () => {
      expect(container.has("DummyService")).toBe(false);
      expect(container.has("DummyService", "default")).toBe(false);
      expect(container.has("DummyService", "named")).toBe(false);

      container.registerConstant("DummyService", new DummyService(), {
        name: "named",
      });

      expect(container.has("DummyService")).toBe(true);
      expect(container.has("DummyService", "default")).toBe(false);
      expect(container.has("DummyService", "named")).toBe(true);

      container.registerConstant("DummyService", new DummyService());

      expect(container.has("DummyService")).toBe(true);
      expect(container.has("DummyService", "default")).toBe(true);
      expect(container.has("DummyService", "named")).toBe(true);

      container.unregister("DummyService", "named");

      expect(container.has("DummyService")).toBe(true);
      expect(container.has("DummyService", "default")).toBe(true);
      expect(container.has("DummyService", "named")).toBe(false);
    });

    it("should return true, when container has registered service factory, and false otherwise", () => {
      const factory = () => new DummyService();

      expect(container.has("DummyService")).toBe(false);
      expect(container.has("DummyService", "default")).toBe(false);
      expect(container.has("DummyService", "named")).toBe(false);

      container.registerFactory("DummyService", factory, {
        name: "named",
      });

      expect(container.has("DummyService")).toBe(true);
      expect(container.has("DummyService", "default")).toBe(false);
      expect(container.has("DummyService", "named")).toBe(true);

      container.registerFactory("DummyService", factory);

      expect(container.has("DummyService")).toBe(true);
      expect(container.has("DummyService", "default")).toBe(true);
      expect(container.has("DummyService", "named")).toBe(true);

      container.unregister("DummyService", "named");

      expect(container.has("DummyService")).toBe(true);
      expect(container.has("DummyService", "default")).toBe(true);
      expect(container.has("DummyService", "named")).toBe(false);
    });

    it("should return true, if child container has not registered service, but parent container has", () => {
      expect(childContainer.has("DummyService")).toBe(false);
      expect(childContainer.has("DummyService", "default")).toBe(false);
      expect(childContainer.has("DummyService", "named")).toBe(false);

      container.registerConstant("DummyService", new DummyService(), {
        name: "named",
      });

      expect(childContainer.has("DummyService")).toBe(true);
      expect(childContainer.has("DummyService", "default")).toBe(false);
      expect(childContainer.has("DummyService", "named")).toBe(true);

      container.registerConstant("DummyService", new DummyService());

      expect(childContainer.has("DummyService")).toBe(true);
      expect(childContainer.has("DummyService", "default")).toBe(true);
      expect(childContainer.has("DummyService", "named")).toBe(true);

      container.unregister("DummyService", "named");

      expect(childContainer.has("DummyService")).toBe(true);
      expect(childContainer.has("DummyService", "default")).toBe(true);
      expect(childContainer.has("DummyService", "named")).toBe(false);
    });
  });

  describe("hasOwn() method", () => {
    it("should return true, when container has registered service in it's own storage and false otherwise", () => {
      container.registerFactory("DummyService", () => new DummyService());
      childContainer.registerFactory("DummyService", () => new DummyService());

      expect(container.has("DummyService")).toBe(true);
      expect(childContainer.has("DummyService")).toBe(true);
      expect(container.hasOwn("DummyService")).toBe(true);
      expect(childContainer.hasOwn("DummyService")).toBe(true);

      childContainer.unregister("DummyService");

      expect(container.has("DummyService")).toBe(true);
      expect(childContainer.has("DummyService")).toBe(true);
      expect(container.hasOwn("DummyService")).toBe(true);
      expect(childContainer.hasOwn("DummyService")).toBe(false);
    });
  });

  describe("createChild() method", () => {
    it("should return new instance of Container", () => {
      const child = container.createChild();
      expect(child).toBeInstanceOf(Container);
      expect(child).not.toBe(container);
    });
  });

  describe("getParent() method", () => {
    it("should return parent container", () => {
      expect(childContainer.getParent()).toBe(container);
    });

    it("should return undefined, when container has no parent", () => {
      expect(container.getParent()).toBeUndefined();
    });
  });

  describe("backup() and restore() methods", () => {
    let dummyServiceInstance: DummyService;
    beforeEach(() => {
      dummyServiceInstance = new DummyService();
      container.registerConstant("DummyService", dummyServiceInstance);
      container.registerFactory("DummyDependent", (context) => {
        return new DummyDependent(
          context.resolve("DummyService"),
          context.resolve("DummyService")
        );
      });
    });

    it("should backup and restore service registrations", () => {
      const dummyServiceOverride = new DummyService();

      expect(container.resolve("DummyService")).toBe(dummyServiceInstance);

      container.backup();
      container.registerConstant("DummyService", dummyServiceOverride, {
        replace: true,
      });
      expect(container.resolve("DummyService")).toBe(dummyServiceOverride);

      container.restore();
      expect(container.resolve("DummyService")).toBe(dummyServiceInstance);
    });

    it("should backup and restore only own registrations, unless 'cascade' argument is set to true", () => {
      const dummyServiceOverride = new DummyService();
      const childDummyService = new DummyService();
      childContainer.registerConstant("DummyService", childDummyService);

      expect(container.resolve("DummyService")).toBe(dummyServiceInstance);
      expect(childContainer.resolve("DummyService")).toBe(childDummyService);

      childContainer.backup();
      container.registerConstant("DummyService", dummyServiceOverride, {
        replace: true,
      });
      childContainer.registerConstant("DummyService", dummyServiceOverride, {
        replace: true,
      });

      expect(container.resolve("DummyService")).toBe(dummyServiceOverride);
      expect(childContainer.resolve("DummyService")).toBe(dummyServiceOverride);

      childContainer.restore();
      expect(container.resolve("DummyService")).toBe(dummyServiceOverride);
      expect(childContainer.resolve("DummyService")).toBe(childDummyService);
    });

    it("should backup and restore registrations in parent container too, when 'cascade' argument is set to true", () => {
      const dummyServiceOverride = new DummyService();
      const childDummyService = new DummyService();
      childContainer.registerConstant("DummyService", childDummyService);

      expect(container.resolve("DummyService")).toBe(dummyServiceInstance);
      expect(childContainer.resolve("DummyService")).toBe(childDummyService);

      childContainer.backup(true);
      container.registerConstant("DummyService", dummyServiceOverride, {
        replace: true,
      });
      childContainer.registerConstant("DummyService", dummyServiceOverride, {
        replace: true,
      });

      expect(container.resolve("DummyService")).toBe(dummyServiceOverride);
      expect(childContainer.resolve("DummyService")).toBe(dummyServiceOverride);

      childContainer.restore(true);
      expect(container.resolve("DummyService")).toBe(dummyServiceInstance);
      expect(childContainer.resolve("DummyService")).toBe(childDummyService);
    });
  });

  describe("getServiceNames() method", () => {
    beforeEach(() => {
      container.registerFactory("DummyService", () => new DummyService());
      container.registerFactory("DummyService", () => new DummyService(), {
        name: "alternative",
      });
      childContainer.registerFactory("DummyService", () => new DummyService());
      childContainer.registerFactory("DummyService", () => new DummyService(), {
        name: "child",
      });
    });

    it("should return names of service registrations by given service key", () => {
      expect(container.getServiceNames("DummyService")).toEqual([
        "default",
        "alternative",
      ]);
    });

    it("should return names of service registrations from current and parrent container", () => {
      expect(childContainer.getServiceNames("DummyService")).toEqual([
        "default",
        "alternative",
        "child",
      ]);
    });

    it("should return empty array when there is no registrations of given service", () => {
      // @ts-expect-error testing unknown service key
      expect(container.getServiceNames("NotRegistered")).toEqual([]);
    });
  });

  describe("registerClassConfig() method", () => {
    it("should register class constructor with automatic factory creation", () => {
      expect(container.has(DummyService)).toBe(false);
      container.registerClassConfig(DummyService, []);
      expect(container.has(DummyService)).toBe(true);
      expect(container.resolve(DummyService)).toBeInstanceOf(DummyService);
    });

    it("should register class constructor with dependencies", () => {
      container.registerClassConfig(DummyDependent, [
        DummyService,
        { service: DummyService, name: "alt" },
      ]);
      container.registerClassConfig(DummyService, [], {
        lifecycle: "singleton",
      });
      container.registerClassConfig(DummyService, [], {
        name: "alt",
        lifecycle: "singleton",
      });
      const dependent = container.resolve(DummyDependent);
      expect(dependent.dummyService1).toBeInstanceOf(DummyService);
      expect(dependent.dummyService2).toBeInstanceOf(DummyService);
      expect(dependent.dummyService1).not.toBe(dependent.dummyService2);
    });

    it("should register class constructor with constant dependencies", () => {
      const dummyService = new DummyService();
      container.registerClassConfig(DummyDependent, [
        { constant: dummyService },
        { constant: dummyService },
      ]);
      const dummyDependent = container.resolve(DummyDependent);
      expect(dummyDependent.dummyService1).toBe(dummyService);
      expect(dummyDependent.dummyService2).toBe(dummyService);
    });
  });

  describe("implement() method", () => {
    it("should register class as implementation of interface", () => {
      container.implement("DummyService", DummyService, []);
      expect(container.resolve("DummyService")).toBeInstanceOf(DummyService);
    });

    it("should register class with dependencies as implementation of interface", () => {
      container.implement("DummyService", DummyService, []);
      container.implement("DummyDependent", DummyDependent, [
        "DummyService",
        "DummyService",
      ]);
      const dependent = container.resolve("DummyDependent");
      expect(dependent).toBeInstanceOf(DummyDependent);
      expect(dependent.dummyService1).toBeInstanceOf(DummyService);
      expect(dependent.dummyService2).toBeInstanceOf(DummyService);
    });

    it("should register named implementation of interface", () => {
      container.implement("DummyService", DummyService, [], {
        name: "alt-name",
      });
      expect(() => container.resolve("DummyService")).toThrow(RangeError);
      expect(container.resolve("DummyService", "alt-name")).toBeInstanceOf(
        DummyService
      );
    });
  });

  describe("registerModule() method", () => {
    it("should call module's register() method, and return function that unregisters module", () => {
      const module: ServiceModule<TestServicesMap> = {
        register(container: ServiceContainer<TestServicesMap>): void {
          container.registerClassConfig(DummyService, []);
        },
      };

      expect(container.has(DummyService)).toBe(false);
      container.registerModule(module);
      expect(container.has(DummyService)).toBe(true);
    });
  });

  describe("instantiate() method", () => {
    it("should create instance of given class", () => {
      expect(container.instantiate(DummyService, [])).toBeInstanceOf(
        DummyService
      );
    });

    it("should create instance of class with dependencies", () => {
      container.implement("DummyService", DummyService, []);
      expect(
        container.instantiate(DummyDependent, ["DummyService", "DummyService"])
      ).toBeInstanceOf(DummyDependent);
    });
  });

  describe("createArrayResolver() method", () => {
    it("should create and register resolver for service array", () => {
      container.implement("DummyService", DummyService, []);
      container.createArrayResolver("DummyService", "DummyService[]");
      expect(container.resolve("DummyService[]")).toEqual([
        expect.any(DummyService),
      ]);
    });

    it("should create and register resolver for service array, using constructor as key", () => {
      container.registerClassConfig(DummyService, []);
      container.createArrayResolver(DummyService, "DummyService[]");
      expect(container.resolve("DummyService[]")).toEqual([
        expect.any(DummyService),
      ]);
    });
  });
});
