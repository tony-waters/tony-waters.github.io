---
title: Using custom annotations to simplify Spring method security
layout: post
header-img: "img/spring5.jpg"
---

A common requirement is that the owner of something can change it. For example, for most sites I subscribe to I would expect to be able to change my email address or marketing options, while I would not expect to be able to change these details for another user.

This can easily be done using `@PreAuthorise`, some `SpEL`, and some boilerplate.

Rather than proliferating this common requirement in its base `@PreAuthorise` form, lets male it easily reusable and updatable using DRY principles and Custom Annotations.






