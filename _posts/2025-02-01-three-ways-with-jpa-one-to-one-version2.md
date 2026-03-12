# Six Ways to Map One-to-One Relationships in Spring Boot JPA

One-to-one relationships in JPA look simple at first glance. 
The annotation itself is straightforward:

``` java
@OneToOne
private Profile profile;
```

But the real design decisions are not in the annotation. 
They are in the database structure and ownership model behind it.

In practice, there are several structurally different ways
to model a one-to-one relationship. Each leads to slightly different behaviour in:

- database schema
- entity lifecycle
- cascade rules
- deletion behaviour
- navigation between entities

Many tutorials show only one approach. In real systems you will encounter several.

This article walks through six common one-to-one mapping patterns in Spring Boot JPA,
showing how they differ and when to use each.

All examples come from a working repository with @DataJpaTest tests
verifying both entity behaviour and database schema.

Repository:
https://github.com/tony-waters/spring-jpa-one-to-one

## The Six Variants

Every one-to-one relationship is defined by three structural decisions:

- Where the foreign key lives
- Whether the relationship is bidirectional or unidirectional
- Whether the child shares the parent’s primary key

Combining these produces six common patterns.

                     Direction
               ┌───────────────┬───────────────┐
               │ Bidirectional │ Unidirectional│
┌──────────────┼───────────────┼───────────────┤
│ FK in Parent │   Variant A   │   Variant D   │
│ FK in Child  │   Variant B   │   Variant E   │
│ Shared PK    │   Variant C   │   Variant F   │
└──────────────┴───────────────┴───────────────┘

Each variant has slightly different behaviour and trade-offs.

## Quick Recommendation

If you just want a practical default:

Use Variant B — Bidirectional relationship with the foreign key in the child.

This pattern usually feels the most natural because:

- the child references the parent
- the schema reflects the dependency
- navigation works in both directions
- lifecycle management is straightforward

Shared primary keys (@MapsId) are useful when the child must share the parent's identity.

Unidirectional relationships are useful when navigation is only needed in one direction.

The rest of this article explains how each variant works.

## The Three Structural Decisions

Before looking at code, it helps to understand the structural choices 
that define each mapping.

### 1. Where the Foreign Key Lives

The foreign key can exist in either table.

Foreign key in the parent

customer
---------
id
profile_id (FK)

Foreign key in the child

profile
---------
id
customer_id (FK)

In relational modelling, the child table usually references the parent.

2. Unidirectional vs Bidirectional

A one-to-one relationship can be:

Unidirectional

Customer → Profile

or

Bidirectional

Customer ↔ Profile

Bidirectional relationships allow navigation from either side but require helper methods 
to keep both sides synchronized.

3. Shared Primary Key (@MapsId)

Instead of generating its own identifier, the child can reuse the parent’s identifier.

customer
---------
id

profile
---------
customer_id (PK + FK)

This creates a shared primary key relationship, implemented using @MapsId.

This pattern tightly couples the child to the parent.

## Variant A — Bidirectional with Foreign Key in Parent

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

## Variant B — Bidirectional with Foreign Key in Child

Variant B keeps bidirectional navigation but moves the foreign key to the child table.

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

