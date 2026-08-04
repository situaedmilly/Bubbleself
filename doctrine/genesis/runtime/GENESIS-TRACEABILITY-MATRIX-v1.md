# GENESIS Doctrine → Runtime Traceability Matrix (v1)

Companion to `GENESIS-RUNTIME-CONTRACT-v1.md`. Every doctrine mechanic maps to a
compiled location in `genesis-days.v1.json`; every compiled field traces back to a
doctrine source. An entry in either column with no partner is an orphan and fails
`genesis-contract.test.js`. Doctrine sources cite the documents at commit `c7ae230`.

## 1. Shared instrumentation (spec §4) → compiled `sharedLaw` / per-day fields

| # | Spec §4 mechanic | Compiled location | Also enforced per-day at |
|---|---|---|---|
| 1 | THE GATE (one line, banned verbs, DoD, two-option completion) | `sharedLaw.bannedGateVerbs`, `sharedLaw.completionStatementCount` | `days[*].gate.{prompt,definitionOfDone,completionStatements,failureConditions}` |
| 2 | THE TRAP (read once, named in advance, D-002 first form) | `sharedLaw.protocolDocumentEditPolicy` | `days[*].trap.{name,definition,detectionSignals,runtimeResponse,readOncePolicy}` |
| 3 | OPENING DEBT (settle yesterday; ambiguity blocks) | — (inherently per-day) | `days[*].openingDebt.{requiredPriorDay,resolutionRequirement}`; refusal `OPENING_DEBT_AMBIGUOUS` |
| 4 | MORNING COMMAND (before phone, read aloud, no day-of edits) | `sharedLaw.morningCommandEditPolicy` | Command text remains in the day documents (doctrine-owned prose; the contract governs its edit policy, not its wording) |
| 5 | STATIONS (log at contact; feeling-not-reason) | `sharedLaw.stationAbandonmentColumn` | `days[*].stations[]` |
| 6 | MIDDAY TALLIES (leak + named lie, timestamps mandatory) | `sharedLaw.tallyTimestampsMandatory` | `days[*].tally.{eventType,label,timestampRequired,reasonFieldForbidden,countsAs}` |
| 7 | THE MIRROR QUESTION (verbatim, dated, no paraphrase) | Provenance law: contract §2.1 | `days[*].mirror.{sourcePolicy,question,sourceFields}`; refusal `PARAPHRASE_AS_QUOTE` |
| 8 | THE MATERIAL ACTION (matter changes or no seal) | — (inherently per-day) | `days[*].materialAction` |
| 9 | EVENING CONFRONTATION (3:00 floor, halfway-mark law, listen once) | `sharedLaw.eveningMemo` | `days[*].eveningMemo`; refusal `MEMO_UNDER_FLOOR` |
| 10 | NARRATIVE COMPLETION CHECK (win-feeling + hour) | carried doctrine `D-001` | `days[*].narrativeCheck` |
| 11 | DOCTRINE VERDICT (falsification pre-written; falsified = WIN) | `days[*].doctrine.{falsificationRule,falsificationIsWin}` | Verdict prose remains in day documents |
| 12 | THE SEAL (checklist, discomfort, can fail, honest line) | `sharedLaw.{discomfortScale,sealCanFailEveryDay}` | `days[*].seal.{canFail,requirements,discomfortThresholdNote,failureMessage,sealLaw}`; refusal `SEAL_CHECKLIST_INCOMPLETE` |

## 2. Failure law (spec §6) → compiled

| Spec §6 mechanic | Compiled location |
|---|---|
| Two lawful terminal states | `sharedLaw.terminalDayStates = ["SEALED","FAILED_MEASURED"]` |
| Failed day unlocks the next day | `days[*].openingDebt.resolutionRequirement` ("sealed **or** failure line written") |
| No streak reset; sealed and failed side by side | `sharedLaw.streakLaw` |
| The one unrecoverable state + its recovery | `sharedLaw.unrecoverableState` (`NARRATED_UNMEASURED`, late-write recovery); Day 7 `weekLedger.narratedUnmeasuredPassingValue = 0` |

## 3. Runtime duties (spec §7) → refusal law (contract §2.3)

| Spec §7 duty | Refusal code / contract clause |
|---|---|
| Refuse empty/banned-verb Gate | `GATE_EMPTY`, `GATE_BANNED_VERB` |
| Refuse incomplete seal checklist mechanically | `SEAL_CHECKLIST_INCOMPLETE` |
| Verbatim, dated mirror returns | Provenance law §2.1; `PARAPHRASE_AS_QUOTE` |
| SELF SAID / SELF DID without shame language | Contract §3 MUST list; Day 4 station d4-s3 law |
| Log tally timestamps, surface pattern | `sharedLaw.tallyTimestampsMandatory`; time law §2.2 |
| Accept written failure line as settlement | `FAILED_MEASURED` terminal state; every `seal.failureMessage` |
| Record falsified doctrine as WIN | `days[*].doctrine.falsificationIsWin = true` |
| Never score content / soften / complete sentences | Contract §3 MUST NEVER list |
| Never accept aspiration as evidence | `ASPIRATION_AS_EVIDENCE` |
| Never upgrade own evidence; never infer submissions | Contract §3 MUST NEVER list |

## 4. Per-day mechanics (spec §3 table + day documents) → compiled `days[n]`

| Day | Removes | Required output | Doctrine | Trap (third eye) | Named-lie tally | Seal law | All compiled at |
|---|---|---|---|---|---|---|---|
| 1 | Vagueness | Reality Position Sheet | D-101 Vagueness as Shelter | The Eloquent Confession | approximation | "I cannot command a reality I refuse to measure." | `days[0]` |
| 2 | Unauthorized access | Extraction Graph | D-102 Avoided Revocation | The Missing Row (+ moral accounting) | virtue-word | "Access to SELF is not inherited. It is governed." | `days[1]` |
| 3 | False incapacity | Force Ledger | D-103 Discounted Capacity | The Humble Discount (+ Inflated Ledger) | discount | "Potential is capacity without witness. My capacity now has evidence." | `days[2]` |
| 4 | Constitutional hypocrisy | Betrayal Record | D-104 Shame Settlement | The Shame Payment (+ Confession Loop) | shame-hit | "A law I repeatedly violate is not yet law." | `days[3]` |
| 5 | Resource drift | Treasury & Authority Map | D-105 Allocation Drift | The Beautiful Treasury | later | "What I do not allocate will be allocated by pressure." | `days[4]` |
| 6 | Purely internal change | Mutation Packet | D-106 Reversibility Preference | The Private Mutation (+ Worthiness Delay) | worthiness | "Reality does not record intention. It records state change." | `days[5]` |
| 7 | Unsupported identity | Genesis Verdict · Law · Mission · Witness | D-107 Narrative Sentencing | The Clean Story | story | "SELF HAS ENTERED THE RECORD." | `days[6]` |

Day-specific mechanics with no shared-law home, and where they compiled:

| Mechanic | Doctrine source | Compiled location |
|---|---|---|
| Covenant precondition (10 clauses, no signature no Day 1) | Spec §8; Day 1 entry condition | `covenant`; `days[0].openingDebt` |
| Surrendered phrases (Day 1) | DAY-1 §"SURRENDERED PHRASES" | `days[0].surrenderedPhrases` |
| Sheet fill-order logging; MISSING-with-date lawful, `~` unlawful | DAY-1 Station 2 | `days[0].stations[1].law` |
| Absence audit (mandatory; sworn if none) | DAY-2 Station 2 | `days[1].stations[1].law` |
| "Not the largest extraction — the one that proves the keys work" | DAY-2 Station 3 | `days[1].stations[2].law` |
| WITNESSED/UNWITNESSED column, no silent middle | DAY-3 Station 1 | `days[2].stations[0].law` |
| 24-hour repair clock, immutable due timestamp | DAY-4 Gate + Station 4 | `days[3].repairClock`; time law §2.2 |
| Shame-hit : repair-move ratio as the day's finding | DAY-4 tallies | `days[3].tally.countsAs` |
| UNSPLIT as lawful signed measurement | DAY-5 Station 2 | `days[4].stations[1].law` |
| First-pressure-held/folded logging | DAY-5 Station 3 | `days[4].stations[2].law` |
| Pre-declared evidence standard; rollback cost > 0 | DAY-6 Station 2 | `days[5].stations[1].law` |
| Midnight deadline | DAY-6 Gate/DoD | `days[5].deadline`; time law §2.2 |
| Docket-as-Gate; court tries declarations, not days | DAY-7 Gate | `days[6].gate.{gateForm,docketExhibits}` |
| PROVEN / PARTIALLY_PROVEN / UNPROVEN with citations | DAY-7 Station 2 | `days[6].verdictVocabulary`, `days[6].verdictLaw`; refusals `VERDICT_WITHOUT_CITATION`, `ONE_DIRECTIONAL_VERDICTS` |
| Mission built from PARTIALLY PROVEN rows, nine numbered fields | DAY-7 Station 5 | `days[6].stations[4].law`, `days[6].gate.definitionOfDone` |
| Node witness, flattery voids (covenant clause 9) | DAY-7 Station 6 | `days[6].stations[5].law` |
| Week ledger: narrated-unmeasured passing value 0 | DAY-7 Seal | `days[6].weekLedger` |

## 5. Deliberately NOT compiled (and why that is not an orphan)

- **Morning command wording, station interrogation prompts, day-document prose** —
  doctrine-owned voice. The contract governs their edit policy and structural laws,
  not their words; a runtime renders them from the day documents (or a future
  verbatim ingest), it does not re-author them.
- **Record shapes (spec §11)** — remain PROPOSED, deferred to the persistence gate
  (G-R03) and ultimately the schema gate; compiling them into the day contract now
  would smuggle schema through doctrine, which the ruling explicitly prohibits.
- **The Genesis Field (spec §9), exit condition (§12), audience definition (§2)** —
  cohort-layer and narrative-layer material with no per-day runtime obligation; they
  bind later gates (field rendering, orientation handoff), not the day contract.
- **`genesis.tally.*` / verdict vocabularies** — present in the compiled JSON as
  PROPOSED names only; not added to `CLOSED_EVENT_TYPES` or any schema, per scope.
