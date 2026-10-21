---
title: Making a POST Request Idempotent in a Distributed System
layout: post
header-img: "img/system-design.jpg"
github_links:
  - https://github.com/tony-waters/idempotent-rest-service-md/blob/bfb7a6a2d0b15ce0640ed1382aa0a17b8a78afee/rest-service/src/main/java/uk/bit1/outbox/rest/order/OrderController.java#L21-L27
  - https://github.com/tony-waters/idempotent-rest-service-md/blob/bfb7a6a2d0b15ce0640ed1382aa0a17b8a78afee/rest-service/src/main/java/uk/bit1/outbox/rest/order/OrderService.java#L37-L48
  - https://github.com/tony-waters/idempotent-rest-service-md/blob/bfb7a6a2d0b15ce0640ed1382aa0a17b8a78afee/rest-service/src/main/java/uk/bit1/outbox/rest/idempotency/IdempotencyAspect.java#L58-L60
  - https://github.com/tony-waters/idempotent-rest-service-md/blob/bfb7a6a2d0b15ce0640ed1382aa0a17b8a78afee/rest-service/src/main/java/uk/bit1/outbox/rest/idempotency/IdempotencyRecord.java#L7-L12
  - https://github.com/tony-waters/idempotent-rest-service-md/blob/bfb7a6a2d0b15ce0640ed1382aa0a17b8a78afee/rest-service/src/main/java/uk/bit1/outbox/rest/idempotency/LockResult.java#L7-L12
  - https://github.com/tony-waters/idempotent-rest-service-md/blob/bfb7a6a2d0b15ce0640ed1382aa0a17b8a78afee/rest-service/src/main/java/uk/bit1/outbox/rest/idempotency/IdempotencyStore.java#L31-L56
  - https://github.com/tony-waters/idempotent-rest-service-md/blob/bfb7a6a2d0b15ce0640ed1382aa0a17b8a78afee/rest-service/src/main/java/uk/bit1/outbox/rest/idempotency/IdempotencyAspect.java#L62-L78
  - https://github.com/tony-waters/idempotent-rest-service-md/blob/bfb7a6a2d0b15ce0640ed1382aa0a17b8a78afee/rest-service/src/main/java/uk/bit1/outbox/rest/idempotency/IdempotencyAspect.java#L99-L104
  - https://github.com/tony-waters/idempotent-rest-service-md/blob/bfb7a6a2d0b15ce0640ed1382aa0a17b8a78afee/rest-service/src/main/java/uk/bit1/outbox/rest/idempotency/IdempotencyAspect.java#L81-L92
  - https://github.com/tony-waters/idempotent-rest-service-md/blob/bfb7a6a2d0b15ce0640ed1382aa0a17b8a78afee/rest-service/src/main/java/uk/bit1/outbox/rest/idempotency/IdempotencyStore.java#L58-L61
  - https://github.com/tony-waters/idempotent-rest-service-md/blob/bfb7a6a2d0b15ce0640ed1382aa0a17b8a78afee/rest-service/src/main/java/uk/bit1/outbox/rest/idempotency/IdempotencyProperties.java#L7-L19
---

> There are only two hard problems in distributed systems: (2) Exactly-once delivery, (1) Guaranteed order of messages, (2) Exactly-once delivery.
>
> ~ Mathias Verraes

---

In a [previous post]({% post_url 2026-09-05-transactional-outbox-pattern-2 %}) I looked at how the `Transational Outbox Pattern` closes the dual-write gap caused by a rate-limited service. Writing the order and the outbox event in one transaction meant there was no window where the two could disagree, and moving email delivery onto Kafka meant `rest-service` no longer waited on `email-service` for the database transaction or for the request thread.

In this post I want to look at how we make our REST API idempotent using a unique `Idempotency-Key`.

>The code can be found [in this repo](https://github.com/tony-waters/idempotent-rest-service-mp).
>You can see an architectural summary of this solution by clicking on the image below:
> 
> [![Image alt]({{ site.baseurl }}/img/architecture-idempotency.png "System Summary: Opens in this window")](https://tony-waters.github.io/idempotent-rest-service-mp/)


## Planning for failure

One reason for implementing idempotency is to plan for network or server failure. If we take the simple case of a client request to a server we can easily identify three places such a failure could occur:

![System diagram]({{ site.baseurl }}/img/architecture-failure-points.png "System Diagram")

1. After the request has been sent but before it reaches its destination.
2. Once it has reached its destination but before it has been fully processed.
3. During the response to the successful request.

While only (3) has a successful result *they all look the same to the client*. The client is left with a timeout, and does not know if the payload has been processed. From the clients perspective, often the only realistic option is to just retry the request.

This is a good thing if the failure was at (1), and sometimes if it was at (2), since we do not want to lose the message. However, if the failure was at (3) we risk consuming the message more than once.

---

What we really want is `exactly-once` delivery.

Exactly-once delivery would guarantee that a message is processed exactly one time, preventing both data loss and duplication. This is difficult to implement in distributed systems due to network unreliability (illustrated by the [Two Generals Problem](https://en.wikipedia.org/wiki/Two_Generals'_Problem)).  Fortunately, systems can achieve "effectively exactly-once" semantics by combining at-least-once delivery with idempotent processing, ensuring that duplicate messages have no additional adverse effects. A common pattern for achieving this is to include an `Idempotency-Key` in the request.



## Architectural changes - adding Redis

![System diagram]({{ site.baseurl }}/img/architecture-idempotency-2.png "System Diagram")

In order for this to work we need somewhere to record if we have seen the `Idempotency-Key` before, and that has to be visible to *every* instance handling requests. `rest-service` runs as multiple replicas behind a load balancer, so an in-memory map on one JVM instance would miss a retry that lands on another. The state has to live outside any single instance.

Redis is a good fit for that shared state, for three reasons:

- **Atomic processing.** Two replicas can receive the same `Idempotency-Key` within milliseconds of each other. Redis's `SET ... NX PX` (`setIfAbsent`) atomically creates the key and attaches its TTL in one round trip, so exactly one caller wins the right to process the request.
- **Automatic TTL cleanup.** Idempotency keys only need to survive for as long as a client might plausibly retry. Redis expires keys itself, so there is no cleanup job to write, schedule, or forget to run.
- **Low Latency.** This check sits in front of every write `rest-service` makes. Redis's in-memory operations keep that overhead small.

Postgres still owns the durable `Order` and `Outbox` rows. Redis only ever holds the lock/record for the request itself.

## What the software has to do

The software solution has three responsibilities:

1. give each unsafe request a stable identity
2. make one caller win the right to do the work
3. turn every later retry into a clear outcome

Rather than write this code inside every non-idempotent service method, the `rest-service` exposes them through a reusable annotation (which I have cunningly called `@Idempotent`). The controller still looks like ordinary HTTP code. It receives the client-supplied `Idempotency-Key` header and passes it into the application service.

```java
@PostMapping
@ResponseStatus(HttpStatus.CREATED)
public OrderResponse createOrder(@RequestHeader("Idempotency-Key") String idempotencyKey,
                                  @Valid @RequestBody CreateOrderRequest request) {
    Order order = orderService.createOrder(idempotencyKey, request);
    return OrderResponse.from(order);
}
```

The service method is where the `@Idempotent`  boundary starts. `@IdempotencyKey` identifies which argument carries the client's retry key.

```java
@Idempotent
@Transactional
public Order createOrder(@IdempotencyKey String idempotencyKey, CreateOrderRequest request) {
    Order order = new Order(UUID.randomUUID(), request.customerEmail(), request.amount(), Instant.now());
    orderRepository.save(order);

    OutboxEvent event = new OutboxEvent(UUID.randomUUID(), "order", order.getId().toString(), "OrderCreated",
            writePayload(order), currentTraceParent());
    outboxEventRepository.save(event);

    return order;
}
```

Note that the business method still contains business logic. It creates the `Order`, writes the outbox event, and returns the order. It does not know how the Redis locks works, how retries are detected, or which HTTP status code a duplicate in-flight request should receive as a response.

This work is split between two infrastructure classes:

- `IdempotencyAspect` wraps annotated methods and maps idempotency outcomes back to HTTP behaviour
- `IdempotencyStore` owns the Redis state machine

The aspect starts by extracting the annotated key and deriving the `<scope>` from the method name. The Redis key is then namespaced as `idempotency:<scope>:<key>`, so the same `Idempotency-Key` key can be used safely against different idempotent endpoints:

```java
String scope = method.getDeclaringClass().getName() + "." + method.getName();
String idempotencyKey = extractIdempotencyKey(method, args);
String fingerprint = fingerprint(method, args);
```

### The Redis record

The value stored in Redis is small. And not a cached HTTP response. It is just enough state to answer "what happened to the first request with this key?":

```java
record IdempotencyRecord(Status status, String fingerprint, UUID resultId) {
    enum Status { IN_PROGRESS, COMPLETED }
}
```

The record moves through two states:

- `IN_PROGRESS`: one request has acquired the key and is still running.
- `COMPLETED`: the request finished, and `resultId` points at the `Order` row it created.

That `fingerprint` field is there to catch accidental key reuse. The aspect hashes the method arguments, excluding the idempotency key itself. If a retry arrives with the same key and the same body, it is a replay. If it arrives with the same key and a different body, it is a conflict.

### The lock state machine

`IdempotencyStore` turns the Redis record into a domain-level result. Callers receive one of four outcomes:

```java
sealed interface LockResult {
    record Acquired() implements LockResult {}
    record InProgress() implements LockResult {}
    record Replayable(UUID resultId) implements LockResult {}
    record Conflict() implements LockResult {}
}
```

The below call to `setIfAbsent` is backed by Redis `SET ... NX PX`. It creates the `IN_PROGRESS` record only if the key does not already exist, and attaches the TTL in the same operation.

```java
LockResult tryBegin(String scope, String key, String fingerprint) {
    String redisKey = keyFor(scope, key);
    for (int attempt = 1; attempt <= MAX_LOCK_ATTEMPTS; attempt++) {
        boolean acquired = Boolean.TRUE.equals(redisTemplate.opsForValue().setIfAbsent(
                redisKey, write(new IdempotencyRecord(IdempotencyRecord.Status.IN_PROGRESS, fingerprint, null)), properties.getTtl()));
        if (acquired) {
            return new LockResult.Acquired();
        }

        IdempotencyRecord existing = read(redisTemplate.opsForValue().get(redisKey));
        if (existing == null) {
            continue; // key vanished between setIfAbsent and this read — retry the acquisition
        }
        if (existing.status() == IdempotencyRecord.Status.IN_PROGRESS) {
            return new LockResult.InProgress();
        }
        if (!existing.fingerprint().equals(fingerprint)) {
            return new LockResult.Conflict();
        }
        return new LockResult.Replayable(existing.resultId());
    }
    throw new IllegalStateException("Could not acquire or read idempotency state for " + redisKey + " after " + MAX_LOCK_ATTEMPTS + " attempts");
}
```

Only the caller that gets `Acquired` is allowed to execute the service method. Every other caller is interpreting state left behind by the first attempt:

- `InProgress`: the first request is still running
- `Replayable`: the first request completed with the same fingerprint
- `Conflict`: the key was already used with a different request body

The aspect maps those other outcomes to the appropriate API response:

```java
LockResult result = store.tryBegin(scope, idempotencyKey, fingerprint);
return switch (result) {
    case LockResult.Acquired() -> proceedAndRecord(joinPoint, scope, idempotencyKey, fingerprint);
    case LockResult.InProgress() -> {
        recordOutcome("in_progress", scope);
        throw new ResponseStatusException(HttpStatus.TOO_EARLY, "A request with this Idempotency-Key is already in progress");
    }
    case LockResult.Conflict() -> {
        recordOutcome("conflict", scope);
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Idempotency-Key was already used with a different request body");
    }
    case LockResult.Replayable(UUID resultId) -> {
        Object replayed = replay(method.getReturnType(), resultId);
        recordOutcome("replayed", scope);
        yield replayed;
    }
};
```

The replay path is straightforward. We just fetch the real entity from Postgres:

```java
private Object replay(Class<?> returnType, UUID id) {
    CrudRepository<Object, Object> repository = (CrudRepository<Object, Object>) repositories.getRepositoryFor(returnType)
            .orElseThrow(() -> new IllegalStateException("No repository registered for idempotent replay of " + returnType));
    return repository.findById(id)
            .orElseThrow(() -> new IllegalStateException("Idempotent replay target " + id + " no longer exists"));
}
```

This avoids keeping a second copy of the HTTP response in Redis. Postgres remains the source of truth for orders. Redis only remembers enough to make retries safe.

If the method wrapped by `@Idempotent` throws an exception then the aspect releases the key immediately. That matters because a failed attempt should not poison the key for the full TTL. The next retry should be able to make a clean attempt:

```java
private Object proceedAndRecord(ProceedingJoinPoint joinPoint, String scope, String key, String fingerprint) throws Throwable {
    Object result;
    try {
        result = joinPoint.proceed();
    } catch (Throwable t) {
        store.release(scope, key);
        throw t;
    }
    store.complete(scope, key, fingerprint, extractId(result));
    recordOutcome("created", scope);
    return result;
}
```

If the method succeeds, the aspect replaces `IN_PROGRESS` with `COMPLETED` and stores the returned entity id:

```java
void complete(String scope, String key, String fingerprint, UUID resultId) {
    redisTemplate.opsForValue().set(keyFor(scope, key),
            write(new IdempotencyRecord(IdempotencyRecord.Status.COMPLETED, fingerprint, resultId)), properties.getTtl());
}
```

### Expiration

Idempotency only has to last longer than any realistic client retry window. The TTL is configured as an application property and defaults to 24 hours:

```java
@ConfigurationProperties(prefix = "app.idempotency")
public class IdempotencyProperties {
    private Duration ttl = Duration.ofHours(24);
    // getter/setter
}
```

After the TTL expires, a request with the same `Idempotency-Key` is treated as a new request and can create a new order. That is an explicit trade-off. It keeps retry protection for a bounded period, but does not let Redis grow forever with keys that nobody will replay.



## How this plays out against the architecture

![System diagram]({{ site.baseurl }}/img/architecture-failure-points.png "System Diagram")

Lets revisit our failure points and see how the clients only real option, resending the request, now works. What happens to this re-tried request in any of the three failure scenarios:

1. **Previous request never arrived.** Nothing in `rest-service` was previously run — no Redis key, no database row. A retry with the same `Idempotency-Key` behaves exactly like the first attempt, but hopefully succeeds this time.
2. **The server failed mid-processing.** If the second request is right after the first Redis holds an `IN_PROGRESS` record for that key, and the client gets back `425 Too Early`. If the original request failed outright instead the key is freed immediately. Either way, no duplicate `Order` can be created from this path.
3. **Response was lost on the way back.** This is the case the whole mechanism exists for. The order and outbox row were committed inside the one transaction, but the client did not get a 201 response. In this scenario the aspect re-fetches the same `Order` row from Postgres and hands it back, so the client receives the original order rather than creating a second one.

From the client perspective it no longer matters at what point the failure occurred. They can safely retry the request.

---

## Observing the K6 tests

``` bash
█ THRESHOLDS 

    checks
    ✓ 'rate==1.0' rate=100.00%


█ TOTAL RESULTS 

    checks_total.......: 12      2.282958/s
    checks_succeeded...: 100.00% 12 out of 12
    checks_failed......: 0.00%   0 out of 12
    
    ✓ fresh key creates the order (201)
    ✓ replay returns 201
    ✓ replay returns the SAME order id, not a new one
    ✓ reusing the key with a different body returns 409 Conflict
    ✓ missing Idempotency-Key header returns 400 Bad Request
    ✓ concurrent request either creates/replays the order (201) or is rejected as in-progress (425)
    ✓ at least one concurrent request got 201
    ✓ every 201 response during the race returned the SAME order id (no duplicate order was created)
```

## Metrics and Tracing

Here is what happens when we run the K6 tests once:

![System diagram]({{ site.baseurl }}/img/system-design-idempotent-grafana-1.png "System Diagram")

The four series on the "Idempotency outcomes over time" panel are the dashboard's names for the four `LockResult` cases — `created`, `in_progress`, `replayed`, or `conflict`. A couple of things stand out from a single run:

- All four outcomes fire within one test run, including a `conflict`. This was designed into the K6 tests.
- `in_progress` and `replayed` both spike and drop back to zero within about a minute. Nothing lingers `in_progress` after the run ends, which is what you would expect given the lock is released as soon as the wrapped method returns or throws.

If we run the K6 tests in a loop it looks like this:

![System diagram]({{ site.baseurl }}/img/system-design-idempotent-grafana-2.png "System Diagram")

Looping the same K6 tests for ten minutes shows us:

- The outcome rates settle into a steady state rather than climbing. `in_progress` in particular doesn't creep upward over time, which is what you'd see if locks were leaking instead of being released on completion or after a failure.
- All four series drop quickly back to zero after the loop stops, instead of draining gradually. There is no backlog of outstanding locks left behind.

---
## Conclusion

A client cannot know whether a timed-out `POST` failed before it arrived, failed while it was running, or succeeded and lost the response on the way back. Idempotency moves that uncertainty onto the server, where we have enough state to answer it.

The `Idempotency-Key` gives each attempt a stable identity. Redis uses that identity to guard the work and remember the result for a bounded retry window (24 hours, in this case). Postgres remains the source of truth for the order itself. On a retry, `rest-service` can make a deliberate decision: run the request, reject it because the first attempt is still in flight, replay the completed order, or reject it because the same key is being used for a different request.

Together with the [transactional outbox]({% post_url 2026-09-05-transactional-outbox-pattern-2 %}) from the previous post, this makes `rest-service` significantly more robust against data loss due to network or server failures. The database transaction keeps the order and outbox event together. The idempotency layer keeps retries from repeating the order creation.
