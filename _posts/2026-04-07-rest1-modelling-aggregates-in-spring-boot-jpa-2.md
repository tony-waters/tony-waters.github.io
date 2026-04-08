---
title: Spring REST 1 - Modelling Aggregates using JPA v2
layout: post
header-img: "img/spring5.jpg"
---

Most Spring Boot applications start with CRUD:

- Controllers call services
- Services call repositories
- Entities expose getters and setters

This works — until the domain becomes non-trivial.

At that point:

- business rules are duplicated across services
- invariants are inconsistently enforced
- the model reflects the database, not the domain

This article shows how to move from CRUD-style design to **aggregate-based modelling**, using concepts from **Domain-Driven Design (DDD)** in a pragmatic way.

---

## The problem with CRUD-style entities

In a typical CRUD model, entities are passive:

```java
ticket.setStatus(RESOLVED);
ticket.setDescription("Updated after resolution");
```

There is no guarantee this sequence is valid.

Rules must be enforced externally:

```java
if (ticket.getStatus() == RESOLVED) {
    throw new IllegalStateException();
}
```

This leads to:

- duplicated logic
- fragile invariants
- increasingly complex services

In DDD, this is known as an **anemic domain model**.

> If a rule can be broken by calling a setter, your model is wrong.

---

## The domain

The example domain consists of:

- `Customer`
- `Profile`
- `Ticket`
- `Tag`

With relationships:

- Customer → Profile (1–1)
- Customer → Ticket (1–many)
- Ticket → Tag (many–many)

The key question is not how these relate in JPA —  
but how they should be **grouped for consistency**.

---

## Aggregates in DDD

Eric Evans defines an aggregate as:

> A cluster of associated objects treated as a single unit for data changes, with a root entity that enforces invariants.

An aggregate introduces two key ideas:

### 1. Consistency boundary
All changes inside the aggregate must leave it in a valid state.

### 2. Controlled access
External code interacts **only with the aggregate root**.

---

## Defining the aggregate

In this model:

- `Customer` is the **aggregate root**
- `Ticket` and `Profile` are internal entities
- `Tag` is a **separate aggregate** (shared reference data)

Only `Customer` is accessed from outside.

> External code must not directly manipulate `Ticket` or `Profile`.

---

## Behaviour over setters

Instead of exposing setters:

```java
ticket.setStatus(RESOLVED);
```

We model intent:

```java
public void resolve() {
    requireEditable();
    this.status = TicketStatus.RESOLVED;
}
```

This makes invalid transitions impossible.

---

## Invariants belong inside the aggregate

An **invariant** is a rule that must always hold.

Example:

> A resolved ticket cannot be modified.

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

This rule now lives where it belongs: **inside the domain**.

---

## The aggregate root controls mutations

All changes go through `Customer`:

```java
customer.raiseTicket("Broken login");
customer.resolveTicket(ticketId);
customer.addTagToTicket(ticketId, tag);
```

Relationships are managed internally:

```java
public void addTicket(Ticket ticket) {
    if (ticket == null) return;

    tickets.add(ticket);
    ticket.attachToCustomer(this);
}
```

This guarantees:

- consistency
- correct relationships
- enforcement of invariants

---

## Loading the aggregate

To work with the aggregate, we load it as a whole:

```java
public interface CustomerRepository extends JpaRepository<Customer, Long> {

    @EntityGraph(attributePaths = {"profile", "tickets", "tickets.tags"})
    Optional<Customer> findAggregateById(Long id);
}
```

This ensures the full consistency boundary is available during modification.

---

## The role of the service layer

Services orchestrate use cases:

```java
customer.resolveTicket(ticketId);
```

They do **not** enforce business rules.

> Services coordinate. Aggregates enforce.

---

## What changes in practice

| CRUD Model | Aggregate Model |
|----------|---------------|
| Entities are data holders | Entities enforce rules |
| Services contain logic | Services orchestrate |
| State is freely mutable | State changes are controlled |
| Invariants are fragile | Invariants are guaranteed |

---

## Conclusion

If your entities expose setters, your invariants are optional.

Aggregates make them unavoidable.

That is the difference between:

> modelling data

and

> modelling behaviour