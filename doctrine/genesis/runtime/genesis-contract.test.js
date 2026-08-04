"use strict";

// Validates genesis-days.v1.json against GENESIS-RUNTIME-CONTRACT-v1.md.
// Runs standalone: node --test doctrine/genesis/runtime/
// Deliberately not wired into `npm test` — the realm suite and this doctrine
// validation report separately.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const contract = require(path.join(__dirname, "genesis-days.v1.json"));
const days = contract.days;

// The spec's §3 table, restated as the expected compilation targets. If a day
// document changes, this table and the compiled JSON must change together.
const EXPECTED = [
  { n: 1, doctrine: "D-101", trap: "THE ELOQUENT CONFESSION", tally: "approximation", removes: "Vagueness", sealLaw: "I cannot command a reality I refuse to measure." },
  { n: 2, doctrine: "D-102", trap: "THE MISSING ROW", tally: "virtue-word", removes: "Unauthorized access", sealLaw: "Access to SELF is not inherited. It is governed." },
  { n: 3, doctrine: "D-103", trap: "THE HUMBLE DISCOUNT", tally: "discount", removes: "False incapacity", sealLaw: "Potential is capacity without witness. My capacity now has evidence." },
  { n: 4, doctrine: "D-104", trap: "THE SHAME PAYMENT", tally: "shame-hit", removes: "Constitutional hypocrisy", sealLaw: "A law I repeatedly violate is not yet law." },
  { n: 5, doctrine: "D-105", trap: "THE BEAUTIFUL TREASURY", tally: "later", removes: "Resource drift", sealLaw: "What I do not allocate will be allocated by pressure." },
  { n: 6, doctrine: "D-106", trap: "THE PRIVATE MUTATION", tally: "worthiness", removes: "Purely internal change", sealLaw: "Reality does not record intention. It records state change." },
  { n: 7, doctrine: "D-107", trap: "THE CLEAN STORY", tally: "story", removes: "Unsupported identity", sealLaw: "SELF HAS ENTERED THE RECORD." }
];

test("all 7 days are represented, in order, under genesis.v1", () => {
  assert.equal(contract.protocolVersion, "genesis.v1");
  assert.equal(days.length, 7);
  days.forEach((d, i) => {
    assert.equal(d.dayNumber, i + 1);
    assert.equal(d.protocolVersion, "genesis.v1");
    assert.ok(d.slug && d.title && d.removes && d.requiredOutput);
  });
  assert.equal(new Set(days.map((d) => d.slug)).size, 7);
});

test("all 7 day-doctrines represented exactly once, each falsifiable, falsification is a WIN", () => {
  const ids = days.map((d) => d.doctrine.doctrineId);
  assert.deepEqual(ids, EXPECTED.map((e) => e.doctrine));
  days.forEach((d) => {
    assert.ok(d.doctrine.proposition.length > 0);
    assert.ok(d.doctrine.falsificationRule.length > 0, `${d.slug}: falsification rule missing`);
    assert.equal(d.doctrine.falsificationIsWin, true);
  });
});

test("all 3 carried doctrines (D-001..D-003) are registered at protocol level", () => {
  const ids = contract.carriedDoctrines.map((c) => c.doctrineId);
  assert.deepEqual(ids, ["D-001", "D-002", "D-003"]);
  contract.carriedDoctrines.forEach((c) => assert.ok(c.proposition && c.instrument));
});

test("all named traps represented, read-once, with signals and a runtime response", () => {
  days.forEach((d, i) => {
    assert.equal(d.trap.name, EXPECTED[i].trap);
    assert.equal(d.trap.readOncePolicy, true);
    assert.ok(Array.isArray(d.trap.detectionSignals) && d.trap.detectionSignals.length > 0);
    assert.ok(d.trap.runtimeResponse.length > 0);
  });
  // Second heads named in the day documents must survive compilation.
  for (const n of [2, 3, 4, 6]) {
    assert.ok(days[n - 1].trap.secondHead, `day ${n}: second head of the trap lost in compilation`);
  }
});

test("all completion gates represented: DoD, exactly two completion statements, failure conditions", () => {
  days.forEach((d) => {
    assert.ok(d.gate.definitionOfDone.length > 0, `${d.slug}: empty Definition of Done`);
    assert.equal(d.gate.completionStatements.length, 2, `${d.slug}: completion statements must be exactly two — no third option`);
    assert.ok(d.gate.failureConditions.length > 0);
  });
  assert.equal(days[6].gate.gateForm, "docket");
  assert.ok(days[6].gate.docketExhibits.length >= 10);
});

test("gate law: banned verbs registered and absent from every gate prompt", () => {
  const banned = contract.sharedLaw.bannedGateVerbs;
  assert.ok(banned.includes("work on") && banned.includes("research") && banned.includes("figure out"));
  days.forEach((d) => {
    const prompt = d.gate.prompt.toLowerCase();
    banned.forEach((verb) => assert.ok(!prompt.includes(verb), `${d.slug}: banned verb "${verb}" in gate prompt`));
  });
});

test("all seal failures represented: every day can fail, with an honest failure line and a seal law", () => {
  assert.equal(contract.sharedLaw.sealCanFailEveryDay, true);
  days.forEach((d, i) => {
    assert.equal(d.seal.canFail, true, `${d.slug}: the seal must be able to fail`);
    assert.ok(d.seal.failureMessage.length > 0, `${d.slug}: no honest failure line`);
    assert.ok(d.seal.requirements.length > 0);
    assert.equal(d.seal.sealLaw, EXPECTED[i].sealLaw);
    assert.ok(d.seal.discomfortThresholdNote.includes("under 7"), `${d.slug}: discomfort threshold note missing`);
  });
});

test("failure law: two terminal states, one unrecoverable state with a recovery path", () => {
  assert.deepEqual(contract.sharedLaw.terminalDayStates, ["SEALED", "FAILED_MEASURED"]);
  assert.equal(contract.sharedLaw.unrecoverableState.name, "NARRATED_UNMEASURED");
  assert.ok(contract.sharedLaw.unrecoverableState.recovery.length > 0);
  assert.equal(days[6].weekLedger.narratedUnmeasuredPassingValue, 0);
});

test("all verbatim-source requirements represented: mirror policy is verbatim on every day", () => {
  days.forEach((d) => {
    assert.equal(d.mirror.sourcePolicy, "verbatim_user_language", `${d.slug}: mirror must return verbatim language`);
    assert.ok(d.mirror.question.length > 0);
    assert.ok(Array.isArray(d.mirror.sourceFields) && d.mirror.sourceFields.length > 0);
  });
});

test("tallies: named lie per day, timestamps required, reasons forbidden", () => {
  days.forEach((d, i) => {
    assert.equal(d.tally.label, EXPECTED[i].tally);
    assert.equal(d.tally.timestampRequired, true);
    assert.equal(d.tally.reasonFieldForbidden, true);
    assert.ok(d.tally.eventType.startsWith("genesis.tally."));
  });
  assert.equal(new Set(days.map((d) => d.tally.eventType)).size, 7);
});

test("opening debt chain: covenant before day 1, then strictly sequential", () => {
  assert.equal(days[0].openingDebt.requiredPriorDay, null);
  assert.ok(days[0].openingDebt.resolutionRequirement.toLowerCase().includes("covenant"));
  assert.equal(contract.covenant.requiredBeforeDay, 1);
  assert.equal(contract.covenant.clauseCount, 10);
  for (let n = 2; n <= 7; n++) {
    assert.equal(days[n - 1].openingDebt.requiredPriorDay, n - 1, `day ${n}: opening debt must point at day ${n - 1}`);
  }
});

test("evening memo: 3:00 hard floor and a required stem on every day", () => {
  assert.equal(contract.sharedLaw.eveningMemo.minimumSeconds, 180);
  days.forEach((d) => {
    assert.equal(d.eveningMemo.minimumSeconds, 180);
    assert.ok(d.eveningMemo.requiredStems.length > 0 && d.eveningMemo.requiredStems[0].length > 0);
  });
});

test("narrative check and stations present on every day; day-specific clocks compiled", () => {
  days.forEach((d) => {
    assert.ok(d.narrativeCheck.questions.length >= 2);
    assert.ok(d.narrativeCheck.refusalRule.length > 0);
    assert.ok(d.stations.length >= 3, `${d.slug}: stations lost in compilation`);
    assert.ok(d.materialAction.name && d.materialAction.requirement);
  });
  assert.equal(days[3].repairClock.windowHours, 24);
  assert.equal(days[3].repairClock.dueTimestampImmutable, true);
  assert.equal(days[5].deadline.boundary, "midnight_local");
  assert.deepEqual(days[6].verdictVocabulary, ["PROVEN", "PARTIALLY_PROVEN", "UNPROVEN"]);
});

test("zero orphaned doctrine mechanics: spec table fields all land in the compilation", () => {
  days.forEach((d, i) => {
    assert.equal(d.removes, EXPECTED[i].removes, `${d.slug}: 'removes' drifted from the spec table`);
  });
  // Day-1-only mechanics that must not vanish.
  assert.ok(days[0].surrenderedPhrases.length === 6, "day 1: surrendered phrases lost");
  // No compiled event name may leak into implemented vocabulary by accident:
  // this file only checks names; schemas are untouched by design.
  assert.equal(contract.sharedLaw.completionStatementCount, 2);
  assert.equal(contract.sharedLaw.tallyTimestampsMandatory, true);
  assert.equal(contract.sharedLaw.stationAbandonmentColumn, "feeling_not_reason");
});
