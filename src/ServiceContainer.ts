import type { ServiceResolutionContext } from "./ServiceResolutionContext";
import type {
  Constructor,
  ResolvedByKey,
  ServiceKey,
  ServiceResolver,
  ServicesMap,
} from "./ServiceResolver";

export type ServiceResolvingKey<
  TServicesMap extends ServicesMap,
  ResolvedType,
> = {
  [K in keyof TServicesMap]: TServicesMap[K] extends ResolvedType ? K : never;
}[keyof TServicesMap];

type ServiceResolvingToken<TServicesMap extends ServicesMap, ResolvedType> = {
  service:
    | ServiceResolvingKey<TServicesMap, ResolvedType>
    | (ResolvedType extends object ? Constructor<ResolvedType> : never);
  name: string;
};

export interface ConstantToken<T> {
  constant: T;
}

export function isConstantToken(obj: unknown): obj is ConstantToken<unknown> {
  return typeof obj === "object" && obj !== null && "constant" in obj;
}

export type DependencyToken<TServicesMap extends ServicesMap, ResolvedType> =
  | ServiceResolvingKey<TServicesMap, ResolvedType>
  | ServiceResolvingToken<TServicesMap, ResolvedType>
  | ConstantToken<ResolvedType>
  | (ResolvedType extends object ? Constructor<ResolvedType> : never);

export type DependenciesTuple<
  TServicesMap extends ServicesMap,
  Tuple extends [...unknown[]],
> = {
  [K in keyof Tuple]: DependencyToken<TServicesMap, Tuple[K]>;
} & { length: Tuple["length"] };

export type InterfaceImplementation<
  TServicesMap extends ServicesMap,
  ServiceKey extends keyof TServicesMap,
> = TServicesMap[ServiceKey] extends object
  ? Constructor<TServicesMap[ServiceKey]>
  : never;

/**
 * Service factory function. Takes service resolution context and returns service instance.
 */
export interface ServiceFactory<TServicesMap extends ServicesMap, ServiceType> {
  (context: ServiceResolutionContext<TServicesMap>): ServiceType;
}

export interface ServiceModule<TServicesMap extends ServicesMap> {
  register(container: ServiceContainer<TServicesMap>): void;
}

/**
 * Service lifecycle:
 * - "transient": creates new service instance each time service is requested.
 * - "singleton": creates service instance when service is requested first time, and returns that service instance
 *    in all further service requests.
 * - "request": creates service instance once per root service resolution request and returns that instance in all further
 *    service requests in context of that root service resolution request.
 */
export type ServiceLifecycle = "transient" | "singleton" | "request";

/**
 * Service registration options.
 */
export interface ServiceRegistrationOptions {
  /**
   * Service name. Used to distinguish between different variations of same interface.
   * @default "default"
   */
  name?: string;

  /**
   * Used to replace service, that is already registered under given key and name. If omitted or set to false,
   * TypeError will be thrown, if service under that key and name is already registered.
   *
   * @default false
   */
  replace?: boolean;
}

/**
 * Service factory registration options.
 */
export interface ServiceFactoryRegistrationOptions
  extends ServiceRegistrationOptions {
  /**
   * Service lifecycle.
   * @default "transient"
   */
  lifecycle?: ServiceLifecycle;
}

export interface ClassRegistrationOptions
  extends ServiceFactoryRegistrationOptions {
  circular?: boolean;
}

/**
 * Service container interface.
 */
export interface ServiceContainer<TServicesMap extends ServicesMap>
  extends ServiceResolver<TServicesMap> {
  /**
   * Registers constant value under given key.
   *
   * @param key
   * @param service
   * @param options
   */
  registerConstant<TServiceKey extends ServiceKey<TServicesMap>>(
    key: TServiceKey,
    service: ResolvedByKey<TServicesMap, TServiceKey>,
    options?: ServiceRegistrationOptions
  ): void;

  /**
   * Registers service factory under given key.
   *
   * @param key
   * @param factory
   * @param options
   */
  registerFactory<TServiceKey extends ServiceKey<TServicesMap>>(
    key: TServiceKey,
    factory: ServiceFactory<
      TServicesMap,
      ResolvedByKey<TServicesMap, TServiceKey>
    >,
    options?: ServiceFactoryRegistrationOptions
  ): void;

  registerClassConfig<
    ConstructorType extends Constructor<object>,
    DepsTuple extends DependenciesTuple<
      TServicesMap,
      ConstructorParameters<ConstructorType>
    >,
  >(
    constructor: ConstructorType,
    deps: DepsTuple,
    options?: ClassRegistrationOptions
  ): void;

  implement<
    ServiceKey extends keyof TServicesMap,
    ConstructorType extends InterfaceImplementation<TServicesMap, ServiceKey>,
    DepsTuple extends DependenciesTuple<
      TServicesMap,
      ConstructorParameters<ConstructorType>
    >,
  >(
    key: ServiceKey,
    implementation: ConstructorType,
    deps: DepsTuple,
    options?: ClassRegistrationOptions
  ): void;

  registerModule(module: ServiceModule<TServicesMap>): void;

  /**
   * Removes service registration. When name is omitted or is `undefined`, removes all registrations of that
   * service. If name is passed, removes only service registration, that has given name.
   * When 'cascade' argument is set to true, also removes that registration from all parent containers.
   *
   * @param key
   * @param name
   * @param cascade
   */
  unregister(
    key: ServiceKey<TServicesMap>,
    name?: string,
    cascade?: boolean
  ): void;

  /**
   * Creates child container. Child container can override any service registration, that exists in parent container,
   * without changing parent container registrations. All parent container registrations are still available in child
   * container.
   */
  createChild(): ServiceContainer<TServicesMap>;

  /**
   * Checks if container has own service registration of given key and optional name. Unlike `has()` method, it doesn't
   * check registrations in parent container.
   *
   * @param key
   * @param name
   */
  hasOwn(key: ServiceKey<TServicesMap>, name?: string): boolean;

  /**
   * Returns parent container, if it exists.
   */
  getParent(): ServiceContainer<TServicesMap> | undefined;

  /**
   * Creates snapshot of current container registrations and stores it in internal storage. Registrations can be restored
   * later, using `restore()` method. Backups are stackable. When 'cascade' argument is set to true, then `backup()`
   * method is called through all ancestor containers hierarchy.
   *
   * @param cascade
   */
  backup(cascade?: boolean): void;

  /**
   * Restores service registrations state to previous snapshot, made using `backup()` method. If there is no snapshots,
   * does nothing. When 'cascade' argument is set to true, then `restore()` method is called through all ancestor
   * containers hierarchy.
   *
   * @param cascade
   */
  restore(cascade?: boolean): void;

  instantiate<
    ConstructorType extends Constructor<object>,
    DepsTuple extends DependenciesTuple<
      TServicesMap,
      ConstructorParameters<ConstructorType>
    >,
  >(
    constructor: ConstructorType,
    deps: DepsTuple
  ): InstanceType<ConstructorType>;

  createArrayResolver<TServiceKey extends ServiceKey<TServicesMap>>(
    key: TServiceKey,
    arrayKey: ServiceResolvingKey<
      TServicesMap,
      ResolvedByKey<TServicesMap, TServiceKey>[]
    >,
    options?: ServiceFactoryRegistrationOptions
  ): void;
}
