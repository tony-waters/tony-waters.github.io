---
title: Matt Pocock stole my Vibe (Coding)
layout: post
header-img: "img/spring5.jpg"
---

An open-source repository of AI-agnostic agent skills designed for real engineering workflows. Time to stop "vibe coding"?

---
I have been watching a number of [Matt Pocock](https://www.aihero.dev/) videos recently and visiting his site, and was keen to try out his process.
He basically has a collection of AI-agnostic `skills` [he provides](https://github.com/mattpocock/skills), along with a process to take an idea into production code.

One of the primary skills is `grill-me` (or the more current `grill-with-docs`), which is described as:

> Grill the user relentlessly about a plan, decision, or idea.

It asks useful questions and gives usually sensible suggestions:

``` text
Q30 - UI Action at End of First Slice: If there is no draft creation yet, what should the Support Agent workspace show after eligibility?
A. A disabled “Create refund draft” button with eligibility explanation and “Next slice” copy.
B. No draft button at all.
C. A fake successful draft state.
Recommended answer: A. It makes the intended workflow visible without pretending the side effect exists

Q33 - Architecture Documentation: Should we record an ADR for the UI and MCP being separate adapters over shared application services?
A. Yes.
B. No, just keep it in original-idea.md.
C. Wait until implementation forces the issue.
Recommended answer: A. It is an architectural boundary future code can easily violate, so it is worth recording

Q34 - First-Slice Completion Definition: What counts as “done” for the first implementation slice?
A. App runs locally with Docker Postgres, UI can search a Customer and check refund eligibility, MCP tool methods are wired, and tests pass.
B. Same as A, plus Redis and queue placeholders.
C. Same as A, plus a working external MCP client config.
Recommended answer: A. It is concrete, testable, and respects the slice boundaries we already chose
```

The goal behind the `grill-me` skill is the subsequent creation of a spec:

``` text
Q35 - Next Step After Grilling: After we finish this design pass, what should I produce next?
A. A concise implementation spec in docs/spec.md.
B. Tracer-bullet implementation tickets.
C. Start implementing the first slice directly.
Recommended answer: A. We have enough decisions now that a short spec will prevent drift before coding

Q36 - Shared Understanding: Are we done grilling this first slice and ready for me to write the spec?
A. Yes, write docs/spec.md from the decisions we settled.
B. No, continue grilling the design.
Recommended answer: A. The important boundaries are now decided: user, demo promise, safety line, UI shape, MCP transport, database, first slice, tests, and completion criteria.
```

Which can then be turned into tickets addressing vertical slices in the system. If we are happy with the spec and the tickets we go ahead and get the agent to implement it in code.

Conveniently, we can use GitHub to store the tickets, or local markdown files:

``` test
Section A - Issue Tracker
Recommended: Local markdown. This repo has no remote, and we already need tickets for the MCP prototype, so local files under .scratch/<feature>/issues/ are the most direct fit.
Options:
A. Local markdown
B. GitHub Issues
C. GitLab Issues
D. Other tracker
Which issue tracker should these skills use?
```

When used in its new 'with-docs' format it will also create a Language section in `CONTEXT.md` to include the Domain Language (or 'Ubiquitous Language'<sup>[[1]](#notes)</sup>) it has derived from the grilling:

``` text
## Language

**Customer**:
A person who bought from the business and may contact support about orders, tickets, or refunds.
_Avoid_: customer account, user account, client, buyer

**Customer Risk Level**:
A support signal on a Customer. `normal` has no warning, `watch` warns the Support Agent without blocking eligibility, and `blocked` prevents Refund Draft creation.
_Avoid_: fraud status, account status
```

This is extremely useful! The terminology here will be used for class and method names in the resulting code.

At the time of writing I have tried the `grill-with-docs` skill on two (admittedly different sized) projects. For the first project I got asked 111 questions, for the second a little under 40. I am excited about trying this process again.

## <a name="notes"></a>Notes
1. Eric Evans, Domain Driven Design (2003)

