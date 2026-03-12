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

This produces 6 variants:

                     Direction
               ┌───────────────┬───────────────┐
               │ Bidirectional │ Unidirectional│
┌──────────────┼───────────────┼───────────────┤
│ FK in Parent │   Variant A   │   Variant D   │
│ FK in Child  │   Variant B   │   Variant E   │
│ Shared PK    │   Variant C   │   Variant F   │
└──────────────┴───────────────┴───────────────┘

This article walks through these six `@OneToOne` mapping patterns,
showing how they differ and offering suggestions on when to use each.

If you just want a practical default, and want to skip the details,
[Variant B](#variantB) is probably a good option.

All examples come from a 
[working repository](https://github.com/tony-waters/spring-jpa-one-to-one)
with tests verifying both entity behaviour and database schema.

## Variant A — Bidirectional with Foreign Key in Parent

> Variant A is a bidirectional one-to-one relationship where the foreign key 
is stored in the parent table.
The parent entity owns the relationship and controls the lifecycle of the child
using cascading and orphan removal.
This design allows navigation in both directions 
(Customer → Profile and Profile → Customer), 
but the database link is stored on the parent row.
It can work well when the parent logically "contains" the child, 
although storing the foreign key in the parent is less common in relational modelling.


In this variant:

the parent table stores the foreign key

both entities reference each other

lifecycle is controlled by the parent

Schema
customer_a
-----------
id
profile_id (FK UNIQUE)

profile_a
-----------
id
Mapping

Parent owns the relationship:

@OneToOne(
cascade = CascadeType.ALL,
orphanRemoval = true
)
@JoinColumn(name = "profile_id")
private ProfileA profile;

Child defines the inverse side:

@OneToOne(mappedBy = "profile")
private CustomerA customer;
Behaviour

Saving the parent cascades to the child:

Customer → Profile inserted

Removing the profile deletes the child row due to orphan removal.

Deleting the parent cascades the delete.

## <a name="variantB"></a>Variant B — Bidirectional with Foreign Key in Child

> Variant B is a bidirectional one-to-one relationship where the foreign key
is stored in the child table.
The child owns the relationship at the database level, 
but the parent typically manages lifecycle operations through helper methods
and cascade rules.
This structure closely mirrors typical relational design where a dependent entity
references its parent. 
Because of this, it is often the most natural and widely used 
> one-to-one mapping in real applications.

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

@OneToOne(optional = false)
@JoinColumn(
name = "customer_id",
nullable = false,
unique = true
)
private CustomerB customer;

Parent contains the inverse side:

@OneToOne(
mappedBy = "customer",
cascade = CascadeType.ALL,
orphanRemoval = true
)
private ProfileB profile;
Behaviour

Saving the parent cascades to the child.

Orphan removal deletes the profile when it is removed from the parent.

Deleting the parent cascades the delete.

Why many developers prefer this pattern

Variant B reflects the natural dependency:

profile.customer_id → customer.id

For many domains this feels like the most intuitive relational design.

## Variant C — Bidirectional Shared Primary Key (@MapsId)

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

## Variant D — Unidirectional with Foreign Key in Parent

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

Lifecycle is entirely controlled by the parent.

Saving the parent cascades the insert.

Removing the profile deletes the child row.

## Variant E — Unidirectional with Foreign Key in Child

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

## Variant F — Unidirectional Shared Primary Key

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

## Comparison of the Six Variants
Variant	Direction	FK Location	Shared PK	Owning Side	Navigation	Lifecycle
A	Bidirectional	Parent	No	Parent	Both	Parent-managed
B	Bidirectional	Child	No	Child	Both	Parent-managed
C	Bidirectional	Shared PK	Yes	Child	Both	Parent-managed
D	Unidirectional	Parent	No	Parent	Parent only	Parent-managed
E	Unidirectional	Child	No	Child	Child only	Caller-managed
F	Unidirectional	Shared PK	Yes	Child	Child only	Caller-managed

## Common Mistakes with One-to-One Relationships

### 1. Not understanding the owning side

Only the side with @JoinColumn controls the foreign key.

Changing the inverse side alone does not update the database.

### 2. Forgetting the unique constraint

A one-to-one relationship must be enforced at the database level.

Without a unique constraint, the relationship becomes one-to-many.

### Misusing shared primary keys

@MapsId tightly couples the child identity to the parent.

Use it only when the child truly depends on the parent.

### Treating entities as simple data containers

Entities should enforce domain invariants.

For example:

public Profile createProfile(boolean marketingOptIn) {
if (this.profile != null) {
throw new IllegalStateException("Customer already has a Profile");
}
this.profile = new Profile(marketingOptIn);
return profile;
}

## Repository

All six variants are implemented in the repository with working tests verifying:

- cascade behaviour
- orphan removal
- deletion semantics
- foreign key placement
- schema constraints

Repository:
https://github.com/tony-waters/spring-jpa-one-to-one

## Final Thoughts

The @OneToOne annotation hides several structural decisions.

The most important questions are:

- where the foreign key should live
- whether navigation should be bidirectional
- whether the child should share the parent’s identity

Understanding these design choices makes one-to-one relationships in JPA far more predictable.

In many applications, Variant B (bidirectional with FK in the child) provides
the most natural model.

Shared primary keys (@MapsId) are powerful but should be reserved for tightly coupled relationships.

## <a name="notes"></a>Notes
1. I purposefully do not include using a JOIN table here. 
While this is a legitimate way of representing a one-to-one relationship
it is generally only used in a legacy system   

2. This feature is not available in Spring Security 3.0 (See [here](http://forum.spring.io/forum/spring-projects/security/100708-spel-and-spring-security-3-accessing-bean-reference-in-preauthorize) for discussion and a workaround). It is available 3.1 but you must leave out the `@` symbol. It works as shown in 3.2.

<hr />
## Resources
- [Spring Expression Language Reference](http://docs.spring.io/spring/docs/current/spring-framework-reference/html/expressions.html)

