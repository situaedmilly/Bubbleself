# SELF / OURSELF — Architectural Review Protocol (v1)

Authorization: `AUTHORIZE_SELF_ARCHITECTURAL_REVIEW_PROTOCOL_V1`

Documentation-only artifact. This file defines a repeatable review format for future
SELF / OURSELF engineering passes. It does not itself review or re-critique the
current realm scaffold beyond the one worked example required below; the substantive
critique already exists in `realm/docs/REALM-ARCHITECTURE-DECOMPOSITION-v1.md`,
`realm/docs/PAGE-CONCEPT-REGISTRY-v1.md`, and
`realm/docs/REALM-KERNEL-MIGRATION-PLAN-v1.md`, all present at the time of writing.
No runtime code, schema, fixture, test, or HTML file was read for modification in this
pass — only for the one bounded worked example in §8.

## 0. Why this protocol exists

The first architecture critique of the realm scaffold mixed three things that must stay
separated: what the code demonstrably does, what pattern a reasonable engineer would
infer from it, and what a future, richer cosmology (event sourcing, CRDTs, identity
engines, doctrine engines) might look like. That mixing let gilded language attach
itself to ungilded fact. This protocol is the standing fix: every future review of SELF
or OURSELF architecture follows the same seven-section structure and the same
three-value evidence classification, so imagination and precision occupy different,
clearly labeled layers instead of competing for the same sentence.

```
Present Truth  ≠  Hidden Pattern  ≠  Evolution Vector  ≠  Authorized Roadmap
```

## 1. Evidence classification (apply to every material claim)

| Label | Meaning | Bar to clear |
|---|---|---|
| **PROVEN** | Directly demonstrated by code, tests, schemas, or a runtime/Git witness. | The reviewer can cite an exact file:line, a passing test name, or a command output. No citation, no PROVEN label. |
| **INFERRED** | A reasonable architectural pattern visible in the implementation, not itself directly executed or asserted by a test. | Must be traceable to specific evidence (same as PROVEN) but is an *interpretation* of that evidence, not a restatement of it. Must never be phrased as if it were already implemented behavior. |
| **PROPOSED** | A future design direction requiring authorization and implementation. | Must carry no implied timeline, no "this is already becoming true" language, and must point to a Migration Gate (§5) before any code changes. |

Every claim in Sections 1–5 of a review produced under this protocol must carry one of
these three labels, inline, next to the claim — not deferred to a summary table at the
end.

## 2. Canonical review sequence

Every future SELF/OURSELF architectural review must contain these seven sections, in
this order:

1. **Verified Architecture**
2. **Engineering Critique**
3. **Hidden Architectural Pattern**
4. **Evolution Vector**
5. **Migration Gates**
6. **Evidence Classification** (a consolidated table restating every PROVEN/INFERRED/
   PROPOSED label used above, for audit convenience — it does not replace inline
   labeling in Sections 1–4, it summarizes it)
7. **Final Present-State Verdict**

### 2.1 Verified Architecture

Answer only, with citations:

- What files exist?
- What behavior is tested (name the test, name the file)?
- What state is owned locally, and by which function/module?
- What authority remains external (who writes canonical truth, and how is that
  enforced in code, not just in intent)?
- What contracts (schemas) are enforced, and where is that enforcement invoked?
- What is explicitly not implemented?

No metaphors. No future architecture. Every sentence in this section is PROVEN or it
does not belong here.

### 2.2 Engineering Critique

Classify every material decision using exactly one of:

- **KEEP** — sound as-is, cite why.
- **REFINE** — sound in direction, needs a specific correction, cite the gap.
- **DECOMPOSE** — currently entangled with unrelated responsibilities, cite the
  entanglement.
- **REMOVE** — no longer earns its complexity, cite the replacement or the absence of
  one.
- **DEFER** — real but not urgent, cite why it can wait.

Each classification must cite exact implementation evidence (file:line, test name, or
command output) and state the present benefit, present risk, and the authorized next
action (which may be "none — filed as DEFER").

### 2.3 Hidden Architectural Pattern

This is where interpretation becomes lawful — but only here, and only labeled
INFERRED. A hidden pattern is a name for something the code already does structurally,
not a claim that a larger system exists around it.

Examples of the form (not claims about any specific codebase):

- a restricted public API surface → INFERRED capability boundary
- a closed, enum-enforced event vocabulary → INFERRED protocol discipline
- canonical writes gated behind one callback branch → INFERRED authority
  reconciliation model
- one runtime instance serving multiple page identities → INFERRED projection
  tendency (not a projection system — see §2.1 for what would be required to promote
  this to PROVEN)

No hidden pattern may be described using implemented-architecture language ("the
system does X") — it must use interpretive language ("this reads as X," "this pattern
suggests X").

### 2.4 Evolution Vector

Answer: what could naturally grow from the proven structure? Every entry is PROPOSED,
without exception, regardless of how small or how obviously "next" it seems.

Typical categories a SELF/OURSELF review may propose (illustrative, not exhaustive,
not a commitment list):

- Projection Registry
- Evidence Transaction
- Journey Graph
- Identity Layer / Identity Engine
- Doctrine Engine
- Memory Constellation
- Contradiction Chamber

A diagram of how several proposed components might relate (e.g. a doctrine engine
sitting above an identity engine sitting above a journey graph) must be labeled, as a
whole and not just in a footnote:

```
CANDIDATE EVOLUTION VECTOR
NOT CURRENT ROADMAP
NOT IMPLEMENTED
NOT AUTHORIZED
```

The one chain that may be described in present tense in such a review is the chain
that is actually PROVEN by the current implementation, e.g.:

```
Human → Intent → Realm Runtime → Bubble Authority → Callback Receipt
      → Canonical Reconciliation → Human
```

— and only if each arrow in that chain has a citation. If even one arrow is aspirational,
the whole chain moves to PROPOSED.

### 2.5 Migration Gates

Every Evolution Vector entry that anyone intends to actually build must terminate in an
executable gate sequence before it may be implemented:

```
concept → prerequisite → bounded mutation → test → witness → review → authorization
```

A proposal with no migration gate is doctrine, not engineering, and must not be
implemented from that review alone — it needs its own gated plan (see
`REALM-KERNEL-MIGRATION-PLAN-v1.md` for the current worked example of this format:
8 gates, each with exact mutation scope, invariants, tests, rollback, and a review
stop, none of which auto-commit).

Renaming or repurposing an existing PROVEN contract (e.g. an existing event type) in
service of a PROPOSED concept is exactly the kind of change that must wait for its own
Migration Gate — a working protocol must not be replaced by an abstraction that has not
yet earned its shape through fixtures, tests, and a Bubble-side mapping.

### 2.6 Evidence Classification (summary table)

A consolidated table restating every claim's label from Sections 1–4, for audit
convenience. Format:

| Section | Claim | Label | Evidence |
|---|---|---|---|
| 2.1 | ... | PROVEN | file:line / test name |
| 2.3 | ... | INFERRED | file:line it interprets |
| 2.4 | ... | PROPOSED | (none — proposals cite no present evidence) |

### 2.7 Final Present-State Verdict

Close every review with, in this exact shape:

- **Current system class** — one sentence, present tense, PROVEN only.
- **Current maturity** — e.g. "scaffold," "stabilizing," "gated for extraction."
- **Proven capabilities** — bullet list, each with a citation.
- **Known limitations** — bullet list, each with a citation (absence of a test counts
  as a citable limitation).
- **Not implemented** — explicit negative list; this is where over-claiming is most
  likely to creep in, so it must be as carefully written as the positive claims.
- **Next lawful gate** — the single next Migration Gate that is actually authorized to
  proceed, or "none — awaiting authorization."

## 3. Mandatory language distinctions

Every review produced under this protocol must preserve these corrections verbatim in
spirit, applying them whenever the relevant topic is discussed:

- non-authoritative is not stateless
- event-mediated UI is not event sourcing
- centralized reconciliation is not CRDT
- shared pages are not registered projections
- strict schemas indicate protocol discipline but not protocol completeness
- Bubble is the current canonical authority
- identity-native architecture remains proposed
- human intent does not create canonical reality
- authoritative callback data may update canonical state

A review that uses any of the corrected phrasings (e.g. calls the runtime "stateless,"
or calls the current pattern "event sourcing" or "CRDT-based") without immediately
supplying the correction has failed this protocol and must be revised before it is
treated as a valid review artifact.

## 4. Current architecture statement (standing description)

Until a future, separately authorized review changes it, the SELF JOURNEY realm
runtime is to be described, in any document produced under this protocol, as:

> A governed, non-authoritative, server-reconciled HTML Realm runtime.

It must not be classified, in present tense, as any of:

- event-sourced
- CRDT-based
- identity-native
- doctrine-driven
- autonomous
- distributed-authority
- production-integrated with Bubble

Any of these labels may appear only inside an Evolution Vector section, explicitly
marked PROPOSED, never in a Verified Architecture section.

## 5. What "authority" means operationally in this protocol

"Bubble is the current canonical authority" is not a slogan — it is testable. A review
may only mark it PROVEN if it can point to the specific code path that enforces it
(e.g., in the current realm runtime, the fact that `state.canonical` is assigned to
only inside the `accepted`-status branch of callback handling, and nowhere inside the
event-emission path). If a future implementation adds a second write path to canonical
state without an accompanying test proving the old single-writer invariant still holds,
that is itself a Engineering Critique finding (§2.2, likely REMOVE or DECOMPOSE), not a
silent architecture change.

## 6. Reference example (worked, using the current realm.js)

This is the one concrete illustration required by this protocol's authorization, kept
intentionally short — it is a template demonstration, not a re-run of the full critique
already filed in `REALM-ARCHITECTURE-DECOMPOSITION-v1.md`.

> **PROVEN:** The runtime exposes exactly `mount`, `update`, `receiveCallback`,
> `destroy`, and `getState` on `window.UMI_SOLAN` (`realm/realm.js:607-613`), verified
> by an exact-shape test (`realm/tests/realm-runtime.test.js:35-38`).
>
> **INFERRED:** The restricted five-method public API acts as a capability boundary —
> nothing outside the runtime can reach `state.canonical`, `state.pending`, or the
> event-construction logic except through these five entry points. This is a pattern
> visible in the shape of the export (`realm/realm.js:607-613`), not itself a tested
> "capability boundary" concept.
>
> **PROPOSED:** The runtime may later internally decompose into `RealmKernel`,
> `ProjectionRegistry`, `IntentEngine`, `ReconciliationEngine`, and
> `EnvironmentAdapter` (as detailed in `REALM-ARCHITECTURE-DECOMPOSITION-v1.md` §4),
> without changing the public `window.UMI_SOLAN` surface above.
>
> **MIGRATION GATE:** Per `REALM-KERNEL-MIGRATION-PLAN-v1.md` Gate 1, runtime lifecycle
> stabilization (extracting kernel state/lifecycle functions into their own module,
> plus adding post-patch schema re-validation to `applyPatch`) must complete, with its
> own review stop, before any internal extraction proceeds. No gate in that plan
> auto-commits.

## 7. Scope discipline for reviews produced under this protocol

A review produced under this protocol is itself documentation. It must not, in the
course of being written, modify runtime code, schemas, fixtures, tests, or HTML files —
if a review's Engineering Critique section identifies something that should change,
that change is proposed and gated (§2.5), not made inline as part of writing the
review. This mirrors the constraint this very document was written under: bounded
inspection of the files named in its own authorization, and a scope witness confirming
that only this file was created.

## 8. Applicability

This protocol applies to future architectural reviews of the SELF JOURNEY realm
runtime and any sibling OURSELF engineering work reviewed in this repository or a
successor repository sharing its authority model. It does not itself re-authorize or
re-open any Migration Gate already defined in `REALM-KERNEL-MIGRATION-PLAN-v1.md`; those
gates remain governed by that document until it is superseded by its own explicitly
authorized revision.
