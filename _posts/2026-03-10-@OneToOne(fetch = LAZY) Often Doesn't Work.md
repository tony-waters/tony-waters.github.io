---
layout: post
title: A Common JPA Pitfall - @OneToOne(fetch = LAZY) Often Doesn't Work
tags: [JPA, @OneToOne]
header-img: "img/jekyll2.jpg"
---

## A Common JPA Pitfall: @OneToOne(fetch = LAZY) Often Doesn't Work

Developers often expect that setting FetchType.LAZY will prevent the 
related entity from being loaded immediately.

For example:

``` java
@OneToOne(fetch = FetchType.LAZY)
private Profile profile;
```

However, in many cases Hibernate will still load the related entity eagerly.

This behaviour surprises many developers.

### Why This Happens

The problem comes from how Hibernate implements lazy loading.

Hibernate normally uses proxies to defer loading an entity until it is accessed.

For example:

Customer → Proxy(Profile)

When the proxy is accessed, Hibernate performs a SQL query to load the real entity.

This works well for:

@ManyToOne
@OneToMany

But one-to-one relationships are harder to proxy.

If the association is not on the owning side, 
Hibernate often cannot determine whether a row exists without executing a query.

For example:

Customer
↳ profile (mappedBy)

Hibernate must check whether a profile row exists before creating a proxy.

That check requires a query.

So Hibernate simply loads the entity immediately.

### When Lazy Loading Does Work

Lazy loading works reliably when the association is on the owning side with a foreign key.

Example:

@OneToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "customer_id")
private Customer customer;

Here the foreign key already tells Hibernate whether a related entity exists.

So a proxy can be created safely.

### Hibernate Bytecode Enhancement

Hibernate can support true lazy loading for more one-to-one cases using bytecode enhancement.

This allows Hibernate to intercept field access and load the entity on demand.

However, this requires additional build configuration and is not enabled 
by default in many projects.

For that reason, many developers treat one-to-one relationships as effectively eager 
unless they are on the owning side.

### Practical Advice

When designing one-to-one mappings:

do not rely on FetchType.LAZY alone

understand which side owns the relationship

verify behaviour with SQL logging and tests

In many cases, explicit queries or DTO projections are better 
for controlling fetch behaviour.

