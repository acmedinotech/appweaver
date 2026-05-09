# SmartContainer

The brains behind AppWeaver orchestration. SmartContainer manages the complete lifecycle of your code, including dependency injection. But before we talk about interacting with the container, we need to understand what the container is working with.

## Container Lifecycle Overview

- **Services** are classes that provide some type of functionality (e.g. db connection, HTTP controller, etc.) and have a unique id, along with other metadata.
- **Bundles** are collections of services associated by a **`bundleId`** and can be easily included/excluded from a container instance.
- Dependecies to other services can be **injected** by using either `service.id` or a more complex metadata filter.
- Once all dependencies for a service are resolved, the service will be **activated**
- Finally, once the container has done an initial round of service initialization, any active service marked with a **post-boot** method will have that method invoked. Think of this as your application binding step (e.g. an Express server would listen to its designated port at this time).

Here's an example of an app creating its own services and pulling in other bundled services as dependencies:

```
// external db module
import dbBundle from 'db-package';
// import other deps here

export const bundleId = 'myBundle';

@Service({id: 'myApp', bundleId})
class MyApp {
    @Inject('db.connection')
    dbConnection = undefined as unknown as dbBundle.Connection;
    @Inject('db.observer')
    dbObserver = undefined as unknown as dbBundle.Observer;

    @Activate()
    postConstruct(myappMetadata) {
        // ! this will be invoked if both @Inject are resolved
        // bind to dbObserver if you want to listen for events
    }

    @PostBoot()
    bindApplication(container) {
        // ! this will be invoked after all other service activations IF
        //   this service was activated successfully
        // this is your application startup
    }
}

export const autowire = [MyApp, dbBundle.autowire];

const container = new SmartContainer({
    // allow all bundles to register (you can blacklist the ones you don't want --
    //   this is the preferred method, as dependent bundles will potentially have
    //   their own dependencies that you shouldn't have to inspect and pull up)
    bundleIds: {'*': true}
})
```

Viewed another way, here's what the container 'sees':

```
Bundle("dbBundle") {
    service("db.Connection"): ConnectionClass,
    service("db.Observer"): ObserverClass
        <- inject("db.Connection")
}

Bundle("myBundle") {
    service("myApp")
        <- inject("db.Connection")
        <- inject("db.Observer")
}
```

## Bundles

📏 A **bundle** is just a module you import. To follow framework conventions, a bundle _should minimally have_ the following exported members:

- `bundleId`: **preferred**. a unique identifier for the bundle
- `autowire`: **preferred**. typically an array containing concrete references to the classes you want to register in the container
    - **note**: any decorated service classes directly referenced by autowire classes will be visible by the container, but only those with `bundleId` set that match the exported `bundleId` will be considered part of the bundle.
    - **tip**: if a file containing services has other services as indirect dependencies, consider having a local `autowire` variable in that file as well.
- `importedBundleIds`: **future**. Example usage: `[depBundle1.bundleId, depBundle2.bundleId, depBundle1.importedBundleIds, depBundle2.importedBundleIds]`
    - **note**: this would allow upstream bundles to easily have a way to explicitly inspect all transient bundle dependencies.

**Example: Minimal Bundle**

```ts
// import/export your submodules
export const bundleId = `acmedinotech.dummyBundle`;

export const autowire = [MyClass1];
```

[See documentation for @Service and other decorators](./DECORATORS.md).

## Env Vars

In order to ease container management across environments, the following env vars can be set that the container will parse:

- `APPWEAVER_RUN_MODES`: A comma-separated string of `runMode`s that describe the container environment
    - **format**: `'runMode1,!runMode2,...` means `runMode1 enabled, runMode2 disabled`
    - **example**: you could add `'local'` to indicate that the container is running on a developer machine, and only enable debugging services by restricting them to `local`
    - **default value**: `'${process.env.NODE_ENV},default'`
- `APPWEAVER_BUNDLE_IDS`: A comma-separated string of `bundleId`s to enable/disable
    - **format**: `'bundle1,!bundle2,...'` means `bundle1 enabled, bundle2 disabled`
    - **special values**: use `'*'` or `'!*'` to enable or disable all bundles
    - **default value**: `'*'`

> Note that any services that don't give an explicit runMode will use `default`

**Any restrictions set at this level cannot be overridden**. For instance, if the container starts with `APPWEAVER_BUNDLE_IDS='*!'`, the application code *must* enable individual bundleIds in order to be used in application. Likewise, any bundles specifically disabled here will remain disabled.

## Interacting with Container

TODO

### Container Options

TODO