# GENESIS-RUNTIME-CONTRACT-001 — Doctrine → Deterministic Runtime Specification (v1)

Authorization: `AUTHORIZE_GENESIS_RUNTIME_CONTRACT_001_DOCTRINE_COMPILATION_ONLY`

Doctrine-compilation artifact. This document and its compiled sibling
(`genesis-days.v1.json`) translate the eight Genesis doctrine documents into one
deterministic machine grammar. **Nothing here is implemented.** No runtime code,
Bubble schema, fixture, HTML, or existing test was modified in this pass. The Genesis
doctrine documents themselves are untouched — this contract is derived *from* them,
and where the two disagree, the doctrine documents win until a doctrine amendment is
separately authorized.

Evidence classification (per `realm/docs/ARCHITECTURAL-REVIEW-PROTOCOL-v1.md`):
everything in this document is **PROPOSED** runtime behavior compiled from **PROVEN**
doctrine text (present in the repo at commit `c7ae230`). No claim here describes
running code.

---

## 1. The canonical day contract

Every Genesis day resolves into one normalized object. The authoritative compiled
instance of all seven is `genesis-days.v1.json` in this directory; the shape is:

```ts
interface GenesisDayDefinition {
  protocolVersion: "genesis.v1";
  dayNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  slug: string;
  title: string;
  removes: string;                 // the concealment strategy this day attacks
  requiredOutput: string;          // the day's named artifact class

  doctrine: {
    doctrineId: string;            // D-101..D-107
    name: string;
    proposition: string;
    prediction: string;
    falsificationRule: string;     // written before the data arrives
    falsificationIsWin: true;      // a falsified doctrine is a WIN, always
  };

  trap: {
    name: string;
    definition: string;
    secondHead?: string;           // days 2,3,4,6 carry a named second head
    detectionSignals: string[];
    runtimeResponse: string;       // what CONSELFCONVO says when the trap fires
    readOncePolicy: true;          // presented once, then never again that day
  };

  gate: {
    prompt: string;
    artifactLineCount: number;     // 1 (d1-3), 2 (d4,d5), 3 (d6), 0 (d7: docket)
    gateForm?: "docket";           // day 7 only
    definitionOfDone: string[];
    completionStatements: [string, string];  // exactly two. No third option.
    failureConditions: string[];
  };

  openingDebt: {
    requiredPriorDay: number | null;   // null on day 1 (covenant instead)
    resolutionRequirement: string;     // sealed or written failure line; ambiguity blocks
  };

  stations: { stationId: string; name: string; law: string }[];

  materialAction: { name: string; requirement: string };

  tally: {
    eventType: string;             // genesis.tally.* — PROPOSED, not in any schema
    label: string;                 // the day's named lie
    timestampRequired: true;
    reasonFieldForbidden: true;    // tallies carry a label and a timestamp, never a justification
    countsAs: string;
  };

  mirror: {
    sourcePolicy: "verbatim_user_language";
    question: string;
    sourceFields: string[];        // which prior records the runtime returns verbatim
  };

  eveningMemo: {
    minimumSeconds: 180;           // the 3:00 hard floor
    requiredStems: string[];
  };

  narrativeCheck: {
    questions: string[];
    refusalRule: string;           // the day's named counterfeit win
  };

  seal: {
    canFail: true;
    requirements: string[];        // the evidence checklist — mechanically enforced
    discomfortThresholdNote: string;
    failureMessage: string;        // the honest line for FAILED_MEASURED
    sealLaw: string;
  };
}
```

Shared, protocol-level law (compiled once in `genesis-days.v1.json → sharedLaw`):
banned Gate verbs; the two terminal day states (`SEALED`, `FAILED_MEASURED`); the
single unrecoverable state (`NARRATED_UNMEASURED`) and its late-write recovery; the
0–10 discomfort scale with the under-7 threshold; the 3:00 memo floor with
listen-once/don't-delete; the feeling-not-reason abandonment column; mandatory tally
timestamps; the streak law; and the two D-002 edit bans (morning command, protocol
documents). Carried doctrines D-001/D-002/D-003 and the ten-clause covenant
precondition are compiled at the same level.

**Derivation rule:** this contract is derived from the doctrine, not invented by the
HTML director. Any field the compiled JSON carries must be traceable to a doctrine
line (see `GENESIS-TRACEABILITY-MATRIX-v1.md`); any doctrine mechanic with no
compiled field is an orphan and fails the validation test.

---

## 2. The four laws (previously unresolved, now specified)

### 2.1 Verbatim provenance law

"The Mirror Question returns SELF's verbatim prior words" becomes an exact record
requirement. Every returned statement carries:

```text
conversation_turn_id        (or record id in the persistence layer)
captured_at                 (ISO-8601, authoritative clock — §2.2)
day_number
station_id
exact_text
normalization_applied = false
```

- The runtime may summarize elsewhere, but it must never label a paraphrase as "your
  words." A mirror return whose `normalization_applied` is not `false` is invalid and
  must not render inside a SELF SAID frame.
- If the referenced prior record does not exist (e.g. Day 1 failed-measured and the
  sheet field is empty), the mirror states that absence plainly — it does not
  reconstruct plausible prior language. This is the doctrine-layer instance of the
  Realm's standing rule: never fabricate; report insufficient evidence.
- Day 4's SELF SAID / SELF DID station and Day 7's declaration docket inherit this
  law wholesale: a side-by-side or docketed declaration without provenance fields is
  void, exactly as a Day 7 verdict without an exhibit citation is void.

### 2.2 Time law

Timestamp patterns are part of the instrument ("the timestamp is the tell"), so time
is specified, not vague:

```text
authoritative timezone        The node's declared home timezone, bound at covenant
                              signing. One timezone per Genesis run.
day opening boundary          00:00:00 local in the bound timezone.
day closing boundary          23:59:59 local. Day 6's "midnight" deadline is this
                              boundary, of the day the Gate was declared.
late entry                    Permitted, but stamped with both event time and entry
                              time; a late-written failure line is lawful and marked
                              late (the NARRATED_UNMEASURED recovery path).
offline capture               Client timestamp recorded as claimed_at; authoritative
                              received_at assigned on sync; both retained; the
                              instrument's pattern analysis uses claimed_at, disputes
                              use received_at.
clock change (DST)            Boundaries follow local civil time in the bound
                              timezone; a 23h/25h day is accepted as-is, never
                              normalized.
Day 4 repair clock            Starts at the Gate declaration event (gate.declared_at,
                              server-received). Due timestamp = declared_at + 24h,
                              computed once, stored immutable. The seal checks the
                              repair artifact's captured_at against the stored due
                              timestamp — never against a recomputed one.
```

### 2.3 Refusal law

The runtime's refusals (spec §7) compile into executable records, not stern
paragraphs. Every refusal has:

```text
trigger · refusal code · participant-facing language · what remains editable ·
what evidence resolves it · whether the day may still seal
```

| Code | Trigger | Participant-facing language (canonical) | Still editable | Resolving evidence | Day may still seal |
|---|---|---|---|---|---|
| `GATE_EMPTY` | Day opened with blank Gate line | "No artifact named = the day does not start. Name one noun that will verifiably exist by sundown." | The Gate line only | A non-empty Gate line without banned verbs | Yes, once resolved |
| `GATE_BANNED_VERB` | Gate line contains a banned verb | "That is a direction, not an artifact. 'Work on / think about / research…' cannot pass the Gate." | The Gate line only | A rewritten Gate line naming a verifiable noun | Yes, once resolved |
| `ELOQUENT_CONFESSION` (Day 1 archetype; each day aliases its trap) | Adjective/approximation where a measurement belongs | "That statement describes intensity, not position. Enter one amount, one obligation, or explicitly mark the value UNKNOWN/MISSING with a retrieval date." | The field in question | An exact value + source, or a lawful MISSING mark | Yes — MISSING with a date is lawful; `~` is not |
| `OPENING_DEBT_AMBIGUOUS` | Prior day neither sealed nor failure-lined | "Yesterday is unmeasured. Seal it or write the failure line. Vagueness does not unlock today." | Yesterday's seal/failure line only | Prior day reaching SEALED or FAILED_MEASURED | Today blocked until resolved |
| `SEAL_CHECKLIST_INCOMPLETE` | Seal attempted with unchecked evidence boxes | "An unchecked box is an unchecked box. The seal is mechanical." | The missing evidence items | The named missing artifacts, or the failure line instead | Seal refused; FAILED_MEASURED remains lawful |
| `MEMO_UNDER_FLOOR` | Voice memo shorter than 180s | "The floor is 3:00. The first clean stopping sentence is the halfway mark, not the end." | Re-record or extend | A memo ≥ 180s | Seal refused until met or day failure-lined |
| `PARAPHRASE_AS_QUOTE` | A mirror/side-by-side source without provenance or with normalization | "That is a summary, not your words. The record returns only verbatim, dated language." | The citation | A provenance-complete verbatim record | The station is void until resolved |
| `VERDICT_WITHOUT_CITATION` (Day 7) | A trial verdict with no exhibit reference | "A verdict without an exhibit is void. Cite the record or strike the verdict." | The verdict row | An exhibit citation | Court cannot complete until all verdicts cite |
| `ONE_DIRECTIONAL_VERDICTS` (Day 7) | All verdicts in one direction on first pass | "A court that returns all-PROVEN flattered the defendant; all-UNPROVEN flattered the excuses. Re-try with the trap in view." | All verdict rows | A re-tried sheet (may lawfully remain one-directional after re-trial — the re-trial, not the mix, is mandatory) | Yes, after re-trial |
| `ASPIRATION_AS_EVIDENCE` | Future-tense claim submitted in an evidence field | "Aspiration is not evidence, in any field, on any day. Enter what exists, or mark what is missing." | The field | A present-tense artifact reference | Per the field's seal requirement |

Refusals alter runtime authority (blocked day, refused seal, void station) — they are
state transitions, not tone. The runtime never fabricates a value to fill a refused
field and never accepts poetry as measurement.

### 2.4 Amendment law

Once a Genesis cohort begins, doctrine edits could invalidate longitudinal
comparison. Every participant session binds at covenant signing to:

```text
protocol_version            "genesis.v1"
day_definition_digest       SHA-256 of the canonical genesis-days.v1.json bytes
doctrine_registry_version   version of the D-001..D-003 + D-101..D-107 registry
runtime_contract_version    version of this document
```

- v1 evidence must never silently execute against v1.1 law. A session whose bound
  digest does not match the deployed contract must be either completed under its
  bound version (preferred) or explicitly migrated with a recorded migration event —
  never silently re-bound.
- The compiled JSON is therefore append-only in spirit: a changed day definition is a
  new `protocolVersion`, not an edit to `genesis.v1`.
- This is the doctrine-layer analogue of the realm's schema-versioning row
  (`REALM-ARCHITECTURE-DECOMPOSITION-v1.md` §2 row 10), and its implementation is
  deferred to the same place: a future persistence gate.

---

## 3. Runtime duties, restated as machine obligations

From spec §7, now addressable against §2.3's codes:

MUST: refuse `GATE_EMPTY`/`GATE_BANNED_VERB`; refuse `SEAL_CHECKLIST_INCOMPLETE`
mechanically; return mirror language under the §2.1 provenance law; present SELF
SAID / SELF DID without shame language; log tally timestamps and surface the
time-of-day pattern; accept a written failure line as lawful settlement
(`FAILED_MEASURED` is a terminal success state of measurement, not a defect); record
a falsified doctrine as a WIN.

MUST NEVER: score the truth of a reflection's content; soften a confrontation,
compliment, or complete a node's sentence; accept aspiration as evidence
(`ASPIRATION_AS_EVIDENCE`); upgrade its own evidence (a runtime-generated summary is
never a witness); infer a seal, feeling, verdict, or repair the node did not
explicitly submit.

These duties are the Genesis-layer restatement of the Realm's standing authority
rule: the runtime proposes and carries; it never authors the node's record.

---

## 4. Implementation gates (registered, not authorized)

Per the ruling that produced this contract, implementation proceeds only through
gates G-R01…G-R07 (doctrine compilation → Day 1 vertical slice → persistence &
provenance → refusal engine → phenomenological shell → three-node falsification →
Days 2–7). **This pass is G-R01 only.** Each subsequent gate requires its own
authorization token and its own review stop. The three-node falsification gate
(G-R06) is the contract's own honesty check: the instrument must distinguish
articulate evasion (Node B) from legitimate uncertainty (Node C) — a lawful
`MISSING — retrieval date` is never punished as evasion, or the instrument has become
coercive rather than exact.

Branch governance (`main` creation) remains a separate repository-governance pass,
exactly as ruled — it is not part of this contract and must not ride along with any
Genesis gate.

---

## 5. Validation

`genesis-contract.test.js` (this directory) validates the compiled JSON against this
contract: all 7 days present and complete, all 10 doctrines represented exactly once,
every named trap/gate/seal-failure/verbatim-source requirement present, exactly two
completion statements per day, `seal.canFail === true` everywhere, and zero orphaned
doctrine mechanics against the spec's §3 table. It runs standalone
(`node --test doctrine/genesis/runtime/genesis-contract.test.js`) and is deliberately
not wired into `npm test`, so the existing 32-test realm suite and this doctrine
validation report separately.
