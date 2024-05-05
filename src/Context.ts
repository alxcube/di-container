import type { ServiceFactory, ServiceLifecycle } from "./ServiceContainer";
import type { ServiceResolutionContext } from "./ServiceResolutionContext";
import { ServiceResolutionError } from "./ServiceResolutionError";
import type {
  NamedServiceKey,
  ResolvedServicesTuple,
  ServiceTokensTuple,
  ServicesMap,
  ServiceKey,
  ResolvedByKey,
} from "./ServiceResolver";
import { stringifyServiceKey } from "./stringifyServiceKey";

/**
 * Service registration record
 *
 * @internal
 */
export interface ServiceRegistration<SMap extends ServicesMap, ServiceType> {
  /**
   * Service name.
   */
  name: string;

  /**
   * Service instance, registered either using service container `registerConstant()` method, or created by service
   * factory with "singleton" lifecycle.
   */
  instance?: ServiceType;

  /**
   * Service factory function.
   */
  factory?: ServiceFactory<SMap, ServiceType>;

  /**
   * Service lifecycle (only when service registered using factory).
   */
  lifecycle: ServiceLifecycle;
}

/**
 * Service resolution context class.
 */
export class Context<TServicesMap extends ServicesMap>
  implements ServiceResolutionContext<TServicesMap>
{
  /**
   * Storage of resolved service instances, registered with "request" lifecycle.
   * @private
   */
  private readonly resolved: Map<
    ServiceKey<TServicesMap>,
    { name: string; service: unknown }[]
  >;

  /**
   * Services resolution stack.
   * @private
   */
  private readonly resolutionStack: NamedServiceKey<TServicesMap>[];

  /**
   * Delayed callbacks, executed after all dependencies stack resolution of current service resolution.
   *
   * @private
   */
  private readonly delayedCallbacksQueue: (() => void)[];

  /**
   * Context constructor.
   *
   * @param registry
   */
  constructor(
    private readonly registry: Map<
      ServiceKey<TServicesMap>,
      ServiceRegistration<TServicesMap, unknown>[]
    >
  ) {
    this.resolved = new Map();
    this.resolutionStack = [];
    this.delayedCallbacksQueue = [];
  }

  /**
   * @inheritDoc
   */
  resolve<TServiceKey extends ServiceKey<TServicesMap>>(
    key: TServiceKey,
    name = "default"
  ): ResolvedByKey<TServicesMap, TServiceKey> {
    this.resolutionStack.push({ service: key, name });
    let service: ResolvedByKey<TServicesMap, TServiceKey>;
    try {
      service = this.doResolve(key, name);
      this.executeDelayed();
      return service;
    } finally {
      this.resolutionStack.pop();
    }
  }

  /**
   * @inheritDoc
   */
  resolveAll<TServiceKey extends ServiceKey<TServicesMap>>(
    key: TServiceKey
  ): ResolvedByKey<TServicesMap, TServiceKey>[] {
    const registrations = this.registry.get(key);
    if (!registrations) {
      return [];
    }
    return registrations.map(({ name }) => this.resolve(key, name));
  }

  /**
   * @inheritDoc
   */
  resolveTuple<ServiceKeys extends ServiceTokensTuple<TServicesMap>>(
    services: ServiceKeys
  ): ResolvedServicesTuple<TServicesMap, ServiceKeys> {
    return services.map((key) => {
      if (typeof key === "object") {
        return this.resolve(key.service, key.name);
      }
      return this.resolve(key);
    }) as ResolvedServicesTuple<TServicesMap, ServiceKeys>;
  }

  /**
   * @inheritDoc
   */
  has(key: ServiceKey<TServicesMap>, name?: string): boolean {
    const registrations = this.registry.get(key);
    if (name === undefined) {
      return !!registrations?.length;
    }
    return !!registrations && !!registrations.find((r) => r.name === name);
  }

  /**
   * @inheritDoc
   */
  getStack(): NamedServiceKey<TServicesMap>[] {
    return [...this.resolutionStack];
  }

  /**
   * @inheritDoc
   */
  isResolvingFor(key: ServiceKey<TServicesMap>, name?: string): boolean {
    return !!this.resolutionStack.find((entry) => {
      return (
        entry.service === key && (name === undefined || entry.name === name)
      );
    });
  }

  /**
   * @inheritDoc
   */
  isDirectlyResolvingFor(
    key: ServiceKey<TServicesMap>,
    name?: string
  ): boolean {
    if (this.resolutionStack.length < 2) {
      // Call made from resolution root.
      return false;
    }
    const resolvingFor = this.resolutionStack[this.resolutionStack.length - 2];
    return (
      resolvingFor.service === key &&
      (name === undefined || resolvingFor.name === name)
    );
  }

  /**
   * @inheritDoc
   */
  getServiceNames(key: ServiceKey<TServicesMap>): string[] {
    const registrations = this.registry.get(key);
    if (!registrations) {
      return [];
    }
    return registrations.map(({ name }) => name);
  }

  /**
   * @inheritDoc
   */
  delay(callback: () => void) {
    this.delayedCallbacksQueue.push(callback);
  }

  /**
   * Performs service resolution.
   *
   * @param key
   * @param name
   * @private
   */
  private doResolve<TServiceKey extends ServiceKey<TServicesMap>>(
    key: TServiceKey,
    name = "default"
  ): ResolvedByKey<TServicesMap, TServiceKey> {
    const alreadyResolved = this.findInResolved(key, name);
    if (alreadyResolved) {
      return alreadyResolved;
    }

    return this.resolveRegistered(key, name);
  }

  /**
   * Resolves service, using container registration record.
   *
   * @param key
   * @param name
   * @private
   */
  private resolveRegistered<TServiceKey extends ServiceKey<TServicesMap>>(
    key: TServiceKey,
    name: string
  ): ResolvedByKey<TServicesMap, TServiceKey> {
    const registration = this.getServiceRegistration(key, name);

    if (registration.instance) {
      // Return instance, that was registered as constant or resolved earlier with "singleton" lifecycle.
      return registration.instance;
    }

    if (!registration.factory) {
      // Make sure we have service factory
      throw new TypeError(
        `Service "${stringifyServiceKey(key)}" has neither instance, nor factory.`
      );
    }

    const instance = this.resolveWithErrorHandling(
      key,
      name,
      registration.factory
    );

    if (["singleton", "request"].includes(registration.lifecycle)) {
      // Store resolved instance in resolution context cache for further resolutions.
      this.saveInResolved(key, instance, name);

      if (registration.lifecycle === "singleton") {
        // Store resolved value in container registration.
        registration.instance = instance;
      }
    }

    return instance;
  }

  /**
   * Executes service factory with errors handling and returns resolved value.
   *
   * @param key
   * @param name
   * @param factory
   * @private
   */
  private resolveWithErrorHandling<
    TServiceKey extends ServiceKey<TServicesMap>,
  >(
    key: TServiceKey,
    name: string,
    factory: ServiceFactory<
      TServicesMap,
      ResolvedByKey<TServicesMap, TServiceKey>
    >
  ): ResolvedByKey<TServicesMap, TServiceKey> {
    try {
      this.checkForCircularDependency();
      return factory(this);
    } catch (e) {
      if (e instanceof ServiceResolutionError) {
        throw e;
      }
      throw new ServiceResolutionError(
        `An error occurred in "${stringifyServiceKey(key)}" service factory, named "${name}"`,
        this.getStack(),
        e
      );
    }
  }

  /**
   * Searches for previously resolved service instance in context resolved services storage..
   *
   * @param key
   * @param name
   * @private
   */
  private findInResolved<TServiceKey extends ServiceKey<TServicesMap>>(
    key: TServiceKey,
    name: string
  ): ResolvedByKey<TServicesMap, TServiceKey> | undefined {
    const resolved = this.resolved.get(key) as
      | { name: string; service: ResolvedByKey<TServicesMap, TServiceKey> }[]
      | undefined;
    if (!resolved) {
      return;
    }
    const named = resolved.find((record) => record.name === name);
    return (named && named.service) || undefined;
  }

  /**
   * Stores resolved service with "singleton" or "request" lifecycle in context resolved services storage.
   *
   * @param key
   * @param service
   * @param name
   * @private
   */
  private saveInResolved<TServiceKey extends ServiceKey<TServicesMap>>(
    key: TServiceKey,
    service: ResolvedByKey<TServicesMap, TServiceKey>,
    name: string
  ): void {
    const existingResolved = this.resolved.get(key);
    if (!existingResolved) {
      this.resolved.set(key, [{ service, name }]);
      return;
    }
    const existingNamed = existingResolved.find(
      (record) => record.name === name
    );
    if (existingNamed) {
      existingNamed.service = service;
      return;
    }

    existingResolved.push({ service, name });
  }

  /**
   * Searches for service registration using service key and name. Throws `RangeError` if registration is not found.
   *
   * @param key
   * @param name
   * @private
   */
  private getServiceRegistration<TServiceKey extends ServiceKey<TServicesMap>>(
    key: TServiceKey,
    name: string
  ): ServiceRegistration<
    TServicesMap,
    ResolvedByKey<TServicesMap, TServiceKey>
  > {
    const registrations = this.registry.get(key) as
      | ServiceRegistration<
          TServicesMap,
          ResolvedByKey<TServicesMap, TServiceKey>
        >[]
      | undefined;
    if (!registrations) {
      throw new RangeError(
        `Service "${stringifyServiceKey(key)}" is not found.`
      );
    }
    const registration = registrations.find((record) => record.name === name);
    if (!registration) {
      throw new RangeError(
        `Service "${stringifyServiceKey(key)}", named "${name}" is not found.`
      );
    }
    return registration;
  }

  /**
   * Checks for circular dependencies and throws ServiceResolutionError, if circular dependency was found.
   *
   * @private
   */
  private checkForCircularDependency() {
    const resolutionStackPath = this.resolutionStack.map(
      (entry) => `${stringifyServiceKey(entry.service)}[${entry.name}]`
    );
    const current = resolutionStackPath.pop();
    if (!current) {
      // This shouldn't happen
      return;
    }
    const firstAppeared = resolutionStackPath.indexOf(current);
    if (firstAppeared < 0) {
      // If no previous requests for current service was made -- no circular dependency
      return;
    }

    // Get resolutions stack from first request of current service to the previous resolution.
    const substack = resolutionStackPath.slice(firstAppeared);
    if (substack.length % 2) {
      // If sub-stack length is odd, no circular dependency
      return;
    }

    // Divide sub-stack into two equal arrays and compare - if they're equal - circular dependency detected.
    const first = substack.splice(substack.length / 2, substack.length / 2);
    for (let i = 0; i < first.length; i++) {
      if (first[i] !== substack[i]) {
        return;
      }
    }

    // Circular dependency detected.
    const circularPath = first.join(" < ") + ` < (CIRCULAR) ${current}`;
    throw new Error(`Circular dependency detected: ${circularPath}`);
  }

  /**
   * Executes delayed callbacks queue.
   *
   * @private
   */
  private executeDelayed(): void {
    let callback = this.delayedCallbacksQueue.shift();
    while (callback) {
      callback();
      callback = this.delayedCallbacksQueue.shift();
    }
  }
}
