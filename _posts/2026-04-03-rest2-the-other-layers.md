---
title: Spring REST 2 - Application Layer: Commands, Queries, and Use Case Orchestration
layout: post
header-img: "img/spring5.jpg"
---

In a previous article, I looked at modelling a non-anemic domain with JPA using a sample Spring REST application.

The focus there was the Domain layer:

- identifying the aggregate root
- keeping invariants inside the model
- replacing setters with behaviour
- making the domain responsible for its own consistency

That answered:

> where should business logic live?

But it raises another question:

> if the domain enforces the rules, what is the role of the Application layer?

This article focuses on the Application layer, and in particular how it coordinates **commands and queries**.

---

## The Role of the Application Layer

The Domain defines what is allowed.

The Application layer defines **when those behaviours are invoked** and **how data is retrieved**.

It acts as the boundary between:

- the domain model (write side)
- the read model (query side)

A typical flow becomes:

Command:  
Application Command → Aggregate → Repository

Query:  
Application Query → Projection → Database

The Application layer is responsible for:

- orchestrating use cases
- loading aggregates (command side)
- invoking domain behaviour
- executing efficient read queries (query side)
- managing transaction boundaries

It is **not** responsible for:

- business rules
- entity state transitions
- low-level persistence concerns

---

## Command vs Query Responsibilities

This application separates write and read concerns within the Application layer.

### Command Side

- works with aggregates (`Customer`, `Ticket`)
- enforces invariants via domain behaviour
- modifies system state

### Query Side

- uses projections (`CustomerSummaryView`, etc.)
- does not load aggregates
- returns data optimised for reading

This is not full CQRS, but it follows the same principle:

> optimise writes for correctness, reads for simplicity

---

## Command Side: Application Services

Application services coordinate use cases that change state.

```java
@Service
@RequiredArgsConstructor
@Transactional
public class CustomerCommandService {

    private final CustomerRepository customerRepository;

    public Long createCustomer(String displayName) {
        Customer customer = new Customer(displayName);
        return customerRepository.save(customer).getId();
    }

    public void resolveTicket(Long customerId, Long ticketId) {
        Customer customer = customerRepository.findAggregateById(customerId)
                .orElseThrow();

        customer.resolveTicket(ticketId);
    }
}
```

This is the core pattern:

1. Load the aggregate
2. Invoke domain behaviour
3. Persist changes

Nothing more.

---

## What Command Services Must Not Do

Most Spring applications get this wrong.

### 1. Re-implement domain rules

```java
if (ticket.getStatus() == RESOLVED) {
    throw new IllegalStateException();
}
```

If this exists here, it belongs in the domain.

---

### 2. Manipulate entity internals

```java
ticket.setStatus(RESOLVED);
ticket.setDescription("...");
```

This bypasses invariants.

---

### 3. Become transaction scripts

```java
repository.save(a);
repository.save(b);
repository.save(c);
```

This is procedural logic, not domain orchestration.

---

Bluntly:

> If your service layer looks like a script, your domain model is anemic.

---

## Query Side: Read Model

The query side lives alongside the command services but serves a different purpose.

It retrieves data without involving aggregates.

```java
@Query("""
    select new uk.bit1.spring_jpa.application.customer.query.CustomerSummaryView(
        c.id,
        c.displayName
    )
    from Customer c
""")
Page<CustomerSummaryView> findCustomerSummaries(Pageable pageable);
```

The query side:

- uses projections
- performs joins explicitly
- returns only the required fields

It avoids:

- loading full aggregates
- triggering lazy loading chains
- accidental domain mutations

Strong rule:

> Reads should not need invariants — they need data.

---

## Why Keep Command and Query Separate?

Mixing them leads to problems:

- loading aggregates just to read data
- accidental writes during reads
- performance issues (N+1, over-fetching)
- blurred responsibilities

Separating them gives:

- clear intent
- better performance
- simpler queries
- safer code

---

## Transaction Boundaries

Transactions belong to the command side.

Each command method defines a use case boundary:

```java
@Transactional
public void resolveTicket(...) { ... }
```

Within that boundary:

- aggregates are loaded
- behaviour is executed
- the system transitions from one valid state to another

Query methods typically do not require transactions.

---

## Error Handling and Invariants

When a rule is violated, the domain throws.

Example:

> "Cannot modify resolved ticket"

The Application layer:

- does not duplicate the rule
- does not suppress it
- allows it to propagate outward

This keeps the source of truth inside the domain.

---

## What This Buys You

A clean Application layer with command/query separation gives:

- **Consistency** — invariants enforced once
- **Clarity** — commands vs queries are explicit
- **Performance** — reads are efficient
- **Testability** — command and query paths can be tested independently

Most importantly:

> it prevents the system from collapsing back into CRUD.

---

## Conclusion

The Domain answers:

> what is allowed?

The Application layer answers:

> when does it happen?  
> how is data retrieved?

Commands change state.  
Queries return data.

Keeping those responsibilities separate keeps the system predictable, performant, and maintainable.