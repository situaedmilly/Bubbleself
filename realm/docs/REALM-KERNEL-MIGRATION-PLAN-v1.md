# SELF JOURNEY Realm — Kernel Migration Plan (v1)

Design-registration document. This plan is not authorization to execute any gate. Each
gate below requires its own review stop before its mutation is made, and no gate
auto-commits. Baseline for all gates: commit `6764a1adc6731988db8377b2f43aa9983829f303`
on branch `claude/new-session-47gm2u`.

## Invariants that hold across every gate

1. `window.UMI_SOLAN` continues to expose exactly `{ mount, update, receiveCallback,
   destroy, getState }` (`realm/realm.js:607-613`), verified by the exact-shape test at
   `realm/tests/realm-runtime.test.js:35-38`. No gate may add, remove, or rename a
   public method.
2. Canonical state (`state.canonical`) is written only inside the accepted-callback
   branch of reconciliation (today: `realm/realm.js:526-534`). No gate may introduce a
   second write path.
3. All 32 existing tests (`realm/tests/realm-runtime.test.js`,
   `realm/tests/realm-contracts.test.js`) must continue to pass unmodified in
   assertions (file moves/renames of the code under test are fine; test *intent* does
   not change) unless a gate explicitly says otherwise.
4. The static-safety grep scan (pattern list: `fetch\(|XMLHttpRequest|WebSocket|
   localStorage|sessionStorage|document\.cookie|eval\(|exec\(|api_key|password|secret|
   supabase|firebase`) must return no matches in execution code after every gate.
5. No gate commits automatically. Each gate ends at a review stop.

---

## Gate 1 — Runtime lifecycle stabilization

**Exact mutation scope.** Extract `initialState`, `mount`, `update`, `receiveCallback`
(minus the `finalizeOptimistic` dispatch body), `destroy`, `getState`, `deepClone`,
`applyPatch`, and the three schema constants from `realm/realm.js` into
`realm/kernel/realm-kernel.js`. `realm/realm.js` becomes a thin composition file that
imports the kernel and wires the (not-yet-existing) projection registry. No behavior
change; this is a file split.

**Invariants.**
- Public API shape unchanged (see global invariant 1).
- `applyPatch` gains an explicit allowlist check: after applying `canonical_patch`, the
  resulting canonical object must re-pass `validate(BUBBLE_INPUT_SCHEMA, ...)`
  (closes decision-matrix row 6 in `REALM-ARCHITECTURE-DECOMPOSITION-v1.md`). If the
  patched result fails validation, the patch is rejected and an error is recorded — the
  canonical state must not be left in a mixed valid/invalid state.

**Tests.** All existing `realm-runtime.test.js` and `realm-contracts.test.js` cases
pass against the new file layout without modification to their assertions. New test:
a `canonical_patch` containing an unknown/invalid dotted path is rejected and
`state.canonical` is unchanged (currently unguarded — see decomposition doc row 6).

**Rollback.** `git restore realm/realm.js && git rm -r realm/kernel` (only if
`realm/kernel/` was newly added and empty of anything else).

**Review stop.** Present diff. Do not commit.

---

## Gate 2 — Environment adapter and deterministic test injection

**Exact mutation scope.** Introduce `createRealmRuntime({ documentAdapter,
bridgeAdapter, clock, idFactory })` as an internal factory inside
`realm/kernel/realm-kernel.js` (or a sibling `realm/kernel/environment-adapter.js`).
Production entry (`realm/realm.js`) calls it with real `document`,
`window.bubble_fn_realm_event`, `Date`, and the existing `genId()`
(`realm/realm.js:252-262`) as defaults. `window.UMI_SOLAN` remains the same five
methods — the factory is not exposed globally.

**Invariants.**
- No new global function is added to `window` or `globalThis`.
- The `__test__` export (`realm/realm.js:615-633`) becomes removable *by the end of
  this gate* — tests inject a fake `documentAdapter`/`bridgeAdapter` instead of reaching
  into `module.exports.__test__`.

**Tests.** Rewrite `realm-runtime.test.js` to construct a runtime instance via
`createRealmRuntime` with a minimal fake `documentAdapter` (an in-memory element/tree
sufficient for `getElementById`, `innerHTML` assignment, `addEventListener`,
`dispatchEvent` — no external dependency, hand-rolled, per the existing "no new test
libs" constraint). New tests dispatch real `click`/`change` events against the fake DOM
and assert on resulting `bubble_fn_realm_event` calls — closing the browser-test gap
identified in `REALM-ARCHITECTURE-DECOMPOSITION-v1.md` §2 row 12.

**Rollback.** `git restore realm/realm.js realm/tests/realm-runtime.test.js` and
`git rm` any new adapter/fake-dom files introduced.

**Review stop.** Present diff, including the fake DOM implementation, for review before
any test file is modified. Do not commit.

---

## Gate 3 — Projection registry extraction

**Exact mutation scope.** Introduce `realm/kernel/projection-registry.js` defining the
registry shape from `REALM-ARCHITECTURE-DECOMPOSITION-v1.md` §4.2. Move the
`c.realm_id === "today" | "overview" | "reflection"` branch structure
(`realm/realm.js:332-366`) into a registry lookup; the three branch bodies move
verbatim (no logic change) into `realm/projections/today.js`,
`realm/projections/overview.js`, `realm/projections/reflection.js` as placeholder
adapters implementing only `render`/`bind` for now. `finalizeOptimistic`'s
`event_type`-keyed switch (`realm/realm.js:492-511`) is not yet split — that is Gate
4–6 work, done per-projection as each page is extracted, to avoid a single
big-bang rewrite.

**Invariants.**
- Rendered HTML output for all three pages is byte-identical to pre-Gate-3 output for
  the existing fixtures (`active-day.json`, `completed-day.json`, `empty-state.json`,
  `overview.json`, `phase-switch.json`). This is a pure extraction, not a redesign.
- RealmKernel (Gate 1) does not import any projection module by name — only the
  registry does.

**Tests.** Snapshot-style test comparing `renderIfPossible` output before/after
extraction for each fixture (string equality). Existing tests continue to pass.

**Rollback.** `git restore realm/realm.js && git rm -r realm/kernel/projection-registry.js realm/projections`.

**Review stop.** Present diff. Do not commit.

---

## Gate 4 — Today projection extraction

**Exact mutation scope.** Complete `realm/projections/today.js`: move
`deriveView`'s day-related fields (`realm/realm.js:300-310`), the Today-specific
`finalizeOptimistic` cases (`journey.reflection.save_requested`,
`journey.day.seal_requested` — `realm/realm.js:494-502`), and
`triggerSaveReflection`/`triggerSealDay` (`realm/realm.js:563-582`) out of the shared
kernel file into this module, exposed via the projection adapter interface defined in
`REALM-ARCHITECTURE-DECOMPOSITION-v1.md` §4.2.

**Invariants.** All Today-related tests in `realm-runtime.test.js` (mount active-day/
completed-day, Save Reflection ×4, Seal Day ×2) pass unmodified in intent. Overview and
Reflection projections are untouched by this gate (still living wherever Gate 3 left
them).

**Tests.** No new tests required beyond confirming existing Today tests still pass
against the extracted module; this gate is about isolation, not new behavior.

**Rollback.** `git restore realm/realm.js` and revert `realm/projections/today.js` to
its Gate-3 placeholder state (or `git rm` if newly created in this gate).

**Review stop.** Present diff. Do not commit.

---

## Gate 5 — Overview projection extraction

**Exact mutation scope.** Same pattern as Gate 4, for Overview: move
`view.showCompleted`/`view.selectedPhaseId` derivation, the Overview branch of
`renderIfPossible` (`realm/realm.js:347-360`), `triggerNavigatePhase` and
`triggerToggleCompleted` (`realm/realm.js:584-595`) into `realm/projections/overview.js`.

**Invariants.** Toggle Completed remains a purely local UI action with no event
emission (`realm/realm.js:590-595`, tested at
`realm/tests/realm-runtime.test.js:243-248`) — this gate must not add an emission path
for it. That would be a behavior change requiring its own review, not an incidental
side effect of extraction.

**Tests.** Existing Toggle Completed and Phase Selection tests pass unmodified in
intent.

**Rollback.** Same pattern as Gate 4.

**Review stop.** Present diff. Do not commit.

---

## Gate 6 — Reflection projection extraction

**Exact mutation scope.** Move the Reflection branch of `renderIfPossible`
(`realm/realm.js:361-365`), `triggerFlagImportant` (`realm/realm.js:597-602`), and the
flag-related `finalizeOptimistic` case (`realm/realm.js:503-508`) into
`realm/projections/reflection.js`. After this gate, `realm/realm.js` (or its Gate-1
successor) contains no `if (c.realm_id === ...)` branching at all — decision-matrix row
4 in `REALM-ARCHITECTURE-DECOMPOSITION-v1.md` is fully resolved.

**Invariants.** Mark Important's optimistic-set-then-revert-on-rejection behavior
(tested at `realm/tests/realm-runtime.test.js:250-267`) is preserved exactly.

**Tests.** Existing Mark Important tests pass unmodified in intent. New test:
`ProjectionRegistry` contains exactly three entries and `RealmKernel` has zero
references to `"today"`/`"overview"`/`"reflection"` string literals (a grep-based
architectural test, not a behavioral one).

**Rollback.** Same pattern as Gate 4/5.

**Review stop.** Present diff. Do not commit.

---

## Gate 7 — Concept-specific contract proposals

**Exact mutation scope.** For each of the six concepts in
`PAGE-CONCEPT-REGISTRY-v1.md`, propose (as a reviewable diff, not yet merged) the
specific schema additions each requires: `day.ritual_state`/`day.requirements`
(Ritual State Machine), `evidence.capture_mode` enum tightening (Evidence
Transaction), `journey.available_lenses[]` (Phase Lensing), `journal.entries[]`
(Memory Constellation), `contradiction` object (Contradiction Chamber), and any new
`CLOSED_EVENT_TYPES` entries (`journey.evidence.submit_requested`,
`journey.projection.lens_requested`, `journey.reflection.relate_requested`,
`belief.contradiction.acknowledge_requested`, `belief.revision.propose_requested`).

**Invariants.** No event type is added to `CLOSED_EVENT_TYPES`
(`realm/realm.js:15-21`) or `realm-event.schema.json`'s enum
(`realm/contracts/realm-event.schema.json:22-28`) without: (a) a fixture demonstrating
it, (b) a test proving the closed-vocabulary guard still rejects everything not on the
list, (c) an explicit statement of which "must never be inferred" clause from
`PAGE-CONCEPT-REGISTRY-v1.md` governs it.

**Tests.** One contract test per newly added event type / schema field, following the
existing pattern in `realm/tests/realm-contracts.test.js`.

**Rollback.** `git restore realm/contracts realm/realm.js` (schema and constant
changes only — this gate should not touch projection or kernel logic).

**Review stop.** This is the highest-risk gate — it expands the closed vocabulary and
the canonical input surface. Present diff; explicitly flag which concepts are being
promoted from "registered" to "contracted" in this pass, since not all six need to land
together.

---

## Gate 8 — Bubble mapping

**Exact mutation scope.** Document (not implement — this repository has no Bubble
editor access) the exact Bubble-side workflow steps that would produce each
`accepted`/`rejected`/`stale_revision`/`conflict` callback for each event type
confirmed in Gate 7, and the exact Bubble-side field mapping that produces
`bubble-input.schema.json`-conformant payloads for `SELF_JOURNEY_MOUNT`
(`realm/today.html:11-14`, `realm/index.html:10-13`, `realm/reflection.html:10-13`).

**Invariants.** Bubble integration status remains `NOT_LIVE` at the end of this gate,
consistent with every prior implementation report. This gate produces documentation and
a mapping spec, not a live connection.

**Tests.** N/A — no runtime code changes. Manual verification checklist instead:
each event type's payload shape is traceable to a specific Bubble workflow step
description.

**Rollback.** N/A (documentation-only gate; revert via normal doc file restore if
needed).

**Review stop.** Confirm with the repository owner before any actual Bubble workflow is
configured outside this repository — that action has consequences (a live third-party
system) outside git's rollback guarantees.

---

## Sequencing notes

- Gates 1–2 (kernel stabilization, environment adapter) must land before Gates 3–6
  (projection extraction), because extraction is meaningless without a seam to extract
  *into* and a way to test the extracted DOM-binding code.
- Gates 3–6 (one per page, plus the registry) can proceed independently of Gate 7 —
  extraction does not require any new concept vocabulary.
- Gate 7 (contract proposals) should not attempt all six concepts in one commit; each
  concept in `PAGE-CONCEPT-REGISTRY-v1.md` has an independent "Required fixture" /
  "Required tests" section and can be gated separately if that proves safer.
- Gate 8 is documentation-only and has no code dependency, but is sequenced last
  because it needs Gate 7's contracts finalized to describe accurately.
