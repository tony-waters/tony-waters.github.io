---
description: "Programming and DevOps; using Ansible, Docker, Java, Spring, and AngularJS"
layout: post
---

Of all the JPA relationships  ...
JPA @OneToOne relationships can be mapped in a surprising number of ways/variants.

I have outlined 5 such variants [here - github repo].

There is no one best variant because it all depends on project requirements.
Fortunately, JPA gives us a variety of ...

At the JPA Entity level we deal with the Object to Relational mapping.
So we inevitably deal with both Relational Database-level factors,
and Java Object-level factors.

In order to map our Customer/Profile relationship, 
and understand the differences between these 5 examples,
 it can be useful to think of Customer and Profile in terms of: 

(1) the Owning side of the relationship: is Customer or Profile looking after the FK in the DB?
(2) the Parent side of the relationship: is Profile and instance variable in Customer, or vice versa?

The Parent side of the relationship is usually (but doent have to be) ...

(3) the side in control of the lifecycle.

With that in mind, lets look at variant A.

## Variant A: uses FK and unique

Customer is Owner
Customer is Parent
Customer controls lifecycle

### Customer is Owner

'Owner' is from a Database-Centric perspective. 
The Customer entity is the Owner because it controls the JOIN column in the Database@

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

[DB tables]

or ...

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

It is also worth noting that in order to enforce a one-to-one relationship
in the Database, we must also make customerA.profile_id unique in the customer_a table.
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


## Variant B: uses FK and unique

Profile is Owner
Customer is Parent
Customer controls lifecycle


### Profile is Owner

For Variant-B the Profile holds the JOIN column:

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

And again, to enforce a one-to-one relationship
in the Database, we must also make customerB.profile_id unique in the customer_b table.
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

[wxplain @MapsId]

## Variant C: uses @MapsId

Profile is Owner
Customer is the Parent
Customer controls lifecycle

### Profile is the Owner

In Variant-C the Owning side is Profile.
Also note the @MapsId annotation and that @Id has bo generator.

<pre>
    @Id
    @Getter
    private Long id; // no @GeneratedValue — comes from Customer via @MapsId

    // Owning side
    @OneToOne(optional = false) // TODO: avoid the eager fetching?
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
It is similar to Variant-A except Profile does not know about Customer.
So the Profile entity has no reference to Customer:

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