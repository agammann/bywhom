---
doc: prd
status: draft
recorded: 2026-10-08 UTC
---

# ByWhom — Product Requirements

**Planning record:** Written on 2026-10-08 from the verified planning conversation that preceded coding and from the extension's observed behavior. Implementation already exists. This draft records product requirements for review; it is not a contemporaneous pre-code PRD, learner sign-off, or completion of the event pack's formal PRD stage. See [planning-history.md](planning-history.md) and [scope.md](scope.md).

ByWhom is an original animated detective in a Chrome extension that helps a reader see who an article credits for its writing, hosting, and originating publication. It presents the evidence behind each claim and preserves uncertainty. Source: `scope.md > The unique kernel` and `Who it's for`.

## The core journey

Source: `scope.md > The core loop` and `What working looks like`.

1. A reader opens an article and may highlight a passage. They explicitly invoke ByWhom while on that page. The character signals that it is investigating.
2. ByWhom reads permitted credit information from the current article and shows separate results for the credited writer, the hosting publisher, and any credited originating publication. A highlighted sentence is shown as context; it does not by itself prove who wrote it. The current page's separate attribution can support a result because the reader invoked the action on that page.
3. The reader opens a claim's evidence to inspect the captured page wording or labeled article metadata. Unknown roles remain unknown and differing claims remain visible together.
4. If the page cannot be read, the reader may explicitly paste credit text into the detective's text bubble and inspect what that text actually supports. Paste alone cannot supply an unmentioned article source or origin.
5. The reader can repeat the action on a new selection, clear the result, or leave the article. Old page results should not be presented as if they came from a newly opened page.

## Surface and look

Source: `scope.md > Inspiration and identity` and `The proof-of-concept boundary`.

The proof of concept has one Chrome extension interaction: an explicit article action and a compact results surface with the detective, a text bubble for pasted credit text, three credit results, and an evidence view. The earlier conversation chose an **original animated character** and the highlight-or-paste interaction. It did not record a color, typeface, or detailed character-art direction. The current build uses a toolbar action and side panel; those are observed implementation choices, not a claim that the learner approved a detailed layout before coding. Animation has idle, investigating, and result moments, with an off or pause option and respect for reduced-motion preference.

## Article credit results

Source: `scope.md > The unique kernel`, `The core loop`, and `What working looks like`.

- Present **credited writer**, **hosting publisher**, and **credited originating publication** as distinct roles. A person's name, an editor or illustrator credit, a site address, or the existence of a similar article elsewhere does not automatically establish a writer or origin.
- Connect each supported claim to the exact captured page excerpt or a clearly labeled metadata value. The user can reveal the evidence and its source label. An article title or URL may provide context but cannot become a credit on its own.
- Show **Unknown** when evidence is absent. When visible text and metadata or multiple credits disagree, show **Conflicting claims** with the competing evidence rather than selecting a winner. A metadata-only claim must remain labeled as metadata.
- An originating publication requires an explicit origin or republication credit in the supplied evidence. ByWhom does not claim to identify the earliest publication on the web.

**Acceptance checks:** An article with a named byline shows that writer and its evidence; multiple people or an organization are not silently reduced to one invented person; editor and illustrator labels are not reported as article writers; an explicit republication statement supports an origin; missing or conflicting roles remain visible as such. These checks develop `scope.md > The proof-of-concept boundary`.

## Selection and paste

Source: `scope.md > The core loop` and `The proof-of-concept boundary`.

- The article-reading action happens only when the reader invokes ByWhom. If text is highlighted, show the captured selection alongside the current page's separately supported attribution. Selecting words does not mean that ByWhom can identify their author from the words alone.
- The text bubble accepts a deliberate paste. Analyze its explicit credit wording locally, separately from an earlier article result. An optional pasted URL is context, not evidence; if the pasted text contains no origin credit, origin is **Unknown**.
- If Chrome or the publisher does not allow a page read, explain that it could not be read and offer paste. Do not attempt to bypass that restriction.

**Acceptance checks:** A highlighted passage survives the invoke action; a second invoke refreshes the selection; pasted text with no stated origin shows an unknown origin even if a URL is provided; a restricted page falls back to paste without claiming a page credit.

## States and boundaries

Source: `scope.md > What working looks like`, `The proof-of-concept boundary`, and `Explicitly cut`.

- **Idle:** The reader can see how to invoke the detective or use the text bubble; no article has been read automatically.
- **Investigating and result:** Motion may indicate progress or a finding, but the textual results and evidence remain usable when animation is paused or reduced motion is enabled.
- **Missing or conflicting evidence:** Preserve unknown and competing claims; do not mask uncertainty with a single confident answer.
- **Unavailable page:** Give a clear read failure and a paste route. Respect browser and publisher restrictions.
- **Repeat, navigation, dismissal:** Repeated action replaces the previous active result; navigation or changing the active tab invalidates stale article findings; clearing or dismissing the view does not trigger another page read.
- **Privacy:** No automatic clipboard access, passive browsing collection, account, paid API, or web-wide source search. Page processing is local and initiated by the reader.

## Product decisions and provenance

The verified pre-code discussion chose Chrome, an original animated detective, article highlight followed by an explicit invoke, an explicit paste bubble, writer/publisher/evidence output, and a small proof of concept without paid APIs, accounts, or web-wide origin search. The documented build order prioritized capture and reliable evidence, then results and paste, then simple animation. The current extension adds concrete interface details such as three result cards, an evidence dialog, and a pause control; this draft records them as observed behavior and reviewable acceptance checks, not as independently verified pre-code learner approvals. Source: [planning-history.md](planning-history.md) and `scope.md > The core loop`.

## Deferred and non-goals

Source: `scope.md > Later` and `Explicitly cut`.

- Broader original-source discovery and publisher-specific coverage are later investigations, not requirements for this prototype.
- No automatic clipboard reading, background article collection, accounts, paid APIs, or web-wide origin search.
- No bypass of publisher access controls and no claim that a page's byline or metadata independently verifies identity or first publication.

## Open review item

The learner has not reviewed or approved this saved PRD under the formal event-pack workflow. Detailed visual styling and any later source-discovery feature remain unspecified; neither is required to assess the current proof of concept. This draft should be checked against the learner's intent before its status changes.
