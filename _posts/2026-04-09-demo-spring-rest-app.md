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

## Domain / JPA Layer

The classes in this layer can be found here: 

The main focus was to avoid an [anemic domain model]() by using aggregates:

> An aggregate is a cluster of associated objects treated as a single unit for data changes, with a clearly defined boundary and a root entity that enforces invariants.  
> — Eric Evans, *Domain-Driven Design*

The basic idea is that by grouping entities into logical groups (called an aggregate) and controlling access to this group through a single entity (called the aggregate root) we can create better systems.

Enforcement of invariants becomes simpler, because happens inside the aggregate, rather than leaking into services. And all traffic to the aggregate goes via the aggregate root, so its easier to reason over. In fact, the aggregate root never returns entity objects from within the aggregate.

Our application has 2 aggregates, `Customer` and `Tag`. In this first iteration I am going to focus on the `Customer` aggregate:

![Image alt]({{ site.baseurl }}/img/spring-customer-aggregate-2.png "Customer Aggregate Diagram")

For example, take  [`Customer`](), our aggregate root. It has no entity objects as return values. And it is the only entity in the aggregate with public return methods.

Also note that all the entities in the aggregate focus on domain behaviour (like `resolveTicket()`) rather than setters (like `setStatus('resolved')`).

Domain tests for the sample application include unit tests that run without any JPA context. And `@DataJpaTest` tests:

- [CustomerTest](https://github.com/tony-waters/spring-boot-app/blob/main/src/test/java/uk/bit1/spring_jpa/domain/customer/CustomerTest.java)
- [TicketTest](https://github.com/tony-waters/spring-boot-app/blob/main/src/test/java/uk/bit1/spring_jpa/domain/customer/TicketTest.java)
- [CustomerRepositoryDataJpaTest](https://github.com/tony-waters/spring-boot-app/blob/main/src/test/java/uk/bit1/spring_jpa/domain/customer/CustomerRepositoryDataJpaTest.java)







