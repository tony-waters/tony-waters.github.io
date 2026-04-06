---
title: Modelling Aggregates in Spring Boot
layout: post
header-img: "img/spring5.jpg"
---

Most Spring Boot tutorials teach you how to build CRUD apps.

- Controller calls service
- Service calls repository
- Repository saves entity

And the entity?

Just getters and setters.

---

## The problem

This style looks fine… until you try to add real behaviour.

You end up with:

- “God services” full of business logic
- entities that are just data bags
- rules scattered across layers
- bugs when invariants aren’t enforced

Example:

```java
ticket.setStatus(RESOLVED);
ticket.setDescription("Updated after resolution"); // should this even be allowed?
```

Nothing stops this.

Because your entity has no opinion.

---

## What we actually want

Instead of CRUD, we want **aggregates with behaviour**.

In this project, the core aggregate is:

Customer
└── Tickets
└── Tags

The rules live inside that structure:

- A ticket belongs to a customer
- A resolved ticket cannot be modified
- Tags belong to tickets
- Relationships must stay consistent

---

## The mistake most people make

They push all of this into the service layer.

```java
if (ticket.getStatus() == RESOLVED) {
    throw new IllegalStateException();
}
```

This is wrong.

Because now:

- the rule is optional
- it can be bypassed
- it gets duplicated

---

## Move the rules into the entity

Your entity should **protect itself**.

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

## Kill the setters

Bad:

```java
public void setStatus(TicketStatus status) {
    this.status = status;
}
```

Better:

```java
public void resolve() {
    requireEditable();
    this.status = TicketStatus.RESOLVED;
}
```

---

## Managing relationships properly

Bad:

```java
ticket.setCustomer(customer);
customer.getTickets().add(ticket);
```

Fix:

```java
public void addTicket(Ticket ticket) {
    if (ticket == null) return;

    tickets.add(ticket);
    ticket.attachToCustomer(this);
}
```

---

## The role of the service layer

Instead of:

```java
// lots of logic
ticket.setStatus(...);
```

You get:

```java
ticket.resolve();
```

---

## What about JPA?

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

## What you gain

- safer code
- clearer intent
- less duplication
- simpler services

---

## Final thought

If your entities are just getters and setters,  
you don’t have a model — you have a database wrapper.