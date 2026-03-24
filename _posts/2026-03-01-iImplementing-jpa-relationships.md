---
title: Implementing JPA relationships in Spring Boot JPA
layout: post
tags: [JPA, @OneToOne, Hibernate 7, SpringBoot 4]
header-img: "img/jekyll2.jpg"
---

> The technical objective of this work is to provide an object/relational mapping facility
> for the Java application developer using a Java domain model to manage a relational database.
>
> "Jakarta Persistence". jakarta.ee. Retrieved 2021-10-05.
> https://jakarta.ee/specifications/persistence/3.0/jakarta-persistence-spec-3.0.html

# spring-jpa
Setting up Java Persistence API (JPA) using Spring Boot 4 and Hibernate.

# Overview
JPA allows us to map Java objects to a relational database, whats called Object-Relational Mapping (ORM).
Getting this right creates a solid persistence layer for Java applications backed by a relational database.
At its core it allows us to effectively represent @OneToOne, @OneToMany, and @ManyToMany relationships at the
DB level.

This repo represents the Java code to show how each of these relationships work on a practical level.

A large part of confidence in releasing something to production is to have the right tests.
So I have included a realistic set of tests.

Plan is to create the entity/repository layer here, then build other layers over it.

# The Entities
I have chosen a simple Domain model for demonstration purposes:

domain model ER diagram here.


## The BaseEntity

### Modelling @OneToMany, @ManyToMany, and @OneToOne relationships
We will be modelling three relationships in our Entities:
- Cus
  https://medium.com/@davoud.badamchi/understanding-jpa-relationships-manytomany-onetomany-and-onetoone-ab84aa1953c1
-

## The Customer entity
For demonstration purposes the Customer entity contains a small amount of mutable data - the Customers name.
Additional information about the Customer is held in the Profile entity (display name, and marketing options).
A Customer has a single Profile and a Profile belongs to one Customer.
So Customer has a @OneToOne relationship with its Profile.

Customers can have multiple Tickets and a Ticket belongs to a single Customer.
So Customer has a @OneToMany relationship with Ticket.

Let's look at the @OneToMany Customer->Ticket relationship first.
These are usually the most straightforward to understand.


### Customer @OneToMany relationship with Ticket (Bidirectional, Owning side is Ticket)
In order to maintain a @OneToMany relationship in a database table we usually want the Many side of the
relationship to have a column which holds the primary key of the One side
(called the 'foreign key' in this context).
The database table / Entity holding this foreign key is called the 'Owning' side, with the other side
called the 'Inverse' side.
This makes sense as the Ticket entity table 'knows' what Customer it has,
while the same cannot be said of the Customer table (without a SELECT).
This leans towards a database-centric view of the relationship.
It describes how a bidirectional relationship is managed in the database.

A more java-centric way of looking at @OneToMany relationships is Parent/Child.
Here the parent (Customer) is the logical owner of the relationship,
even if the foreign key resides in the child (Ticket) table.
For Parent/Child relationships the Parent would be in control of
the relationship - for example having methods for adding and removing Children.
Again this makes sense, particularly when we think of Children as a Collection within the Parent class.

So Owning Side/Inverse Side defines the management of the relationship in the database,
while Parent/Child is the relationship in terms of the Object model.
We are dealing with an Object-Relation Mapping framework here,
so it makes sense that we will be dealing with both the Database perspective (Owner/Inverse)
and the Object perspective (Parent/Child) here in our Entity classes.

Typically, a @OneToMany relationship will have the @One side as the Parent
and the @Many side as the Owner. So in Customer we have:

<pre>
    @OneToMany(
            mappedBy = "customer",
            cascade = CascadeType.ALL,
            orphanRemoval = true,
            fetch = FetchType.LAZY
    )
    private Set<Ticket> tickets = new HashSet<>();
</pre>

Let's break this down.

mappedBy = "customer" : lives on the inverse side of the relationship and makes the relationship bidirectional.
'mappedBy' points to the


'orphanRemoval = true' lives in the Parent entity.
It automatically deletes a child entity from the database when it is
removed from the Parent collection
i.e. something like parent.getChildren().remove(child).
So here we say to delete Ticket records in the database when they are removed from the
Customer.tickets collection.

'cascade = CascadeType.ALL' :

'fetch = FetchType.LAZY' :

... and in Ticket:

<pre>
    @ManyToOne(
            fetch = FetchType.LAZY, 
            optional = false
    )
    @JoinColumn(
            name = "customer_id", 
            nullable = false
    )
    private Customer customer;
</pre>

In this type of @OneToMany relationship the Parent (Customer) is the place to
put the methods that manipulate the Customer->Ticket relationship.
We provide a methods to create and remove Tickets from the current Customer:

<pre>
    public Ticket raiseTicket(String description) {
        if(description == null || description.isBlank()) throw new IllegalArgumentException("Description must not be null");
        Ticket ticket = new Ticket(description.strip());
        addTicketInternal(ticket);
        return ticket;
    }

    public void removeTicket(Ticket ticket) {
        if(ticket == null) throw new IllegalArgumentException("Ticket must not be null");
        // Object comparison like "ticket.getCustomer() != this" will not work properly
        // with inherited BaseEntity.equals()/hashcode() as 'this' may be a Hibernate proxy
        // ... need to ensure use of 'equals()' method '!this.equals(customer)'
        if (!this.equals(ticket.getCustomer())) {
            throw new IllegalArgumentException("Ticket does not belong to this Customer");
        }
        removeTicketInternal(ticket);
    }
</pre>

While in the Ticket class we prevent mutation of the relationship by making the
constructor package-private, not providing setters, and making Collection getters return
Unmodifiable Collections.

<pre>
    Set<Ticket> getTickets() {
        return Collections.unmodifiableSet(tickets);
    }
</pre>
l
This approach has been implemented in all of the entities.
There are some subtle differences though that are worth noting when it comes to @OneToOne and @ManyToMany.

### Ticket @ManyToMany relationship with Tag (Bidirectional, Owning side is Ticket)
Lets turn our attention to the Ticket->Tag @ManyToMany relationship.
Since we need to create a JOIN table here
the Owning side will be which ever side takes charge of maintaining and updating the JOIN table,
Since we will logically add or remove Tags to/from a Ticket,
it makes sense to make Ticket the Owner.

Parent/Child makes less sense in a @ManyToMany relationship since both sides must hold a Collection.

Here is what the Ticket->Tag looks like in Ticket:

<pre>
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "ticket_tag",
            joinColumns = @JoinColumn(name = "ticket_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private Set<Tag> tags = new HashSet<>();
</pre>

... and the Inverse side in Tag:

<pre>
    @ManyToMany(mappedBy = "tags")
    private Set<Ticket> tickets = new HashSet<>();
</pre>

We control the mutation of the Ticket.tags Collection through Ticket:

<pre>
    public void addTag(Tag tag) {
        requireEditable("addTag");
        if (tag == null) return; // addTag should be idempotent
        if (tags.add(tag)) {
            tag.addTicketInternal(this);
        }
    }

    public void removeTag(Tag tag) {
        requireEditable("removeTag");
        if (tag == null) return; // removeTag should be idempotent
        if (tags.remove(tag)) {
            tag.removeTicketInternal(this);
        }
    }

    public void clearTags() {
        requireEditable("clearTags");
        for (Tag tag : new HashSet<>(tags)) {
            removeTag(tag);
        }
    }
</pre>

As before, we prevent mutation of the Ticket->Tag relationship by making the Ticket
constructor package-private, not providing setters, and making Collection getters return
Unmodifiable Collections.

### Customer @OneToOne relationship with Profile (Unidirectional, Owning side is Customer)






### inheriting from a BaseEntity

## testing

Yes, test entities — but only where they contain rules

No, don’t test annotations

Yes, test services a lot

Yes, test repositories where you depend on behavior

Yes, test controllers for contracts

Keep E2E tests few and meaningful

What I’ll cover (and only what’s worth covering for entities):

Bidirectional consistency
Customer.addOrder/removeOrder/clearOrders
Order.addProduct/removeProduct/clearProducts
Customer.setContactInfo(...) with @MapsId

Orphan removal
removing orders deletes rows
removing contact info deletes row
clearing collections removes join rows where appropriate

Immutability / guard rails
unmodifiable collections can’t be mutated through getters
ID/audit fields not settable

Equals/hashCode “Set safety”
transient entities don’t collapse; persisted ones behave as expected

We will avoid CRUD.

### add / remove / clear Consistency Tests

### orphan removal Tests

### lock in equals / hashcode correctness Tests

### pressure Tests

While its not always straightforward what one should be testing where Entites are concerned,
we can begin with the tenant that we should test any code/logic we have added.
In our case this mainly consists of the add, remove, and clear methods we have included
in the @ToMany relationships to maintain the realtionship integrity at the DB level.

In a Production system you do not want to be dealing with bugs from the JPA layer.
If you are working on a already-in-production system these bugs have already implicated the client layer,
and they may be very difficult to trace.
All the while your database is potentially persisting these bugs at a data level.
So let us try and lock down the JPA Entity layer so we feel confident, and can sleep well at night.

At the same time realise that re-testing what has already been tested is a code smell.
It creates unnecessary complexity (more code to read and understand) and diverts attention from the
important bits.

With JPA Entities we are operating within a framework where a lot of testing is already taking place.
So for the sake of brevity and sanity we should try and avoid testing the framework itself too much.
At the same time we are configuring the framework with Annotations.
So one question is should we test our use of the JPA annotations is correct?
We can break this down further as the annotations refer to different facets of the ORM.


# The Repositories

## highlights

### using projections

## testing

# The Service layer
next ...
