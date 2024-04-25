/**
 * Services map.
 */
export interface ServicesMap {}

/**
 * Generic constructor.
 */
export type Constructor<ConstructedType extends object> = {
  new (
    ...args: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
  ): ConstructedType;
  name: string;
  length: number;
};

/**
 * Service key.
 */
export type ServiceKey<TServicesMap extends ServicesMap> =
  | keyof TServicesMap
  | Constructor<object>;

/**
 * Utility type. Infers service type by ServiceKey.
 */
export type ResolvedByKey<
  TServicesMap extends ServicesMap,
  TServiceKey extends ServiceKey<TServicesMap>,
> =
  TServiceKey extends Constructor<infer ConstructedType>
    ? ConstructedType
    : TServiceKey extends keyof TServicesMap
      ? TServicesMap[TServiceKey]
      : never;

/**
 * Object containing service key and name.
 */
export interface NamedServiceRecord<TServicesMap extends ServicesMap> {
  service: ServiceKey<TServicesMap>;
  name: string;
}

export function isNamedServiceRecord(
  obj: unknown
): obj is NamedServiceRecord<object> {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "service" in obj &&
    ["string", "function"].includes(typeof obj.service) &&
    "name" in obj &&
    typeof obj.name === "string"
  );
}

/**
 * Service key or NamedServiceRecord.
 */
export type ServiceToken<TServicesMap extends ServicesMap> =
  | ServiceKey<TServicesMap>
  | NamedServiceRecord<TServicesMap>;

/**
 * Array of service keys in ServicesMap or NamedServiceRecord objects.
 */
export type ServiceTokensTuple<TServicesMap extends ServicesMap> = [
  ...ServiceToken<TServicesMap>[],
];

/**
 * Utility type. Resolves service type using ServicesMap and service key or NamedServiceRecord.
 */
export type ResolvedByToken<
  TServicesMap extends ServicesMap,
  TServiceToken extends ServiceToken<TServicesMap>,
> =
  TServiceToken extends NamedServiceRecord<TServicesMap>
    ? ResolvedByKey<TServicesMap, TServiceToken["service"]>
    : TServiceToken extends keyof TServicesMap
      ? ResolvedByKey<TServicesMap, TServiceToken>
      : never;

/**
 * Utility type. Maps service key / NamedServiceRecord array to resolved services array type.
 */
export type ResolvedServicesTuple<
  TServiceMap extends ServicesMap,
  Tuple extends ServiceTokensTuple<TServiceMap>,
> = {
  [K in keyof Tuple]: ResolvedByToken<TServiceMap, Tuple[K]>;
} & { length: Tuple["length"] };

/**
 * Service resolver interface.
 */
export interface ServiceResolver<TServicesMap extends ServicesMap> {
  /**
   * Resolves single service by its key in ServicesMap and optional name. If name is omitted or is `undefined`,
   * "default" is used as name.
   *
   * @param key
   * @param name
   */
  resolve<TServiceKey extends ServiceKey<TServicesMap>>(
    key: TServiceKey,
    name?: string
  ): ResolvedByKey<TServicesMap, TServiceKey>;

  /**
   * Resolves array of services, registered under given key with different names. Returns empty array, when there is
   * no services, registered under given key.
   *
   * @param key
   */
  resolveAll<TServiceKey extends ServiceKey<TServicesMap>>(
    key: TServiceKey
  ): ResolvedByKey<TServicesMap, TServiceKey>[];

  /**
   * Resolves tuple of services, using given array of service keys / NamedServiceRecord objects. Used to get independent
   * services in single resolution context, which means that same instance of services, having 'request' lifecycle
   * will be resolved. There is no need to call this method inside service factories, since they're already resolves
   * services in same context.
   *
   * @param services
   */
  resolveTuple<ServiceTokens extends ServiceTokensTuple<TServicesMap>>(
    services: ServiceTokens
  ): ResolvedServicesTuple<TServicesMap, ServiceTokens>;

  /**
   * Checks if given service exists. When name is omitted, returns true, when at least one registration of given service
   * exists, ignoring registration name. When name is passed, returns true if there exists registration of given service
   * with given name.
   *
   * @param key
   * @param name
   */
  has(key: ServiceKey<TServicesMap>, name?: string): boolean;

  /**
   * Returns array of service names, registered under given key. If service was registered without explicit name,
   * it will have name "default".
   * @param key
   */
  getServiceNames(key: ServiceKey<TServicesMap>): string[];
}
