import type { ServiceFactory } from "./ServiceContainer";
import type { ServicesMap } from "./ServiceResolver";

/**
 * Helper function for service factories with circular dependencies registration.
 *
 * @param factory
 */
export function circular<
  TServicesMap extends ServicesMap,
  ServiceType extends object,
>(
  factory: ServiceFactory<TServicesMap, ServiceType>
): ServiceFactory<TServicesMap, ServiceType> {
  return ((context) => {
    let instance: ServiceType;
    const getService = () => {
      if (!instance) {
        instance = factory(context);
      }
      return instance;
    };

    return new Proxy(
      {},
      {
        get(_: object, p: string | symbol, receiver: unknown): unknown {
          return Reflect.get(getService(), p, receiver);
        },
        set(
          _: object,
          p: string | symbol,
          newValue: unknown,
          receiver: unknown
        ): boolean {
          return Reflect.set(getService(), p, newValue, receiver);
        },
        has(_: object, p: string | symbol): boolean {
          return Reflect.has(getService(), p);
        },
        deleteProperty(_: object, p: string | symbol): boolean {
          return Reflect.deleteProperty(getService(), p);
        },
        getPrototypeOf(): object | null {
          return Reflect.getPrototypeOf(getService());
        },
        setPrototypeOf(_: object, v: object | null): boolean {
          return Reflect.setPrototypeOf(getService(), v);
        },
        isExtensible(): boolean {
          return Reflect.isExtensible(getService());
        },
        preventExtensions(): boolean {
          return Reflect.preventExtensions(getService());
        },
        defineProperty(
          _: object,
          property: string | symbol,
          attributes: PropertyDescriptor
        ): boolean {
          return Reflect.defineProperty(getService(), property, attributes);
        },
        getOwnPropertyDescriptor(
          _: object,
          p: string | symbol
        ): PropertyDescriptor | undefined {
          return Reflect.getOwnPropertyDescriptor(getService(), p);
        },
        ownKeys(): ArrayLike<string | symbol> {
          return Reflect.ownKeys(getService());
        },
      }
    ) as ServiceType;
  }) as ServiceFactory<TServicesMap, ServiceType>;
}
