---
title: Spring REST 3 - Efficient Read Models Using CQRS-lite and JPA Projections
layout: post
header-img: "img/spring5.jpg"
---

In a previous article, we moved from CRUD-style design to **aggregates with behaviour**, applying ideas from Domain-Driven Design (DDD).

That solved one problem:

> where should business logic live?

This article tackles the next one:

> how should we read data efficiently?

Because the answer is almost always:

> not from your entities.

---

## The default approach (and why it breaks)

A typical Spring Boot application returns entities directly:

```java
@GetMapping("/{id}")
public Customer getCustomer(@PathVariable Long id) {
    return customerRepository.findById(id).orElseThrow();
}
```

This looks simple, but causes problems:

### 1. Over-fetching

You load more than you need:

- customer
- profile
- tickets
- tags

Even if the API only needs:

{
"id": 1,
"displayName": "Alice"
}

---

### 2. Lazy loading issues

You get:

- LazyInitializationException
- or unexpected additional queries

---

### 3. Leaking your domain model

Your API becomes tightly coupled to your entities:

- changing the entity breaks the API
- internal structure becomes public

---

## CQRS (without the ceremony)

Full CQRS is complex.

But you can apply a simpler idea:

> Separate writes (commands) from reads (queries).

- Commands use aggregates
- Queries use projections

---

## The read side in practice

Instead of returning entities, we define DTO projections.

### Example: Customer summary

```java
public record CustomerSummaryView(
    Long id,
    String displayName
) {}
```

---

## Repository-level projections

```java
@Query("""
    select new uk.bit1.spring_jpa.application.customer.query.CustomerSummaryView(
        c.id,
        c.displayName
    )
    from Customer c
    where (:name is null or lower(c.displayName) like lower(concat('%', :name, '%')))
""")
Page<CustomerSummaryView> findCustomerSummaries(String name, Pageable pageable);
```

---

## Why this is better

- minimal data
- no lazy loading surprises
- stable API

---

## Query service layer

```java
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class CustomerQueryService {

    private final CustomerQueryRepository repository;

    public Page<CustomerSummaryView> findCustomers(String name, Pageable pageable) {
        return repository.findCustomerSummaries(name, pageable);
    }
}
```

---

## Filtering

Push filtering into SQL:

```java
where (:name is null or lower(c.displayName) like lower(concat('%', :name, '%')))
```

---

## Ticket detail example

```java
select new TicketDetailRow(
    t.id,
    t.description,
    t.status,
    tag.name
)
from Customer c
join c.tickets t
left join t.tags tag
where c.id = :customerId
  and t.id = :ticketId
```

---

## Trade-offs

- more DTOs
- more queries

But:

- better performance
- clearer boundaries
- stable APIs

---

## Conclusion

Using entities for reads is convenient, but fragile.

Using projections:

- makes performance explicit
- simplifies your API
- avoids accidental complexity

Keep aggregates for writes.  
Use projections for reads.