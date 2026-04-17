---
title: Spring REST 1 - Anatomy of a Non-Anemic Spring Demo Application 
layout: post
header-img: "img/spring5.jpg"
---

I wanted to write a [simple-ish Spring REST application](https://github.com/tony-waters/spring-boot-app) to experiment with these technologies:

- Java 21
- Spring Boot 4.x
- Spring Data JPA
- Hibernate 7
- H2 (test database)
- AssertJ

... and these aims:

- [non-anemic](https://martinfowler.com/bliki/AnemicDomainModel.html) domain model using aggregates
- separate Command and Query operations
- sensible tests aimed at specific layers of the application

The domain looks like this:

![Image alt]({{ site.baseurl }}/img/spring-customer-aggregate.png "Customer Aggregate Diagram")

The application is broken down into layers.

- Domain / JPA Repository Layer
- Application Service Layer
- REST Controller Layer

![Image alt]({{ site.baseurl }}/img/spring-customer-layers.png "Application Layers Diagram")

I will briefly summarise each of these layers, and point to where the important code and tests are.

## Domain / JPA Layer

The main classes in this layer are:

- [`Customer`](https://github.com/tony-waters/spring-boot-app/blob/main/src/main/java/uk/bit1/spring_jpa/domain/customer/Customer.java)
- [`Profile`](https://github.com/tony-waters/spring-boot-app/blob/main/src/main/java/uk/bit1/spring_jpa/domain/customer/Profile.java)
- [`Ticket`](https://github.com/tony-waters/spring-boot-app/blob/main/src/main/java/uk/bit1/spring_jpa/domain/customer/Ticket.java)

A focus was to avoid an [anemic domain model](https://martinfowler.com/bliki/AnemicDomainModel.html) by using aggregates:

> An aggregate is a cluster of associated objects treated as a single unit for data changes, with a clearly defined boundary and a root entity that enforces invariants.
> 
> — Eric Evans, *Domain-Driven Design*

Our application has 2 aggregates, `Customer` and `Tag`. In this first iteration I am going to focus on the `Customer` aggregate:

![Image alt]({{ site.baseurl }}/img/spring-customer-aggregate-2.png "Customer Aggregate Diagram")

The basic idea is that by grouping entities into logical groups (called an aggregate) and controlling access to this group through a single entity (called the aggregate root) we can create better systems.

Enforcement of invariants becomes simpler, because it happens inside the aggregate, rather than leaking into services. And since all traffic to the aggregate goes via the aggregate root, its easier to reason over. In fact, the aggregate root never returns entity objects from within the aggregate.

For example, take  [`Customer`](), our aggregate root. It has no entity objects as return values. And it is the only entity in the aggregate with public methods - neither [`Ticket`]() or [`Profile`]() has any.

Also note that all the entities in the aggregate focus on domain behaviour (like `resolveTicket()`) rather than setters (like `setStatus('resolved')`).

Domain tests for the sample application include unit tests that run without any JPA context. And `@DataJpaTest` tests:

- [CustomerTest](https://github.com/tony-waters/spring-boot-app/blob/main/src/test/java/uk/bit1/spring_jpa/domain/customer/CustomerTest.java)
- [TicketTest](https://github.com/tony-waters/spring-boot-app/blob/main/src/test/java/uk/bit1/spring_jpa/domain/customer/TicketTest.java)
- [CustomerRepositoryDataJpaTest](https://github.com/tony-waters/spring-boot-app/blob/main/src/test/java/uk/bit1/spring_jpa/domain/customer/CustomerRepositoryDataJpaTest.java)

## Application Service Layer

The main classes in this layer are:

- [`CustomerCommandService`](https://github.com/tony-waters/spring-boot-app/blob/main/src/main/java/uk/bit1/spring_jpa/application/customer/command/CustomerCommandService.java)
- [`CustomerQueryService`](https://github.com/tony-waters/spring-boot-app/blob/main/src/main/java/uk/bit1/spring_jpa/application/customer/query/CustomerQueryService.java)
- [`CustomerQueryRepository`](https://github.com/tony-waters/spring-boot-app/blob/main/src/main/java/uk/bit1/spring_jpa/application/customer/query/CustomerQueryRepository.java)

It can be useful to separate the processes that query a system from the processes that change it. That way we can implement different approaches (or even different models) for the query and the mutate parts. This is the basis of the generic Object Oriented pattern [Command Query Separation](https://martinfowler.com/bliki/CommandQuerySeparation.html), and the more involved [Command Query Responsibility Segregation (CQRS)](https://martinfowler.com/bliki/CQRS.html):

> The really valuable idea in this principle is that it's extremely handy if you can clearly separate methods that change state from those that don't. This is because you can use queries in many situations with much more confidence, introducing them anywhere, changing their order. You have to be more careful with modifiers.
>
> — [Martin Fowler](https://martinfowler.com/bliki/CommandQuerySeparation.html)

The application services are split between [`CustomerCommandService`](https://github.com/tony-waters/spring-boot-app/blob/main/src/main/java/uk/bit1/spring_jpa/application/customer/command/CustomerCommandService.java) and [`CustomerQueryService`](https://github.com/tony-waters/spring-boot-app/blob/main/src/main/java/uk/bit1/spring_jpa/application/customer/query/CustomerQueryService.java).

`CustomerCommandService` talks directly to the `Customer` aggregate root to apply changes to the data using Command objects. One outcome of this approach is you can end up with a lot of Command objects, since the recomendation is usually to use one object per command. These simple data carriers can be represented with `records` for convenience.

`CustomerQueryService` uses its [`CustomerQueryRepository`](https://github.com/tony-waters/spring-boot-app/blob/main/src/main/java/uk/bit1/spring_jpa/application/customer/query/CustomerQueryRepository.java) and JPQL, avoiding the domain model entirely. The Query side returns projections in the form of `record`s.

Tests for this layer can be found in:

- [`CustomerCommandServiceDataJpaTest`](https://github.com/tony-waters/spring-boot-app/blob/main/src/test/java/uk/bit1/spring_jpa/application/customer/command/CustomerCommandServiceDataJpaTest.java)
- [`CustomerQueryRepositoryDataJpaTest`](https://github.com/tony-waters/spring-boot-app/blob/main/src/test/java/uk/bit1/spring_jpa/application/customer/query/CustomerQueryRepositoryDataJpaTest.java)

## REST Controller Layer

The main classes in this layer are:

- [`CustomerCommandController`](https://github.com/tony-waters/spring-boot-app/blob/main/src/main/java/uk/bit1/spring_jpa/web/customer/CustomerCommandController.java)
- [`CustomerQueryController`](https://github.com/tony-waters/spring-boot-app/blob/main/src/main/java/uk/bit1/spring_jpa/web/customer/CustomerQueryController.java)

This is a vanilla Spring REST controller layer. Its thin, uses DTOs for requests, and basically calls the the Application Layer.

Tests for this layer can be found in:

- [`CustomerCommandControllerWebMvcTest`](https://github.com/tony-waters/spring-boot-app/blob/main/src/test/java/uk/bit1/spring_jpa/web/customer/CustomerCommandControllerWebMvcTest.java)
- [`CustomerQueryControllerWebMvcTest`](https://github.com/tony-waters/spring-boot-app/blob/main/src/test/java/uk/bit1/spring_jpa/web/customer/CustomerQueryControllerWebMvcTest.java)

## Other bits (deployment and a little load testing for sanity)

Apart from the Layers its worth mentioning the application has a few other features:

### Seeder

The seeder classes are:

- [`DemoDataSeederService`](https://github.com/tony-waters/spring-boot-app/blob/main/src/main/java/uk/bit1/spring_jpa/bootstrap/DemoDataSeederService.java)
- [`SeedCommandLineRunner`](https://github.com/tony-waters/spring-boot-app/blob/main/src/main/java/uk/bit1/spring_jpa/bootstrap/SeedCommandLineRunner.java)

The `SeedCommandLineRunner` runs `DemoDataSeederService` when the Spring profile is "seed".

### Docker

The Docker classes are:

- [`Dockerfile`](https://github.com/tony-waters/spring-boot-app/blob/main/Dockerfile)
- [`docker-compose.yaml`](https://github.com/tony-waters/spring-boot-app/blob/main/docker-compose.yaml)
- [`docker-compose-no-seed.yaml`](https://github.com/tony-waters/spring-boot-app/blob/main/docker-compose-no-seed.yaml)
- [`customer-write-smoke-test.js`](https://github.com/tony-waters/spring-boot-app/blob/main/customer-write-smoke-test.js)

Running the following will build and seed the application:

```bash
docker-compose up --build --detach
```

To just run the application and Postgres (no seeding):

```bash
docker-compose -f docker-compose-no-seed.yaml up
```

### GitHub build script

I have included a GitHub Actions script to [publish the container image](https://github.com/tony-waters/spring-boot-app/blob/main/.github/workflows/publish-image.yml) produced by the [Spring Demo application](https://github.com/tony-waters/spring-boot-app). It is published to [GitHub Container Registry](https://github.com/tony-waters/spring-boot-app/pkgs/container/spring-boot-app)

---

## Run some K6 tests:

Provided [K6](https://k6.io/) is installed, you can run write and read smoke tests. Run the write test like this:

```shell
k6 run \
  -e TEST_PROFILE=smoke \
  -e BASE_URL=http://localhost:8080 \
  ./k6/write-test.js
```

If thats clean, you can try running using `TEST_PROFILE=load` and `TEST_PROFILE=stress`.

Same for the read tests:

```shell
k6 run \
  -e TEST_PROFILE=smoke \
  -e BASE_URL=http://localhost:8080 \
  ./k6/read-test.js
```

## Resources
- [Domain-Driven Design Reference - Eric Evans](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf)
- [Domain-Driven Design: Reference Definitions and Pattern Summaries - Eric Evans](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf)
- [Command Query Separation pattern - Martin Fowler](https://martinfowler.com/bliki/CommandQuerySeparation.html)
- [Command Query Responsibility Segregation (CQRS) - Martin Fowler](https://martinfowler.com/bliki/CQRS.html)
- [Getting started with CQRS](https://cqrs.nu/faq/Command%20and%20Query%20Responsibility%20Segregation/)
- [Services in domain Driven Design](https://www.gorodinski.com/Services-in-Domain-Driven-Design-DDD-3158cf7881f980c5807dfcd7df0a69ce)
- [Domain-Driven Design: Entities, Value Objects, and How To Distinguish Them](https://wempe.dev/blog/domain-driven-design-entities-value-objects)
- [K6](https://k6.io/)
- [Chart Releaser Action to Automate GitHub Page Charts](https://helm.sh/docs/howto/chart_releaser_action/)
- [Publishing Helm Charts to GitHub Container Registry](https://paulyu.dev/article/publishing-helm-charts-to-ghcr/)
