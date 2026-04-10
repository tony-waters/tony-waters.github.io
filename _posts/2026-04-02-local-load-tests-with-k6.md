---
title: Spring REST 2 - Local Load Testing with k6
layout: post
header-img: "img/spring5.jpg"
---

Before we let our system out into the real world let's give it a little experience. It would be comforting to know that it can work well under load. Now let's be clear. I'm not talking about full-on load testing. It would just be nice to feel confident that the system in general, and the domain in particular, is up to the job.

Imagine you had a DDOS attack?!

"It is actually the default behavior with k6! Failed thresholds cause k6 to exit with a non-zero code, which aborts the build on most CI environments." (https://stackoverflow.com/questions/63831729/k6-load-testing-can-the-result-be-output-into-the-continuous-integration-pipel)

Pertinently, the results from this process highlighted issues with the underlying Domain layer in the demo application (now fixed). This is exactly why these types of tests are useful.


## K6 tests in the Demo App


## Running smoke tests with no seeded data


## Running smoke tests with seeded data


## Honing in on particular thresholds and increasing load


## Adding K6 smoke test to build pipeline (GitHub Action)

- most important metric in this use case is `checks_succeeded` is 100%

## Lets break it! making a system work under pressure


## what happens when we throw 1 million users? it breaks! dealing with inevitable breakage

whats great about K6 is we can throw 1 million accesses to it. this is a great place to be. how does my application react to 1 million requests? Your welcome!

## what you have just discovered!

how the system will deal with overload! The most important thing is:

> overload does not impact database consistency

Because this is how DDOS tries to get ya.


















