# ByWhom release-readiness checkpoint

Recorded **2026-10-08 UTC**. This is a current-state audit of the existing v0.1.1 proof of concept, written after implementation. Substantive scope and feature conversations preceded coding, but this file is **not** a contemporaneous formal pre-code plan, learner approval record, Devpost submission, or eligibility certification. Do not backdate it or treat it as completion of the local Build With AI: Basics curriculum.

## Verified product state

| Item | Evidence observed |
| --- | --- |
| Reproducible local extension | `manifest.json` defines Chrome 116+ Manifest V3 with only `activeTab`, `scripting`, and `sidePanel`; `README.md` gives unpacked-load instructions. There is no normal-profile installation or store publication. |
| Source repository | A Git `main` branch contains the extension source, tests, dated planning drafts, license, and review notes. Its publication status is tracked below. |
| Credit behavior | Explicit toolbar action reads a bounded set of page credits and metadata locally. Writer, hosting publication, and originating publication remain separate; unknown and conflicting evidence is preserved. Paste is a separate local fallback. |
| Automated checks | 15/15 credit-engine tests, 5/5 worker tests, 1/1 permission test, capture regressions for related cards, byline labels, and metadata sources, 11/11 panel smoke checks, and 6/6 extension action-path checks passed locally. The [GitHub Actions Tests run](https://github.com/agammann/bywhom/actions/runs/37742374693) for commit `79e3587` passed on Windows. Browser tests use programmatic action triggering; the separate demo video shows a real toolbar click. Chrome 116 is a manifest minimum, not an individually tested version. |
| Public-page compatibility snapshot | WUSF, KFF Health News, and University of South Carolina returned HTTP 200 and reached the extension's `ready` state in an isolated Chromium action test. The exact claims, KFF metadata disagreement, and publisher-page diagnostics are recorded in `LIVE-PAGE-COMPATIBILITY.md`. Page markup can change. |
| Privacy boundaries | No host-pattern permission, automatic clipboard read, passive content script, background article collection, account, paid API, or web-wide origin search. Only an animation preference persists in panel local storage. See `README.md` and `BUILD-NOTES.md`. |

## Open participation and release items

The earlier audit found no `devpost/` directory. On 2026-10-08, the verified pre-code conversation was recorded in `devpost/planning-history.md`, and current-date draft `scope.md`, `prd.md`, and `spec.md` were created after implementation. Those four files are now included in this repository. They document the earlier direction and the observed build; they do not retroactively complete or approve the event pack's formal stages.

| Item | State and next evidence needed |
| --- | --- |
| Event registration and terms | **Unverified.** The learner must review the current organizer terms and complete any registration or acceptance personally. This work did not accept terms or register anyone. |
| Learner profile | **Missing locally.** If the guided pack is used, `1-start` records what the learner actually shares in `devpost/learner-profile.md`; do not invent personal details or publish that file by default. |
| Scope, PRD, spec, build checklist | **Current-date drafts present; formal approval unverified.** Repository `devpost/` holds `scope.md`, `prd.md`, `spec.md`, and `planning-history.md`, all recorded 2026-10-08 after implementation. The substantive scope and feature conversation preceded coding, but no saved, approved formal files were present when implementation began. A build checklist remains missing, and no learner sign-off on the drafts is recorded. |
| Learner hands-on review and learning wrap-up | **Not recorded.** The local `5-build` skill requires the learner's own final hands-on observations, explicit readiness confirmation, and Code Tour and App Map activity. Automated tests do not substitute for these. |
| Public source repository | **Verified public.** The learner explicitly approved publication of this source and artwork. [agammann/bywhom](https://github.com/agammann/bywhom) and its [initial source commit](https://github.com/agammann/bywhom/commit/b6e2cfeb7b1e25027d4d536923ea8302e60945ad) were accessible without sign-in on 2026-10-08. The repository includes the MIT license and the four dated `devpost/` drafts. |
| License | **MIT applied.** The learner explicitly chose MIT for the prepared source and included original artwork. See `LICENSE` and `LICENSE-DECISION.md`; the image's ChatGPT/C2PA provenance remains documented. |
| Demo video | **Recorded and public.** The [1:09 ByWhom screen recording](https://youtu.be/2dNrmiwtEYA) shows the actual Chrome toolbar action and docked side panel on clearly labeled fictional local pages, including evidence, conflicting claims, and the paste fallback. YouTube Studio reported no copyright issues, and an unauthenticated watch-page request returned playable status. The video is silent; `DEMO-RUNBOOK.md` remains the earlier shot plan. |
| Devpost fields and exit survey | **Not completed or verified.** Under the local `6-ship` skill, the learner writes the project name, short description, other submission answers, and exit-survey reflections. An assistant may correct their spelling and grammar, but must not draft or rewrite those answers. |
| Final submission | **Not performed.** Check the live form, verify the public repository and video links without authentication, then submit only with the learner's explicit authorization. |

The extension is ready for a learner-run local review and demo rehearsal. It is **not yet ready to be represented as a completed Build With AI: Basics submission**. Formal checkpoint approval and the remaining participation items above are unverified or incomplete; this audit does not certify eligibility or make organizer contact a required next step.
