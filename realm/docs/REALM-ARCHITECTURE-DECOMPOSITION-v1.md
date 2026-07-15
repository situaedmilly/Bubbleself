# SELF JOURNEY Realm — Architecture Decomposition (v1)

Design-registration document. No runtime code, schema, fixture, HTML, or test file was
modified to produce this document. All citations reference the repository state at
commit `6764a1adc6731988db8377b2f43aa9983829f303` on branch `claude/new-session-47gm2u`.

## 1. Scope and method

This document critiques the existing `realm/realm.js` scaffold against the
Bubble-authority architecture it claims to implement, corrects imprecise labels applied
to it, and proposes an internal (non-public-API-changing) decomposition. It does not
authorize any code change; it is the artifact Gate 0 of the migration plan
(`REALM-KERNEL-MIGRATION-PLAN-v1.md`) depends on.

## 2. Decision matrix

| # | Concern | Classification | Evidence | Rationale |
|---|---|---|---|---|
| 1 | Bubble authority boundary — canonical state changes only via `receiveCallback` on `status === "accepted"` | KEEP | `realm/realm.js:526-534` | `receiveCallback` never assigns to `state.canonical` except inside the `accepted` branch; `emitEvent` (`realm.js:456-490`) never mutates `state.canonical`, only `state.pending`. This is the load-bearing invariant of the whole design and it holds today. |
| 2 | canonical/view/pending/errors state separation | KEEP | `realm/realm.js:277-287` (`initialState`), `realm/realm.js:291-313` (`deriveView`) | Four state buckets are structurally distinct in `initialState()`. `deriveView` never writes to `canonical`. Good separation, but see #4 below — the separation is enforced by convention inside one file, not by module boundaries. |
| 3 | Five-method public API (`mount, update, receiveCallback, destroy, getState`) | KEEP | `realm/realm.js:607-613`, asserted by `realm/tests/realm-runtime.test.js:35-38` | Exact-shape test exists and passes. This is the one invariant every later gate must not break. |
| 4 | Page-specific branching inside `realm.js` (`if (c.realm_id === "today")` / `"overview"` / `"reflection"`) | DECOMPOSE | `realm/realm.js:332-366` (render), `realm/realm.js:492-511` (`finalizeOptimistic` switch), `realm/realm.js:563-602` (trigger functions) | This is the "one kernel trying to contain five organs" problem named in the request. Today/Overview/Reflection markup, event-type-to-optimistic-state mapping, and DOM binding (`realm.js:376-400`) all live in the same closure with no per-page seam. Adding a fourth page today means editing this file in four places. |
| 5 | `__test__` exposure on `module.exports` | TEMPORARY, KEEP UNTIL GATE 2 | `realm/realm.js:558-561` (comment), `realm/realm.js:615-633` | Explicitly commented as a substitute for a real DOM in Node (`realm/realm.js:559-561: "not part of the public API surface... but reachable in tests via module.exports.__test__"`). It duplicates trigger logic as a second hidden entry point and can drift from real `click`/`change` binding in `bindIfPossible` (`realm.js:376-400`), since tests call `triggerSaveReflection` etc. directly and never exercise `bindIfPossible` at all — no test in `realm-runtime.test.js` ever constructs a DOM `container` or dispatches a `click` event. This is the browser-test gap (#12). |
| 6 | `canonical_patch` dotted-path application | REFINE | `realm/realm.js:264-275` (`applyPatch`) | `applyPatch` writes to *any* dotted path Bubble sends, with no allowlist against `BUBBLE_INPUT_SCHEMA`. A malicious or buggy callback with `"canonical_patch": {"permissions.can_seal_day.__proto__.polluted": true}`-shaped keys, or simply an unexpected key like `"day.reflection.extra_field"`, is applied without re-validating the patched result against `BUBBLE_INPUT_SCHEMA`. Contrast: `mount()` and `update()` both call `validate(BUBBLE_INPUT_SCHEMA, payload)` (`realm.js:417`, `realm.js:442`) before accepting a payload wholesale, but `receiveCallback`'s patch path (`realm.js:528`) has no equivalent post-patch validation. This is real, not speculative — the "dangerous if it accumulates" critique in the request applies exactly here. |
| 7 | Revision handling (`>=` accept, `<` reject) | KEEP, DOCUMENT EXPLICITLY | `realm/realm.js:447-449` (`update`), `realm/realm.js:527` (`receiveCallback` stale-accept guard) | `update()` treats `newPayload.revision < state.canonical.revision` as the only rejection condition, meaning equal revision is accepted (idempotent-replace). This was a deliberate but implicit choice — the PDF spec left it open ("define behavior (test idempotency or error)"). It is exercised by `realm/tests/realm-runtime.test.js:82-96` for the `>` and `<` cases, but there is no test for the `==` case. Not a defect, but an undocumented decision. |
| 8 | Optimistic view state (`saving`, `sealing`, `flagged`) | REFINE | `realm/realm.js:492-511` (`finalizeOptimistic`), `realm/tests/realm-runtime.test.js:250-267` | Correctly reverts `flagged` on rejection (test at `realm-runtime.test.js:255-266` confirms revert), and correctly clears `saving`/`sealing` regardless of outcome. Refinement needed: `finalizeOptimistic` is a `switch` keyed on `event_type` string literals (`realm.js:494`, `realm.js:500`, `realm.js:503`) — this is exactly the kind of per-concept conditional that should live in a projection's callback-interpretation hook (Gate 3+), not in the shared reconciliation path. |
| 9 | Closed event vocabulary enforcement | KEEP | `realm/realm.js:15-21` (`CLOSED_EVENT_TYPES`), enforced at `realm.js:458-460` inside `emitEvent`, schema-enforced again at `realm.js:194` (`REALM_EVENT_SCHEMA.properties.event_type.enum`) | Double-enforced (constant check + schema `enum`), verified by `realm/tests/realm-contracts.test.js:58-73`. Solid. |
| 10 | Schema versioning | DEFER | `realm/realm.js:13` (`SCHEMA_VERSION = "1.0.0"`), `realm/contracts/*.schema.json` (`$schema` header only, no version negotiation) | `schema_version` is stamped on every event (`realm.js:462`) and required on every envelope (`bubble-input.schema.json:6`, `realm-event.schema.json:7`, `bubble-callback.schema.json:6`), but nothing reads or branches on its value — there is no migration law yet, only a constant. Deferred, not urgent, since only one version exists. |
| 11 | DOM binding testability | DECOMPOSE (see EnvironmentAdapter, §4.5) | `realm/realm.js:371-408` (`bindIfPossible`, `unbindIfPossible`), guarded only by `typeof document === "undefined"` (`realm.js:372`, `realm.js:326`) | `document`, `window.bubble_fn_realm_event`/`global.bubble_fn_realm_event` (`realm.js:315-321`), and `root.crypto.randomUUID` (`realm.js:253`) are all read as ambient globals rather than injected. This is what forces the `__test__` back door — there is no seam to hand the runtime a fake document or a fake sender without reaching into `global`. |
| 12 | Browser-test gap | CONFIRMED GAP | `realm/tests/realm-runtime.test.js` (entire file — no `document`, no `container`, no `click`/`change` dispatch anywhere) | Every one of the 32 passing tests (`npm test` output, prior turn) calls `realm.__test__.triggerX(...)` directly. **None exercise `renderIfPossible` (`realm.js:326-369`) or `bindIfPossible` (`realm.js:371-401`).** The rendering/binding code is currently untested at any level. This directly contradicts any claim that the page rendering is "verified." |
| 13 | Static grep safety scan | KEEP AS ONE LAYER, NOT SUFFICIENT ALONE | prior-turn scan command: `grep -RniE "fetch\(\|XMLHttpRequest\|...` over `realm/realm.js`, HTML, tests | A literal-pattern grep cannot catch computed member access (e.g. `window["fe" + "tch"]`), aliasing (`const f = fetch; f(...)`), or a future helper module that reintroduces network access without matching the literal denylist. It is a correct first layer, not a proof of absence. |
| 14 | Default-branch governance | CORRECT LATER, FLAG NOW | prior-turn `git ls-remote origin` output: only ref was `refs/heads/claude/new-session-47gm2u`, which GitHub set as default because the repo was empty at push time | Operationally unavoidable — there was no `main` to branch from. Recorded here as a governance debt: a deliberate `main` should be established before further remote development so future feature branches have a real base to diff and PR against. |
| 15 | `genId()` fallback UUID generator | KEEP | `realm/realm.js:252-262` | Uses `crypto.randomUUID()` when available, falls back to a `Math.random()`-based v4-shaped string otherwise. Non-cryptographic fallback is acceptable here because `event_id` is a correlation key, not a security token — it is never used for authorization. |

## 3. Corrected claims

The following labels are inaccurate as applied to the current code and must not appear
in future documentation or commit messages without this qualification:

- **"The runtime is stateless."** — Incorrect. `realm/realm.js:277-287` defines six
  persisted fields (`mounted`, `containerId`, `container`, `canonical`, `view`,
  `pending`, `errors`) that survive across calls to `mount`/`update`/`receiveCallback`.
  The accurate claim: **the runtime is non-authoritative, not stateless** — it holds
  state but cannot unilaterally promote it to canonical without an `accepted` callback.

- **"This is event sourcing."** — Not yet. Event sourcing reconstructs canonical state
  by replaying an append-only event log. This codebase does the opposite: it discards
  events once acknowledged (`delete state.pending[callback.event_id]` at
  `realm.js:524`) and keeps only the latest canonical snapshot plus its `revision`
  integer (`realm.js:450`, `realm.js:529`). There is no log, no replay, no event
  store. The accurate claim: **event-mediated, server-authoritative UI**.

- **"This is CRDT thinking."** — Not technically. A CRDT defines a merge function that
  guarantees convergence across concurrent writers without a coordinator. Here there is
  exactly one writer of canonical truth (Bubble), and the realm's only conflict
  handling is "reject if `revision` is behind" (`realm.js:447-449`,
  `realm.js:527`). The accurate claim: **optimistic interaction with centralized
  canonical reconciliation**.

- **"Pages are already projections."** — Not yet. `realm.js:332-366` shows Today,
  Overview, and Reflection markup as three `if`/`else if` branches inside one
  `renderIfPossible` function keyed on `c.realm_id`. A projection requires a declared
  contract (input requirements, derivation rules, supported events, callback
  interpretation) that can be registered and swapped independently of the kernel. No
  such registry exists yet — see §4.2.

- **"Bubble becomes one renderer."** — Not a present fact. Bubble is currently both the
  canonical-state authority and the host that embeds `today.html`/`index.html`/
  `reflection.html` (see the `SELF_JOURNEY_MOUNT` / `bubble_fn_realm_callback` /
  `bubble_fn_realm_update` contract stubs in each HTML file, e.g.
  `realm/today.html:11-22`). No renderer-swap capability exists; this is a future
  ecosystem doctrine, not implemented behavior.

## 4. Target internal architecture

The public contract does not change:

```js
window.UMI_SOLAN = {
  mount,
  update,
  receiveCallback,
  destroy,
  getState
};
```

Internally, the single `realm.js` closure decomposes into five responsibilities. This
section defines interfaces only — no code in this pass implements them.

### 4.1 RealmKernel

Owns exactly what `realm.js:277-556` (state shape + `mount`/`update`/`receiveCallback`/
`destroy`/`getState`) owns today, minus rendering and page-specific event
interpretation:

- lifecycle: `mounted`/`containerId` bookkeeping (`realm.js:413-438`,
  `realm.js:543-546`)
- revision acceptance rule (`realm.js:447-449`)
- pending-event correlation table (`realm.js:487`, `realm.js:522-524`)
- error accumulation (`realm.js:419`, `realm.js:444`, `realm.js:518`, `realm.js:537`)
- immutable-input guarantee via `deepClone` (`realm.js:248-250`, used at `realm.js:433`,
  `realm.js:450`, `realm.js:549-555`)

RealmKernel must not know the strings `"today"`, `"overview"`, or `"reflection"`.

### 4.2 ProjectionRegistry

A page-identity → projection-adapter map, replacing the `if (c.realm_id === ...)`
ladder at `realm.js:332-366` and the `switch (pendingEntry.event_type)` at
`realm.js:492-511`.

```js
const projections = {
  "journey.today": todayProjection,
  "journey.overview": overviewProjection,
  "journey.reflection": reflectionProjection
};
```

Each projection adapter owns:

- deriving its slice of view state (today's share of `deriveView`, `realm.js:291-313`)
- rendering (today's share of `renderIfPossible`, `realm.js:332-366`)
- binding interactions (today's share of `bindIfPossible`, `realm.js:376-400`)
- declaring which of the five `CLOSED_EVENT_TYPES` (`realm.js:15-21`) it may emit
- interpreting an accepted/rejected callback for its own optimistic view fields (today's
  share of `finalizeOptimistic`, `realm.js:492-511`)

A projection adapter never writes to `canonical` directly and never talks to
`bubble_fn_realm_event` directly — it calls back into RealmKernel/IntentEngine.

### 4.3 IntentEngine

Constructs a typed, schema-valid event from a human action. Replaces the shared
envelope-construction body of `emitEvent` (`realm.js:456-490`), keeping it independent
of DOM structure:

```
human action → capability check (permissions.*) → intent envelope construction
  → REALM_EVENT_SCHEMA validation → pending registration → bridge dispatch
```

The capability checks currently inline in each trigger function (e.g.
`realm.js:565-568` for `can_edit_reflection`, `realm.js:576-579` for `can_seal_day`)
belong here as a single reusable guard, parameterized by the permission key each
projection declares it needs — not duplicated per trigger.

### 4.4 ReconciliationEngine

Everything `receiveCallback` does today (`realm.js:514-541`) minus the
projection-specific `finalizeOptimistic` dispatch:

```
callback schema validation (realm.js:516)
  → event_id correlation (realm.js:522-524)
  → revision check (realm.js:527)
  → status branch: accepted → canonical_patch + revision write (realm.js:528-529)
                     other    → error accumulation (realm.js:537)
  → delegate to the owning projection's optimistic-state interpreter
  → projection re-render
```

This is where the "centralized authority enforced" property (§3) is structurally
guaranteed: only ReconciliationEngine may call the function that writes `canonical`.

### 4.5 EnvironmentAdapter

Removes the ambient-global reads currently scattered through the file
(`typeof document` at `realm.js:326`/`realm.js:372`/`realm.js:424`; `getEventSender`
reading `root.bubble_fn_realm_event`/`global.bubble_fn_realm_event` at
`realm.js:315-321`; `root.crypto.randomUUID` at `realm.js:253`) behind one seam:

```js
createRealmRuntime({
  documentAdapter,   // real `document` in production; a deterministic fake in tests
  bridgeAdapter,     // { send(eventJson) } wrapping bubble_fn_realm_event
  clock,             // () => ISO-8601 string, replacing `new Date().toISOString()`
  idFactory          // () => string, replacing genId() (realm.js:252-262)
});
```

Production wires the real browser globals. Tests inject deterministic fakes,
including a fake `documentAdapter` capable of dispatching real `click`/`change`
events — closing the browser-test gap (#12) without needing jsdom or any new
dependency. `window.UMI_SOLAN` still exposes only the five lawful methods
(§4, unchanged); the injected factory is an internal production wiring detail, not a
sixth public method. **This removes the need for a production `__test__` surface**
(#5) once Gate 2 lands.

## 5. What this document does not authorize

No file listed in §2's "Evidence" column has been altered by this document. The five
files under `realm/*.html`, `realm/realm.js`, `realm/contracts/*.json`,
`realm/fixtures/*.json`, and `realm/tests/*.test.js` remain exactly as committed at
`6764a1adc6731988db8377b2f43aa9983829f303`. Implementation of §4 begins at Gate 1 of
`REALM-KERNEL-MIGRATION-PLAN-v1.md`, subject to its own review gate.
