---
title: Resilience4j Circuit Breaker in Spring Boot
layout: post
header-img: "img/spring5.jpg"
---

This is another post in a series on [Resilience4j](https://resilience4j.readme.io/) with SpringBoot. Resilience4j provides common resilience patterns that can be used with SpringBoot. In this post I want to look at the `Circuit Breaker` pattern.

A [Circuit Breaker](https://resilience4j.readme.io/docs/circuitbreaker) stops an application from repeatedly calling a dependency that is already failing. Instead of sending every request over the network and waiting for another error, the circuit breaker reacts to recent outcomes. When failures cross a configured threshold, it opens and rejects new calls immediately.

This demo uses two Spring Boot services:

- `rest-service` accepts orders, saves them to Postgres, and calls the email-service.
- `email-service` delays by 1 second, then pretends to send order confirmation emails.

![Image alt]({{ site.baseurl }}/img/system-design-circuit-breaker.png "System Diagram")

The code can be found [here](https://github.com/tony-waters/resilience4j-circuit-breaker-demo).

Configuration for the Circuit Breaker is in `application.yaml`:

```yaml
resilience4j:
  circuitbreaker:
    instances:
      emailService:
        sliding-window-type: count_based
        sliding-window-size: 4
        minimum-number-of-calls: 4
        failure-rate-threshold: 50
        wait-duration-in-open-state: 2s
        permitted-number-of-calls-in-half-open-state: 2
        automatic-transition-from-open-to-half-open-enabled: true
```

The breaker looks at the last 4 calls. Once at least 4 calls have been recorded, a failure rate of 50% or more opens the circuit. While open, calls do not go to the `email-service`. After 2 seconds, the breaker moves to half-open and allows 2 trial calls through. If those trial calls succeed, the circuit closes again.

## The Protected Call

The SpringBoot `@CircuitBreaker` annotation is added to the `rest-service` method that calls the `email-service`.

```java
@CircuitBreaker(name = "emailService", fallbackMethod = "emailFallback")
public EmailDeliveryResult sendOrderConfirmation(Order order) {
    log.info("calling email-service orderId={}", order.getId());

    emailRestClient.post()
            .uri("/emails")
            .body(request)
            .retrieve()
            .toBodilessEntity();

    return EmailDeliveryResult.sent();
}
```

The `@CircuitBreaker` annotation puts calls to `sendOrderConfirmation` behind the `emailService` circuit breaker. When the downstream call succeeds, the order response shows `SENT`. When the downstream call fails, times out, or is rejected because the circuit is open, Resilience4j invokes the fallback.

```java
EmailDeliveryResult emailFallback(Order order, Throwable cause) {
    log.warn("email delivery deferred orderId={} reason={}",
            order.getId(), cause.getClass().getSimpleName());
    return EmailDeliveryResult.deferred(cause.getClass().getSimpleName());
}
```

The API still returns `201 Created` because the order has been saved. But the email notification is deferred or lost.

## Running the System

Start the stack:

```bash
docker compose up --build
```

Then run the k6 load test:

```bash
k6 run k6/circuit-breaker.js
```

If the downstream service is unavailable, the useful log lines look like this:

```text
rest-service  | WARN - ...rest.CircuitBreakerEventLogger : circuit breaker error name=emailService state=CLOSED failureRate=-1.0
rest-service  | WARN - ...rest.EmailClient               : email delivery deferred orderId=1 reason=ServiceUnavailable
rest-service  | INFO - ...rest.OrderController           : create order called orderId=1 customerEmail=circuit-breaker-1-0-1787743330000@example.com amount=42.50

rest-service  | WARN - ...rest.CircuitBreakerEventLogger : circuit breaker state transition name=emailService transition=State transition from CLOSED to OPEN
rest-service  | WARN - ...rest.CircuitBreakerEventLogger : circuit breaker call not permitted name=emailService state=OPEN
rest-service  | WARN - ...rest.EmailClient               : email delivery deferred orderId=5 reason=CallNotPermittedException
rest-service  | INFO - ...rest.OrderController           : create order called orderId=5 customerEmail=circuit-breaker-5-0-1787743330500@example.com amount=42.50
```

There are two different failures shown here.

The first is a downstream failure. The `rest-service` calls `email-service`, and `email-service` returns an error. The circuit breaker records that error.

The second is an open-circuit rejection. The `rest-service` does not call `email-service` at all. Resilience4j rejects the call locally with `CallNotPermittedException`, and the fallback marks the email as deferred.

The REST service also exposes actuator endpoints for circuit breaker state and events:

```text
http://localhost:8081/actuator/circuitbreakers
http://localhost:8081/actuator/circuitbreakerevents
```

When the downstream service is healthy again and the wait duration has passed, the circuit breaker allows trial calls:

```text
rest-service  | WARN - ...rest.CircuitBreakerEventLogger : circuit breaker state transition name=emailService transition=State transition from OPEN to HALF_OPEN
rest-service  | INFO - ...rest.CircuitBreakerEventLogger : circuit breaker success name=emailService state=HALF_OPEN failureRate=-1.0
rest-service  | WARN - ...rest.CircuitBreakerEventLogger : circuit breaker state transition name=emailService transition=State transition from HALF_OPEN to CLOSED
```

The circuit breaker has recovered automatically because the downstream service started succeeding again.

## Observing the K6 Results

Looking at the K6 results we can see that not all emails were sent:

```text
 █ THRESHOLDS 

    deferred_email_responses
    ✗ 'count==0' count=16

    open_circuit_responses
    ✗ 'count==0' count=10

    sent_email_responses
    ✓ 'count>0' count=64

    unexpected_responses
    ✗ 'rate<0.01' rate=20.00%


  █ TOTAL RESULTS 

    checks_total.......: 80     7.799919/s
    checks_succeeded...: 80.00% 64 out of 80
    checks_failed......: 20.00% 16 out of 80

    ✗ order created with sent email
      ↳  80% — ✓ 64 / ✗ 16

```

## Checking the Database

Postgres is also useful for checking the final state after the run:

```bash
docker compose exec postgres psql -U demo -d orders \
  -c "select email_status, count(*) from orders group by email_status order by email_status;"
```

```text
  email_status  | count 
----------------+-------
 EMAIL_DEFERRED |    16
 SENT           |    64
(2 rows)
```

You can also compare total orders with sent emails directly:

```bash
docker compose exec postgres psql -U demo -d orders \
  -c "select count(*) as orders_processed, count(*) filter (where email_status = 'SENT') as emails_sent from orders;"
```

```text
 orders_processed | emails_sent 
------------------+-------------
               80 |          64
(1 row)
```

So clearly, not all of the emails have been sent.

## Conclusion

In this demo, the intentionally slow email service causes the order API to pile up behind it. Adding a circuit-breaker makes this behavior visible, and protects the calling service.

## Addendum: How is this different from a Bulkhead?

Circuit-breaker and bulkhead are complementary resilience patterns, but address different types of failure.  Circuit Breakers prevent repeated calls to failing dependencies by opening the circuit when error rates exceed a threshold, enabling fail-fast behavior and giving the external service time to recover.  Bulkheads isolate system resources (such as thread pools or connection pools) into independent compartments, ensuring that a slowdown or failure in one dependency does not exhaust resources and starve other critical services. 

