---
title: Six Ways to Map One-to-One Relationships in Spring Boot JPA
layout: post
header-img: "img/spring5.jpg"
---

For a seemingly straightforward JPA annotation, `@OneToOne` relationships can be mapped in a surprising number of ways. I want to explore some<sup>[[1]](#notes)</sup> variants of these mappings using a simple Customer–Profile relationship existing in a simple Parent-Child setup.

## Tech stack

- Java 21
- Spring Boot 4.x
- Spring Data JPA
- Hibernate 7
- H2 (test database)
- AssertJ

## Source

These variants come from a [working repository](https://github.com/tony-waters/spring-jpa-one-to-one) with tests verifying entity behaviour, database schema, and lazy loading observations.

## Design space

The `@OneToOne` annotation hides three structural decisions:

- Where the foreign key lives (parent vs child)
- Whether navigation is bidirectional
- Whether identity is shared (`@MapsId`)

I have combined these into 6 distinct (clickable) variants:

<table class="table table-bordered text-center align-middle one-to-one-table">
  <thead class="table-light">
    <tr>
      <th></th>
      <th>Bidirectional</th>
      <th>Unidirectional</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th class="text-start">FK in Parent</th>
      <td>
        <a href="https://github.com/tony-waters/spring-jpa-one-to-one/tree/main/src/main/java/uk/bit1/spring_jpa/variantA"
           target="_blank" rel="noopener">
          Variant A
        </a>
      </td>
      <td>
        <a href="https://github.com/tony-waters/spring-jpa-one-to-one/tree/main/src/main/java/uk/bit1/spring_jpa/variantD"
           target="_blank" rel="noopener">
          Variant D
        </a>
      </td>
    </tr>
    <tr>
      <th class="text-start">FK in Child</th>
      <td>
        <a href="https://github.com/tony-waters/spring-jpa-one-to-one/tree/main/src/main/java/uk/bit1/spring_jpa/variantB"
           target="_blank" rel="noopener" class="fw-bold">
          Variant B
        </a>
      </td>
      <td>
        <a href="https://github.com/tony-waters/spring-jpa-one-to-one/tree/main/src/main/java/uk/bit1/spring_jpa/variantE"
           target="_blank" rel="noopener">
          <i>Variant E</i>
        </a>
      </td>
    </tr>
    <tr>
      <th class="text-start">Shared PK</th>
      <td>
        <a href="https://github.com/tony-waters/spring-jpa-one-to-one/tree/main/src/main/java/uk/bit1/spring_jpa/variantC"
           target="_blank" rel="noopener">
          Variant C
        </a>
      </td>
      <td>
        <a href="https://github.com/tony-waters/spring-jpa-one-to-one/tree/main/src/main/java/uk/bit1/spring_jpa/variantF"
           target="_blank" rel="noopener" class="fw-bold">
          <i>Variant F</i>
        </a>
      </td>
    </tr>
  </tbody>
</table>


Note that for most of the variants the Parent (`Customer`) controls the lifecycle. From an Object composition<sup>[[2]](#notes)</sup> perspective this usually makes sense in a Parent/Child scenario. This is dealing with ORM at the entity level, and Variants A to D all do this. 

Variants E and F are unidirectional from the Child side. This precludes lifecycle control from `Customer` to `Profile` and pushes lifecycle management up a level. To the Caller. In the case of many applications this is a Service layer.

Let's look at the first Variant in detail, then summarise the other Variants.

## Variant A — Bidirectional with Foreign Key in Parent

In [this variant](https://github.com/tony-waters/spring-jpa-one-to-one/tree/main/src/main/java/uk/bit1/spring_jpa/variantA) the Parent looks like this:

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
the Child entity is fetched eagerly regardless of the `FetchType.LAZY` annotation. But since this is the 'owning side' and not the 'inverse side' we would expect it to work here as planned (which the tests demonstrate). You can contrast this with Variants B/C where lazy loading fails despite being marked `FetchType.LAZY`.

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

Placing the foreign key in the Parent table can sometimes feel slightly unnatural from a Relational Database perspective if the Child is conceptually dependent on the parent. One advantage of Variant A is that making the Parent the 'owning side' means Lazy Loading of `Profile` works out of the box in this setup.

## All the Variants

Here are all the (clickable) Variants with links to the GitHub repo folder where they are located:

| Variant                                                                                                               | Direction       | FK Location | Shared PK | Owning Side | Navigation       | Typical Lifecycle |
|-----------------------------------------------------------------------------------------------------------------------|----------------|-------------|-----------|-------------|------------------|-------------------|
| [Variant A](https://github.com/tony-waters/spring-jpa-one-to-one/tree/main/src/main/java/uk/bit1/spring_jpa/variantA) | Bidirectional  | Parent      | No        | Parent      | Both directions  | Parent-managed    |
| [Variant B](https://github.com/tony-waters/spring-jpa-one-to-one/tree/main/src/main/java/uk/bit1/spring_jpa/variantB) | Bidirectional  | Child       | No        | Child       | Both directions  | Parent-managed    |
| [Variant C](https://github.com/tony-waters/spring-jpa-one-to-one/tree/main/src/main/java/uk/bit1/spring_jpa/variantC) | Bidirectional  | Shared PK   | Yes       | Child       | Both directions  | Parent-managed    |
| [Variant D](https://github.com/tony-waters/spring-jpa-one-to-one/tree/main/src/main/java/uk/bit1/spring_jpa/variantD) | Unidirectional | Parent      | No        | Parent      | Parent only      | Parent-managed    |
| [Variant E](https://github.com/tony-waters/spring-jpa-one-to-one/tree/main/src/main/java/uk/bit1/spring_jpa/variantE) | Unidirectional | Child       | No        | Child       | Child only       | Caller-managed    |
| [Variant F](https://github.com/tony-waters/spring-jpa-one-to-one/tree/main/src/main/java/uk/bit1/spring_jpa/variantF) | Unidirectional | Shared PK   | Yes       | Child       | Child only       | Caller-managed    |

## Summary of Variants B–F

Rather than repeating the full walkthrough, the remaining variants can be understood as variations on the same core ideas demonstrated in Variant A. They are better understood through reference to the actual repositories. Below is a summary of each Variant with links to its classes and tests.

---

### Variant B — FK in Child

- Foreign key moves to the child (`profile.customer_id`)
- Child becomes the owning side
- Parent becomes inverse (`mappedBy`)

Most natural relational model. The parent *feels* like it owns the relationship, but the child controls persistence. One drawback in this setup is Lazy Loading of the `Profile` does not work 'out of the box' (see LazyLoading Tests).

---

### Variant C — Shared Primary Key (`@MapsId`)

- `Profile.id == Customer.id`
- No separate foreign key column

Models true composition at the database level since Child cannot exist independently and cannot be reassigned. Also feel a little simpler to understand at the Object level, and one less field to worry about. One drawback in this setup is Lazy Loading of the `Profile` does not work 'out of the box' (see LazyLoading Tests).

---

### Variant D — Unidirectional, FK in Parent

- Same schema as Variant A
- No back-reference from Profile → Customer

Simplifies the object model by removing bidirectional complexity. As with Variant A, placing the foreign key in `Customer` feels less conceptually common from a Relational Database perspective.

---

### Variant E — Unidirectional, FK in Child (Explicit Lifecycle)

- Same schema as Variant B
- No cascade or helper methods

Not a lot of Object modelling here in terms of the strong composition we want for our `Customer`-`Profile` domain. Could work for a different concept. Lifecycle is controlled entirely in the service layer. We will have to deal with our actual domain requirements there instead.

---

### Variant F — Shared PK + Explicit Lifecycle

- Combines `@MapsId` with unidirectional design
- No cascade, no bidirectional links

Similar Object mode to last Variant (E) so same summary applies.

---

## Which variant should I use?

I wish I had a simple answer to this. Primarily I think we have to keep the domain model in mind. But the whole point of ORM is to reconcile the Domain and Relational models. So what I really want is Variant B where Lazy Loading works as-is.

For our strong composition of `Customer` and `Profile` there are some Variants we can more easily rule out. Because I want a strong domain model for `Customer`/`Profile` pushing the lifecycle to the Service layer is counterproductive. So Variants E and F are not appealing.

Another consideration is Lazy Loading. At the moment Eagerly loading `Profile` is no big deal. But as `Profile` grew this could become more of a problem. Without changing the current setup this situation makes Variants B and C less attractive because the Parent is on the 'inverse side'. Notably, there are other options here. We could add selectors to the Customer Repository for example. Also, we could use Bytecode Enhancement.

This leaves Variants A and D. Both of which make less conceptual sense from a Relational perspective. If I take this as the choice, then the only question is whether I want a bidirectional or unidirectional relationship.

The important point here is that there is no one Variant for any scenario. Understanding the tradeoffs should provide some direction.

---

For full implementations, tests, and edge cases, see the repository:
👉 https://github.com/tony-waters/spring-jpa-one-to-one

## Tests

The included tests have evolved as I added to and refactored the [source repo](). Each Variant includes persistence behaviour and schema state tests:

- [VariantA_BidirectionalFkInParentTest](https://github.com/tony-waters/spring-jpa-one-to-one/blob/main/src/test/java/uk/bit1/spring_jpa/variantA/VariantA_BidirectionalFkInParentTest.java)
- [VariantB_BidirectionalFkInChildTest](https://github.com/tony-waters/spring-jpa-one-to-one/blob/main/src/test/java/uk/bit1/spring_jpa/variantB/VariantB_BidirectionalFkInChildTest.java)
- [VariantC_BidirectionalSharedPkMapsIdTest](https://github.com/tony-waters/spring-jpa-one-to-one/blob/main/src/test/java/uk/bit1/spring_jpa/variantC/VariantC_BidirectionalSharedPkMapsIdTest.java)
- [VariantD_UnidirectionalFkInParentTest](https://github.com/tony-waters/spring-jpa-one-to-one/blob/main/src/test/java/uk/bit1/spring_jpa/variantD/VariantD_UnidirectionalFkInParentTest.java)
- [VariantE_UnidirectionalFkInChildExplicitLifecycleTest](https://github.com/tony-waters/spring-jpa-one-to-one/blob/main/src/test/java/uk/bit1/spring_jpa/variantE/VariantE_UnidirectionalFkInChildExplicitLifecycleTest.java)
- [VariantF_UnidirectionalSharedPkExplicitLifecycleTest](https://github.com/tony-waters/spring-jpa-one-to-one/blob/main/src/test/java/uk/bit1/spring_jpa/variantF/VariantF_UnidirectionalSharedPkExplicitLifecycleTest.java)

... and entity contract tests where appropriate:

- [VariantA_EntityContractTest](https://github.com/tony-waters/spring-jpa-one-to-one/blob/main/src/test/java/uk/bit1/spring_jpa/variantA/VariantA_EntityContractTest.java)
- [VariantB_EntityContractTest](https://github.com/tony-waters/spring-jpa-one-to-one/blob/main/src/test/java/uk/bit1/spring_jpa/variantB/VariantB_EntityContractTest.java)
- [VariantC_EntityContractTest](https://github.com/tony-waters/spring-jpa-one-to-one/blob/main/src/test/java/uk/bit1/spring_jpa/variantC/VariantC_EntityContractTest.java)
- [VariantD_EntityContractTest](https://github.com/tony-waters/spring-jpa-one-to-one/blob/main/src/test/java/uk/bit1/spring_jpa/variantD/VariantD_EntityContractTest.java)

I also wanted to record some of the observed Hibernate behaviour in this setup (I found some of it surprising):

- [VariantA_ProfileLazyLoadingObservationTest](https://github.com/tony-waters/spring-jpa-one-to-one/blob/main/src/test/java/uk/bit1/spring_jpa/hibernate/VariantA_ProfileLazyLoadingObservationTest.java)
- [VariantB_ProfileLazyLoadingObservationTest](https://github.com/tony-waters/spring-jpa-one-to-one/blob/main/src/test/java/uk/bit1/spring_jpa/hibernate/VariantB_ProfileLazyLoadingObservationTest.java)
- [VariantC_ProfileLazyLoadingObservationTest](https://github.com/tony-waters/spring-jpa-one-to-one/blob/main/src/test/java/uk/bit1/spring_jpa/hibernate/VariantC_ProfileLazyLoadingObservationTest.java)
- [VariantD_ProfileLazyLoadingObservationTest](https://github.com/tony-waters/spring-jpa-one-to-one/blob/main/src/test/java/uk/bit1/spring_jpa/hibernate/VariantD_ProfileLazyLoadingObservationTest.java)
- [VariantF_SharedPkHibernateObservationTest](https://github.com/tony-waters/spring-jpa-one-to-one/blob/main/src/test/java/uk/bit1/spring_jpa/hibernate/VariantF_SharedPkHibernateObservationTest.java)

## Common Pitfalls

Just a few things I try to avoid:

- Updating only the inverse side
- Forgetting `UNIQUE`
- Assuming `FetchType.LAZY` always works
- Confusing owning side with domain ownership

## Repository
The repository contains full implementations, tests, and schema assertions for each variant:

👉 https://github.com/tony-waters/spring-jpa-one-to-one


## <a name="notes"></a>Notes
1. I purposefully do not include using a JOIN table here. While this is a legitimate way of representing a one-to-one relationship it is generally only used for legacy systems.

2. For what 'composition' means in an Object/Java context look here (See [here](https://stackoverflow.com/questions/11881552/implementation-difference-between-aggregation-and-composition-in-java)).

---

## Resources
- [Some Resource](http://docs.spring.io/spring/docs/current/spring-framework-reference/html/expressions.html)

