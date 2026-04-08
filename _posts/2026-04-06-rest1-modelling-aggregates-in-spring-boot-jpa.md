---
title: Spring REST 1 - Modelling Aggregates using JPA
layout: post
header-img: "img/spring5.jpg"
---

Most Spring Boot applications are built around CRUD:

- Controllers call services
- Services call repositories
- Entities expose getters and setters

This approach works — until the domain becomes non-trivial.

At that point, behaviour leaks into services, invariants are inconsistently enforced, and the model no longer reflects the business.

This article shows how to move from CRUD-style design to **aggregate-based modelling**, drawing on concepts from **Domain-Driven Design (DDD)** while remaining pragmatic.

---

## The limits of CRUD

In a typical CRUD model, entities are passive:

```java
ticket.setStatus(RESOLVED);
ticket.setDescription("Updated after resolution");
```

There is no guarantee that this sequence is valid.

Any rules governing state transitions must be enforced externally, typically in services:

```java
if (ticket.getStatus() == RESOLVED) {
    throw new IllegalStateException();
}
```

This leads to:

- duplication of business rules
- inconsistent enforcement
- increasing service complexity

In DDD terms, this is known as an **anemic domain model**.

---

## Aggregates in Domain-Driven Design

DDD introduces the concept of an **aggregate** and an **aggregate root***:

> An aggregate is a cluster of associated objects treated as a single unit for data changes, with a clearly defined boundary and a root entity that enforces invariants.  
> — Eric Evans, *Domain-Driven Design*



The fact is we have to deal with the Business logic somewhere. If it is not in the Domain model it will end up in the Service layer. 

In this project, the aggregate is:

Customer (Aggregate Root)
└── Tickets
└── Tags

### Key properties

- **Aggregate Root**: `Customer`
- **Consistency boundary**: all invariants must hold within the aggregate
- **Controlled access**: external code interacts only via the root

---

## Invariants belong inside the aggregate

An **invariant** is a rule that must always hold true.

Example:

> A resolved ticket cannot be modified.

This rule should not live in a service.  
It should be enforced by the domain model itself.

```java
public void changeDescription(String description) {
    requireEditable();
    this.description = description;
}

private void requireEditable() {
    if (status == TicketStatus.RESOLVED || status == TicketStatus.CLOSED) {
        throw new IllegalStateException("Cannot modify resolved ticket");
    }
}
```

---

## Behaviour over setters

Instead of:

```java
ticket.setStatus(RESOLVED);
```

We define explicit domain operations:

```java
public void resolve() {
    requireEditable();
    this.status = TicketStatus.RESOLVED;
}
```

---

## Maintaining aggregate consistency

```java
public void addTicket(Ticket ticket) {
    if (ticket == null) return;

    tickets.add(ticket);
    ticket.attachToCustomer(this);
}
```

---

## The role of the service layer

```java
ticket.resolve();
```

Services orchestrate; aggregates enforce.

---

## Aggregates and JPA

```java
@Entity
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Ticket {

    @ManyToOne(fetch = FetchType.LAZY)
    private Customer customer;

    private String description;

    @Enumerated(EnumType.STRING)
    private TicketStatus status;
}
```

---

## What changes in practice

| CRUD Model | Aggregate Model |
|----------|---------------|
| Entities are data holders | Entities enforce rules |
| Services contain logic | Services orchestrate |
| State is mutable | State changes are controlled |
| Invariants are fragile | Invariants are guaranteed |

---

## Conclusion

If your entities are only getters and setters,  
you are not modelling a domain — you are exposing a database.

Aggregates provide a way to:

- enforce correctness
- express domain intent
- reduce accidental complexity

Start small, and build from there.