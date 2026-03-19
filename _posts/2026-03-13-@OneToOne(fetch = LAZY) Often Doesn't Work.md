---
title: A Common JPA Pitfall - @OneToOne(fetch = LAZY) Often Doesn't Work
layout: post
tags: [JPA, @OneToOne]
header-img: "img/jekyll2.jpg"
---

> The parent-side @OneToOne association requires bytecode enhancement 
> so that the association can be loaded lazily. 
> Otherwise, the parent-side association is always fetched 
> even if the association is marked with FetchType.LAZY.
> 
> [Hibernate Docs](https://docs.hibernate.org/orm/current/userguide/html_single/#best-practices-mapping-associations)


Developers often expect that setting FetchType.LAZY on a Parent
entity will prevent the related Child entity from being loaded immediately.
But as the above quote suggests, 
this is not always the case.
If the Parent is the Inverse side of a one-to-one relationship,
the Child entity is fetched eagerly regardless of the `FetchType.LAZY` annotation.

This behaviour can be surprising.

Lets demonstrate this using the following Parent class `Customer`:

``` java
public class CustomerB {
...
    @OneToOne(
            fetch = FetchType.LAZY,
            mappedBy = "customer",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    private ProfileB profile;
...
}
```

... and its associated Child class `Profile`:

``` java
public class ProfileB {
...
    @OneToOne(
            optional = false
    )
    @JoinColumn(
            name = "customer_id",
            nullable = false,
            unique = true
    )
    private CustomerB customer;
...
}
```

If we run a simple test:

``` java
Customer loaded = customerRepository.findById(1L).orElseThrow();
```

And look at the SELECT this produces:

``` sql
select
    p.id,
    p.customer_id,
    c.id
from
    profile_b p
join
    customer c
        on c.id=p.customer_id 
where
    p.customer_id=?
```

We can see that it produces a JOIN rather than lazily load the Profile.

The problem comes from how Hibernate implements lazy loading.
Hibernate normally uses proxies to defer loading an entity until it is accessed.
If the association is not on the owning side,
Hibernate often cannot determine whether a row exists without executing a query,
so simply loads the entity immediately.

So although CustomerB.profile is declared with FetchType.LAZY, 
in this Hibernate setup the inverse-side one-to-one association 
was observed to initialize eagerly. 
This is a common limitation of one-to-one lazy loading on the inverse side.

Lazy loading works reliably when the association is on the owning side with a foreign key.
Here the foreign key already tells Hibernate whether a related entity exists.
So a proxy can be created safely.

### Solution 1 - Bytecode enhancement

As the introductory quote suggests we can use Bytecode Enhancement:

> The parent-side @OneToOne association **requires bytecode enhancement**
> so that the association can be loaded lazily.
>
> [Hibernate Docs](https://docs.hibernate.org/orm/current/userguide/html_single/#best-practices-mapping-associations)

Hibernate can support true lazy loading for more one-to-one cases using bytecode enhancement.
This allows Hibernate to intercept field access and load the entity on demand.
However, this requires additional build configuration and is not enabled
by default in many projects.

Once this is enabled (in Maven or Gradle) we can tell Hibernate to use it:

...


### Solution 2 - make the Parent the Owning side

Another option is to make the Parent (Customer) side the Owning side:

``` java
public class Customer {
...
    @OneToOne(
            fetch = FetchType.LAZY,
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @JoinColumn(
            name = "profile_id",
            unique = true
    )
    private ProfileA profile;
...
}

public class Profile {
...
    @OneToOne(
            mappedBy = "profile"
    )
    private Customer customer;
...
}
```

Things now work as expected:

``` sql
    select
        c.id,
        c.profile_id 
    from
        customer c 
    where
        c.id=?
```

While this setup is less of a natural fit
as Profile is dependent on Customer and it would be more common to have Profile
as the Owning side. it is still a legitimate schema.

### Solution 3 - move the find to the CustomerRepository

Instead of relying on entity-based ...

#### DTO projections


#### Entity Graphs



### Practical Advice

When designing one-to-one mappings:

do not rely on FetchType.LAZY alone

understand which side owns the relationship

verify behaviour with SQL logging and tests

In many cases, explicit queries, DTO projections, or entity graphs are better 
for controlling fetch behaviour.
I will look at this in a future post.


### <a name="notes"></a>Notes
