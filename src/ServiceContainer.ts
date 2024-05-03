import type { ServiceResolutionContext } from "./ServiceResolutionContext";
import type {
  Constructor,
  ResolvedByKey,
  ServiceKey,
  ServiceResolver,
  ServicesMap,
} from "./ServiceResolver";

/**
 * Utility type. Infers union of keys of ServicesMap, which type is as given. Used for typing class dependencies tuple.
 */
export type ServiceResolvingKey<
  TServicesMap extends ServicesMap,
  ResolvedType,
> =
  | {
      [K in keyof TServicesMap]: TServicesMap[K] extends ResolvedType
        ? K
        : never;
    }[keyof TServicesMap]
  | (ResolvedType extends object ? Constructor<ResolvedType> : never);

/**
 * Utility type. Infers NamedServiceRecord, resolving given ResolvedType. Used for typing class dependencies tuple.
 */
type ServiceResolvingToken<TServicesMap extends ServicesMap, ResolvedType> = {
  /**
   * ServiceKey, resolving given ResolvedType
   */
  service: ServiceResolvingKey<TServicesMap, ResolvedType>;

  /**
   * Service name.
   */
  name: string;
};

/**
 * Special object interface for providing constant class dependencies, when some class depends on primitive types.
 */
export interface ConstantToken<T> {
  constant: T;
}

/**
 * Type guard for ConstantToken.
 *
 * @param obj
 */
export function isConstantToken(obj: unknown): obj is ConstantToken<unknown> {
  return typeof obj === "object" && obj !== null && "constant" in obj;
}

/**
 * Type alias of class dependency token.
 */
export type DependencyToken<TServicesMap extends ServicesMap, ResolvedType> =
  | ServiceResolvingKey<TServicesMap, ResolvedType>
  | ServiceResolvingToken<TServicesMap, ResolvedType>
  | ConstantToken<ResolvedType>
  | (ResolvedType extends object ? Constructor<ResolvedType> : never);

/**
 * Utility type. Infers tuple of DependencyToken's, which resolves tuple of class constructor arguments.
 */
export type DependenciesTuple<
  TServicesMap extends ServicesMap,
  Tuple extends [...unknown[]],
> = {
  [K in keyof Tuple]: DependencyToken<TServicesMap, Tuple[K]>;
} & { length: Tuple["length"] };

/**
 * Utility type. Infers constructor of type, resolved using given TServiceKey. Infers `never`, when type, resolved
 * by given key, is not object type.
 */
export type InterfaceImplementation<
  TServicesMap extends ServicesMap,
  TServiceKey extends keyof TServicesMap,
> = TServicesMap[TServiceKey] extends object
  ? Constructor<TServicesMap[TServiceKey]>
  : never;

/**
 * Service factory function. Takes service resolution context and returns service instance.
 */
export interface ServiceFactory<TServicesMap extends ServicesMap, ServiceType> {
  (context: ServiceResolutionContext<TServicesMap>): ServiceType;
}

/**
 * Service module interface.
 */
export interface ServiceModule<TServicesMap extends ServicesMap> {
  /**
   * Performs services registrations in given container.
   *
   * @param container
   */
  register(container: ServiceContainer<TServicesMap>): void;
}

/**
 * Lifecycle of services, created using factories:
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

/**
 * Class config registration options.
 */
export interface ClassRegistrationOptions
  extends ServiceFactoryRegistrationOptions {
  /**
   * Must be `true` for classes with circular dependencies.
   * @default false
   */
  circular?: boolean;
}

/**
 * Interface implementation registration options.
 */
export interface ImplementationRegistrationOptions
  extends ClassRegistrationOptions {}

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

  /**
   * Registers class dependencies configuration, using class as key. Multiple configurations can be registered, using
   * different names. If name is omitted, the name "default" is assigned implicitly.
   *
   * @param constructor
   * @param deps
   * @param options
   *
   * @example
   *
   * ```ts
   * container.registerClassConfig(TextDecoder, [{constant: "utf-8"}]);
   * container.registerClassConfig(TextDecoder, [{constant: "KOI8-R"}], {name: "koi8-r"});
   * ```
   */
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

  /**
   * Registers interface implementation, using key of ServicesMap, implementation constructor and DependenciesTuple.
   *
   * @param key
   * @param implementation
   * @param deps
   * @param options
   *
   * @example
   * ```ts
   * class ConcreteApiClient implements ApiClient {
   *    constructor(private readonly httpClient: HttpClient) {}
   *    // ...
   * }
   *
   * container.implement("ApiClient", ConcreteApiClient, ["HttpClient"]);
   * ```
   */
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
    options?: ImplementationRegistrationOptions
  ): void;

  /**
   * Loads ServiceModule.
   *
   * @param module
   */
  loadModule(module: ServiceModule<TServicesMap>): void;

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

  /**
   * Creates instance of given class. Constructor dependencies are resolved, using DependenciesTuple.
   *
   * @param constructor
   * @param deps
   */
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

  /**
   * Generates ServiceFactory of array of given services under `arrayKey`.
   *
   * @param key
   * @param arrayKey
   * @param options
   *
   * @example
   * ```ts
   * interface TypesMap extends ServicesMap {
   *  DatabaseConnection: DatabaseConnection;
   *  "DatabaseConnection[]": DatabaseConnection[];
   * }
   *
   * // ...
   *
   * container.createArrayResolver("DatabaseConnection", "DatabaseConnection[]");
   * ```
   */
  createArrayResolver<TServiceKey extends ServiceKey<TServicesMap>>(
    key: TServiceKey,
    arrayKey: ServiceResolvingKey<
      TServicesMap,
      ResolvedByKey<TServicesMap, TServiceKey>[]
    >,
    options?: ServiceFactoryRegistrationOptions
  ): void;
}
