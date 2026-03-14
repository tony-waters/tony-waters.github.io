---
title: Alternatives to Entity-based loading of lazy relationships
layout: post
tags: [JPA, @OneToOne]
header-img: "img/jekyll2.jpg"
---

This is Part 2 of a series of 6 posts about JPA one-to-one relationships.

- @OneToOne(fetch = LAZY) Often Doesn't Work
- alternatives to relying on lazy loading with JPA one-to-one relationships
- fundamental-decisions-when-creating-jpa-one-to-one-relationships
- performance-considerations-for-jpa-one-to-one-relationships
- common-mistakes-with-jpa-one-to-one-relationships
- 6-ways-to-map-a-jpa-one-to-one-relationship

These examples are drawn from a single repository you can find [here]()

<hr />

### Hibernate Bytecode Enhancement

Hibernate can support true lazy loading for more one-to-one cases using bytecode enhancement.

This allows Hibernate to intercept field access and load the entity on demand.

However, this requires additional build configuration and is not enabled
by default in many projects.

For that reason, many developers treat one-to-one relationships as effectively eager
unless they are on the owning side.

## explicit queries

## DTO projections

## Entity Graphs