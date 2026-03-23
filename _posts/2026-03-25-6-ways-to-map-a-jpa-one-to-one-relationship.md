---
title: Six Ways to Map One-to-One Relationships in Spring Boot JPA
layout: post
tags: [JPA, @OneToOne]
header-img: "img/jekyll2.jpg"
---

For a seemingly straightforward JPA annotation, `@OneToOne` relationships can be mapped in a surprising number of ways. I want to explore some<sup>[[1]](#notes)</sup> variants of these mappings using a simple Customer–Profile relationship existing in a simple Parent-Child setup.

[Customer ──1:1── Profile diagram]

## Design space

The `@OneToOne` annotation hides several structural decisions:

- Where the foreign key lives (parent vs child)
- Whether navigation is bidirectional
- Whether identity is shared (`@MapsId`)
- Who controls lifecycle (entity vs caller)

[explain why leaving last item out of table]

Ignoring the last item for now, the first 3 combine into 6 distinct variants:

                     Direction
               ┌───────────────┬───────────────┐
               │ Bidirectional │ Unidirectional│
┌──────────────┼───────────────┼───────────────┤
│ FK in Parent │   Variant A   │   Variant D   │
│ FK in Child  │   Variant B   │   Variant E   │
│ Shared PK    │   Variant C   │   Variant F   │
└──────────────┴───────────────┴───────────────┘

These variants come from a [working repository](https://github.com/tony-waters/spring-jpa-one-to-one) with tests verifying entity behaviour, database schema, and lazy loading observations.

## But what about the last item?

Note that for most of the variants the Parent (`Customer`) controls the lifecycle. From an Object perspective this usually makes more sense in a Parent/Child scenario because of composition<sup>[[2]](#notes)</sup>.

## For Example: Variant A — Bidirectional with Foreign Key in Parent

[ER diagram]

In [this variant](https://github.com/tony-waters/spring-jpa-one-to-one/tree/main/src/main/java/uk/bit1/spring_jpa/variantA):

The Parent looks like this:

``` java
public class CustomerA {

    @Id
    @GeneratedValue(strategy=GenerationType.AUTO)
    private Long id;

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
```

The presence of `@JoinColumn` indicates `CustomerA` is the 'owning side' of this relationship from a Relational perspective. So the foreign key goes in this table. As the 'owning side' it has to be updated in order to persist in the Database. If you only update the inverse side, nothing is persisted to the database. Its best to maintain the object graph and always do something like this:

``` java
customer.setProfile(profile);
profile.setCustomer(customer);
```

From an Object perspective a `Customer` 'owns' its `Profile`. Consequently, `cascade` and `orphanRemoval` live here too. This means:

- persist Customer → persists Profile
- remove reference → deletes Profile
- delete Customer → deletes Profile

Which is effectively composition<sup>[[2]](#notes)</sup> at the Object level.

Also of interest is `FetchType.LAZY`. This should ensure that `Profile` is only read from the Database when needed. This does not always work as one may imagine. If the Parent is the Inverse side of a one-to-one relationship,
the Child entity is fetched eagerly regardless of the `FetchType.LAZY` annotation. But since this is the 'owning side' and not the 'inverse side' we would expect it to work here as planned (which the tests demonstrate). You can contrast this with Variants B/C where lazy loading fails despite the attribute existing.

Finally, it is worth noting, that `unique = true` is not optional here if we wish to ensure a one-to-one relationship. Preventing multiple `Profile` instances referencing the same `Customer` is not enforced by the object model alone.  
Without a database constraint, nothing stops duplicate relationships being persisted. `unique = true` adds a 'UNIQUE' identifier to the column in the DDL. You can see that here in the issued SQL:

``` sql
create table customer_a (
    id bigint not null,
    profile_id bigint unique,
    display_name varchar(80) not null,
    primary key (id)
)
```

On the other side of the relationship the Child (`Profile`) has a `mappedBy` to mark it as the 'inverse side' of the relationship and provide bidirectionality:

``` java
public class ProfileA {

    @Id
    @GeneratedValue(strategy= GenerationType.AUTO)
    private Long id;

    @OneToOne(
            mappedBy = "profile"
    )
    private CustomerA customer;

    private boolean marketingOptIn = false;
    ...
}
```

This allows navigation back to the `Customer` using its instance variable `profile`. And because it is the 'inverse side' holds no foreign key, and cannot be relied upon to save its associated `Customer` when saved itself.
It produces the following SQL:

``` sql
create table profile_a (
    marketing_opt_in boolean not null,
    id bigint not null,
    primary key (id)
)
```

Like most of the variants, in `Variant A` the parent provides helper methods to keep both sides consistent - ensuring the object graph and the database state remain aligned.

``` java
public class CustomerA {
    ...
    public ProfileA createProfile(boolean marketingOptIn) {
        if (this.profile != null) {
            throw new IllegalStateException("Customer already has a Profile");
        }
        ProfileA profile = new ProfileA(marketingOptIn);
        profile.setCustomerInternal(this);
        this.profile = profile;
        return profile;
    }

    public void removeProfile() {
        if (this.profile == null) {
            throw new IllegalStateException("Customer has no Profile to remove");
        }
        ProfileA old =  this.profile;
        this.profile = null;
        old.clearCustomerInternal();
    }
    ...
}
```

`Profile` is only called to change its own internal values:

``` java
public class ProfileA {
    ...
    void setCustomerInternal(CustomerA customer) {
        if (customer == null) {
            throw new IllegalArgumentException("Profile must have a Customer");
        }
        if (this.customer != null && this.customer != customer) {
            throw new IllegalStateException("Profile cannot be moved to another Customer");
        }
        this.customer = customer;
    }

    void clearCustomerInternal() {
        this.customer = null;
    }
    ...
}
```

Placing the foreign key in the parent table can sometimes feel slightly unnatural if the child is conceptually dependent on the parent. 

## All the Variants

Here are all the Variants with links to the GitHub repo folder where they are located:

| Variant   | Direction       | FK Location | Shared PK | Owning Side | Navigation       | Typical Lifecycle |
|----------|----------------|-------------|-----------|-------------|------------------|-------------------|
| Variant A| Bidirectional  | Parent      | No        | Parent      | Both directions  | Parent-managed    |
| Variant B| Bidirectional  | Child       | No        | Child       | Both directions  | Parent-managed    |
| Variant C| Bidirectional  | Shared PK   | Yes       | Child       | Both directions  | Parent-managed    |
| Variant D| Unidirectional | Parent      | No        | Parent      | Parent only      | Parent-managed    |
| Variant E| Unidirectional | Child       | No        | Child       | Child only       | Caller-managed    |
| Variant F| Unidirectional | Shared PK   | Yes       | Child       | Child only       | Caller-managed    |

## Summary of Variants B–F

Rather than repeating the full walkthrough, the remaining variants can be understood as variations on the same core ideas demonstrated in Variant A. They are better understood through reference to the actual repositories. Brlow is a summary of each Variant with links to its classes and tests.

---

### Variant B — FK in Child

- Foreign key moves to the child (`profile.customer_id`)
- Child becomes the owning side
- Parent becomes inverse (`mappedBy`)

Most natural relational model. The parent *feels* like it owns the relationship, but the child controls persistence.

---

### Variant C — Shared Primary Key (`@MapsId`)

- `Profile.id == Customer.id`
- No separate foreign key column

Models true composition at the database level since Child cannot exist independently and Cannot be reassigned

---

### Variant D — Unidirectional, FK in Parent

- Same schema as Variant A
- No back-reference from Profile → Customer

👉 Simplifies the object model by removing bidirectional complexity.

---

### Variant E — Unidirectional, FK in Child (Explicit Lifecycle)

- Same schema as Variant B
- No cascade or helper methods

👉 Lifecycle is controlled entirely in the service layer

---

### Variant F — Shared PK + Explicit Lifecycle

- Combines `@MapsId` with unidirectional design
- No cascade, no bidirectional links

👉 Most explicit and constrained model.

---

For full implementations, tests, and edge cases, see the repository:
👉 https://github.com/tony-waters/spring-jpa-one-to-one

## Tests

The included tests have evolved as I added to and refactored the [source repo](). Each Variant includes persistence behaviour and schema state tests:

- VariantA_BidirectionalFkInParentTest
- VariantB_BidirectionalFkInChildTest
- VariantC_BidirectionalSharedPkMapsIdTest
- VariantD_UnidirectionalFkInParentTest
- VariantE_UnidirectionalFkInChildExplicitLifecycleTest
- VariantF_UnidirectionalSharedPkExplicitLifecycleTest

... and entity contract tests where appropriate:

- VariantA_EntityContractTest
- VariantB_EntityContractTest
- VariantC_EntityContractTest
- VariantD_EntityContractTest

I also wanted to record some of the observed Hibernate behaviour in this setup (I found some of it surprising):

- VariantA_ProfileLazyLoadingObservationTest
- VariantB_ProfileLazyLoadingObservationTest
- VariantC_ProfileLazyLoadingObservationTest
- VariantD_ProfileLazyLoadingObservationTest
- VariantF_SharedPkHibernateObservationTest

## Common Pitfalls

- Updating only the inverse side does nothing
- Forgetting `UNIQUE` → not actually one-to-one
- Assuming `FetchType.LAZY` always works
- Confusing owning side with domain ownership

## Which variant should I use?


## Repository
The repository contains full implementations, tests, and schema assertions for each variant:

👉 https://github.com/tony-waters/spring-jpa-one-to-one


## <a name="notes"></a>Notes
1. I purposefully do not include using a JOIN table here. 
While this is a legitimate way of representing a one-to-one relationship
it is generally only used in a legacy system   

2. if you dont know what composition is look here (See [here](https://stackoverflow.com/questions/11881552/implementation-difference-between-aggregation-and-composition-in-java))

<hr />
## Resources
- [Some Resource](http://docs.spring.io/spring/docs/current/spring-framework-reference/html/expressions.html)

