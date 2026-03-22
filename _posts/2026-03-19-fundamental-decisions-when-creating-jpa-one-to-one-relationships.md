---
title: Fundamental decisions when creating JPA one-to-one relationships
layout: post
tags: [JPA, @OneToOne]
header-img: "img/jekyll2.jpg"
---

In practice, mapping `@OneToOne` relationships can be considered in relation to
some fundamental decisions:

- Where the entity lifecycle is managed
- Where the foreign key lives (`Parent`<sup>[[1]](#notes)</sup> or `Child`<sup>[[1]](#notes)</sup>)
- Whether the `Child` shares the `Parent` primary key
- Whether the relationship is `Bidirectional` or `Unidirectional`

It may be helpful to understand these decisions before looking at the actual variants
considered [here]().

### Where the entity lifecycle is managed

The term Ownership is potentially confusing here.
Take this simple entity:

``` java
class Customer {
    private Address address;
}
```

From an Object perspective, this is usually a Paremnnt/Child relationship:

``` java
class Parent {
    private Child child;
}
```


From an Object perspective this is generally easier to comprehend 
when the xxx is the Parent and xxx is the Child.
managed from the Parent:

[example]

managed from the caller (typically the Service layer):

[example]

Variants xxx are examples of Parent-managed lifecyle.
Variants xxx show entities whose relationship must be managed by the caller
(typically the Service layer).

### Where the foreign key lives

There are two options here because the foreign key can live in either table - both are 
valid schemas but imply slightly different lifecycle behaviour.
Either the foreign key lives in the Parent (Customer) or in the Child (Profile).
The side the foreign key lives in is called the 'Owning side'
as it 'owns' the relationship from the Database perspective.
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

Note that from a Database perspective 
locating the foreign key in the Child is arguably a more natural fit
as the Child depends on the Parent.
Though this is by no means a requirement.
And arguably less so for a one-to-one relationship.

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
But it requires lifecycle helpers to keep both sides consistent.
This can include:
...

Bidirectional relationships allow navigation from either side,
but they require helper methods to keep both sides of the relationship synchronized.

Unidirectional mappings are simpler, but less expressive.

When to use unidirectional

Use when:

child navigation not needed

simpler domain model

avoid bidirectional synchronization


### <a name="notes"></a>Notes

1. Parent/Child refers to the Object relationship ...