---
title: Making POST requests idempotent in a distributed system
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

In a [previous post]({% post_url 2026-09-05-transactional-outbox-pattern-2 %}) I looked at how the `Transational Outbox Pattern` closes the dual-write gap caused by a rate-limited service. Writing the order and the outbox event in one transaction meant there was no window where the two could disagree, and moving email delivery onto Kafka meant `rest-service` no longer waited on `email-service` for the database transaction or for the request thread.

In this post I want to look at how we make our REST API idempotent. Unless we do this we risk duplicate orders appearing in the database. To make the API idempotent, the client sends a unique `Idempotency-Key` with each request. `rest-service` uses this key to recognise when a retry is taking place.

>The code can be found [in this repo](https://github.com/tony-waters/idempotent-rest-service-md).
>You can see an architectural summary of this solution by clicking on the image below:
> 
> [![Image alt]({{ site.baseurl }}/img/architecture-idempotency.png "System Summary: Opens in this window")](https://tony-waters.github.io/idempotent-rest-service-md/)


## Planning for failure

One reason for implementing idempotency is to plan for network or server failure. If we take the simple case of a client request to a server we can easily identify three places a failure could occur:

![System diagram]({{ site.baseurl }}/img/architecture-failure-points.png "System Diagram")

1. After the request has been sent but before it reaches its destination.
2. Once it has reached its destination but before it has been fully processed.
3. During the response to the successful request.

While only (3) has a successful result *they all look the same to the client*. The client is left with a timeout, and does not know if the payload has been processed. From the clients perspective the only realistic option is often to just retry the request.

This is a good thing if the failure was at (1) or (2), since we do not want to lose the message. However, if the failure was at (3) we risk consuming the message more than once.

What we really want is `exactly-once` delivery.

Exactly-once delivery guarantees that a message is processed exactly one time, preventing both data loss and duplication, but it is theoretically impossible to guarantee in distributed systems due to the [Two Generals Problem](https://en.wikipedia.org/wiki/Two_Generals'_Problem) and network unreliability.  Instead, systems achieve "effectively exactly-once" semantics by combining at-least-once delivery with idempotent processing or deduplication, ensuring that duplicate messages have no additional adverse effects.



## The solution - architecture

![System diagram]({{ site.baseurl }}/img/architecture-idempotency-2.png "System Diagram")

In order for this to work we need somewhere to record if we have seen the `Idempotency-Key` before, and that record has to be visible to *every* instance handling requests. `rest-service` runs as multiple replicas behind a load balancer, so an in-memory map on one JVM instance would miss a retry that lands on another. The state has to live outside any single instance.

Redis is a good fit for that shared state, for three reasons:

- **An atomic primitive for the race.** Two replicas can receive the same `Idempotency-Key` within milliseconds of each other. Redis's `SET ... NX PX` (`setIfAbsent`) atomically creates the key and attaches its TTL in one round trip, so exactly one caller wins the right to process the request.
- **TTL as a first-class feature.** Idempotency keys only need to survive for as long as a client might plausibly retry. Redis expires keys itself, so there is no cleanup job to write, schedule, or forget to run.
- **Low Latency.** This check sits in front of every write `rest-service` makes. Redis's in-memory operations keep that overhead small.

Postgres still owns the durable `Order` and `Outbox` rows. Redis only ever holds the lock/record for the request itself.

## The solution - software

The software version of the architecture has three responsibilities:

1. give each unsafe request a stable identity,
2. make one caller win the right to do the work,
3. turn every later retry into a clear outcome.

I did not want those rules hand-written inside every controller method. `rest-service` exposes them through a reusable `@Idempotent` annotation instead. The controller still looks like ordinary HTTP code: it receives the client-supplied `Idempotency-Key` header and passes it into the application service.

```java
@PostMapping
@ResponseStatus(HttpStatus.CREATED)
public OrderResponse createOrder(@RequestHeader("Idempotency-Key") String idempotencyKey,
                                  @Valid @RequestBody CreateOrderRequest request) {
    Order order = orderService.createOrder(idempotencyKey, request);
    return OrderResponse.from(order);
}
```

The service method is where the idempotency boundary starts. `@Idempotent` says "guard this operation", and `@IdempotencyKey` identifies which argument carries the client's retry key.

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

The important point is that the business method still contains business logic. It creates the `Order`, writes the outbox event, and returns the order. It does not know how Redis locks work, how retries are detected, or which HTTP status code a duplicate in-flight request should receive.

That work is split between two infrastructure classes:

- `IdempotencyAspect` wraps annotated methods and maps idempotency outcomes back to HTTP behaviour.
- `IdempotencyStore` owns the Redis state machine.

The aspect starts by extracting the annotated key and calculating a scope from the method name. The Redis key is then namespaced as `idempotency:<scope>:<key>`, so the same client key can be used safely against different idempotent endpoints.

```java
String scope = method.getDeclaringClass().getName() + "." + method.getName();
String idempotencyKey = extractIdempotencyKey(method, args);
String fingerprint = fingerprint(method, args);
```

### The Redis record

The value stored in Redis is deliberately small. It is not a cached HTTP response. It is just enough state to answer one question: what happened to the first request with this key?

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

`IdempotencyStore` turns the Redis record into a domain-level result. Callers do not receive raw JSON, Redis strings, or partial records. They receive one of four outcomes:

```java
sealed interface LockResult {
    record Acquired() implements LockResult {}
    record InProgress() implements LockResult {}
    record Replayable(UUID resultId) implements LockResult {}
    record Conflict() implements LockResult {}
}
```

That type is useful because it makes the rest of the code exhaustive. If the store grows a fifth outcome later, the compiler forces the aspect to decide what HTTP behaviour that outcome should have.

The critical operation is `setIfAbsent`, backed by Redis `SET ... NX PX`. It creates the `IN_PROGRESS` record only if the key does not already exist, and attaches the TTL in the same operation.

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

- `InProgress`: the first request is still running.
- `Replayable`: the first request completed with the same fingerprint.
- `Conflict`: the key was already used with a different request body.

The aspect maps those outcomes to the API contract and records each one as a Prometheus counter (`idempotency.outcomes`), which is the same metric used in the Grafana screenshots later in the post.

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

The replay path is intentionally boring. Redis stores the `resultId`, then the aspect uses Spring Data to fetch the real entity from Postgres and lets the normal response serialization run again.

```java
private Object replay(Class<?> returnType, UUID id) {
    CrudRepository<Object, Object> repository = (CrudRepository<Object, Object>) repositories.getRepositoryFor(returnType)
            .orElseThrow(() -> new IllegalStateException("No repository registered for idempotent replay of " + returnType));
    return repository.findById(id)
            .orElseThrow(() -> new IllegalStateException("Idempotent replay target " + id + " no longer exists"));
}
```

This avoids keeping a second copy of the HTTP response in Redis. Postgres remains the source of truth for orders; Redis only remembers enough to make retries safe.

If the wrapped method throws, the aspect releases the key immediately. That matters because a failed attempt should not poison the key for the full TTL. The next retry should be able to make a clean attempt.

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

If the method succeeds, the aspect replaces the `IN_PROGRESS` record with `COMPLETED` and stores the returned entity id.

```java
void complete(String scope, String key, String fingerprint, UUID resultId) {
    redisTemplate.opsForValue().set(keyFor(scope, key),
            write(new IdempotencyRecord(IdempotencyRecord.Status.COMPLETED, fingerprint, resultId)), properties.getTtl());
}
```

### Expiration

Idempotency does not have to last forever. It has to last longer than any realistic client retry window. The TTL is configured as application properties and defaults to 24 hours:

```java
@ConfigurationProperties(prefix = "app.idempotency")
public class IdempotencyProperties {
    private Duration ttl = Duration.ofHours(24);
    // getter/setter
}
```

Every Redis write uses that TTL. After it expires, a request with the same `Idempotency-Key` is treated as a new request and can create a new order. That is an explicit trade-off: keep retry protection for a bounded period, but do not let Redis grow forever with keys that nobody will replay.



## How this plays out against the architecture

![System diagram]({{ site.baseurl }}/img/architecture-failure-points.png "System Diagram")

Lets revisit our failure points, and see how the clients only real option, resending the request, now works. What happens with this re-tried request given any of the three failure locations:

- **(1) Previous request never arrived.** Nothing in `rest-service` was previously run — no Redis key, no database row. A retry with the same `Idempotency-Key` behaves exactly like the first attempt, but hopefully succeeds this time.
- **(2) The server failed mid-processing.** If the second request is right after the first Redis holds an `IN_PROGRESS` record for that key, and the client gets back `425 Too Early`. If the original request failed outright instead the key is freed immediately. Either way, no duplicate `Order` can be created from this path.
- **(3) Response was lost on the way back.** This is the case the whole mechanism exists for. The order and outbox row were committed inside the one transaction, `store.complete(...)` wrote a `COMPLETED` record carrying the new `orderId`, and then the response itself never reached the client. The retry arrives, `tryBegin` finds that `COMPLETED` record with a matching fingerprint, and returns `Replayable(orderId)` — the aspect re-fetches the same `Order` row from Postgres and hands it back, so the client receives the original order rather than creating a second one.

In every case, the diagram's three failure points collapse onto the same server-side code path: the `Idempotency-Key` is what lets a retry discover what the *first* attempt actually did, rather than leaving the client to guess whether its original request succeeded.

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
- `in_progress` and `replayed` both spike and drop back to zero within about a minute. Nothing lingers `in_progress` after the run ends, which is what you'd expect given the lock is released as soon as the wrapped method returns or throws.

If we run the K6 tests in a loop it looks like this:

![System diagram]({{ site.baseurl }}/img/system-design-idempotent-grafana-2.png "System Diagram")

Looping the same K6 tests for ten minutes shows us:

- The outcome rates settle into a steady state rather than climbing. `in_progress` in particular doesn't creep upward over time, which is what you'd see if locks were leaking instead of being released on completion or after a failure.
- `conflict` stays the smallest of the four throughout, consistent with it being one deliberately-provoked case in the test (the "reusing the key with a different body" check) rather than a systemic problem.
- All four series drop quickly back to zero after the loop stops, instead of draining gradually. There is no backlog of outstanding locks left behind.

---
## Conclusion

Idempotency closes the gap that at-least-once delivery leaves open. The client supplies an `Idempotency-Key`; `IdempotencyStore` turns it into an atomic Redis lock, scoped by method name so endpoints can never collide on the same key; and `IdempotencyAspect` maps every outcome — acquired, in-progress, replayed, conflict — onto an HTTP response that tells the client what happened to its *first* attempt, rather than leaving it to guess. A retry stops being risky: it either does the work once, waits on the attempt already in flight, replays what that attempt produced, or is rejected as a different request wearing the same key.

Paired with the [transactional outbox]({% post_url 2026-09-05-transactional-outbox-pattern-2 %}) from the previous post, `rest-service` now has both halves of the guarantee this series set out to build: the order and the intent to notify the customer can never disagree, and a dropped response can never turn into a duplicate order. Together they get as close to exactly-once as a distributed system can reasonably promise, without claiming something the network itself can't guarantee.
