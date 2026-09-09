---
title: Using custom annotations to simplify Spring method security
layout: post
header-img: "img/spring5.jpg"
---

A common requirement is that the owner of something can change it. For example, for most sites I subscribe to I would expect to be able to change my email address or marketing options. Additionally, I would not expect to be able to change these details for another user.

Using Spring Security we can create infinately complex `SpEL` expressions.

In this post I highlight a straightforward way of encapsulating `@PreAutorsie` `SpEL` expressions using Custom Annotations in Spring Security to create a `@UserOwned` annotation 

This can easily be achieved using `@PreAuthorise`, some `SpEL`, and some boilerplate:

...



## Without Custom Annotations - @PreAuthorise and SpEL

To create a 'owned by user' security gate using the build in `@PreAuthorise` annotation we would probably do something similar to this:

...

We would then simply apply this to all the methods requiring such authorisation.

While this works, the repetition breaks DRY principles. The logic is proliferated throughout the codebase, making it harder to change.

Rather than letting this common requirement run wild in its basic `@PreAuthorise` form, lets make it easily reusable and updatable using DRY principles and Custom Annotations.

## Using Custom Annotations



## Testing



## Conclusion








