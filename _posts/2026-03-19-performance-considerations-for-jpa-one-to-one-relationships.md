---
title: Performance considerations for JPA one-to-one relationships
layout: post
tags: [JPA, @OneToOne]
header-img: "img/jekyll2.jpg"
---

# Performance Considerations for One-to-One Relationships

One-to-one relationships can appear simple,
but they can introduce subtle performance issues if they are not used carefully.

In particular:

- lazy loading may not behave as expected
= joins may appear unexpectedly
- N+1 queries can still occur

Understanding how Hibernate loads one-to-one associations helps avoid surprises.
In this post I want to look at this and some potential solutions.

1. Unexpected Eager Loading

Developers often expect this mapping to load lazily:

@OneToOne(fetch = FetchType.LAZY)
private Profile profile;

However, depending on the mapping, Hibernate may still load the related entity immediately.

For example:

select c.id, c.display_name, p.id, p.marketing_opt_in
from customer c
left join profile p on ...

This happens because Hibernate sometimes cannot determine whether a related row exists without executing a query.

In these cases, Hibernate loads the association eagerly.

2. N+1 Query Problems

Even one-to-one relationships can produce N+1 queries.

Example:

List<Customer> customers = customerRepository.findAll();

Then accessing the profile:

customers.forEach(c -> c.getProfile());

May produce:

SELECT * FROM customer
SELECT * FROM profile WHERE customer_id = 1
SELECT * FROM profile WHERE customer_id = 2
SELECT * FROM profile WHERE customer_id = 3
...

This is the classic N+1 query problem.

3. Using Fetch Joins

One solution is to fetch the relationship explicitly.

Example JPQL query:

@Query("""
select c
from Customer c
join fetch c.profile
""")
List<Customer> findAllWithProfile();

This loads both entities in a single query.

## Solutions

### Using DTO Projections

In many cases it is better to load exactly the data needed using DTO projections.

Example:

@Query("""
select new com.example.CustomerView(c.id, c.displayName, p.marketingOptIn)
from Customer c
left join c.profile p
""")
List<CustomerView> findCustomerViews();

This avoids unnecessary entity loading.

### Using Entity Graphs

## Practical Advice

When working with one-to-one relationships:

verify SQL queries during development

do not rely on FetchType.LAZY alone

use fetch joins when appropriate

consider DTO projections for read-heavy queries

Understanding these behaviours helps prevent performance issues as applications grow.

