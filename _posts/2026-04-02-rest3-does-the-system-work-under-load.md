---
title: Load Testing with k6
layout: post
header-img: "img/spring5.jpg"
---

Before we let our system out into the real world let's give it a little experience. It would be comforting to know that it can work well under load. Now let's be clear. I'm not talking about full-on load testing. It would just be nice to feel confident that the system in general and domain in particular is up to the job. If we stop at unit and integration tests we fail to answer the question:

> “Does the system behave correctly under real usage?”

This article focuses on **k6 load testing**, and how it validates:

- end-to-end behaviour
- data consistency
- query correctness
- performance under concurrency

---

## Why k6?

k6 is a lightweight tool for:

- HTTP load testing
- scripting realistic user flows
- validating responses under concurrency

Unlike unit tests, it exercises:

- controllers
- services
- repositories
- database
- transactions

All together.

---

## The key idea

We are not testing endpoints.

We are testing **behaviour flows**.

---

## Example: Customer + Ticket flow

A realistic scenario:

1. Create customer
2. Raise ticket
3. Add tag
4. Resolve ticket
5. Query filtered results

---

## k6 script (simplified)

```javascript
export default function () {
  // create customer
  const res = http.post(`${BASE_URL}/api/customers`, payload);

  const customerId = extractId(res);

  // raise ticket
  http.post(`${BASE_URL}/api/customers/${customerId}/tickets`, {...});

  // fetch tickets
  const tickets = http.get(`${BASE_URL}/api/customers/${customerId}/tickets`).json();

  // add tag
  http.post(`${BASE_URL}/api/customers/${customerId}/tickets/${ticketId}/tags`, {...});

  // resolve ticket
  http.post(`${BASE_URL}/api/customers/${customerId}/tickets/${ticketId}/resolve`);
}
```

---

## What we validate

### 1. Correct responses

```javascript
check(res, {
  "status is 200": (r) => r.status === 200,
});
```

---

### 2. Behaviour correctness

```javascript
check(ticketDetail, {
  "status is resolved": (d) => d.status === "RESOLVED",
  "tag exists": (d) => d.tagNames.includes(tagName),
});
```

---

### 3. Read-after-write consistency

We verify:

- create → immediately visible
- update → reflected in queries

This is where many systems fail.

---

## Running the test

```bash
k6 run customer-behaviour-write-test.js
```

---

## Example results

```
checks_succeeded: 100%
http_req_failed: 0%
avg latency: ~12ms
```

---

## What k6 reveals (that unit tests don’t)

### Race conditions
Multiple users modifying data simultaneously

### Query issues
Incorrect filtering or joins

### Transaction problems
State not visible immediately after write

### Performance bottlenecks
Slow queries or missing indexes

---

## Why this matters

A system can pass:

- unit tests
- integration tests

…and still fail under load.

k6 exposes that gap.

---

## How this fits with other tests

| Test Type | Purpose |
|----------|--------|
| Unit tests | logic correctness |
| Repository tests | query correctness |
| k6 tests | real behaviour |

---

## Common mistakes

Avoid:

- testing only status codes
- not validating response content
- unrealistic scripts (no flow)

---

## Conclusion

k6 testing answers the most important question:

> “Does the system behave correctly when used like a real system?”

If your application:

- passes behavioural load tests
- maintains consistency
- performs under concurrency

then you have confidence beyond unit tests.

That is the difference between:

> code that works

and

> a system that works