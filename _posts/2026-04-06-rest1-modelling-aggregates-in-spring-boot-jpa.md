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

## The limits of this type of modelling

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

In DDD terms, this is known as an [**anemic domain model**]().

I want to move away from this anemic domain model by implementing the DDD concept of **aggregates**. I will use a [demo Spring REST system I have created]() as an example. In this article I concentrate on the [application Domain]() as this is where the aggregates are mainly located.

---

## The Domain

Before we jump into aggregates let's review the domain we are dealing with, and its JPA relationships.

[UML diagram - Customer, Profile, Ticket, Tag]

The Domain is an extension of the `Customer` and `Profile` example from a [previous article](). As before `Customer` exists in a one-to-one relationship with its `Profile`. In addition it has a one-to-many relationship with `Ticket`:

```java
public class Customer extends BaseEntity {
    ...
    @OneToOne(fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "profile_id", unique = true)
    private Profile profile;

    @OneToMany(mappedBy = "customer", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Ticket> tickets = new HashSet<>();
    ...
}
```

We can see from the `@JoinColumn` that `Customer` owns the `Profile`. Since `Profile` holds no reference to `Customer` the relationship is unidirectional:

```java
class Profile extends BaseEntity {
    ...
    @Getter
    @Column(name = "email_address", length = 50, nullable = false, unique = true)
    private String emailAddress;

    @Getter
    @Column(name = "marketing_opt_in", nullable = false)
    private boolean marketingOptIn;
    ...
}
```

`Ticket` exists in a unidirectional one-to-many relationship with `Customer`, owned by `Ticket`.

```java
class Ticket extends BaseEntity {
    ...
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;
    
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "ticket_tag",
            joinColumns = @JoinColumn(name = "ticket_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private Set<Tag> tags = new HashSet<>();
    ...
}
```

Finally, `Ticket` itself exists in a many-to-many unidirectional relationship with the `Tag` entity:

```java
public class Tag extends BaseEntity {
    ...
    @Getter
    @Column(name = "name", nullable = false, length = 50)
    private String name;
    ...
}
```
This produced the following DDL:

```sql
create table customer (
    id bigint not null, 
    ...
    version bigint, 
    display_name varchar(80) not null, 
    profile_id bigint, 
    primary key (id)
)
create table profile (
    id bigint not null, 
    ...
    email_address varchar(50) not null, 
    marketing_opt_in boolean not null, 
    primary key (id)
)
create table tag (
    id bigint not null, 
    ...
    version bigint, name varchar(50) not null, 
    primary key (id)
)
create table ticket (
    id bigint not null, 
    ...
    description varchar(255) not null, 
    status enum ('CLOSED','IN_PROGRESS','OPEN','RESOLVED') not null, 
    customer_id bigint not null, primary key (id)
)
create table ticket_tag (
    ticket_id bigint not null, 
    tag_id bigint not null, 
    primary key (ticket_id, tag_id)
)
```

## Aggregates in Domain-Driven Design

DDD introduces the concept of an **aggregate** and an **aggregate root***:

> An aggregate is a cluster of associated objects treated as a single unit for data changes, with a clearly defined boundary and a root entity that enforces invariants.  
> — Eric Evans, *Domain-Driven Design*



The fact is we have to deal with the Business logic somewhere. If it is not in the Domain model it will end up in the Service layer. 

In this project, the aggregate is:

Customer (Aggregate Root)
└── Tickets
└── Tags

#### Aggregates as Consistency Boundary

As systems grow more complex it can become increasingly difficult to guarantee the consistency of the entities within them. DDD introduces the concept of an **aggregate** and an **aggregate root*** to help deal with this issue:

> An aggregate is a cluster of associated objects treated as a single unit for data changes, with a clearly defined boundary and a root entity that enforces invariants.
>
> — Eric Evans, *Domain-Driven Design*

The aggregate is a logical grouping of entities that can be treated as one thing. A cluster of related objects. Access to the aggregate is done through one of the Entities - the aggregate root - such that anything outside the aggregate will only hold reference to and talk to the aggregate root. Generally objects outside the aggregate will only hold reference to the aggregate root class. Aggregates are similar to the GoF Facade pattern, providing a specific high level interface into a complex subsystem. Both hide internal implementation details and reduce client dependencies on internal subsystem objects.

Within the aggregate we enforce the business rules of the domain - the invariants.

Aggregate boundaries also act as transaction boundaries, with entities within an aggregate being synchronously updated so that together they are in a valid state. They also provide a hint to deployment, with entities from the same aggregate generally being co-located on the same server.

For this first iteration I have chosen `Customer`, `Profile`, and `Ticket` as an aggregate. `Customer` is the **aggregate root** while`Ticket` and `Profile` are internal entities.

#### Aggregates as Controlled Access

In addition to providing a consistency boundary, aggregates provide controlled access to mutate the aggregate via the aggregate root. `Customer` is a good aggregate root candidate. We put the public methods to control the entire cluster of objects here. These should be behaviour-driven, rather than simple public setters. For example:

Example:

```java
customer.raiseTicket("This is a valid ticket");
customer.resolveTicket(ticketId);
customer.addTagToTicket(ticketId, tag);
```
Because all mutations go through `Customer`, child entities (`Ticket`, `Profile`) are not directly exposed and the relationships are managed internally. This prevents inconsistent state and placing domain logic in services/controllers.

We include a means of locating the aggregate root in the CustomerRepository:

```java
public interface CustomerRepository extends JpaRepository<Customer, Long> {
    @EntityGraph(attributePaths = {"profile", "tickets", "tickets.tags"})
    Optional<Customer> findAggregateById(Long id);
}
```

By using `@EntityGraph` we return the full Object graph for a particular `Customer`/aggregate-root.

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

## Maintaining aggregate consistency using the aggregate root

```java
public void addTicket(Ticket ticket) {
    if (ticket == null) return;

    tickets.add(ticket);
    ticket.attachToCustomer(this);
}
```

---

## Testing the aggregate

Domain tests for the sample application include unit tests that run without any JPA context. And `@DataJpaTest` tests that ...:

- [CustomerTest](https://github.com/tony-waters/spring-boot-app/blob/main/src/test/java/uk/bit1/spring_jpa/domain/customer/CustomerTest.java)
- [TicketTest](https://github.com/tony-waters/spring-boot-app/blob/main/src/test/java/uk/bit1/spring_jpa/domain/customer/TicketTest.java)
- [CustomerRepositoryDataJpaTest](https://github.com/tony-waters/spring-boot-app/blob/main/src/test/java/uk/bit1/spring_jpa/domain/customer/CustomerRepositoryDataJpaTest.java)

---

## The role of the service layer

```java
ticket.resolve();
```

Services orchestrate; aggregates enforce.

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