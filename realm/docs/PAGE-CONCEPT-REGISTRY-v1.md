# SELF JOURNEY Realm — Page Concept Registry (v1)

Design-registration document. **None of the event types named below have been added to
`realm/contracts/realm-event.schema.json` or to `CLOSED_EVENT_TYPES`
(`realm/realm.js:15-21`).** They are proposed vocabulary for a future contract gate
(Gate 7 of `REALM-KERNEL-MIGRATION-PLAN-v1.md`), documented here so the projection
extraction gates (3–6) have a target shape to extract *toward* without smuggling new
runtime behavior into this pass. No schema, fixture, or test file was changed to
produce this document.

Every concept below is written against the existing authority boundary established in
`REALM-ARCHITECTURE-DECOMPOSITION-v1.md` §2 row 1: the Realm only emits intent; Bubble
(or a future doctrine engine sitting behind Bubble) remains the sole writer of
canonical state.

---

## TODAY

### Concept 1 — Ritual State Machine

**Definition.** The current `today` projection derives its UI directly from three
independent boolean-ish fields (`day.status`, `day.practice.completed`,
`permissions.can_seal_day`/`can_edit_reflection`), as seen in
`realm/realm.js:333-334`. This concept proposes replacing that ad-hoc combination with
one explicit, named state that the Realm renders as a transition, not a checklist:

```
ORIENTED → ENGAGED → WITNESSED → PRACTICED → SEALABLE → SEALED
```

**Purpose.** Make "what can the human do right now and why" a single derived value
instead of an implicit AND of three separate fields scattered across `renderIfPossible`
(`realm.js:333-345`).

**Canonical Bubble input requirements.** Bubble must compute and send the state name
itself (the Realm derives *view* from it, it does not compute the state from raw
booleans — that would be inference, see "must never be inferred" below):

```json
{
  "day": {
    "ritual_state": "WITNESSED",
    "requirements": {
      "reflection_present": true,
      "practice_complete": false,
      "seal_authorized": false
    }
  }
}
```

This extends the existing `day` object in `bubble-input.schema.json` (currently
`day_id`, `title`, `status`, `sealed_at`, `practice`, `reflection` —
`realm/contracts/bubble-input.schema.json:57-85`); it does not replace it. `day.status`
(`active`/`completed`/`locked`) stays the coarse lifecycle flag; `ritual_state` is a
finer-grained presentation state layered on top.

**Derived view state.** `view.ritualState` (string, copied verbatim from
`canonical.day.ritual_state`), `view.requirementsMet` (object, copied from
`canonical.day.requirements`). No client-side computation of the state — only display
logic (which section highlights, which button is enabled) keyed off it.

**Closed event types (proposed, not yet added).** None new — this concept only changes
*what is rendered*, not what is emitted. `journey.reflection.save_requested` and
`journey.day.seal_requested` remain the only events the Today projection emits.

**Callback statuses.** Unchanged — `accepted`/`rejected`/`invalid`/`stale_revision`/
`conflict`/`server_error` as already defined in
`realm/contracts/bubble-callback.schema.json:12-15`.

**Authority boundary.** Bubble computes `ritual_state`; the Realm never derives it from
`practice.completed` + `reflection.existing_text` + permissions locally. If the Realm
computed it client-side, a stale or partial payload could show a transition state Bubble
never authorized.

**Failure modes.** If `ritual_state` is missing or unrecognized, the projection must
render a neutral/locked state and log to `state.errors`, not guess the nearest known
state.

**Required fixture.** `realm/fixtures/active-day.json` extended with a `ritual_state`
field (e.g. `"WITNESSED"`) and a `requirements` object — additive to the existing
fixture, not a new file, since it is still the "today, mid-flow" case.

**Required tests.** (1) Projection renders the seal control as disabled when
`requirements.seal_authorized` is `false` regardless of `permissions.can_seal_day`
(guards against the two flags disagreeing). (2) Unknown `ritual_state` string falls
back to a locked render and pushes an error, does not throw.

**Remains human interpretation.** What "ready to witness" or "ready to seal" *means*
for a given human's day — that judgment is Bubble/doctrine-side.

**Must never be inferred by the Realm.** The Realm must never compute
`ritual_state` from raw field combinations client-side. It renders the state Bubble
sends; it does not decide it.

---

### Concept 2 — Evidence Transaction

**Definition.** Reframes "Save Reflection" from a text-persistence action into an
evidence transaction with explicit preconditions, distinct from the current
`journey.reflection.save_requested` event (`realm/realm.js:456-490`,
`realm/realm.js:563-572`), which only carries `{ reflection_text }`
(`realm.js:571`).

**Purpose.** Separate "the human submitted text" from "the system accepted this as
evidence toward the day's ritual state" — the latter carries preconditions
(`source_revision`, human-presence signal) that the current envelope has (via
`source_revision`, `realm.js:467`) but does not name as such.

**Canonical Bubble input requirements.** No new top-level fields beyond what
`day.reflection` already provides (`bubble-input.schema.json:74-83`). This concept is
primarily an event-shape proposal, not an input-shape change.

**Derived view state.** Unchanged from today's `view.reflectionDraft`/`view.saving`
(`realm/realm.js:301-306`).

**Closed event types (proposed, not yet added).** `journey.evidence.submit_requested` —
a proposed *rename/superset* of `journey.reflection.save_requested`, carrying:

```json
{
  "event_type": "journey.evidence.submit_requested",
  "payload": {
    "reflection_text": "...",
    "preconditions": {
      "source_revision": 12
    }
  },
  "evidence": { "capture_mode": "direct_human_interaction" }
}
```

The `evidence.capture_mode` field already exists as an open `object` in
`realm-event.schema.json:52` — this concept proposes making `capture_mode` a required,
enumerated sub-field (`direct_human_interaction` vs. some future non-human source) so
the Realm's evidence claims are falsifiable server-side, not just carried as free-form
metadata. **Not implemented in this pass.**

**Callback statuses.** Unchanged.

**Authority boundary.** The Realm asserts *how* the evidence was captured
(`direct_human_interaction`); Bubble decides whether that assertion is trustworthy
enough to accept. The Realm cannot mark its own evidence as verified.

**Failure modes.** If `can_edit_reflection` is false, the Realm refuses to construct the
transaction at all (already implemented today — `realm.js:565-568`); this is the
"never allow silent optimistic success" guarantee and it must survive the rename.

**Required fixture.** No new fixture; `active-day.json` already exercises this path.

**Required tests.** A future contract test asserting `capture_mode` is present and one
of a closed set, once the schema is actually changed (Gate 7) — not this pass.

**Remains human interpretation.** Whether the *content* of a reflection is meaningful,
honest, or sufficient — the Realm only carries the transaction, it never scores it.

**Must never be inferred by the Realm.** The Realm must never fabricate or upgrade
`capture_mode` (e.g. claiming `direct_human_interaction` for a programmatically
triggered save). If a future automation path exists, it must declare itself honestly in
this field.

---

## JOURNEY OVERVIEW

### Concept 1 — Temporal Cartography

**Definition.** Reframes the day list currently rendered as a flat `<ul>`
(`realm/realm.js:358-360`) as navigable time-space: phases as territories, days as
coordinates, sealed evidence as landmarks, interruptions as fractures, current
trajectory as a vector.

**Purpose.** Give the Overview projection a spatial/temporal model to render (a map)
instead of a paginated list, without changing what canonical data already describes
(`journey.phases`, `journey.days` — `bubble-input.schema.json:112-144`).

**Canonical Bubble input requirements.** No new required fields — `journey.phases[]`
and `journey.days[]` already carry `phase_id`/`phase_title` and `day_id`/`status`/
`sealed_at` (`bubble-input.schema.json:122-143`). This concept is a projection-level
*interpretation* of existing data, not a new input shape. If "interruptions/fractures"
become a real concept, they would need an explicit new field (e.g. a `gaps` array) —
not inferred from gaps in the `days` array by the Realm (see "must never be inferred").

**Derived view state.** `view.territories` (grouped-by-phase day list),
`view.landmarks` (subset of days where `sealed_at` is non-null),
`view.trajectory` (current `day_index`/`total_days` as a vector position — already
available as `journey.day_index`/`journey.total_days`,
`bubble-input.schema.json:27-28`).

**Closed event types (proposed, not yet added).** None new. Selecting a landmark still
emits the existing `realm.navigate_requested` (`realm/realm.js:584-588`); this concept
only changes how the day list is grouped and labeled for rendering.

**Callback statuses.** Unchanged.

**Authority boundary.** The Realm may group and label days spatially, but it must not
declare a day "missed" or "a fracture" unless Bubble's data says so explicitly (e.g. a
future `day.status: "missed"` value) — the Realm must not infer a fracture merely from
a gap in `day_index` sequence, since a gap could mean data not yet loaded, not a missed
day.

**Failure modes.** Missing `journey.phases` or `journey.days` renders an empty map, not
a fabricated one.

**Required fixture.** `realm/fixtures/overview.json` already has the necessary shape
(`phases`, `days` — see fixture as committed); no new fixture required for this
reframing.

**Required tests.** Grouping-by-phase test: given `overview.json`, `view.territories`
groups `day-016`/`day-017`/`day-018` correctly by their (currently single) phase.

**Remains human interpretation.** Whether a "fracture" is meaningful or just noise —
that is doctrine-level, not Realm-level.

**Must never be inferred by the Realm.** The Realm must never invent a "missed day" or
"fracture" from absence of data. Absence of data means "not yet known," not "did not
happen."

---

### Concept 2 — Phase Lensing

**Definition.** Selecting a phase currently triggers navigation
(`realm/realm.js:584-588`, `realm/realm.js:392-396`) — a page change. This concept
proposes that selecting a phase can *also* change the interpretive lens applied to the
same journey graph without necessarily navigating: which evidence, contradictions, and
unresolved requirements are visible, e.g. a "Recognition lens" vs. an "Acceptance
lens."

**Purpose.** Decouple "which phase's first day am I on" (current
`realm.navigate_requested` behavior) from "which lens am I viewing the whole journey
through" (a new, purely presentational filter).

**Canonical Bubble input requirements.** A `journey.available_lenses[]` array (phase-keyed
labels) — additive, not yet present in `bubble-input.schema.json`. Proposed shape:

```json
{ "lens_id": "phase-01", "lens_title": "Recognition" }
```

which is identical in shape to the existing `phases[]` entries
(`bubble-input.schema.json:122-129`) — this concept may not need a new field at all if
"lens" and "phase" are the same list viewed two ways; that ambiguity is flagged here for
Gate 7, not resolved in this pass.

**Derived view state.** `view.activeLens` (separate from `view.selectedPhaseId`,
`realm.js:295`) so that changing the lens does not imply a navigation event.

**Closed event types (proposed, not yet added).** `journey.projection.lens_requested` —
a UI-only or Bubble-informational event, explicitly *not* `realm.navigate_requested`.
Proposed payload: `{ "lens_id": "phase-02" }`. Whether this needs a Bubble round-trip at
all (vs. being purely local like `journey.section.viewed`,
`realm/realm.js:590-595`'s sibling in spirit) is an open question for Gate 7.

**Callback statuses.** If implemented as a Bubble-informed event: same closed set. If
implemented as UI-only (like Toggle Completed, `realm.js:590-595`): none.

**Authority boundary.** The lens changes *what is shown*, never *what is true*. Applying
the "Acceptance lens" must not alter `canonical.day` or `canonical.journey` — it only
changes which already-canonical fields the projection chooses to surface.

**Failure modes.** Unknown `lens_id` falls back to an unfiltered/default view, not an
error state that blocks rendering.

**Required fixture.** A new fixture or an extension of `overview.json` with
`available_lenses` — not created in this pass.

**Required tests.** Switching lens does not emit `realm.navigate_requested`; switching
phase (existing behavior) still does.

**Remains human interpretation.** Which lens is "correct" for where the human actually
is — that is doctrine, not derivable from `day_index` alone.

**Must never be inferred by the Realm.** The Realm must never auto-select a lens based
on inferred emotional state or progress heuristics. Lens selection is either explicit
human choice or an explicit Bubble default.

---

## REFLECTION

### Concept 1 — Memory Constellation

**Definition.** Reframes reflections from isolated journal entries
(`realm/realm.js:361-365` currently renders one `reflectionDraft` textarea per mount)
into linked evidence nodes with relations: `repeats`, `contradicts`, `strengthens`,
`resolves`, `originates_from`, `transforms`.

**Purpose.** Let the Reflection projection render *relationships between* reflections,
not just the current one.

**Canonical Bubble input requirements.** A new array, e.g. `journal.entries[]`
(already anticipated as a placeholder shape in the source PDF's Reflection page
concept table — "`journal.entries[].id` (or similar)" — but **not present in
`bubble-input.schema.json` today**). Proposed shape:

```json
{
  "journal": {
    "entries": [
      { "entry_id": "day-014", "relation": "originates_from", "target_id": "day-009" }
    ]
  }
}
```

This is a schema addition and is explicitly deferred to Gate 7, not authorized here.

**Derived view state.** `view.constellation` — an adjacency structure built from
`journal.entries[].relation`/`target_id`, purely for rendering (e.g. a linked list or
graph), never used to alter `canonical`.

**Closed event types (proposed, not yet added).** None required to *view* the
constellation. If a human can *assert* a new relation (e.g. "this contradicts that"),
a new event such as `journey.reflection.relate_requested` would be needed — proposed
for Gate 7, not this pass.

**Callback statuses.** Unchanged set, if/when the relate event is added.

**Authority boundary.** The Realm renders relations Bubble (or a doctrine engine) has
already recorded; it does not compute "contradicts" or "strengthens" by comparing text
similarity client-side.

**Failure modes.** Missing or malformed `journal.entries` renders the single current
reflection only (today's existing behavior), not a broken graph.

**Required fixture.** A new fixture with a populated `journal.entries[]` — not created
in this pass.

**Required tests.** Constellation view derivation from a fixture with 2+ related
entries; graceful fallback to single-entry view when `journal` is absent (current
fixtures have no `journal` key, so this fallback is implicitly exercised already by
every existing mount test).

**Remains human interpretation.** Whether two reflections actually contradict or
strengthen each other in a meaningful (not just textual) sense.

**Must never be inferred by the Realm.** The Realm must never compute semantic
relations (contradiction, similarity) from reflection text client-side. Relations are
either explicit Bubble/doctrine-authored data or explicit human assertions carried as
events — never inferred locally.

---

### Concept 2 — Contradiction Chamber

**Definition.** A staged confrontation view presenting three things side by side:
historical declaration, new evidence, and current doctrine — with the human able to
request `belief.contradiction.acknowledge_requested` or
`belief.revision.propose_requested`. Bubble (or a future doctrine engine) remains
authoritative over what "current doctrine" is and whether a proposed revision is
accepted.

**Purpose.** Give the human a way to see a stated contradiction and act on it, without
the Realm ever adjudicating which side is correct.

**Canonical Bubble input requirements.** A `contradiction` object Bubble supplies
explicitly per reflection, e.g.:

```json
{
  "contradiction": {
    "historical_entry_id": "day-009",
    "historical_text": "I will never trust again.",
    "new_entry_id": "day-018",
    "new_text": "I chose to trust and it held.",
    "doctrine_position": "trust-is-earned-not-granted"
  }
}
```

Not present in `bubble-input.schema.json` today; deferred to Gate 7.

**Derived view state.** `view.contradiction` — a direct passthrough of the three
fields above for side-by-side rendering. No client-side judgment of which is "true."

**Closed event types (proposed, not yet added).**
`belief.contradiction.acknowledge_requested` (human acknowledges seeing it, no
resolution claimed) and `belief.revision.propose_requested` (human proposes their
belief has changed, payload carries the proposed text — Bubble/doctrine decides
whether/how to record it). Both would need `journal`/`belief` namespacing decisions
that don't exist in the current `CLOSED_EVENT_TYPES` (`realm/realm.js:15-21`) —
explicitly not added in this pass.

**Callback statuses.** Unchanged set. `rejected` here would mean "doctrine engine
declined this proposed revision," which must render as an explicit message, not a
silent no-op.

**Authority boundary.** This is the concept most at risk of scope creep into "the Realm
adjudicates truth." It must not: score which side is "more true," suggest a resolution,
or auto-acknowledge on the human's behalf. It stages the confrontation and forwards the
human's two possible intents; nothing more.

**Failure modes.** If `contradiction` is malformed or absent, the chamber does not
render — it is not a default state, it only appears when Bubble explicitly supplies
one.

**Required fixture.** A new fixture with a populated `contradiction` object — not
created in this pass.

**Required tests.** Rendering test for the three-way display; event tests confirming
both proposed event types, once added, follow the same "refuse if permission is
false" pattern already proven for `triggerSealDay`
(`realm/realm.js:574-582`, tested at `realm/tests/realm-runtime.test.js:186-191`).

**Remains human interpretation.** Which belief is more true, and whether a revision is
warranted — entirely human/doctrine territory.

**Must never be inferred by the Realm.** The Realm must never auto-resolve a
contradiction, never suggest which side to believe, never silently pick a "winning"
entry, and never persist a revision without an explicit human-initiated event and an
explicit Bubble/doctrine `accepted` callback.

---

## Cross-cutting notes

- All six concepts above are compatible with the existing five-method public API
  (`realm/realm.js:607-613`) and the existing authority boundary
  (`REALM-ARCHITECTURE-DECOMPOSITION-v1.md` §2 row 1). None require a sixth global
  method or a new top-level authority path.
- None of the proposed event types (`journey.evidence.submit_requested`,
  `journey.projection.lens_requested`, `journey.reflection.relate_requested`,
  `belief.contradiction.acknowledge_requested`, `belief.revision.propose_requested`)
  exist in `CLOSED_EVENT_TYPES` (`realm/realm.js:15-21`) or in
  `realm-event.schema.json`'s `event_type` enum
  (`realm/contracts/realm-event.schema.json:22-28`) today. Adding them is Gate 7 work,
  contingent on its own review gate, not implied by this registration.
- Every "must never be inferred" clause above is a restatement, at the concept level,
  of the same rule already enforced structurally at the kernel level: the Realm
  proposes, Bubble (or a successor doctrine engine) disposes.
