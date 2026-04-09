---
title: Spring REST 1 - Spring Boot REST/CQRS-lite/JPA/DDD-lite Demo
layout: post
header-img: "img/spring5.jpg"
---

A focused Spring Boot REST application demonstrating:

* @OneToOne, @OneToMany, and @ManyToMany JPA relationships
* Aggregate-oriented domain modelling (DDD-lite)
* Clear separation of **Command vs Query** with CQRS
* Projection-based read model (no entity leakage)
* Query Pagination and Filtering
* REST API with validation and proper status codes
* Layered testing strategy (domain → JPA → service → web)

## Tech Stack

- Java 21
- Spring Boot 4.x
- Spring Data JPA
- Hibernate 7
- H2 (test database)
- Postgres (for docker-compose)
- AssertJ

---

Lets look at the different layers of this application:

### The Domain layer

The Domain model exists under `uk.bit1.spring_jpa.domain`:

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

We can see from the `@JoinColumn` that `Customer` owns the `Profile`.`Profile` holds no reference to `Customer`, making the relationship unidirectional from the `Customer` side:

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

While `Ticket` exists in a unidirectional one-to-many relationship with `Customer`, owned by `Ticket`.

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

`Ticket` itself exists in a many-to-many unidirectional relationship with the `Tag` entity:

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

### The Application/Domain-Service Layer

> Domain services are different from infrastructural services because they embed and operate upon domain concepts ... Infrastructural services are instead focused on encapsulating the "plumbing" requirements of an application

> https://www.gorodinski.com/Services-in-Domain-Driven-Design-DDD-3158cf7881f980c5807dfcd7df0a69ce

Our Application Layer `uk.bit1.spring_jpa.application` sits between the Domain Layer and higher Service layers (like the Web Layer) - acting as a application layer and service layer for the Domain. It works with the Domain objects, but does not return them to the caller. 

#### Command / Query Separation

It can be useful to separate the processes that query a system from the processes that mutate it. That way we can implement different approaches (or even different models) for the query and the mutate parts. This is the basis of the generic Object Oriented pattern [Command Query Separation](https://martinfowler.com/bliki/CommandQuerySeparation.html), and the more involved [Command Query Responsibility Segregation (CQRS)](https://martinfowler.com/bliki/CQRS.html).

On the Command side the application layer loads full aggregate, and applies business rules:

```java
public class CustomerCommandService {
  ...
  public void resolveTicket(ResolveTicketCommand cmd) {
    loadCustomer(cmd.customerId()).resolveTicket(cmd.ticketId());
  }
  ...
  private Customer loadCustomer(Long customerId) {
    return customerRepository.findAggregateById(customerId)
            .orElseThrow(() -> new CustomerNotFoundException(customerId));
  }
  ...
}
```

Because each method in the `CustomerCommandService` runs within a transaction, the JPA Domain takes care of the rest.

While the Query side returns DTO projections, avoids entity loading, and is optimised for read performance:

```java
select new CustomerSummaryView(...)
from Customer c
```


Instead this layer returns either Projections (for queries) or usually nothing (for Commands).

* Clear separation of **Command vs Query** with CQRS
* Projection-based read model (no entity leakage)
* Query Pagination and Filtering




### Web Service layer


#### REST API (Thin Controllers)

* Controllers map:

    * HTTP → Commands (write)
    * HTTP → Query DTOs (read)
* No business logic in controllers
* Validation via `jakarta.validation`
* Consistent error handling

---

#### Filtering + Pagination

Examples:

```http
GET /api/customers?page=0&size=10
GET /api/customers?name=tony
GET /api/customers/1/tickets?status=OPEN
GET /api/customers/1/tickets?tag=bug
```




I wanted to create the [first iteration](https://github.com/tony-waters/spring-boot-app) of a Spring-Boot REST application using a rich (non-anemic) Domain model and a Command/Query separation at the application/service layer.







---

### 7. Testing Strategy

* Layered testing strategy (domain → JPA → service → web)
Layered tests:

| Layer           | Approach                     |
|-----------------|------------------------------|
| Domain          | Plain unit tests             |
| JPA             | `@DataJpaTest`               |
| Command Service | Transactional tests          |
| Query Service   | Projection + filtering tests |
| Web             | `@WebMvcTest` (slice tests)  |

---

## 🏗️ Architecture Overview

```
web (REST controllers)
   ↓
application
   ├── command (write use-cases)
   └── query (read use-cases)
   ↓
domain (aggregate + invariants)
   ↓
persistence (Spring Data JPA)
```

---

## 📦 Key Packages

```
domain/
  customer/
  tag/

application/
  customer/
    command/
    query/

web/
  customer/

```

---

## 🚀 Running the application with Maven

### Requirements

* Java 21
* Maven

### Run

```bash
mvn spring-boot:run
```

App will start on:

```
http://localhost:8080
```

---

## 🔍 Example API Usage

### Create a customer

```bash
curl -X POST http://localhost:8080/api/customers \
  -H "Content-Type: application/json" \
  -d '{ "displayName": "Tony" }'
```

---

### Raise a ticket

```bash
curl -X POST http://localhost:8080/api/customers/1/tickets \
  -H "Content-Type: application/json" \
  -d '{ "description": "This is a valid ticket" }'
```

---

### Resolve a ticket

```bash
curl -X POST http://localhost:8080/api/customers/1/tickets/10/resolve
```

---

### Query customers

```bash
curl "http://localhost:8080/api/customers?page=0&size=5"
```

---

### Filter tickets

```bash
curl "http://localhost:8080/api/customers/1/tickets?status=OPEN"
curl "http://localhost:8080/api/customers/1/tickets?tag=bug"
```

---

## 🐳 Running the Application with Docker Compose

This project can be run locally using Docker Compose, with:

* Spring Boot application
* PostgreSQL database
* Environment-based configuration (no local setup required)

---

### 📦 Prerequisites

* Docker
* Docker Compose (v2+)

---

### 🚀 Start the application

```bash
docker compose up --build
```

This will:

1. Build the Spring Boot application image
2. Start a PostgreSQL container
3. Start the application container
4. Wire them together via Docker networking

---

### 🌐 Access the application

* API: http://localhost:8080
* Health: http://localhost:8080/actuator/health

---

### 🔍 Verify it’s working

Check health:

```bash
curl http://localhost:8080/actuator/health
```

Create a customer:

```bash
curl -X POST http://localhost:8080/api/customers \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Tony"}'
```

Query customers:

```bash
curl "http://localhost:8080/api/customers?page=0&size=5"
```

---

### 🗄️ Database details

The application connects to PostgreSQL using:

```
jdbc:postgresql://postgres:5432/spring_jpa
```

Credentials (from `docker-compose.yml`):

* database: `spring_jpa`
* username: `spring_user`
* password: `spring_pass`

Data is persisted in a Docker volume:

```
postgres_data
```

---

### ⚙️ Configuration

All configuration is provided via environment variables:

| Variable                        | Purpose             |
| ------------------------------- | ------------------- |
| `SPRING_DATASOURCE_URL`         | Database connection |
| `SPRING_DATASOURCE_USERNAME`    | DB username         |
| `SPRING_DATASOURCE_PASSWORD`    | DB password         |
| `SPRING_JPA_HIBERNATE_DDL_AUTO` | Schema generation   |
| `SERVER_PORT`                   | App port            |
| `JAVA_TOOL_OPTIONS`             | JVM memory settings |

---

### 🧠 Notes

* Uses `ddl-auto=update` for convenience (not for production)
* PostgreSQL runs with a health check before the app starts
* Application exposes `/actuator/health` for readiness/liveness

---

### 🛑 Stop the application

```bash
docker compose down
```

To remove the database volume as well:

```bash
docker compose down -v
```

---

### 📈 Why this matters

This setup demonstrates:

* Containerised Spring Boot application
* Externalised configuration (12-factor style)
* Service-to-service networking
* Real database integration

It forms the foundation for the Kubernetes deployment shown later.


## ⚠️ What this project deliberately avoids

* Generic CRUD services
* Entity exposure in controllers
* “God” service classes
* Overuse of DTO mappers (MapStruct not required on query side)
* Premature abstraction (no specifications/query DSL yet)

---

## 📈 Possible next steps

If extending this demo:

* ~~Add containerisation (Docker + Postgres)~~
* Add load testing (k6/Gatling)
* Add authentication
* Introduce domain events (e.g. TicketResolvedEvent)
* Develop Tag as a separate aggregate route

---

## 🧩 Key Takeaway

This project demonstrates that:

> You can build a Spring Boot + JPA application that is
> **not CRUD-driven**,
> **not anemic**,
> and **still simple to reason about and test**.

---

## 📄 License

MIT (or your choice)


## <a name="notes"></a>Notes
1. I purposefully do not include using a JOIN table here. While this is a legitimate way of representing a one-to-one relationship it is generally only used for legacy systems.

2. For what 'composition' means in an Object/Java context see [here](https://stackoverflow.com/questions/11881552/implementation-difference-between-aggregation-and-composition-in-java).

---

## Resources
- [Domain-Driven Design Reference - Eric Evans](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf)
- [Command Query Separation pattern - Martin Fowler](https://martinfowler.com/bliki/CommandQuerySeparation.html)
- [Command Query Responsibility Segregation (CQRS) - Martin Fowler](https://martinfowler.com/bliki/CQRS.html)


