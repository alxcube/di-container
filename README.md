# @alxcube/di-container

Simple but flexible type-safe dependency injection container for TypeScript
applications.

## Installation

```shell
npm i @alxcube/di-container
```

## Glossary

This section explains the terms used in this documentation.

### Service Container

Implementation of Dependency Injection Container pattern.

### Service Resolution Context

Service resolution context is a special object available in service factories.
This object provides methods for retrieving services that are dependencies of the service
being created by the factory. It exists within the scope of a single root service request.
Additionally, it provides methods to determine whether the current service is being
resolved as a dependency for another service, as well as the current stack of service
resolution.

See [ServiceResolutionContext interface](./src/ServiceResolutionContext.ts).

### Service

Service - an object or value obtained from the container. In general, services are
implementations of your application's interfaces, but the container allows storing
values of any type.

### Service Factory

Service factory is a callback function that will be invoked when a service is requested
from the container. The sole argument of the function is the
[Service Resolution Context](#service-resolution-context) object, which allows obtaining
dependencies of the constructed service. This function should return a value of the
corresponding type.

### Service Map

Service map is an auxiliary interface that represents the mapping between service keys and
service types. It enables TypeScript to leverage type inference, making calls to container
methods type-safe, and assists you in working with code hints from your IDE.

While any strings can be used as property names in this interface, it is recommended to
name them according to the names of your application's interfaces.

Index signature (`[key: string]: any;`) should not be used, since it breaks type inference.

### Service Key

Service key is either a key of the [service map](#service-map) interface or a class
constructor. Services are registered and retrieved from the container using this key.

### Service Token

Service Token is an object that has two properties: `'service'` - the
[service key](#service-key), and `'name'` - the service name.

### Constant Token

Constant token is an object with a single property `'constant'`, which can hold a value
of any type. It is used to declare dependencies of a class that are not retrieved from
the container and are passed directly to the class constructor in methods
`registerClassConfig()`, `implement()` and `instantiate()`.

### Dependencies Tuple

Dependencies tuple is a special type of tuple whose members are
[Service keys](#service-key), [Service tokens](#service-token), or
[Constant tokens](#constant-token), from which values of the corresponding type are
resolved. It is used for declaratively specifying the dependencies of a class constructor
in the methods registerClassConfig(), implement(), and instantiate().

## Usage

### Create service map

First of all, you need to create a [service map](#service-map) and specify in it the
types of services that will be available in the container.

```ts
// TypesMap.ts
import type { ServicesMap } from "@alxcube/di-container";
import type { HttpClient } from "./HttpClient";
import type { BackendApiClient } from "./BackendApiClient";

// Extending of ServicesMap is not required, but recommended for clarity.
export interface TypesMap extends ServicesMap {
  HttpClient: HttpClient;
  "HttpClient[]": HttpClient[];
  BackendApiClient: BackendApiClient;
  applicationKey: string;
}
```

### Creating container

After declaring service map, you are now ready to create container instance:

```ts
// container.ts
import { Container } from "@alxcube/di-container";
import type { TypesMap } from "./TypesMap";

export const container = new Container<TypesMap>();
```

### Resolving services

There are several methods for resolving services from container.

#### Resolving single service

To retrieve a service from the container, you use the `resolve()` method. It takes the
[service key](#service-key) as an argument and returns a value of the corresponding type.
If the key passed is key of [service map](#service-map), the method returns the
corresponding type according to the map. If a constructor is passed as the key, an instance
of the provided class will be returned. However, remember to register the appropriate
[service factory](#service-factory) for the class; the container does not inherently know
how to instantiate class instances.

The second argument of the method, `name`, allows you to retrieve a service with the
corresponding name. If this parameter is omitted, the name "default" is implicitly used
(the same applies to registration in the container).

If there is no service registered in the container with the given key or name, a
`RangeError` will be thrown.

```ts
const httpClient: HttpClient = container.resolve("HttpClient");

// There is no need to declare types, since type inference works using types map
const paymentsApiHttpClient = container.resolve("HttpClient", "payment");
```

#### Resolving array of services

The resolveAll() method takes a service key and returns an array of services of the
corresponding type registered under different names. If there are no registrations for
this service in the container, an empty array will be returned.

```ts
// The inferred type is HttpClient[]
const httpClients = container.resolveAll("HttpClient");
```

#### Resolving tuple of services

To obtain a tuple of services, you use the `resolveTuple()` method. It takes a tuple as
an argument, whose members are either [service keys](#service-key) or
[service tokens](#service-token). The return value is a tuple of the corresponding
services.

This method can be useful when you need to retrieve multiple services from the container
within the same context, when the services have a `'request'` lifecycle. Using this method for
services with other lifecycles does not make sense. The method is also available on
the [service resolution context](#service-resolution-context) object (in
[service factories](#service-factory)), but using it there does not make sense either, as
calls to `resolve()` on the `ServiceResolutionContext` object will already return services
within the context of the same request.

```ts
const [backendApiClient, httpClient] = container.resolveTuple([
  {
    service: "HttpClient",
    name: "backend"
  }, // Named services can be resolved, using ServiceToken interface
  "BackendApiClient"
] as const); // Don't forget "as const" to make type inference work
```

#### Retrieving service names

Using the `getServiceNames()` method, you can obtain an array of all names under which a
service with the given [service key](#service-key) has been registered. If the service
was registered without explicitly specifying a name, this array will include the name
`"default"`. If the service was not registered, an empty array will be returned.

```ts
container.registerConstant("HttpClient", new ConcreteHttpClient());
container.registerConstant("HttpClient", new AnotherHttpClient(), { name: "another" });

console.log(container.getServiceNames("HttpClient")); // ["default", "another"]
```

### Registering Services

There are several ways to register services.

#### Registering Constant

To register a constant value, you use the `registerConstant()` method. It takes a
[service key](#service-key) and the constant value as arguments. Values of any type are
supported, except for `undefined`. For example, you can register a primitive value or a
singleton object created outside the container using this method.

The third optional argument is an options object. The following options are available:
* `name` - Allows registering multiple services of the same type under the same service key.
It serves to differentiate between services of the same type. If this option is not
specified, the name `"default"` will be used implicitly.
* `replace` - When set to `true`, it replaces the service (taking into account the service
name) that was previously registered. If the option is set to `false` or omitted, and a
service with the given key (and name) is already registered, a `TypeError` will be thrown.

```ts
// Register string constant
container.register("applicationKey", "my_app_key");

// Register interface implementation as singleton
container.register("HttpClient", new ConcreteHttpClient(), { name: "payments" });

// Replace registered services
container.register("applicationKey", "other_app_key", { replace: true });
container.register("HttpClient", new ConcreteHttpClient(), { name: "payments", replace: true });
```

#### Registering Service Factory

Service factories are the most flexible and versatile way to register a service. To register
a factory, you use the `registerFactory()` method. It takes three parameters: the
[service key](#service-key) as the first parameter, the [factory function](#service-factory)
as the second parameter, and an options object as the third parameter.

This factory function accepts the [context object](#service-resolution-context) as an
argument and should return the corresponding service. Dependencies of the constructed
service can be obtained from the context object using the `resolve()`, `resolveAll()`, or
`resolveTuple()` methods.

This factory function will be invoked when the service is requested from the container or
as a dependency of another service in another factory function.

The lifecycle of the created service is regulated by the `lifecycle` option, which can
have one of three values:

* `"transient"` (default) - for each request of this service, the factory function will be
called, generally returning a new instance of the service.
* `"singleton"` - the factory function will be called once, after which the created
instance of the service will be stored in the container. For all subsequent requests,
the same instance of the service will be returned throughout the application's lifetime
(assuming the service registration is not updated).
* `"request"` - operates similarly to `"singleton"`, but only within the scope of a single
root request. A root request is considered to be a call to one of the `resolve()`,
`resolveAll()`, or `resolveTuple()` methods on the container instance. Thus, when
resolving a service of one root request, all services that depend on the service with the
`"request"` lifecycle will receive the same instance of it, but in the next root request,
this instance will be different.

In addition to `lifecycle`, the options of the `registerFactory()` method also include
`name` and `replace`, the meaning and action of which are identical to the similarly named
options of the [`registerConstant()`](#registering-constant) method.

```ts
// Register interface implementation as singleton
container.registerFactory(
  "HttpClient",
  () => new ConcreteHttpClient(),
  { lifecycle: "singleton" }
);

// Register interface implementation with dependencies
container.registerFactory(
  "BackendApiClient",
  (context) => new ConcreteBackendClient(context.resolve("HttpClient"))
);

// Register service factory, using constructor as key
container.registerFactory(TextEncoder, () => new TextEncoder());
```

#### Registering Class Configuration

In general, when only dependency injections through a class constructor are used, your
class factories may look quite similar:

```ts
container.registerFactory(
  MyClass,
  (context) => new MyClass(context.resolve("Dep1"), context.resolve("Dep2"))
)
```

To free you from routine and make class factory registration more declarative, the
`registerClassConfig()` method is designed. It takes the class constructor as the first
argument, and as the second argument, it accepts a
[tuple of dependencies](#dependencies-tuple), the corresponding members of which will be
used to extract the constructor dependencies in the respective order.
The third argument is an options object. In addition to options of
[`registerFactory()`](#registering-service-factory) method, there are 2 other options:
* `circular` - this should be set to true, when class has circular dependencies. See
details below in corresponding section.
* `className` - this option takes a string that will be substituted into error messages
when resolving this class. It simplifies understanding where an error occurred after your
code has been minified and classes used as keys have lost meaningful names. There is no
point in using this option more than once when registering multiple class configurations
because under the hood, it is associated with the constructor object itself rather than
with configuration variations.


Please note that you can pass dependencies that are not directly extracted from the
container by using a [constant token](#constant-token). Typically, this applies to
primitive data types that do not make much sense to store in the container.

You can use the `constant()` helper for convenience in creating constant tokens.

```ts 
import { constant } from "@alxcube/di-container";

// Register different configurations with constant 
container.registerClassConfig(
  TextDecoder,
  [{ constant: "utf-8" }],
  { name: "utf8" }
);
container.registerClassConfig(
  TextDecoder,
  [constant("koi8-r")], // use `constant()` helper
  { name: "koi8" }
);

// Resolving
const utf8Decoder = container.resolve(TextDecoder, "utf8");
const koi8Decoder = container.resolve(TextDecoder, "koi8");

// Registering class config with container dependencies
container.registerClassConfig(
  PaymentsApiClient,
  [
    { service: "HttpClient", name: "payment" }, // Dependency on service with specific name
    "XmlParser", // Dependency on default service
    TextDecoder, // Dependency on class
  ]
);
```

#### Registering Interface Implementation

Similarly, the `implement()` method works like the `registerClassConfig()` method,
allowing you to declaratively bind an interface to its implementing class. The first
argument of the method takes the string name of the interface, which is key of the
[service map](#service-map). The second argument is the constructor of the class
implementing this interface. The third argument is a
[tuple of class dependencies](#dependencies-tuple), just like in
[`registerClassConfig()`](#registering-class-configuration).
The fourth argument is options, which are the same as in
[`registerClassConfig()`](#registering-class-configuration).

```ts
// Register implementaion with no dependencies
container.implement("HttpClient", ConcreteHttpClient, []);

// Register implementation with dependencies
container.implement("BackendApiClient", ConcreteBackendClient, ["HttpClient"]);
```

#### Generating Array Resolvers

Some of your classes may depend on an array of homogeneous interfaces from the container.
Typically, such a dependency is resolved using the `resolveAll()` method inside the
service factory:

```ts
container.registerFactory(
  "HttpClientsPool",
  (context) => new ConcreteHttpClientsPool(
    context.resolveAll("HttpClient")
  )
);
```

To be able to leverage the benefits of declarative dependency specification in methods like
`registerClassConfig()` or `implement()`, you can use the `createArrayResolver()` method.

First, add a separate type for the array of the selected service to your service map.
For example, it might look like this:

```ts
interface AppServiceMap {
    HttpClient: HttpClient;
    "HttpClient[]": HttpClient[];
}
```

Then pass the keys of the single type and the corresponding array to the
`createArrayResolver()` method:

```ts
container.createArrayResolver("HttpClient", "HttpClient[]");
```

This will be equivalent to the following code:

```ts
container.registerFactory("HttpClient[]", (context) => context.resolveAll("HttpClient"));
```

Now you can declaratively use the dependency on the array:

```ts
container.implement("HttpClientPool", ConcreteHttpClientsPool, ["HttpClient[]"]);
```

The `createArrayResolver()` method also accepts options similar to the options of the
[`registerFactory()`](#registering-service-factory) method.

### Child Containers

The `createChild()` method creates an empty child container. It is "empty" in the sense
that it initially does not have its own service registrations, but all services registered
in the parent container are also accessible in the child container.

When registering services in the child container, they override registrations with the same
name from the parent container.

When removing a service from the child container, the existing registration from the
parent container (if it exists) is not removed unless the `cascade` parameter of the
`unregister()` method is set to `true`.

To obtain the parent container, you can use the `getParent()` method. It returns the
parent container or `undefined` if the container has no parent.

It is important to note that when requesting a service from the child container, a process
of merging all registrations across the container hierarchy occurs, which may lead to
performance degradation when there are a large number of registrations.

```ts
// Register interface implementation as singleton
container.implement("HttpClient", ConcreteHttpClient, [], { lifecycle: "singleton" });

// Create child container
const childContainer = container.createChild();

// Resolve http client from child container
const httpClient1 = childContainer.resolve("HttpClient");

// Override interface implementation in child container. (No need to pass `true` as
// `replace` option value, since child container hasn't own registration of HttpClient
childContainer.implement(
  "HttpClient",
  AxiosHttpClient,
  ["AxiosInstanceFactory"],
  { lifecycle: "singleton" }
);

// Resolve new implementation of http client from child container
const httpClient2 = childContainer.resolve("HttpClient");

// Now there are different implementations in parent and child containers.
console.log(httpClient1 === httpClient2); // false

// Parent container keeps old registration
console.log(httpClient1 === container.resolve("HttpClient")); // true
```

### Checking Service Existence

The `has()` method takes a [service key](#service-key) and an optional service name as
arguments and returns `true` if such a service is registered in the container, and `false`
otherwise. If no name is provided, the method returns `true` if there is at least one
registration for the service with that key. If a name is provided, it checks for the
existence of a registration with that specific name.

The `hasOwn()` method works similarly, with the only difference being that, unlike the
`has()` method, which checks for registrations in parent containers as well, the `hasOwn()`
method only checks for service registration in the container on which it was called.

```ts
// assume that HttpClient is registered in parent container, and not registered in child
console.log(childContainer.has("HttpClient")); // true
console.log(childContainer.hasOwn("HttpClient")); // false
console.log(container.has("HttpClient")); // true
console.log(container.hasOwn("HttpClient")); // true

// Check with name
console.log(container.has("HttpClient", "default")); // true
console.log(container.has("HttpClient", "not-registered-name")); // false
```

### Unregistering Service

To remove a service registration, the `unregister()` method is used. The only mandatory
argument is the [service key](#service-key). The second argument is the service name.
The third argument, `cascade`, indicates whether the service should also be removed from
all parent containers.

If the service name is not specified (or is `undefined`), all service registrations with
that key will be removed. If a name is provided, only the registration with the
corresponding name will be removed.

```ts
// Unregister HttpClient from child container.
childContainer.unregister("HttpClient");

// Unregistering services that are not registered does nothing
childContainer.unregister("HttpClient");
childContainer.unregister("HttpClient", "default");

// Unregister service from whole container hierarchy
console.log(parentContainer.has("HttpClient")); // true
childContainer.unregister("HttpClient", undefined, true);
console.log(parentContainer.has("HttpClient")); // false
```

### Circular dependencies


If your classes have cyclic dependencies, and for some reason you cannot refactor to
eliminate them, there are 2 ways to register classes with cyclic dependencies.

#### Using `circular()` Helper

The first way is to wrap your [service factory](#service-factory) using the `circular()`
helper:

```ts
import { circular } from "@alxcube/di-container";

class CircularA {
  constructor(private readonly circularB: CircularB) {}
}

class CircularB {
  constructor(private readonly circularA: CircularA) {}
}

container.registerFactory(
  CircularA,
  circular(
    (context) => new CircularA(
      context.resolve(CircularB)
    )
  )
);
container.registerFactory(
  CircularB,
  circular(
    (context) => new CircularB(
      context.resolve(CircularA)
    )
  )
);
```

This function will return a service factory that creates a JavaScript
[Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy),
replacing the requested class, and only when this object is first accessed, your factory
will be called, which will create an instance of the class.

If you register classes with circular dependencies using the `registerClassConfig()` or
`implement()` methods, set the `circular` option to `true`. Under the hood, this will
wrap the generated service factory using the `circular()` helper.

#### Using Delayed Dependencies Injection

The second approach is delayed dependency injection. This method is less convenient and
not as universal, but it does not use proxies, so it may be useful if proxies are not
available in your application environment, although this is unlikely.

To implement this approach, your class dependencies must be injected through public
properties or must have setter methods. Additionally, the `"singleton"` or `"request"`
lifecycle is a mandatory requirement for cyclic dependencies.

You can pass a callback to the `delay()` method of the [context object](#service-resolution-context)
in the [service factory](#service-factory), in which you can resolve and set the necessary
dependencies. This callback will be invoked after resolving the dependency stack of the
current service.

```ts
class CircularA {
  constructor(public circularB: CircularB = undefined) {}
}

class CircularB {
  constructor(public circularA: CircularA = undefined) {}
}

container.registerFactory(
  CircularA,
  (context) => {
    // Create instance without dependency
    const instance = new CircularA();
    // Delay resolution and injection of dependency
    context.delay(() => instance.circularB = context.resolve(CircularB));
    // Return instance
    return instance;
  },
  {
    // Lifecycle must be either "request" or "singleton"
    lifecycle: "request"
  }
);

// Same for other circular dependency
container.registerFactory(
  CircularB,
  (context) => {
    const instance = new CircularB();
    context.delay(() => instance.circularA = context.resolve(CircularA));
    return instance;
  },
  { lifecycle: "request" }
);
```

### Service Modules

To categorize registrations in the container and separate code, you can use service modules.
These are simple objects with a single `register()` method, which takes the container
object as its sole parameter.

To activate a module, pass it to the `loadModule()` method of the container.

```ts
// module.ts
import type { ServiceModule } from "@alcube/di-container";
import type { AppServiceMap } from "./AppServiceMap";
export const module: ServiceModule<AppServiceMap> = {
  register(container) {
    container.registerConstant("applicationKey", "some-app-key");
  }
}

// container.ts
import { Container } from "@alxcube/di-container";
import type { AppServiceMap } from "./AppServiceMap";
import { module } from "./module";

const container = new Container<AppServiceMap>();
container.loadModule(module);
```

### Testing

The container also provides some methods that are useful for testing purposes.

#### Container Snapshots

Using the `backup()` method, you can create snapshots of the container's state, and with
the `restore()` method, you can roll back the container's state to a previous snapshot.
Snapshots work on a stack principle, and their number is unlimited. Typically, you would
use the `backup()` and `restore()` methods, respectively, in the `beforeEach()` and
`afterEach()` hooks of your testing framework.

Calling the `backup()` method without parameters creates a snapshot of the container on
which it was called. However, if the optional parameter `cascade` is set to `true`, this
method will also be called on all parent containers, causing them to create snapshots of
their own state. The `restore()` method works similarly. Be careful when using cascading
snapshots and remember to set the `cascade` parameter to `true` for the corresponding
`restore()` calls, otherwise, you may encounter hard-to-track container state violations.

```ts
let httpClientSpy: HttpClientSpy;

beforeEach(() => {
  container.backup();
  httpClientSpy = new HttpClientSpy();
  container.registerConstant("HttpClient", httpClientSpy, { replace: true });
});

afterEach(() => {
  container.restore();
})
```

#### Creating Class Instances

The `instantiate()` method exists for conveniently creating instances of a class with
dependency injection through the constructor, using the container. This method takes the
class constructor as the first argument and a
[tuple of dependencies](#dependencies-tuple) as the second argument, and returns an
instance of the provided class. This is convenient for use in unit testing specific
classes.

```ts
let backendClient: ConcreteBackendClient;

beforeEach(() => {
  backendClient = container.instantiate(ConcreteBackendClient, ["HttpClient"]);
})
```