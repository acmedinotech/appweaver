## `@Service` (class)

📏 Bundles expose 1 or more **services**, which are classes decorated by `@Service`. Service metadata consists of the following:

- `id`: **required**. An ideally unique identifier for this service. If the container already has a service registered with this `id`, it will not be instantiated by the container
- `bundleId`: optional. A unique identifier for the collection of exposed services
- `priority`: optional; lifecycle. Controls the order in which the container manages service lifecycle (with _priority order_ being highest to lowest)
    - **rule**: `@PostBoot` invocation is done in priority order
    - **future**: initial service initialization is done in priority order
- `interfaces`: optional. A set of values defining the exposed interfaces. For instance, `http.Controller` is used to tag `@Controller` services
- `lifecycle`: optional. Determines whether service is unique to the current container (`container` (default)) or all containers in AppWeaver (`singleton`)
    - **rule**: if `singleton` is set, only the container that initially created it can manage it
- `enabled`: optional; lifecycle. If `false`, does not activate/publish service (default is `true`)
- `runModes`: optional (`['default']` default); lifecycle. If set, will only enable this service when one of the container's `runModes` match one of the service's `runModes` [see Env Vars](./README.md#env-vars)
## `@Inject` (properties, methods)

> Parameter injection is currently not supported

📏 Dependency injection is done using an explicit `service.id` or a complex metadata filter consisting of the following:

- `ids`. optional. A list of `service.id`s to match
- `interfaces`: optional. A list of interfaces to match
- `priorityMin`: optional. Only services greater-than-equal-to given priority
- `priorityMax`: optional. Only services less-than-equal-to given priority
- `cardinality`. optional. Controls min/max enforcement of returned services:
    - `0..1`: 0 or 1 services (i.e. optional service)
    - `1..1`: 1 service (i.e. required service)
    - `0..n`: 0 or more services (i.e. optional services)
    - `1..n`: 1 or more services (i.e. at least one required service)

> Note that using a complex filter allows you to resolve multiple service instances.

The container will put the resolved dependencies into the service instance by either directly setting the **property** or the **setter method**.

## `@Activate` (method)

📏 Once all dependencies are resolved for a service, if a method is marked as `@Activate`, it will be called before the service becomes available outside of the container. Activation methods are **async**.

## `@PostBoot` (method)

📏 Once all services have been initialized, any successfully activated services containing a method marked as `@PostBoot` will have that method called. Post-boot methods will be called in **service.priority** order (high to low)