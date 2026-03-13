---
layout: post
title: Six Ways to Map One-to-One Relationships in Spring Boot JPA
tags: [JPA, @OneToOne]
header-img: "img/jekyll2.jpg"
---

For a seemingly straightforward JPA annotation,
`@OneToOne` relationships can be mapped in a surprising number of ways.
I want to explore some<sup>[[1]](#notes)</sup> variants of these mappings 
using a simple Customer–Profile relationship:

[Customer ──1:1── Profile diagram]

In practice, mapping `@OneToOne` relationships can be considered in relation to
three decisions:

- Where the foreign key lives (`Parent` or `Child`)
- Whether the `Child` shares the `Parent` primary key
- Whether the relationship is `Bidirectional` or `Unidirectional`
- Where the entity lifecycle is managed

It is helpful to understand these decisions before looking at the actual variants
considered here.

### Where the foreign key lives

There are two options here because the foreign key can live in either table
- both are valid schemas but imply slightly different lifecycle behaviour.
Either the foreign key lives in the Parent (Customer) or in the Child (Profile).
The side the foreign key lives in is called the 'Owning side'
as it 'owns' the relationship from the database perspective.
While the other side of the relationship is called the 'Inverse side'
and (in a Bidirectional relationship) uses 'mappedBy' to point to the Owning side.

Here is an example of the Parent (Customer) being the Owning side (holding the foreign key):

[example]

This makes the Child (Profile) the Inverse side:

[example]

Similarly, if the Child (Profile) is the Owning side it contains 
the foreign key / join column:

[example]

Making the Parent (Customer) the Inverse side:

[example]

Variants xxx are examples of the foreign key living in the Parent.
Variants xxx show the foreign key living in the Child.

Note that locating the foreign key in the Child is arguably a more natural fit
as the Child depends on the Parent.
Though this is by no means a requirement.

### Whether the `Child` shares the `Parent` primary key

Instead of a separate foreign key column it is possible to have the Child entity
share the primary key of its Parent.
This creates a strong coupling between the Child and Parent
as the Child cannot exist independently of its Parent,
and the Parent must exist before creating the Child.

In JPA we use the `@MapsId` annotation to express this type of relationship.
This annotation only really makes sense in the Child side of a relationship:

[example]

There is obviously no need for an Id generation strategy in the Child in this scenario.

Since a shared primary key relationship tightly couples the child to the parent 
is common for dependent entities such as:

- User → UserSettings
- Order → OrderAudit
- Account → AccountProfile

Variants xxx are examples of using a shared primary key.

### Whether the relationship is `Bidirectional` or `Unidirectional`

Bidirectional is convenient for navigation
But it requires lifecycle helpers to keep both sides consistent

Bidirectional relationships allow navigation from either side, 
but they require helper methods to keep both sides of the relationship synchronized.

Unidirectional mappings are simpler, but less expressive.

When to use unidirectional

Use when:

child navigation not needed

simpler domain model

avoid bidirectional synchronization

### Where the lifecycle is managed

DDD
managed from the Parent:

[example]

managed from the caller (typically the Service layer):

[example]

Variants xxx are examples of Parent-managed lifecyle.
Variants xxx show entities whose relationship must be managed by the caller
(typically the Service layer).

## The 6 variants

This produces 6 variants:

                     Direction
               ┌───────────────┬───────────────┐
               │ Bidirectional │ Unidirectional│
┌──────────────┼───────────────┼───────────────┤
│ FK in Parent │   Variant A   │   Variant D   │
│ FK in Child  │   Variant B   │   Variant E   │
│ Shared PK    │   Variant C   │   Variant F   │
└──────────────┴───────────────┴───────────────┘

Variant	Direction	FK Location	Shared PK	Owning Side	Navigation	Lifecycle
A	Bidirectional	Parent	No	Parent	Both	Parent-managed
B	Bidirectional	Child	No	Child	Both	Parent-managed
C	Bidirectional	Shared PK	Yes	Child	Both	Parent-managed
D	Unidirectional	Parent	No	Parent	Parent only	Parent-managed
E	Unidirectional	Child	No	Child	Child only	Caller-managed
F	Unidirectional	Shared PK	Yes	Child	Child only	Caller-managed

Let's walk through these six `@OneToOne` mapping patterns,
showing how they differ and offering suggestions on when to use each.

(If you just want a practical default, and want to skip the bigger picture,
[Variant B](#variantB) is often a good default option.)

All examples come from a 
[working repository](https://github.com/tony-waters/spring-jpa-one-to-one)
with tests verifying both entity behaviour and database schema.

## Variant A — Bidirectional with Foreign Key in Parent

sections:
    Entity mapping
    Database schema
    Behaviour

Variant A is a bidirectional one-to-one relationship where the foreign key 
is stored in the parent table.
The parent entity owns the relationship and controls the lifecycle of the child
using cascading and orphan removal.
This design allows navigation in both directions 
(Customer → Profile and Profile → Customer), 
but the database link is stored on the parent row.

In this variant:

- the parent table stores the foreign key
- both entities reference each other
- lifecycle is controlled by the parent

So the Parent looks like this:

[example]

And the Child:

[example]

This produces the following DDL:

[example]

Because the relationship is bidirectional, 
the parent provides helper methods to keep both sides consistent.

[example]

These helpers ensure that the object graph and the database state remain aligned.

#### Behaviour

The repository tests demonstrate several important behaviours.

##### Cascade persist

Saving the parent automatically saves the profile.

CustomerA customer = new CustomerA("Alice");
customer.createProfile(true);

customerRepository.save(customer);

Both rows are inserted.

##### Orphan removal

Removing the profile from the parent deletes the child row.

customer.removeProfile();
customerRepository.save(customer);

The profile row disappears from the database.

##### Cascade delete

Deleting the customer deletes the profile.

DELETE customer
→ profile automatically removed

This makes Variant A suitable when the profile lifecycle is completely controlled by the customer.

#### When would you use this pattern?

Variant A works well when:

- the parent clearly owns the child
- the relationship is always managed through the parent
- bidirectional navigation is useful

However, placing the foreign key in the parent table can sometimes feel 
slightly unnatural if the child is conceptually dependent on the parent.

For that reason, many developers prefer the next variant.

## <a name="variantB"></a>Variant B — Bidirectional with Foreign Key in Child

Variant B keeps the same bidirectional navigation but moves the foreign key 
into the child table.

This often produces a schema that more closely reflects 
the real dependency between the entities.

This is often the most natural relational design, 
because the dependent entity references its parent.

Variant B is a bidirectional one-to-one relationship where the foreign key
is stored in the child table.
The child owns the relationship at the database level, 
but the parent typically manages lifecycle operations through helper methods
and cascade rules.
This structure closely mirrors typical relational design where a dependent entity
references its parent. 
Because of this, it is often the most natural and widely used 
one-to-one mapping in real applications.

Schema
customer_b
-----------
id

profile_b
-----------
id
customer_id (FK UNIQUE)
Mapping

Child owns the relationship:

``` java
@OneToOne(optional = false)
@JoinColumn(
name = "customer_id",
nullable = false,
unique = true
)
private CustomerB customer;
```

Parent contains the inverse side:

``` java
@OneToOne(
mappedBy = "customer",
cascade = CascadeType.ALL,
orphanRemoval = true
)
private ProfileB profile;
```

### Behaviour

Saving the parent cascades to the child.
No ... saving the Child cascades to the Parent.
(this is one of the Gotcha's discussed later/ just saving the Parent does not necessarily
guarantee that the Child will be saved)

Orphan removal deletes the profile when it is removed from the parent.

Deleting the parent cascades the delete.

Why many developers prefer this pattern

Variant B reflects the natural dependency:

profile.customer_id → customer.id

For many domains this feels like the most intuitive relational design.

Why many developers prefer this variant

Variant B has a small but important advantage:
the database schema reflects the dependency direction.

The child table stores the foreign key pointing to the parent:

profile_b.customer_id → customer_b.id

This is the structure most relational designers expect.

For that reason, Variant B is often the default choice when a 
bidirectional relationship is needed.

## Variant C — Bidirectional Shared Primary Key (@MapsId)

Variant C introduces a more tightly coupled relationship.

Instead of using a separate foreign key column, the child shares the parent's primary key.

This is implemented using the @MapsId annotation.

Variant C uses a shared primary key relationship, 
where the child entity’s primary key is also a foreign key to the parent.
This is implemented using the `@MapsId` annotation, 
meaning the child’s identity is derived directly from the parent’s identifier.
This pattern represents strong composition: the child cannot exist
independently and always shares the same identifier as the parent.
It is commonly used for tightly coupled domain objects such as configuration 
or detail records.

Variant C introduces shared identity.

The child uses the parent’s primary key.

Schema
customer_c
-----------
id

profile_c
-----------
customer_id (PK + FK)
Mapping

Parent:

@OneToOne(
mappedBy = "customer",
cascade = CascadeType.ALL,
orphanRemoval = true
)
private ProfileC profile;

Child:

@Id
private Long id;

@OneToOne(optional = false)
@MapsId
@JoinColumn(name = "customer_id")
private CustomerC customer;
Behaviour

Saving the parent and child results in the same identifier:

customer_c.id = 1
profile_c.customer_id = 1

The child cannot exist independently.

When to use shared primary keys

Shared PK mappings are useful when the child is conceptually part of the parent.

Examples:

User → UserSettings

Account → AccountProfile

Order → OrderAudit

#### Next Variants

The remaining variants simplify the model by removing the bidirectional navigation:

Variant D — Unidirectional FK in parent

Variant E — Unidirectional FK in child

Variant F — Unidirectional shared primary key

These patterns reduce the complexity of bidirectional synchronization 
and are often useful when navigation is only needed in one direction.

## Variant D — Unidirectional with Foreign Key in Parent

Variant D removes the back-reference from the child entity.

Only the parent entity navigates to the profile.

Variant D introduces unidirectional relationships.
The parent stores the foreign key 
and the child has no back-reference.
Only the parent entity can navigate to the child. 
The child does not know which parent references it.
This produces a simpler object model because there is no bidirectional relationship 
to keep synchronized. 
Lifecycle operations are controlled entirely by the parent 
through cascade and orphan removal.

Variant D removes the back-reference.

Only the parent navigates to the child.

Schema
customer_d
-----------
id
profile_id (FK UNIQUE)

profile_d
-----------
id
Mapping
@OneToOne(
cascade = CascadeType.ALL,
orphanRemoval = true
)
@JoinColumn(
name = "profile_id",
unique = true
)
private ProfileD profile;

The child entity does not reference the parent.

### Behaviour

Lifecycle management is controlled entirely by the parent.

Saving the parent persists the profile:

CustomerD customer = new CustomerD("Dan");
customer.createProfile(true);

customerRepository.save(customer);

Removing the profile deletes the row due to orphan removal.

Deleting the parent cascades the delete to the profile.

##### When this pattern works well

Variant D is useful when:

navigation is only needed from parent to child

the child does not need to know about the parent

the domain model should stay simple

Removing the back-reference eliminates the need to synchronize both sides 
of the relationship.

## Variant E — Unidirectional with Foreign Key in Child

Variant E moves the foreign key into the child table 
but keeps the relationship unidirectional.

Variant E is a unidirectional relationship where the child stores 
the foreign key and references the parent, but the parent does not reference the child.
This means navigation only exists from the child to the parent.
Because the parent has no knowledge of the child, 
the relationship is typically managed at the service or application layer, 
which must ensure that entities are persisted and deleted in the correct order.

Variant E keeps the foreign key in the child table but removes parent navigation.

Schema
customer_e
-----------
id

profile_e
-----------
id
customer_id (FK UNIQUE)
Mapping

Child:

@OneToOne(optional = false)
@JoinColumn(
name = "customer_id",
nullable = false,
unique = true
)
private CustomerE customer;

Parent has no reference to the child.

### Behaviour

The relationship is typically managed by the caller or service layer.

Customer saved
Profile created referencing customer

Lifecycle management

In this model, the relationship is typically managed outside the entities.

For example:

CustomerE customer = customerRepository.save(new CustomerE("Alice"));
ProfileE profile = new ProfileE(customer, true);

profileRepository.save(profile);

The service layer coordinates the two saves.

Why use this approach?

Variant E is common when:

entities should remain simple

lifecycle is handled in the service layer

navigation from parent to child is unnecessary

This approach avoids bidirectional synchronization entirely.

## Variant F — Unidirectional Shared Primary Key

Variant F combines the shared primary key pattern with a unidirectional relationship.

Variant F combines a shared primary key relationship with a unidirectional association.
The child entity uses the parent’s identifier as its primary key 
through `@MapsId`, but the parent does not hold a reference to the child.
This produces a very strict dependency: 
the child cannot exist without the parent, 
but the parent does not need to know about the child in the object model.
It is useful for modelling strongly dependent entities 
where navigation from parent to child is unnecessary.

Variant F combines shared identity with a unidirectional relationship.

Schema
customer_f
-----------
id

profile_f
-----------
customer_id (PK + FK)
Mapping
@Id
private Long id;

@OneToOne(optional = false)
@MapsId
@JoinColumn(name = "customer_id")
private CustomerF customer;

Parent does not reference the child.

### Behaviour

Saving both entities results in shared identity:

customer_f.id = 1
profile_f.customer_id = 1

### Which Variant Should You Use?

After exploring all six variants, the obvious question is:

Which one should you actually use in real applications?

There is no single correct answer, but some patterns are more common than others.

A good default: Variant B

In many applications, the most natural choice is:

Bidirectional relationship
Foreign key in child

This corresponds to Variant B.

Why?

the child naturally references the parent

navigation works in both directions

lifecycle is easy to manage with helper methods

the database schema reflects the dependency

For many domains, this is the most intuitive design.

### When shared primary keys make sense

Variants C and F use the shared primary key pattern.

These work best when the child is tightly coupled to the parent.

Typical examples include:

User → UserSettings
Account → AccountProfile
Order → OrderAudit

In these cases the child should never exist without the parent.

### When unidirectional relationships are better

Bidirectional relationships introduce complexity.

Both sides of the relationship must be kept consistent, which usually requires helper methods.

If navigation from the child is not needed, a unidirectional mapping (Variants D, E, or F) is often simpler.

## Common Mistakes with One-to-One Relationships

1. Not Understanding Which Side Owns the Relationship

In JPA, only one side of a relationship owns the foreign key.

The owning side is the one with @JoinColumn.

For example:

@OneToOne
@JoinColumn(name = "customer_id")
private Customer customer;

This entity owns the relationship.

If the relationship is bidirectional, the other side must use mappedBy.

@OneToOne(mappedBy = "customer")
private Profile profile;

Changing the inverse side alone does not update the foreign key in the database.

Only the owning side controls the relationship.

2. Forgetting to Synchronize Both Sides of a Bidirectional Relationship

When using bidirectional mappings, both sides of the relationship must remain consistent.

This is why helper methods are commonly used.

Example:

public Profile createProfile(boolean marketingOptIn) {
Profile profile = new Profile(marketingOptIn);
profile.setCustomerInternal(this);
this.profile = profile;
return profile;
}

Without this kind of synchronization, the in-memory object graph may not match what is written to the database.

3. Expecting FetchType.LAZY to Always Work

Many developers assume that:

@OneToOne(fetch = FetchType.LAZY)

guarantees lazy loading.

In practice, this depends on the JPA provider.

Hibernate can lazily load one-to-one relationships, but it sometimes requires bytecode enhancement or proxy support.

In some situations the relationship may still behave as eager.

This is one reason why performance testing is important when designing entity relationships.

4. Forgetting the Unique Constraint

A one-to-one relationship is usually enforced at the database level with a unique constraint.

For example:

@JoinColumn(
name = "customer_id",
unique = true
)

Without the uniqueness constraint, the relationship becomes one-to-many at the database level, even if the entity mapping suggests otherwise.

Your application might work during testing but allow invalid data later.

5. Using Shared Primary Keys When the Child Needs Its Own Identity

The @MapsId pattern is powerful but should be used carefully.

Shared primary keys tightly couple the child to the parent.

This is appropriate when:

User → UserSettings
Account → AccountProfile

But it is not suitable if:

the child might later become optional

the child might exist independently

the relationship might change in the future

Once a shared primary key schema exists, it is difficult to change.

6. Treating Entities as Simple Data Containers

One common mistake is treating JPA entities as passive data objects.

When relationships exist, entities should often enforce domain invariants.

For example:

public Profile createProfile(boolean marketingOptIn) {
if (this.profile != null) {
throw new IllegalStateException("Customer already has a Profile");
}
this.profile = new Profile(marketingOptIn);
return profile;
}

This prevents invalid states from ever reaching the database.

Allowing unrestricted setters can make relationship bugs much harder to detect.

## Which variat should you use?

Which Variant Should You Use?

If you just want a practical default:

Use Variant B (Bidirectional, FK in Child).

Customer ↔ Profile
profile.customer_id (FK UNIQUE)

It works well because:

the child naturally references the parent

the schema reflects the dependency direction

navigation works both ways

lifecycle management is straightforward

Many real-world Spring Boot applications use this structure.

Use shared primary keys (@MapsId) when

the child cannot exist without the parent

the child does not need its own identity

Examples:

User → UserSettings
Account → AccountProfile
Order → OrderAudit
Use unidirectional relationships when

navigation from the child is unnecessary

you want a simpler domain model

## Repository

All six variants are implemented in the repository with working tests verifying:

- cascade behaviour
- orphan removal
- deletion semantics
- foreign key placement
- schema constraints

Repository:
https://github.com/tony-waters/spring-jpa-one-to-one


### Comparison of the Six One-to-One Variants
Variant	Direction	FK Location	Shared PK	Owning Side	Navigation	Typical Lifecycle
A	Bidirectional	Parent	No	Parent	Both directions	Parent-managed
B	Bidirectional	Child	No	Child	Both directions	Parent-managed
C	Bidirectional	Shared PK	Yes	Child	Both directions	Parent-managed
D	Unidirectional	Parent	No	Parent	Parent only	Parent-managed
E	Unidirectional	Child	No	Child	Child only	Caller-managed
F	Unidirectional	Shared PK	Yes	Child	Child only	Caller-managed
Practical default

If you need a general-purpose one-to-one mapping, start with Variant B.
Use C or F when the child should share the parent’s identity.

## Summary

Spring Boot JPA supports several ways to implement one-to-one relationships. 
The main differences come from three structural decisions:

where the foreign key is stored

whether the relationship is bidirectional or unidirectional

whether the child shares the parent’s primary key using @MapsId

These choices produce six common patterns.

For most applications, a bidirectional relationship with the foreign key in the child (Variant B) provides the most natural design. Shared primary keys are useful when the child entity is conceptually part of the parent and should not exist independently.

Understanding these patterns helps avoid common pitfalls and makes entity relationships easier to maintain.

## Final Thoughts

The @OneToOne annotation hides several structural decisions.

The most important questions are:

- where the foreign key should live
- whether navigation should be bidirectional
- whether the child should share the parent’s identity

Understanding these design choices makes one-to-one relationships in JPA far more predictable.

In many applications, Variant B (bidirectional with FK in the child) provides
the most natural model.

Shared primary keys (@MapsId) are powerful but should be reserved for tightly 
coupled relationships.


## Performance Considerations for One-to-One Relationships

One-to-one relationships can appear simple, 
but they can introduce subtle performance issues if they are not used carefully.

In particular:

lazy loading may not behave as expected

joins may appear unexpectedly

N+1 queries can still occur

Understanding how Hibernate loads one-to-one associations helps avoid surprises.

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

4. Using DTO Projections

In many cases it is better to load exactly the data needed using DTO projections.

Example:

@Query("""
select new com.example.CustomerView(c.id, c.displayName, p.marketingOptIn)
from Customer c
left join c.profile p
""")
List<CustomerView> findCustomerViews();

This avoids unnecessary entity loading.

Practical Advice

When working with one-to-one relationships:

verify SQL queries during development

do not rely on FetchType.LAZY alone

use fetch joins when appropriate

consider DTO projections for read-heavy queries

Understanding these behaviours helps prevent performance issues as applications grow.



## <a name="notes"></a>Notes
1. I purposefully do not include using a JOIN table here. 
While this is a legitimate way of representing a one-to-one relationship
it is generally only used in a legacy system   

2. This feature is not available in Spring Security 3.0 (See [here](http://forum.spring.io/forum/spring-projects/security/100708-spel-and-spring-security-3-accessing-bean-reference-in-preauthorize) for discussion and a workaround). It is available 3.1 but you must leave out the `@` symbol. It works as shown in 3.2.

<hr />
## Resources
- [Spring Expression Language Reference](http://docs.spring.io/spring/docs/current/spring-framework-reference/html/expressions.html)

