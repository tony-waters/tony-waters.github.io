---
title: Implementing Separation Of Concerns pattern using @Annotations and Service Classes in Method-based Spring Security 
layout: post
header-img: "img/spring5.jpg"
---

# 3 ways to use @Annotations to simplify method security in Spring Boot

1. Composed Annotations: You can create reusable annotations by stacking @PreAuthorize on top of a custom annotation interface, e.g., @PreAuthorize("hasRole('ADMIN')") public @interface AdminOnly {}.
2. Custom Expressions: For dynamic checks (e.g., resource ownership), implement PermissionEvaluator and register a CustomMethodSecurityExpressionHandler to expose methods like hasOrg('ACME') in your SpEL expressions.
3. Multiple Rules: When combining multiple custom annotations on a single method, you may need a custom MethodSecurityMetadataSource to compose their rules into a single SpEL expression using OR or AND logic.

## Composed Annotations


## Custom Expressions



## Multiple Rules






I wanted to implement Spring Security in the Demo App in ...

- which layer do i put method annotations?
- how do i deal with the increasing complexity of authorisation?
- where do @Annotations and Service classes fit in?

I have based some of this off a talk by Daniel Garnier at SpringCon: https://www.youtube.com/watch?v=-x8-s3QnhMQ


# Using @Annotations

## Meta Annotations




## Resources

https://youtu.be/-x8-s3QnhMQ?si=fSVPaP1A1fhz7DoD
https://medium.com/@yasiffkhan/security-method-annotations-in-spring-security-4448f86e16bc
