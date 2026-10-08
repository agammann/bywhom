---
doc: scope
status: draft
recorded: 2026-10-08 UTC
---

# ByWhom

**Planning record:** Documented on 2026-10-08 after implementation from the verified earlier planning conversation. The direction was discussed before coding; this file was not a pre-code artifact or a recorded approval of the event pack's formal scope stage. See [planning-history.md](planning-history.md).

One line: An original animated detective in a Chrome extension helps a reader inspect who an article credits for its writing, hosting, and originating publication.

## The unique kernel

The character reveals each credit with its supporting page excerpt or metadata label, and keeps missing or conflicting claims visible. Writer, hosting publisher, and originating publication are separate questions; a matching article elsewhere does not establish origin.

## Who it's for

The discussion described someone reading an article who wants to check its credits while reading. A narrower audience or personal reason for the project was not recorded, so this is a description of the use case, not a claim about the learner's intended market.

## The core loop

While viewing an article, the reader may highlight text and invoke ByWhom. The extension reads the permitted current page on that explicit action and shows credit claims with evidence. The reader can inspect the evidence, or explicitly paste text into the character's bubble when page reading is unavailable. Pasted text alone cannot establish an unprovided source.

## Inspiration and identity

An original detective character animates in idle, investigating, and results states. Motion is optional and respects reduced-motion settings. No external visual reference or character design was specified in the verified planning exchange.

## Why this matters to the learner

The learner's personal motivation was not recorded in the verified exchange. This section remains open for the learner rather than attributing a reason to them.

## What working looks like

A short Chrome demo shows selection capture and a click on the character's toolbar action, followed by separate writer, host, and origin cards with evidence. It also shows an explicit republication credit, an unknown or conflicting credit, and a paste fallback. This describes the planned proof, not an event-pack approval or eligibility claim.

## The proof-of-concept boundary

One Chrome extension with narrow, temporary page access, local parsing of visible credits and limited page metadata, a results panel, explicit paste fallback, and optional animation. Test named, multiple, and organization authors; editors versus writers; republication; missing and conflicting credits; navigation, repeat use, and dismissal.

## Later

Broader source discovery and more publisher-specific extraction could be evaluated after this small credit-evidence loop is reliable. Neither was committed to for the initial prototype.

## Explicitly cut

- Automatic clipboard reading and passive or background browsing collection: the reader invokes each page read or paste.
- Paid APIs, user accounts, and web-wide origin search: they are unnecessary to demonstrate the local credit-evidence loop.
- Publisher-restriction bypass: the extension uses only access Chrome and the page allow.
