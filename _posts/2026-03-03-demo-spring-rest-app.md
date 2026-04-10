---
title: Demo Spring REST Application
layout: post
header-img: "img/spring5.jpg"
---

I wanted to write a simple-ish Spring REST application to experiment with these technologies:

- Java 21
- Spring Boot 4.x
- Spring Data JPA
- Hibernate 7
- H2 (test database)
- AssertJ

... and these aims:

- non-anemic domain model using aggregates
- separate Command and Query operations
- sensible tests aimed at specific layers of the application

The domain looks like this:

![Image alt]({{ site.baseurl }}/img/spring-customer-aggregate.png "Customer Aggregate Diagram")

The application is broken down into layers.

- Domain / JPA Repository Layer
- Application Service Layer
- REST Controller Layer


        ┌──────────────────────────────┐
        │      REST Controllers        │
        │  (REST API: /api/customers)  │
        └──────────────┬───────────────┘
                       │
        ┌──────────────▼───────────────┐
        │    Application (Services)    │
        │  Command + Query separation  │
        └──────────────┬───────────────┘
                       │
     ┌─────────────────┴─────────────────┐
     │                                   │
┌────▼─────┐                     ┌───────▼────────┐
│ Command  │                     │ Query          │
│ Side     │                     │ Side           │
│ (Domain) │                     │ (DTOs)         │
└────┬─────┘                     └───────┬────────┘
     │                                   │
┌────▼──────────────┐          ┌─────────▼────────────┐
│ Domain / Entities │          │ Projection Queries   │
│ - Customer        │          │ (no entity leakage)  │
│ - Ticket          │          └──────────────────────┘
│ - Tag             │
└───────────────────┘


I will summarise each of these briefly, and point to where the important code and tests are.

## Domain / JPA Layer

The main classes in this layer are:

- [`Customer`]()
- [`Profile`]()
- [`Ticket`]()

The main focus was to avoid an [anemic domain model]() by using aggregates:

> An aggregate is a cluster of associated objects treated as a single unit for data changes, with a clearly defined boundary and a root entity that enforces invariants.  
> — Eric Evans, *Domain-Driven Design*

The basic idea is that by grouping entities into logical groups (called an aggregate) and controlling access to this group through a single entity (called the aggregate root) we can create better systems.

Enforcement of invariants becomes simpler, because happens inside the aggregate, rather than leaking into services. And all traffic to the aggregate goes via the aggregate root, so its easier to reason over. In fact, the aggregate root never returns entity objects from within the aggregate.

Our application has 2 aggregates, `Customer` and `Tag`. In this first iteration I am going to focus on the `Customer` aggregate:

![Image alt]({{ site.baseurl }}/img/spring-customer-aggregate-2.png "Customer Aggregate Diagram")

For example, take  [`Customer`](), our aggregate root. It has no entity objects as return values. And it is the only entity in the aggregate with public return methods, neither [`Ticket`]() or [`Profile`]() has any.

Also note that all the entities in the aggregate focus on domain behaviour (like `resolveTicket()`) rather than setters (like `setStatus('resolved')`).

Domain tests for the sample application include unit tests that run without any JPA context. And `@DataJpaTest` tests:

- [CustomerTest](https://github.com/tony-waters/spring-boot-app/blob/main/src/test/java/uk/bit1/spring_jpa/domain/customer/CustomerTest.java)
- [TicketTest](https://github.com/tony-waters/spring-boot-app/blob/main/src/test/java/uk/bit1/spring_jpa/domain/customer/TicketTest.java)
- [CustomerRepositoryDataJpaTest](https://github.com/tony-waters/spring-boot-app/blob/main/src/test/java/uk/bit1/spring_jpa/domain/customer/CustomerRepositoryDataJpaTest.java)

## Application Service Layer

The main classes in this layer are:

- [`CustomerCommandService`]()
- [`CustomerQueryService`]()
- [`CustomerQueryRepository`]()

It can be useful to separate the processes that query a system from the processes that change it. That way we can implement different approaches (or even different models) for the query and the mutate parts. This is the basis of the generic Object Oriented pattern [Command Query Separation](https://martinfowler.com/bliki/CommandQuerySeparation.html), and the more involved [Command Query Responsibility Segregation (CQRS)](https://martinfowler.com/bliki/CQRS.html).

The application services are split between [`CustomerCommandService`]() and [`CustomerQueryService`]().

`CustomerCommandService` talks directly to the `Customer` aggregate root to apply changes to the data using Command objects. One outcome of this approach is you can end up with a lot of Command objects, since the recomendation is usually to use one object per command. These simple data carriers can be represented with `records` for simplicity.

`CustomerQueryService` uses its [`CustomerQueryRepository`]() and JPQL, avoiding the domain model entirely. The Query side returns projections in the form of `record`s.

Tests for this layer can be found in:

- [`CustomerCommandServiceDataJpaTest`]()
- [`CustomerQueryRepositoryDataJpaTest`]()

## REST Controller Layer

The main classes in this layer are:

- [`CustomerCommandController`]()
- [`CustomerQueryController`]()

This is a vanilla Spring REST controller layer. Its thin, uses DTOs for requests, and basically calls the the Application Layer.

Tests for this layer can be found in:

- [`CustomerCommandControllerWebMvcTest`]()
- [`CustomerQueryControllerWebMvcTest`]()

## Other bits (deployment and a little load testing for sanity)

Apart from the Layers its worth mentioning the application has a few other features:

### Seeder

The seeder classes are:

- [`DemoDataSeederService`]()
- [`SeedCommandLineRunner`]()

The `SeedCommandLineRunner` runs `DemoDataSeederService` when the Spring profile is "seed".

### Docker

The Docker classes are:

- [`Dockerfile`]()
- [`docker-compose.yaml`]()
- [`docker-compose-no-seed.yaml`]()
- [`customer-write-smoke-test.js`]()

Running the following will build and seed the application:

```bash
docker-compose up --build --detach
```

Then provided K9 is installed, you can run some basic load tests:

```bash
k6 run customer-write-smoke-test.js
```

To just run the application and Postgres (no seeding):

```bash
docker-compose -f docker-compose-no-seed.yaml up --build --detach
```


### GitHub build script

I have included a GitHub Actions script to publish the container imager [here](). Its pulished to https://github.com/tony-waters/spring-boot-app/pkgs/container/spring-boot-app

