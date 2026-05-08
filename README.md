# AppWeaver: easy, flexible orchestration framework

**AppWeaver** (appWeaver, appwvr) is a decorator-driven orchestration framework. It uses the concept of a `@Service` (an instance of the class being decorated) as the basic building block of applications. Services can `@Inject` dependencies, and a service will only be available when all of its dependencies are resolved.

Stitching it all together (😜) is the `SmartContainer`, which will retrieve all `@Service`s and perform dependency injection, post-constructor initialization via an `@Activate` method, and application initialization via `@PostBoot`.

Where AppWeaver shines is that any imported modules using this framework will easily incorporate into your app with minimal or no configuration.

#### Example: Trivial Application

Run the following trivial 'application':

> `npx tsx src/sandbox/sampleApplication.ts`

## Essential Decorator Libraries

**`decorator-registry`** is central to decorator processing and allows easy storage & retrieval of decorator metadata. Usage patterns:

- store class decorators by decorator, method decorators by class, and property decorators by class
- get all classes for a given decorator
- get all methods/properties for a given class and decorator
- get all class/methods/properties decorators for a class

**`smart-container/decorators`** contains the minimal decorators necessary to create an application. These are:

- `Service` (class)
- `Inject` (property, method)
- `Activate`, `Deactivate` (method)
- `PostBoot` (method)

**`http/decorators`** contains useful decorators to easily create web application endpoints. These are:

- `Server` (class): purely decorative. Intended for classes manage port binding and other server lifecycle actions
- `Controller` (class): defines a collection of routes and middleware and an optional `rootPath` where routes will be available
- `Middleware`, `Route` (method): request handlers

> **Note**: these decorators don't automatically provide these services. It's expected that you or some other bundle will provide the concrete wiring to make enable this functionality.

> See `src/sandbox/express.ts` for a fully working Express integration utilizing these decorators. (This will be moved to its own npm module in the near future).

## Roadmap

- Configuration management (allowing you to overwrite 3rd-party `@Service` metadata)
- Factory services (allowing multiple instances of the same class, each having their own metadata configuration)
- Peristence decorators & patterns