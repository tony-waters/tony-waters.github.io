---
layout: post
title: Alternatives to Entity-based loading of lazy relationships
tags: [JPA, @OneToOne]
header-img: "img/jekyll2.jpg"
---

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