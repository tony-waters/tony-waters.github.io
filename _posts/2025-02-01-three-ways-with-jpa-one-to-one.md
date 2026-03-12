---
description: "5 variants on a JPA @OneToOne relationship"
layout: post
---

JPA @OneToOne relationships can be mapped in a surprising number of ways. 
I want to explore 6 variants using a simple Customer–Profile
relationship as an example.

[Customer ──1:1── Profile diagram]

<sup>[[1]](#notes)</sup>

You can find the variants [here].

At the object level the model is straightforward: a Customer has a Profile.
Commonly expressed like this:

<pre>
public class Customer {
    ...
    private Profile profile;
    ...
}
</pre>

When we map this model using JPA we must consider both domain/object-model concerns
and relational database concerns. 
These two perspectives do not always align perfectly, 
and the mapping choices we make often involve trade-offs between them.

From a domain/object-modelling perspective, 
we can view Customer and Profile as existing in a parent–child relationship. 
In this design the Customer acts as the parent (or aggregate root) 
and Profile is a dependent child. 
The lifecycle of Profile is tied to Customer.

In object-oriented terms it is natural for lifecycle operations to be initiated 
through the parent entity:

<pre>
public Profile createProfile();
public void removeProfile();
</pre>

This keeps domain invariants in one place 
and prevents external code from manipulating the child entity directly.

From a database perspective, the key concept is the owning side of the relationship. 
In JPA, the owning side is simply the entity that holds the foreign key column.

Importantly, the owning side does not have to correspond to the parent or child
in the domain model. 
The placement of the foreign key is usually determined by factors such as database design, 
existing schema constraints, and performance considerations.

For this reason there are several valid ways to map the same Customer–Profile relationship
in JPA, even though the domain model remains unchanged or similar. 
In the sections that follow we will examine 5 of these alternatives 
and discuss the implications of each approach.

## Variants covered in this guide:

The 3 main methods of mapping a bidirectional @OneToOne relationship are
1. using a foreign Key and Unique constraint
2. using a Shared Primary Key
3. using a JOIN table

The last option creates an additional (arguably unnecessary) table
so is likely only used if working with a legacy system.
This leaves us 4 main ways of representing a @OneToOne bidirectional relationship between
Customer and Profile.
If we include unidirectional relationships as well, that makes 6 permutations:

- Variant A - Customer is Owner | bidirectional | Foreign Key and unique constraint
- Variant B - Profile is Owner | bidirectional | Foreign Key and unique constraint
- Variant C - Customer is Owner | bidirectional | Shared Primary Key
- Variant D - Profile is Owner | bidirectional | Shared Primary Key
- Variant E - Customer is Owner | unidirectional
- Variant F - Profile is Owner | unidirectional

- Variant A — FK in Customer
- Variant B — FK in Profile
- Variant C — Shared Primary Key (`@MapsId`)
- Variant D — Unidirectional Customer → Profile
- Variant E — Unidirectional Profile → Customer

                     Direction
               ┌───────────────┬───────────────┐
               │ Bidirectional │ Unidirectional│
┌──────────────┼───────────────┼───────────────┤
│ FK in Parent │   Variant A   │   Variant D   │
│ FK in Child  │   Variant B   │   Variant E   │
│ Shared PK    │   Variant C   │   Variant F   │
└──────────────┴───────────────┴───────────────┘

Variants A-D are Parent-managed aggregate style.
Variants E and F are Service-managed.
Note that in Unidirectional variants E and F lifecycle management
is moved from the Customer entity to the Service layer.

The five variants below differ in how the database relationship is mapped.
The domain model — a Customer with a Profile — remains mostly the same.
The only exception is the last variant, E.
Here Customer does not know about Profile.

## Understanding Lazy Loading in @OneToOne relationships



## Variant A: Foreign Key in Customer

One important distinction is between the owning side of the relationship (a database concept)
and the parent entity in the domain model (a lifecycle concept).
These are often the same entity, but they do not have to be.

In Variant A, the Customer entity is the Owner 
because it controls the JOIN column in the Database:

<pre>
    @JoinColumn( // '@JoinColumn / @JoinTable' is on the Owning Side
            name = "profile_id",
            unique = true   // unique enforces true 1-1
    )
    private ProfileA profile;
</pre>

This makes Profile the 'not Owner' or 'Inverse' side of the relationship:

<pre>
    @OneToOne(
            mappedBy = "profile" // think 'customer.profile'
    )
    @Getter(AccessLevel.PROTECTED)
    private CustomerA customer;
</pre>

It produces this table structure:

<pre>
Hibernate: 
    create table customera (
        id bigint not null,
        profile_id bigint unique,
        display_name varchar(255),
        primary key (id)
    )
Hibernate: 
    create table profilea (
        marketing_opt_in boolean not null,
        id bigint not null,
        primary key (id)
    )
</pre>

We can clearly see that the Owning side is the Customer table, 
as it contains the FK for the Profile.

Because relational databases do not have a native “one-to-one” constraint, 
the foreign key column must also be unique to prevent multiple rows referencing the same parent.
This can be seen in the DDL above.
It is enforced in JPA by:

<pre>
    @JoinColumn( // '@JoinColumn / @JoinTable' is on the Owning Side
            name = "profile_id",
            **unique = true**   // unique enforces true 1-1
    )
    private ProfileA profile;
</pre>

### Customer is Parent


## Variant B: Foreign Key in Profile

For Variant-B the Profile is the Owner and holds the JOIN column:

<pre>
    @OneToOne(optional = false) // avoid the eager fetching
    @JoinColumn( // Owner side is here
            name = "customer_id",
            nullable = false,
            unique = true // enforce 1-1 relationship
    )
    @Getter(AccessLevel.PROTECTED)
    private CustomerB customer;
</pre>

... and Customer is the Inverse side:

<pre>
    @OneToOne(
            mappedBy = "customer", // think 'profile.customer'
            ...
    )
    private ProfileB profile;
</pre>

Which gives this DB structure:

<pre>
Hibernate: 
    create table customerb (
        id bigint not null,
        display_name varchar(80) not null,
        primary key (id)
    )
Hibernate: 
    create table profileb (
        marketing_opt_in boolean not null,
        customer_id bigint not null unique,
        id bigint not null,
        primary key (id)
    )
</pre>

Now the Owning side is the Profile table,
as it contains the FK for the Customer.

And again, to enforce a one-to-one relationship in the Database, 
we must also make customerB.profile_id unique in the customer_b table.
This can be seen in the DDL above.
It is enforced in JPA by:

<pre>
    @JoinColumn( // Owner side is here
            name = "customer_id",
            nullable = false,
            **unique = true** // enforce 1-1 relationship
    )
    @Getter(AccessLevel.PROTECTED)
    private CustomerB customer;
</pre>

### Customer is Parent

Although the Owning side is no longer the Customer,
it does not prevent Customer being the Parent: 

<pre>
    @OneToOne(
            ...
            cascade = CascadeType.ALL, // 'cascade' is on the Parent Side
            orphanRemoval = true // 'orphanRemoval' is on the Parent side
    )
    private ProfileB profile;
</pre>

### ... and controls lifecycle

<pre>
    public ProfileB createProfile(boolean marketingOptIn) {
        if (this.profile != null) {
            throw new IllegalStateException("Customer already has a Profile");
        }
        this.profile = new ProfileB(marketingOptIn);
        profile.setCustomerInternal(this);
        return profile;
    }
</pre>

## Using @MapsId instead of FK

### How @MapsId works

In a typical foreign-key based relationship, each table has its own primary key 
and the child table stores a foreign key to the parent.

Customer
+----+--------------+
| id | display_name |
+----+--------------+

Profile
+----+-------------+-------------------+
| id | customer_id | marketing_opt_in  |
+----+-------------+-------------------+

Here the Profile table has two columns related to the parent:

- its own primary key (id)
- a foreign key (customer_id)
- Shared primary key with @MapsId

When using @MapsId, the child entity does not generate its own identifier.
Instead, it reuses the parent's primary key.

Customer
+----+--------------+
| id | display_name |
+----+--------------+

Profile
+-------------+-------------------+
| customer_id | marketing_opt_in  |
+-------------+-------------------+
PK + FK → Customer.id

The key difference is that the child table now has one column that is both:

- the primary key
- the foreign key

This creates a very strong one-to-one relationship: a Profile cannot exist without a Customer.

### What the mapping looks like

In the child entity:

@Entity
public class Profile {

    @Id
    private Long id;

    @OneToOne
    @MapsId
    @JoinColumn(name = "customer_id")
    private Customer customer;

}

@MapsId tells JPA:

Use the identifier of customer as the identifier for this entity.

So when a Customer with id = 42 is persisted, the corresponding Profile will automatically have:

id = 42
customer_id = 42

### Why this can be useful

This mapping expresses a very strong dependency between the two entities.

It is particularly appropriate when the child entity:

cannot exist independently of the parent

always has a one-to-one relationship with the parent

should share the same identity as the parent

In other words, the child is logically part of the parent’s identity.

A quick mental model

A helpful way to think about @MapsId is:

Customer ID
│
▼
Profile ID

The child entity simply borrows the parent’s identity.

## Variant C: Shared Primary Key (@MapsId)

In Variant-C the Owning side is Profile.
Also note the @MapsId annotation and that @Id has no generator.

<pre>
    @Id
    @Getter
    private Long id; // no @GeneratedValue — comes from Customer via @MapsId

    // Owning side
    @OneToOne(optional = false)
    @MapsId
    @JoinColumn(
            name = "customer_id",
            nullable = false,
            unique = true
    )
    @Getter(AccessLevel.PROTECTED)
    private CustomerC customer;
</pre>

The Inverse Customer side is like the last example (Variant-B):

<pre>
    @OneToOne(
            mappedBy = "customer", // think 'Profile.customer'
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    private ProfileC profile;
</pre>

Here is what the DB now looks like:

<pre>
Hibernate: 
    create table customer_c (
        id bigint not null,
        display_name varchar(255),
        primary key (id)
    )
Hibernate: 
    create table profile_c (
        marketing_opt_in boolean not null,
        customer_id bigint not null,
        primary key (customer_id)
    )
</pre>

It shows the Profile table shares the Customer tables Id.

Note that the Customer is still the Parent and still controls the lifecycle.

## Variant D

All the relationships so far have been Bidirectional.

Variant-D illustrates a Unidirectional relationship from Customer to Profile.
It is similar to Variant-A except Profile does not know about, 
and has no reference to, Customer:

<pre>
@Entity
@Table(name = "profile_d")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProfileD {

    @Id
    @GeneratedValue(strategy= GenerationType.AUTO)
    @Getter
    private Long id;

    @Getter
    @Column(nullable = false)
    private boolean marketingOptIn = false;

    ProfileD(boolean marketingOptIn) {
        this.marketingOptIn = marketingOptIn;
    }
}
</pre>

All the magic happens in the Customer entity:

<pre>
    // Unidirectional - Profile does NOT know about Customer
    @OneToOne(
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @JoinColumn(
            name = "profile_id",
            unique = true
    )
    @Getter // since Profile does not reference Customer no reason to not provide a public getter
    private ProfileD profile;
</pre>

Here's the DDL:

<pre>
Hibernate: 
    create table customer_d (
        id bigint not null,
        profile_id bigint unique,
        display_name varchar(80) not null,
        primary key (id)
    )
Hibernate: 
    create table profile_d (
        marketing_opt_in boolean not null,
        id bigint not null,
        primary key (id)
    )
</pre>

## Variant E

In this variant we flip the last one around so that the Customer does not know about Profile.

So Customer only has 2 fields:

<pre>
    @Id
    @GeneratedValue(strategy=GenerationType.AUTO)
    @Getter
    private Long id;

    @Getter
    @Column(nullable = false, length = 80)
    private String displayName;
</pre>

While Profile is the Owning side and uses @MapsId to share its Parent (the Customer) Id.

<pre>
    @MapsId
    @JoinColumn(
            name = "customer_id",
            nullable = false,
            unique = true
    )
    @Getter
    private CustomerE customer;
</pre>

Here is the resulting DB structure:

<pre>
Hibernate: 
    create table customer_e (
        id bigint not null,
        display_name varchar(80) not null,
        primary key (id)
    )
Hibernate: 
    create table profile_e (
        marketing_opt_in boolean not null,
        customer_id bigint not null,
        primary key (customer_id)
    )
</pre>

## VariantF — unidirectional shared primary key (@MapsId), service-managed

Unidirectional shared-primary-key mapping, 
with lifecycle managed in the service layer rather than in the parent entity.

## Which variant should you use?

As we have seen, there are several valid ways to map a one-to-one relationship in JPA.
All five variants represent the same domain concept — a Customer with a Profile — 
but they differ in how the relationship is represented in the database and in the entity model.

The best choice depends on your domain requirements, database structure, 
and how the entities are used in your application.

### Variant A — Foreign key in Customer

This is often the simplest and most intuitive mapping.

The parent (Customer) holds the foreign key to the child (Profile), 
which aligns well with the domain model where the parent controls the lifecycle of the child.

This variant is a good default when:

- Customer is clearly the aggregate root
- Profile is optional
- you want straightforward mapping and queries

### Variant B — Foreign key in Profile

Here the foreign key moves to the child table.

This can be useful when:

- the child entity logically belongs to the parent but
- the database design prefers the FK to be stored on the child side

This pattern also appears when integrating with an existing schema 
where the relationship is already defined this way.

Importantly, even though the database owning side is Profile, 
the domain parent can still be Customer.

### Variant C — Shared primary key (@MapsId)

This variant creates a strong one-to-one dependency by sharing the same primary key 
between the two tables.

Profile cannot exist without Customer.

This approach is useful when:

- the child entity is tightly coupled to the parent
- the relationship is mandatory
- you want the database schema to enforce that dependency

It is a very clean model for dependent entities.

### Variant D — Unidirectional Customer → Profile

This variant removes the back reference from Profile to Customer.

The database structure is similar to Variant A, but the object model 
becomes simpler because only the parent knows about the relationship.

This is often desirable when:

- the child entity does not need to navigate back to the parent
- you want to keep the entity model minimal

Unidirectional mappings can also reduce accidental coupling in the domain model.

### Variant E — Unidirectional Profile → Customer with @MapsId

This is the inverse of Variant D: the child references the parent, 
but the parent does not reference the child.

This style is sometimes used when:

- the relationship is conceptually owned by the child
- the parent should not expose the relationship in its API
- the child is loaded independently

It is less common for aggregate-style models, but it can be useful in some designs.

## A practical rule of thumb

In many domain-driven designs, a Customer clearly acts as the aggregate root, 
and Profile is a dependent part of that aggregate.

For that reason, many applications naturally gravitate toward:

- Variant A (FK in the parent), or
- Variant C (@MapsId with a shared primary key)

These options align well with the idea that the parent controls the lifecycle of the child.

However, the other variants remain useful when working with existing schemas, 
different navigation requirements, or alternative modelling preferences.

Understanding the different mapping strategies makes it easier to adapt your JPA model 
to the needs of your application.

## Common pitfalls with @OneToOne in JPA

Although @OneToOne relationships appear simple, 
they can behave in unexpected ways if some important details are overlooked.

1. One-to-one is not enforced automatically in the database

In relational databases there is no native “one-to-one” constraint. 
A typical implementation is simply a foreign key, 
which by itself only guarantees a many-to-one relationship.

To enforce a true one-to-one relationship the foreign key column must also be unique.

For example:

@JoinColumn(
name = "profile_id",
unique = true
)
private Profile profile;

This results in a schema similar to:

profile_id bigint unique

Without the unique constraint the database would allow multiple rows 
to reference the same profile.

2. @OneToOne defaults to eager fetching

According to the JPA specification, @OneToOne relationships are eager by default:

@OneToOne(fetch = FetchType.EAGER)

This can lead to unexpected queries or unnecessary joins when loading entities.

Some developers prefer to explicitly specify:

@OneToOne(fetch = FetchType.LAZY)

However, lazy loading for @OneToOne is provider dependent and may require bytecode 
enhancement or additional configuration in some environments.

3. The owning side is not the same as the parent

It is easy to assume that the owning side of the relationship 
should also be the parent in the domain model, but this is not required.

The owning side is simply the entity that holds the foreign key column.

For example:

@OneToOne
@JoinColumn(name = "customer_id")
private Customer customer;

Here Profile is the owning side, but the domain model may still treat Customer
as the parent that controls the lifecycle.

Keeping this distinction clear helps avoid confusion when designing entity relationships.

4. @MapsId changes how identifiers are generated

When using @MapsId, the child entity does not generate its own identifier.

Instead, it reuses the identifier of the parent entity.

@Id
private Long id;

@OneToOne
@MapsId
@JoinColumn(name = "customer_id")
private Customer customer;

In this model the child’s primary key is also the foreign key.

This can simplify the schema and strongly enforce the dependency between 
the two entities, but it also means the child cannot be persisted independently.

5. Bidirectional relationships must be kept in sync

When a relationship is bidirectional, both sides of the association 
must be kept consistent in the entity model.

For example:

customer.setProfile(profile);
profile.setCustomer(customer);

If only one side is updated, the in-memory model may become inconsistent 
until the persistence context is flushed.

For this reason many designs provide helper methods on the parent entity 
to manage the relationship.

## Summary

JPA provides several ways to map a @OneToOne relationship, 
each with slightly different trade-offs.

Understanding how the owning side, foreign keys, lifecycle control, 
and identifier strategies interact makes it much easier to choose the right mapping 
for a given situation.

The five variants explored in this guide demonstrate how the same domain relationship 
can be expressed in multiple ways at the persistence level.

## Conclusion

As we have seen, the same domain relationship can be mapped in several different ways in JPA.
The best choice depends on factors such as database structure, lifecycle control,
and how the entities are accessed in the application.
Understanding the distinction between owning side, foreign key placement,
and domain lifecycle control makes these choices much clearer.


## An alternative: @ManyToOne with a unique constraint

Although JPA provides a dedicated @OneToOne mapping, in practice many projects 
model one-to-one relationships using @ManyToOne combined with a unique constraint.

For example:

@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(
name = "profile_id",
unique = true
)
private Profile profile;

From the database perspective this produces the same constraint:

profile_id BIGINT UNIQUE

Which still guarantees that each Profile can only be referenced by one Customer.

## Why do some developers prefer this approach?

There are several practical reasons.

1. Lazy loading behaves more predictably

The JPA specification defines @OneToOne as eager by default, 
and lazy loading may require additional configuration depending on the JPA provider.

@ManyToOne, on the other hand, supports lazy loading reliably:

@ManyToOne(fetch = FetchType.LAZY)

This often results in fewer surprises when entities are loaded.

2. Fewer proxy and initialization issues

Historically, @OneToOne relationships have been more prone to issues such as:

- unexpected eager joins
- proxy initialization problems
- additional SQL queries

Using @ManyToOne avoids many of these edge cases.

3. The database structure is identical

From the database’s perspective, a one-to-one relationship implemented 
with a foreign key plus a unique constraint is indistinguishable from a many-to-one 
with a unique constraint.

In both cases the schema looks like:

customer
+----+--------------+-----------+
| id | display_name | profile_id|
+----+--------------+-----------+
UNIQUE FK

The difference is primarily in the object model, not the database.

## When is @OneToOne still useful?

@OneToOne remains a good choice when the relationship is conceptually very tight, 
particularly when using a shared primary key with @MapsId.

For example:

@OneToOne
@MapsId
@JoinColumn(name = "customer_id")
private Customer customer;

This pattern clearly expresses that the child entity depends entirely on the parent.

## A pragmatic guideline

In practice, many teams follow a simple rule:

Use @ManyToOne + unique constraint for foreign-key based one-to-one relationships

Use @OneToOne with @MapsId for shared-primary-key relationships

This avoids some of the quirks of @OneToOne while still modelling the same database structure.

## Final thoughts

Although JPA provides a rich set of annotations for modelling relationships, 
the same domain concept can often be represented in several different ways.

Understanding how these mapping strategies translate into database structures 
and entity behaviour allows you to choose the approach that best fits your application.

## <a name="notes"></a>Notes
1. Examples of how to do this can be seen [here](http://blog.solidcraft.eu/2011/03/spring-security-by-example-securing.html), [here](http://www.disasterarea.co.uk/blog/protecting-service-methods-with-spring-security-annotations/), and [here](http://www.borislam.com/2012/08/writing-your-spring-security-expression.html).

2. This feature is not available in Spring Security 3.0 (See [here](http://forum.spring.io/forum/spring-projects/security/100708-spel-and-spring-security-3-accessing-bean-reference-in-preauthorize) for discussion and a workaround). It is available 3.1 but you must leave out the `@` symbol. It works as shown in 3.2.

<hr />
## Resources
- [Spring Expression Language Reference](http://docs.spring.io/spring/docs/current/spring-framework-reference/html/expressions.html)

