---
layout: post
title: Common mistakes with JPA one-to-one relationships
tags: [JPA, @OneToOne]
header-img: "img/jekyll2.jpg"
---

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
