import { circular } from "./circular";
import { Context, type ServiceRegistration } from "./Context";
import {
  type ClassRegistrationOptions,
  type ConstantToken,
  type DependenciesTuple,
  type InterfaceImplementation,
  isConstantToken,
  type ServiceContainer,
  type ServiceFactory,
  type ServiceFactoryRegistrationOptions,
  type ServiceModule,
  type ServiceRegistrationOptions,
  type ServiceResolvingKey,
} from "./ServiceContainer";
import {
  type ResolvedServicesTuple,
  type ServiceTokensTuple,
  type ServicesMap,
  type ServiceKey,
  type ResolvedByKey,
  type Constructor,
  isNamedServiceRecord,
  type NamedServiceRecord,
} from "./ServiceResolver";
import { stringifyServiceKey } from "./stringifyServiceKey";

/**
 * Service container.
 */
export class Container<TServicesMap extends ServicesMap>
  implements ServiceContainer<TServicesMap>
{
  /**
   * Services registrations storage.
   *
   * @private
   */
  private registry: Map<
    ServiceKey<TServicesMap>,
    ServiceRegistration<TServicesMap, unknown>[]
  >;

  /**
   * Backup snapshots stack.
   *
   * @private
   */
  private readonly snapshots: Map<
    ServiceKey<TServicesMap>,
    ServiceRegistration<TServicesMap, unknown>[]
  >[];

  /**
   * Container constructor.
   *
   * @param parent
   */
  constructor(private readonly parent?: Container<TServicesMap>) {
    this.registry = new Map();
    this.snapshots = [];
  }

  /**
   * @inheritDoc
   */
  resolve<TServiceKey extends ServiceKey<TServicesMap>>(
    key: TServiceKey,
    name?: string
  ): ResolvedByKey<TServicesMap, TServiceKey> {
    return new Context(this.getMergedRegistry()).resolve(key, name);
  }

  /**
   * @inheritDoc
   */
  resolveAll<TServiceKey extends ServiceKey<TServicesMap>>(
    key: TServiceKey
  ): ResolvedByKey<TServicesMap, TServiceKey>[] {
    return new Context(this.getMergedRegistry()).resolveAll(key);
  }

  /**
   * @inheritDoc
   */
  resolveTuple<ServiceKeys extends ServiceTokensTuple<TServicesMap>>(
    services: ServiceKeys
  ): ResolvedServicesTuple<TServicesMap, ServiceKeys> {
    return new Context(this.getMergedRegistry()).resolveTuple(services);
  }

  /**
   * @inheritDoc
   */
  registerConstant<TServiceKey extends ServiceKey<TServicesMap>>(
    key: TServiceKey,
    service: ResolvedByKey<TServicesMap, TServiceKey>,
    options?: ServiceRegistrationOptions
  ) {
    this.registerConstantOrFactory(key, service, false, options);
  }

  /**
   * @inheritDoc
   */
  registerFactory<TServiceKey extends ServiceKey<TServicesMap>>(
    key: TServiceKey,
    factory: ServiceFactory<
      TServicesMap,
      ResolvedByKey<TServicesMap, TServiceKey>
    >,
    options?: ServiceFactoryRegistrationOptions
  ) {
    this.registerConstantOrFactory(key, factory, true, options);
  }

  registerClassConfig<
    ConstructorType extends Constructor<object>,
    DepsTuple extends DependenciesTuple<
      TServicesMap,
      ConstructorParameters<ConstructorType>
    >,
  >(
    constructor: ConstructorType,
    deps: DepsTuple,
    options: ClassRegistrationOptions = {}
  ) {
    const factory = this.createFactoryForConstructor(
      constructor,
      deps,
      options.circular
    );

    this.registerFactory(
      constructor,
      factory as ServiceFactory<
        TServicesMap,
        ResolvedByKey<TServicesMap, ConstructorType>
      >,
      options
    );
  }

  implement<
    TServiceKey extends keyof TServicesMap,
    ConstructorType extends InterfaceImplementation<TServicesMap, TServiceKey>,
    DepsTuple extends DependenciesTuple<
      TServicesMap,
      ConstructorParameters<ConstructorType>
    >,
  >(
    key: TServiceKey,
    implementation: ConstructorType,
    deps: DepsTuple,
    options: ClassRegistrationOptions = {}
  ) {
    const factory = this.createFactoryForConstructor(
      implementation,
      deps,
      options.circular
    );

    this.registerFactory(
      key,
      factory as ServiceFactory<
        TServicesMap,
        ResolvedByKey<TServicesMap, TServiceKey>
      >,
      options
    );
  }

  registerModule(module: ServiceModule<TServicesMap>): void {
    return module.register(this);
  }

  /**
   * @inheritDoc
   */
  unregister(key: ServiceKey<TServicesMap>, name?: string, cascade = false) {
    this.unregisterOwn(key, name);
    if (cascade && this.parent) {
      this.parent.unregister(key, name, true);
    }
  }

  /**
   * @inheritDoc
   */
  has(key: ServiceKey<TServicesMap>, name?: string): boolean {
    if (this.hasOwn(key, name)) {
      return true;
    }
    if (this.parent) {
      return this.parent.has(key, name);
    }
    return false;
  }

  /**
   * @inheritDoc
   */
  hasOwn(key: ServiceKey<TServicesMap>, name?: string): boolean {
    const registrations = this.registry.get(key);
    if (name === undefined) {
      return !!registrations?.length;
    }
    return !!registrations && !!registrations.find((r) => r.name === name);
  }

  /**
   * @inheritDoc
   */
  createChild(): Container<TServicesMap> {
    return new Container(this);
  }

  /**
   * @inheritDoc
   */
  getParent(): ServiceContainer<TServicesMap> | undefined {
    return this.parent;
  }

  /**
   * @inheritDoc
   */
  backup(cascade = false) {
    const newRegistry: Map<
      ServiceKey<TServicesMap>,
      ServiceRegistration<TServicesMap, unknown>[]
    > = new Map();
    for (const [key, registrations] of this.registry) {
      newRegistry.set(
        key,
        registrations.map((registration) => ({ ...registration }))
      );
    }
    this.snapshots.push(this.registry);
    this.registry = newRegistry;

    if (this.parent && cascade) {
      this.parent.backup(true);
    }
  }

  /**
   * @inheritDoc
   */
  restore(cascade = false) {
    const snapshot = this.snapshots.pop();
    if (snapshot) {
      this.registry.clear();
      this.registry = snapshot;
    }
    if (this.parent && cascade) {
      this.parent.restore(true);
    }
  }

  /**
   * @inheritDoc
   */
  getServiceNames(key: ServiceKey<TServicesMap>): string[] {
    const mergedRegistry = this.getMergedRegistry();
    const registrations = mergedRegistry.get(key);
    if (!registrations) {
      return [];
    }
    return registrations.map(({ name }) => name);
  }

  instantiate<
    ConstructorType extends Constructor<object>,
    DepsTuple extends DependenciesTuple<
      TServicesMap,
      ConstructorParameters<ConstructorType>
    >,
  >(
    constructor: ConstructorType,
    deps: DepsTuple
  ): InstanceType<ConstructorType> {
    const factory = this.createFactoryForConstructor(constructor, deps);
    const context = new Context(this.getMergedRegistry());
    return factory(context);
  }

  /**
   * Unregisters service from own registry.
   *
   * @param key
   * @param name
   * @private
   */
  private unregisterOwn(key: ServiceKey<TServicesMap>, name?: string) {
    if (name === undefined) {
      this.registry.delete(key);
      return;
    }
    const registrations = this.registry.get(key);
    if (registrations) {
      const registration = registrations.find((r) => r.name === name);
      if (registration) {
        registrations.splice(registrations.indexOf(registration), 1);
      }
      if (!registrations.length) {
        this.registry.delete(key);
      }
    }
  }

  /**
   * Returns service registry, resulting from merging parent container registry and own registry.
   *
   * @protected
   */
  protected getMergedRegistry(): Map<
    ServiceKey<TServicesMap>,
    ServiceRegistration<TServicesMap, unknown>[]
  > {
    if (!this.parent) {
      return this.registry;
    }
    const parentRegistry = this.parent.getMergedRegistry();
    const result: Map<
      ServiceKey<TServicesMap>,
      ServiceRegistration<TServicesMap, unknown>[]
    > = new Map();

    // Get unique service keys from both registries.
    const serviceKeys = new Set([
      ...parentRegistry.keys(),
      ...this.registry.keys(),
    ]);

    for (const serviceKey of serviceKeys) {
      const parentRegistrations = parentRegistry.get(serviceKey);
      const ownRegistrations = this.registry.get(serviceKey);
      if (!parentRegistrations && ownRegistrations) {
        result.set(serviceKey, ownRegistrations);
        continue;
      }
      if (!ownRegistrations && parentRegistrations) {
        result.set(serviceKey, parentRegistrations);
        continue;
      }
      if (parentRegistrations && ownRegistrations) {
        result.set(
          serviceKey,
          this.mergeRegistrations(parentRegistrations, ownRegistrations)
        );
      }
    }

    return result;
  }

  /**
   * Merges own concrete service registrations with parent registrations.
   *
   * @param parentRegistrations
   * @param ownRegistrations
   * @private
   */
  private mergeRegistrations<T>(
    parentRegistrations: ServiceRegistration<TServicesMap, T>[],
    ownRegistrations: ServiceRegistration<TServicesMap, T>[]
  ): ServiceRegistration<TServicesMap, T>[] {
    const mergedRegistrations = [...parentRegistrations];
    for (const registration of ownRegistrations) {
      const parentRegistration = mergedRegistrations.find(
        (r) => r.name === registration.name
      );
      if (parentRegistration) {
        mergedRegistrations.splice(
          mergedRegistrations.indexOf(parentRegistration),
          1,
          registration
        );
      } else {
        mergedRegistrations.push(registration);
      }
    }
    return mergedRegistrations;
  }

  /**
   * Registers constant or service factory.
   *
   * @param key
   * @param serviceOrFactory
   * @param isFactory
   * @param options
   * @private
   */
  private registerConstantOrFactory<
    TServiceKey extends ServiceKey<TServicesMap>,
  >(
    key: TServiceKey,
    serviceOrFactory:
      | ResolvedByKey<TServicesMap, TServiceKey>
      | ServiceFactory<TServicesMap, ResolvedByKey<TServicesMap, TServiceKey>>,
    isFactory: boolean,
    options: ServiceFactoryRegistrationOptions = {}
  ) {
    const registration = this.createRegistration(
      serviceOrFactory,
      isFactory,
      options
    );

    const existingRegistrations = this.registry.get(key) as
      | ServiceRegistration<
          TServicesMap,
          ResolvedByKey<TServicesMap, TServiceKey>
        >[]
      | undefined;
    if (!existingRegistrations) {
      this.registry.set(key, [registration]);
      return;
    }

    const { name } = registration;
    const existingRegistration = existingRegistrations.find(
      (r) => r.name === name
    );
    if (!existingRegistration) {
      existingRegistrations.push(registration);
      return;
    }

    if (!options.replace) {
      throw new TypeError(
        `Service "${stringifyServiceKey(key)}", named "${name}", already registered. Set 'replace' option to true, if you want to replace registration.`
      );
    }

    const index = existingRegistrations.indexOf(existingRegistration);
    existingRegistrations.splice(index, 1, registration);
  }

  /**
   * Creates registration object.
   *
   * @param serviceOrFactory
   * @param isFactory
   * @param options
   * @private
   */
  private createRegistration<ServiceType>(
    serviceOrFactory: ServiceType | ServiceFactory<TServicesMap, ServiceType>,
    isFactory: boolean,
    options: ServiceFactoryRegistrationOptions
  ): ServiceRegistration<TServicesMap, ServiceType> {
    return {
      name: options.name || "default",
      lifecycle: options.lifecycle || "transient",
      instance: !isFactory ? (serviceOrFactory as ServiceType) : undefined,
      factory: isFactory
        ? (serviceOrFactory as ServiceFactory<TServicesMap, ServiceType>)
        : undefined,
    };
  }

  private createFactoryForConstructor<
    ConstructorType extends Constructor<object>,
    DepsTuple extends DependenciesTuple<
      TServicesMap,
      ConstructorParameters<ConstructorType>
    >,
  >(
    constructor: ConstructorType,
    deps: DepsTuple,
    hasCircularDeps = false
  ): ServiceFactory<TServicesMap, InstanceType<ConstructorType>> {
    let factory: ServiceFactory<TServicesMap, InstanceType<ConstructorType>> = (
      context
    ) => {
      const resolvedDeps = (
        deps as unknown as (
          | ServiceKey<TServicesMap>
          | NamedServiceRecord<TServicesMap>
          | ConstantToken<unknown>
        )[]
      ).map((dep) => {
        if (isConstantToken(dep)) {
          return dep.constant;
        }
        if (isNamedServiceRecord(dep)) {
          return context.resolve(dep.service, dep.name);
        }
        return context.resolve(dep as ServiceKey<TServicesMap>);
      }) as ConstructorParameters<ConstructorType>;
      return new constructor(...resolvedDeps) as InstanceType<ConstructorType>;
    };

    if (hasCircularDeps) {
      factory = circular(factory);
    }

    return factory;
  }

  createArrayResolver<TServiceKey extends ServiceKey<TServicesMap>>(
    key: TServiceKey,
    arrayKey: ServiceResolvingKey<
      TServicesMap,
      ResolvedByKey<TServicesMap, TServiceKey>[]
    >,
    options?: ServiceFactoryRegistrationOptions
  ) {
    this.registerFactory(
      arrayKey,
      (context) =>
        context.resolveAll(key) as ResolvedByKey<
          TServicesMap,
          ServiceResolvingKey<
            TServicesMap,
            ResolvedByKey<TServicesMap, TServiceKey>[]
          >
        >,
      options
    );
  }
}
