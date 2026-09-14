---
title: "Resilience4j Rate Limiter in Spring Boot (and dealing with a rate-limited downstream service)"
layout: post
header-img: "img/spring5.jpg"
---

How to implement a rate-limiter using Resilience4j and Spring Boot, and dealing with calling it using code and returned headers.

---
This is another post in a series on [Resilience4j](https://resilience4j.readme.io/) with Spring Boot. Resilience4j provides common resilience patterns that can be used with Spring Boot. In this post I am interested in the [Rate Limiter](https://resilience4j.readme.io/docs/ratelimiter) pattern.

A rate limiter controls how much work a service is willing to accept over a period of time. Instead of letting every caller push unlimited traffic, the service defines a quota and rejects requests once that quota has been used.

This demo uses two Spring Boot services:

- `rest-service` accepts orders, saves them to Postgres, and calls the email service.
- `email-service` pretends to send order confirmation emails and is protected by a Resilience4j rate limiter.

![System diagram: rest-service, email-service, Postgres, and the resilience4j rate limiter between them]({{ site.baseurl }}/img/system-design-rate-limiter.png "System Diagram")

The code can be found [here](https://github.com/tony-waters/resilience4j-rate-limiter-demo-mp).

Configuration for the rate limiter is in `application.yaml`:

```yaml
resilience4j:
  ratelimiter:
    instances:
      emailNotification:
        limit-for-period: 5
        limit-refresh-period: 10s
        timeout-duration: 0
```

The email service allows 5 email requests every 10 seconds. The `timeout-duration` is `0`, so the email service does not queue or wait for a permit. If no permit is available, the request is rejected immediately.

## The Protected Endpoint

The Spring Boot `@RateLimiter` annotation is added to the `email-service` endpoint:

```java
@PostMapping("/notifications")
@RateLimiter(name = RATE_LIMIT_NAME, fallbackMethod = "rateLimited")
public ResponseEntity<NotificationResponse> sendNotification(@RequestBody NotificationRequest request) {
    log.info("Sending email to {} for order {}", request.recipientEmail(), request.orderId());
    return ResponseEntity.ok()
            .headers(rateLimitHeaders.asHeaders())
            .body(new NotificationResponse("SENT", "Email sent"));
}
```

The annotation puts calls to `sendNotification` behind the `emailNotification` rate limiter (the same name configured in `application.yaml`). If a permit is available, the controller method runs immediately and the email service returns `200 OK`.

If the quota has been exhausted, Resilience4j calls the fallback method instead:

```java
public ResponseEntity<NotificationResponse> rateLimited(NotificationRequest request, Throwable throwable) {
    log.info("Rate limiting on request from {} for order {}", request.recipientEmail(), request.orderId());
    HttpHeaders headers = rateLimitHeaders.asHeaders();
    headers.add(HttpHeaders.RETRY_AFTER, headers.getFirst("RateLimit-Reset"));
    return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
            .headers(headers)
            .body(new NotificationResponse("RATE_LIMITED", "Too many notification requests"));
}
```

The fallback returns `429 Too Many Requests` with rate-limit headers:

- `RateLimit-Limit` — the configured quota for the period (`5`, from `limit-for-period`).
- `RateLimit-Remaining` — permits left in the current period, read straight from resilience4j's own `RateLimiter.getMetrics().getAvailablePermissions()`.
- `RateLimit-Reset` — seconds until the next period starts, so callers know how long to wait.

These follow the field names from the [IETF `RateLimit` header fields draft](https://www.ietf.org/archive/id/draft-polli-ratelimit-headers-02.html). `email-service` sends them on **every** response, success or `429`. On a `429` specifically, the fallback also sets the standard `Retry-After` header to the same value as `RateLimit-Reset`, so a generic HTTP client that doesn't know the `RateLimit-*` convention still knows how long to back off.

Sending the headers on success too is what lets `rest-service` track the budget pre-emptively instead of only reacting to rejections.

## The Calling Service

`rest-service` calls `email-service` synchronously, using Spring's blocking `RestClient`. `rest-service` remembers the rate-limit budget that `email-service` last reported. If an earlier response showed the quota exhausted, and the reset window hasn't passed yet, `rest-service` skips the call entirely rather than making one it already knows will be rejected — and the notification is marked `SKIPPED` on the order:

```java
public NotificationOutcome notify(Order order) {
    Instant blockedUntilValue = blockedUntil.get();
    if (blockedUntilValue != null && Instant.now().isBefore(blockedUntilValue)) {
        log.info("Skipping email-service call for order {}: known rate-limited until {}",
                order.getId(), blockedUntilValue);
        return NotificationOutcome.SKIPPED;
    }

    NotificationRequest request = new NotificationRequest(
            order.getId(), order.getCustomerEmail(), order.getProduct(), order.getQuantity());
    try {
        return restClient.post()
                .uri("/notifications")
                .body(request)
                .exchange((req, res) -> {
                    recordRateLimitState(res.getHeaders());
                    HttpStatusCode status = res.getStatusCode();
                    if (status.is2xxSuccessful()) {
                        return NotificationOutcome.SENT;
                    }
                    if (status.value() == HttpStatus.TOO_MANY_REQUESTS.value()) {
                        return NotificationOutcome.RATE_LIMITED;
                    }
                    return NotificationOutcome.FAILED;
                });
    } catch (Exception e) {
        log.warn("Failed to reach email-service for order {}: {}", order.getId(), e.getMessage());
        return NotificationOutcome.FAILED;
    }
}

```

Otherwise `rest-service` attempts the call, which can succeed, come back `429`, or fail outright (timeout, connection refused, and so on).

Every response updates `rest-service`'s picture of the budget:

```java
private void recordRateLimitState(HttpHeaders headers) {
    String remainingHeader = headers.getFirst(HEADER_REMAINING);
    String resetHeader = headers.getFirst(HEADER_RESET);
    if (remainingHeader == null || resetHeader == null) {
        return;
    }
    try {
        int remaining = Integer.parseInt(remainingHeader);
        long resetSeconds = Long.parseLong(resetHeader);
        blockedUntil.set(remaining <= 0 ? Instant.now().plusSeconds(resetSeconds) : null);
    } catch (NumberFormatException e) {
        log.warn("Malformed rate-limit headers from email-service: {}={}, {}={}",
                HEADER_REMAINING, remainingHeader, HEADER_RESET, resetHeader);
    }
}
```

There's no retry within the request. A `RATE_LIMITED` or `FAILED` outcome is recorded and the response goes back immediately. That's a deliberate scope choice for this demo, covered below in Problems.

## Running the System

Start the stack:

```bash
docker compose up --build
```

Run the k6 load test:

```bash
k6 run k6/burst-test.js
```

The k6 test sends more order traffic than the email service can accept immediately.

The logs below are a trimmed excerpt from one run, edited for readability (the test fires concurrent requests from multiple virtual users, so real log interleaving is messier than this).

First, `rest-service` receives a burst of orders and starts calling `email-service`. The `email-service` works fine for the first 5 attempts:

```text
email-service | INFO - ...emailservice.NotificationController  : Sending email to buyer@example.com for order 5
email-service | INFO - ...emailservice.NotificationController  : Sending email to buyer@example.com for order 6
email-service | INFO - ...emailservice.NotificationController  : Sending email to buyer@example.com for order 4
email-service | INFO - ...emailservice.NotificationController  : Sending email to buyer@example.com for order 2
email-service | INFO - ...emailservice.NotificationController  : Sending email to buyer@example.com for order 1
```

Then rate limit kicks in. `rest-service` knows how long to wait (because of the headers returned by the rate limited request). Any orders received during this time have their email notification skipped, and no call is made to the `email-service`:

```text
email-service | INFO - ...emailservice.NotificationController  : Rate limiting on request from buyer@example.com for order 3
rest-service  | INFO - ...restservice.EmailNotificationClient  : Skipping email-service call for order 8: known rate-limited until 2026-09-14T13:21:57.873076122Z
rest-service  | INFO - ...restservice.EmailNotificationClient  : Skipping email-service call for order 7: known rate-limited until 2026-09-14T13:21:57.873076122Z
rest-service  | INFO - ...restservice.EmailNotificationClient  : Skipping email-service call for order 10: known rate-limited until 2026-09-14T13:21:57.873076122Z
rest-service  | INFO - ...restservice.EmailNotificationClient  : Skipping email-service call for order 9: known rate-limited until 2026-09-14T13:21:57.873076122Z
rest-service  | INFO - ...restservice.EmailNotificationClient  : Skipping email-service call for order 15: known rate-limited until 2026-09-14T13:21:57.873076122Z
rest-service  | INFO - ...restservice.EmailNotificationClient  : Skipping email-service call for order 14: known rate-limited until 2026-09-14T13:21:57.873076122Z
rest-service  | INFO - ...restservice.EmailNotificationClient  : Skipping email-service call for order 11: known rate-limited until 2026-09-14T13:21:57.873076122Z
rest-service  | INFO - ...restservice.EmailNotificationClient  : Skipping email-service call for order 12: known rate-limited until 2026-09-14T13:21:57.873076122Z
rest-service  | INFO - ...restservice.EmailNotificationClient  : Skipping email-service call for order 13: known rate-limited until 2026-09-14T13:21:57.873076122Z
```

Once the rate limit has been refreshed, email start getting sent again:

```text
email-service | INFO - ...emailservice.NotificationController  : Sending email to buyer@example.com for order 16
email-service | INFO - ...emailservice.NotificationController  : Sending email to buyer@example.com for order 21
email-service | INFO - ...emailservice.NotificationController  : Sending email to buyer@example.com for order 17
email-service | INFO - ...emailservice.NotificationController  : Sending email to buyer@example.com for order 19
email-service | INFO - ...emailservice.NotificationController  : Rate limiting on request from buyer@example.com for order 20
```

## Observing the K6 Results

Looking at the k6 results, the expected outcome is a mix of sent emails and rate-limited emails:

```text
 █ THRESHOLDS 

    checks
    ✗ 'rate==1.0' rate=90.00%


  █ TOTAL RESULTS 

    checks_total.......: 20     101.014687/s
    checks_succeeded...: 90.00% 18 out of 20
    checks_failed......: 10.00% 2 out of 20

    ✓ every order was created (201)
    ✗ wave 1 saw a SENT notification
      ↳  60% — ✓ 3 / ✗ 2
    ✓ wave 1 saw a RATE_LIMITED notification
    ✓ wave 2 saw a SKIPPED notification
```

## Checking the Database

Postgres is useful for checking the final state after the run. You can compare total orders with sent emails directly:

```bash
docker compose exec postgres psql -U orders -d orders \
  -c "select count(*) as orders_processed, count(*) filter (where notification_outcome = 'SENT') as emails_sent from orders;"
```

```text
 orders_processed | emails_sent 
------------------+-------------
               75 |           5
```

Clearly, the rate limiting is causing a large percentage of the email to not be sent.

## Problems

This demo intentionally keeps the order save and email call in one HTTP request flow. That makes the rate-limit behavior easy to see, but it also demonstrates a common transaction boundary problem: a potentially slow downstream call should not happen inside a database transaction.

Also, here we are rate-limiting to a single service instance. How would this work in a distributed system where different instances may need to sync the number of requests.

### Problem #1: Transaction Boundary Problem

If `rest-service` waits for the `email-service` rate-limit to be available while the order transaction is open, those waiting requests hold database connections from the Hikari pool. Under enough concurrent load, new requests can fail before they even start their own transaction:

```text
HikariPool-1 - Connection is not available, request timed out after 30000ms
CannotCreateTransactionException: Could not open JPA EntityManager for transaction
```

This version avoids that specific failure by using two short transactions:

1. Save the order and commit.
2. Call `email-service` outside the database transaction.
3. Update the order email status in a second transaction.

That keeps database connections out of the rate-limit wait, but it introduces a [dual-write problem](https://www.confluent.io/blog/dual-write-problem/) if the process crashes between those steps.

It is also still synchronous. The HTTP request thread waits while `rest-service` calls `email-service`. This version protects the database connection pool, but it does not free the request thread. To avoid holding that thread too, email delivery needs to move to a background worker, outbox, or queue.

If `email-service` is unavailable rather than just rate limited, the order is still saved first. The email call fails, `rest-service` records the outcome as `FAILED`, and the API can still return the created order. That is better than losing the order, but it is not durable email recovery. Without an outbox or queue, there is no separate worker that will reliably pick that email up later.

The more durable version of this design is a [transactional outbox](https://developer.confluent.io/courses/microservices/the-transactional-outbox-pattern/). Save the order and an `email_requested` outbox row in the same database transaction. A separate worker reads the outbox, calls `email-service`, and marks the message processed after success. This keeps the database transaction short and gives the system a durable record of work that still needs to happen.

### Problem #2: Distributed System Problem

There is an additional problem if we are using a distributed system. If different instances of an application receive requests there needs to be a centralised resource that will keep track of the requests and remaining quota.

Resilience4j's `RateLimiter` is deliberately JVM-local, in-memory state — it has no concept of any other instance. Scale `email-service` out to several replicas behind a load balancer and each replica enforces its own full quota independently (five replicas would together accept five times the intended traffic, not the configured five requests per ten seconds). The same limitation applies on the calling side — `EmailNotificationClient`'s `blockedUntil` is a single in-memory `AtomicReference`, scoped to one `rest-service` instance. With multiple `rest-service` replicas, each would learn the budget independently, and none would know what the others had already spent.

Making the quota distributed means moving it out of process into shared state that every instance reads and writes — for example a Redis-backed token bucket (libraries like Bucket4j support this). Alternatively, we could push enforcement out of the application entirely and into an API Gateway (though if we used multiple Gateways the problem would return).

## Conclusion

In this demo, the email service accepts only a small number of requests per time window. When the quota is exhausted, it returns `429`. Each call returns headers that tell the caller the current budget and when it resets. The REST service uses those headers to avoid pointless calls instead of guessing.

For order confirmation emails, deferring the email inside the response is acceptable for a prototype. For payments, stock reservations, refunds, account changes, or anything with financial or legal consequences, delayed work usually needs a durable path, such as writing it to a database or publishing it to a queue.
