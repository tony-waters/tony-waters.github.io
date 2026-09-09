---
title: Resilience4j Bulkhead in Spring Boot
layout: post
header-img: "img/spring5.jpg"
---

This is the first of a series of posts on [Resilience4j](https://resilience4j.readme.io/) with SpringBoot. Resilience4j provides some common resilience patterns that can be used with SpringBoot. In this post I want to look at the `Bulkhead` pattern.

A [Bulkhead](https://resilience4j.readme.io/docs/bulkhead) limits how much shared capacity a particular operation or dependency can consume at once. If a slow downstream service starts tying up threads or HTTP connections, a bulkhead caps the number of concurrent calls allowed to reach it, helping protect the rest of the application<sup>[[1]](#notes)</sup>.

This demo uses two Spring Boot services:

- `rest-service` accepts orders, saves them to Postgres, and calls the email-service.
- `email-service` delays by 1 second, then pretends to send order confirmation emails.

![Image alt]({{ site.baseurl }}/img/system-design-bulkhead.png "System Diagram")

The code can be found [here](https://github.com/tony-waters/resilience4j-bulkhead-demo).

Configuration for the Bulkhead is in `application.yaml`:

```yaml
resilience4j:
  bulkhead:
    instances:
      emailService:
        max-concurrent-calls: 4
        max-wait-duration: 700
```

Here only 4 calls to the email service can run at the same time. Extra calls are queued for 700ms then rejected.

## The Protected Call

The SpringBoot `@Bulkhead` annotation is added to the [`rest-service` method](https://github.com/tony-waters/resilience4j-bulkhead-demo/blob/acb31cebcae2bfe8c51de05221a4108a9ee0ea6f/rest-service/src/main/java/uk/bit1/resilience4jbulkheaddemo/rest/EmailClient.java#L20) that calls the `email-service`. 

```java
@Bulkhead(name = "emailService", fallbackMethod = "emailFallback")
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

The `@Bulkhead` annotation puts calls to `sendOrderConfirmation` behind the `emailService` bulkhead. If there is capacity, the downstream call runs and the order response shows `SENT`. If the bulkhead is already full, Resilience4j queues the new request for 700ms, then skips the downstream call and invokes the [fallback](https://github.com/tony-waters/resilience4j-bulkhead-demo/blob/acb31cebcae2bfe8c51de05221a4108a9ee0ea6f/rest-service/src/main/java/uk/bit1/resilience4jbulkheaddemo/rest/EmailClient.java#L38).

```java
EmailDeliveryResult emailFallback(Order order, Throwable cause) {
    log.warn("email delivery deferred orderId={} reason={}",
            order.getId(), cause.getClass().getSimpleName());
    return EmailDeliveryResult.deferred(cause.getClass().getSimpleName());
}
```

The API still returns `201 Created` because the order has been saved. The email notification is deferred or lost.

## Running the System

Start the stack:

```bash
docker compose up --build
```

Then run the k6 load test:

```bash
k6 run k6/bulkhead.js
```

The k6 test should produce both outcomes - some orders with `emailStatus` set to `SENT` and some orders with `emailStatus` set to `EMAIL_DEFERRED`.

This is the bulkhead doing its job. It allows a specific amount of downstream work through, rejects the overflow after a 700ms queue, and keeps the order API responsive. The K6 tests should generates enough concurrent requests to exhaust the bulkhead.

In this case, orders 49 through 55 provide a useful example:

```text
# orderId=49 is permitted, but consumes the last available permit
rest-service  | INFO - ...rest.BulkheadEventLogger : bulkhead permitted call orderId=49 name=emailService availableConcurrentCalls=0
rest-service  | INFO - ...rest.EmailClient         : calling email-service orderId=49
email-service | INFO - ...email.EmailController    : email-service processing order orderId=49 delayMs=700

# orderId=50 is rejected because the bulkhead is full
rest-service  | WARN - ...rest.BulkheadEventLogger : bulkhead rejected call orderId=50 name=emailService availableConcurrentCalls=0
rest-service  | WARN - ...rest.EmailClient         : email delivery deferred orderId=50 reason=BulkheadFullException
rest-service  | INFO - ...rest.OrderController     : create order called orderId=50 customerEmail=bulkhead-6-1-1787743330298@example.com amount=42.50

# orderId=51 is also rejected
rest-service  | WARN - ...rest.BulkheadEventLogger : bulkhead rejected call orderId=51 name=emailService availableConcurrentCalls=0
rest-service  | WARN - ...rest.EmailClient         : email delivery deferred orderId=51 reason=BulkheadFullException
rest-service  | INFO - ...rest.OrderController     : create order called orderId=51 customerEmail=bulkhead-10-1-1787743330398@example.com amount=42.50
```

As existing calls finish, permits become available again and subsequent requests can enter the bulkhead:

```text
rest-service  | INFO - ...rest.BulkheadEventLogger : bulkhead permitted call orderId=52 name=emailService availableConcurrentCalls=0
rest-service  | INFO - ...rest.EmailClient         : calling email-service orderId=52
email-service | INFO - ...email.EmailController    : email-service processing order orderId=52 delayMs=700

rest-service  | INFO - ...rest.BulkheadEventLogger : bulkhead permitted call orderId=53 name=emailService availableConcurrentCalls=0
rest-service  | INFO - ...rest.EmailClient         : calling email-service orderId=53
email-service | INFO - ...email.EmailController    : email-service processing order orderId=53 delayMs=700

rest-service  | INFO - ...rest.BulkheadEventLogger : bulkhead permitted call orderId=54 name=emailService availableConcurrentCalls=0
rest-service  | INFO - ...rest.EmailClient         : calling email-service orderId=54
email-service | INFO - ...email.EmailController    : email-service processing order orderId=54 delayMs=700

rest-service  | INFO - ...rest.BulkheadEventLogger : bulkhead permitted call orderId=55 name=emailService availableConcurrentCalls=0
rest-service  | INFO - ...rest.EmailClient         : calling email-service orderId=55
email-service | INFO - ...email.EmailController    : email-service processing order orderId=55 delayMs=700
```

When the outstanding calls finish, the permits are released:

```text
rest-service  | INFO - ...rest.BulkheadEventLogger : bulkhead finished call orderId=52 name=emailService availableConcurrentCalls=1
rest-service  | INFO - ...rest.BulkheadEventLogger : bulkhead finished call orderId=53 name=emailService availableConcurrentCalls=2
rest-service  | INFO - ...rest.BulkheadEventLogger : bulkhead finished call orderId=54 name=emailService availableConcurrentCalls=3
rest-service  | INFO - ...rest.BulkheadEventLogger : bulkhead finished call orderId=55 name=emailService availableConcurrentCalls=4
```

The final line is particularly significant:

```text
availableConcurrentCalls=4
```

All four permits are available again. The bulkhead has recovered automatically because the pressure on the downstream service has subsided.

### Observing the K6 results

Looking at the K6 results we can see that not all the emails got delivered:

``` bash
█ THRESHOLDS

    bulkhead_rejected_email_responses
    ✓ 'count>0' ***count=32***

    sent_email_responses
    ✓ 'count>0' ***count=63***

    unexpected_responses
    ✓ 'rate<0.01' rate=0.00%


█ TOTAL RESULTS

    checks_total.......: ***95***      8.055647/s
    checks_succeeded...: 100.00% 95 out of 95
    checks_failed......: 0.00%   0 out of 95

    ✓ order created with sent or bulkhead-deferred email
```

So while we have maintained control of the calling service, the `Bulkhead` alone does not stop loss of emails.

## Conclusion

In this demo, the intentionally slow email service causes the order API to pile up behind it. Adding a bulkhead made that behavior visible, and protects the calling service. But what happens to the work that did not run? For order confirmation emails, losing one might be annoying but recoverable. For payments, stock reservations, refunds, account changes, or anything with financial or legal consequences, simply returning a fallback and moving on would be dangerous.

In a real system, rejected work usually needs a durable path. The bulkhead protects the application doing the call from overload, but it does not decide what should happen to rejected work.

## <a name="notes"></a>Notes
1. In Resilience4j, a `semaphore bulkhead` does this without creating its own threads; it simply acts as a concurrency gate, whereas a `thread-pool bulkhead` provides stronger isolation by running the protected work on a dedicated bounded thread pool. I use a semaphore in this example.
