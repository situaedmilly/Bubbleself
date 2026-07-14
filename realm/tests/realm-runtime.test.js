"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const realm = require(path.join(__dirname, "..", "realm.js"));

const activeDayFixture = require(path.join(__dirname, "..", "fixtures", "active-day.json"));
const completedDayFixture = require(path.join(__dirname, "..", "fixtures", "completed-day.json"));
const emptyStateFixture = require(path.join(__dirname, "..", "fixtures", "empty-state.json"));
const overviewFixture = require(path.join(__dirname, "..", "fixtures", "overview.json"));
const phaseSwitchFixture = require(path.join(__dirname, "..", "fixtures", "phase-switch.json"));

function freshFixture(fixture) {
  return JSON.parse(JSON.stringify(fixture));
}

let sentEvents;

test.beforeEach(() => {
  try {
    realm.destroy();
  } catch (e) {
    /* not mounted yet: fine */
  }
  sentEvents = [];
  global.bubble_fn_realm_event = (json) => sentEvents.push(JSON.parse(json));
});

test.afterEach(() => {
  delete global.bubble_fn_realm_event;
});

test("API shape: window.UMI_SOLAN exposes exactly the five core methods", () => {
  const publicKeys = Object.keys(realm).filter((k) => k !== "__test__").sort();
  assert.deepEqual(publicKeys, ["destroy", "getState", "mount", "receiveCallback", "update"]);
});

test("mount: active-day.json renders an editable reflection state", () => {
  realm.mount("realm-root", freshFixture(activeDayFixture));
  const state = realm.getState();
  assert.equal(state.mounted, true);
  assert.equal(state.view.reflectionDraft, "");
  assert.equal(state.canonical.permissions.can_edit_reflection, true);
});

test("mount: completed-day.json derives a flagged/read-only-eligible state", () => {
  realm.mount("realm-root", freshFixture(completedDayFixture));
  const state = realm.getState();
  assert.equal(state.canonical.permissions.can_edit_reflection, false);
  assert.equal(state.view.reflectionDraft, "I observed X, learned Y.");
});

test("mount: empty-state.json mounts without a day payload", () => {
  realm.mount("realm-root", freshFixture(emptyStateFixture));
  const state = realm.getState();
  assert.equal(state.mounted, true);
  assert.equal(state.canonical.day, undefined);
});

test("mount: malformed payload (missing required field) throws and does not mount", () => {
  const bad = freshFixture(activeDayFixture);
  delete bad.revision;
  assert.throws(() => realm.mount("realm-root", bad));
  assert.equal(realm.getState().mounted, false);
});

test("mount: missing containerId throws", () => {
  assert.throws(() => realm.mount("", freshFixture(activeDayFixture)));
  assert.throws(() => realm.mount(undefined, freshFixture(activeDayFixture)));
});

test("mount: does not mutate the fixture object passed in", () => {
  const fixture = freshFixture(activeDayFixture);
  const snapshot = JSON.stringify(fixture);
  realm.mount("realm-root", fixture);
  realm.__test__.triggerSaveReflection("changed locally");
  assert.equal(JSON.stringify(fixture), snapshot);
});

test("update: higher revision is accepted and rerenders canonical state", () => {
  realm.mount("realm-root", freshFixture(activeDayFixture));
  const result = realm.update(freshFixture(phaseSwitchFixture));
  assert.equal(result.ok, true);
  assert.equal(realm.getState().canonical.revision, phaseSwitchFixture.revision);
});

test("update: lower revision is rejected and canonical state is unchanged", () => {
  realm.mount("realm-root", freshFixture(activeDayFixture));
  const stale = freshFixture(activeDayFixture);
  stale.revision = activeDayFixture.revision - 1;
  const result = realm.update(stale);
  assert.equal(result.ok, false);
  assert.equal(realm.getState().canonical.revision, activeDayFixture.revision);
});

test("update: does not mutate the input payload object", () => {
  realm.mount("realm-root", freshFixture(activeDayFixture));
  const next = freshFixture(phaseSwitchFixture);
  const snapshot = JSON.stringify(next);
  realm.update(next);
  assert.equal(JSON.stringify(next), snapshot);
});

test("Save Reflection: emits a closed-vocabulary event with correct envelope fields", () => {
  realm.mount("realm-root", freshFixture(activeDayFixture));
  realm.__test__.triggerSaveReflection("I observed X, learned Y.");

  assert.equal(sentEvents.length, 1);
  const event = sentEvents[0];
  assert.equal(event.event_type, "journey.reflection.save_requested");
  assert.equal(event.source_revision, activeDayFixture.revision);
  assert.equal(event.target.day_id, activeDayFixture.day.day_id);
  assert.equal(event.payload.reflection_text, "I observed X, learned Y.");
  assert.equal(realm.getState().view.saving, true);
});

test("Save Reflection: refuses to emit when can_edit_reflection is false", () => {
  realm.mount("realm-root", freshFixture(completedDayFixture));
  realm.__test__.triggerSaveReflection("should not be sent");
  assert.equal(sentEvents.length, 0);
  assert.ok(realm.getState().errors.some((e) => e.code === "NO_EDIT_PERMISSION"));
});

test("Save Reflection: accepted callback applies canonical_patch and clears saving state", () => {
  realm.mount("realm-root", freshFixture(activeDayFixture));
  const eventId = realm.__test__.triggerSaveReflection("I observed X, learned Y.");

  realm.receiveCallback({
    schema_version: "1.0.0",
    callback_id: "cb-1",
    event_id: eventId,
    event_type: "journey.reflection.save_requested",
    status: "accepted",
    processed_at: "2026-07-14T12:00:01Z",
    new_revision: activeDayFixture.revision + 1,
    canonical_patch: { "day.reflection.existing_text": "I observed X, learned Y." },
    errors: []
  });

  const state = realm.getState();
  assert.equal(state.canonical.day.reflection.existing_text, "I observed X, learned Y.");
  assert.equal(state.canonical.revision, activeDayFixture.revision + 1);
  assert.equal(state.view.saving, false);
  assert.deepEqual(state.pending, {});
});

test("Save Reflection: rejected callback leaves canonical state untouched", () => {
  realm.mount("realm-root", freshFixture(activeDayFixture));
  const eventId = realm.__test__.triggerSaveReflection("draft text");

  realm.receiveCallback({
    schema_version: "1.0.0",
    callback_id: "cb-2",
    event_id: eventId,
    event_type: "journey.reflection.save_requested",
    status: "rejected",
    processed_at: "2026-07-14T12:00:01Z",
    new_revision: activeDayFixture.revision,
    errors: [{ code: "NO_EDIT_PERMISSION", message: "Cannot edit reflection now." }]
  });

  const state = realm.getState();
  assert.equal(state.canonical.day.reflection.existing_text, "");
  assert.equal(state.view.saving, false);
  assert.ok(state.errors.some((e) => e.code === "NO_EDIT_PERMISSION"));
});

test("receiveCallback: unknown event_id is ignored", () => {
  realm.mount("realm-root", freshFixture(activeDayFixture));
  assert.doesNotThrow(() =>
    realm.receiveCallback({
      schema_version: "1.0.0",
      callback_id: "cb-3",
      event_id: "evt-does-not-exist",
      event_type: "journey.reflection.save_requested",
      status: "accepted",
      processed_at: "2026-07-14T12:00:01Z",
      new_revision: 999
    })
  );
  assert.equal(realm.getState().canonical.revision, activeDayFixture.revision);
});

test("Seal Day: refuses to emit when can_seal_day is false", () => {
  realm.mount("realm-root", freshFixture(activeDayFixture)); // can_seal_day: false
  realm.__test__.triggerSealDay();
  assert.equal(sentEvents.length, 0);
  assert.ok(realm.getState().errors.some((e) => e.code === "SEAL_NOT_ALLOWED"));
});

test("Seal Day: accepted callback transitions canonical state to completed", () => {
  const fixture = freshFixture(activeDayFixture);
  fixture.permissions.can_seal_day = true;
  realm.mount("realm-root", fixture);
  const eventId = realm.__test__.triggerSealDay();

  realm.receiveCallback({
    schema_version: "1.0.0",
    callback_id: "cb-4",
    event_id: eventId,
    event_type: "journey.day.seal_requested",
    status: "accepted",
    processed_at: "2026-07-14T12:05:01Z",
    new_revision: fixture.revision + 1,
    canonical_patch: {
      "day.status": "completed",
      "day.sealed_at": "2026-07-14T12:05:00Z",
      "permissions.can_seal_day": false
    },
    result: { sealed: true },
    errors: []
  });

  const state = realm.getState();
  assert.equal(state.canonical.day.status, "completed");
  assert.equal(state.canonical.permissions.can_seal_day, false);
  assert.equal(state.view.sealing, false);
});

test("Phase Selection: accepted callback with next_bubble_input re-mounts the new payload via update()", () => {
  realm.mount("realm-root", freshFixture(activeDayFixture));
  const eventId = realm.__test__.triggerNavigatePhase("phase-02");

  realm.receiveCallback({
    schema_version: "1.0.0",
    callback_id: "cb-5",
    event_id: eventId,
    event_type: "realm.navigate_requested",
    status: "accepted",
    processed_at: "2026-07-14T12:05:01Z",
    new_revision: phaseSwitchFixture.revision,
    result: { next_bubble_input: freshFixture(phaseSwitchFixture) },
    errors: []
  });

  const state = realm.getState();
  assert.equal(state.canonical.journey.phase_id, "phase-02");
  assert.equal(state.canonical.day.day_id, "day-019");
});

test("Toggle Completed: purely local UI toggle, emits no event", () => {
  realm.mount("realm-root", freshFixture(overviewFixture));
  realm.__test__.triggerToggleCompleted();
  assert.equal(sentEvents.length, 0);
  assert.equal(realm.getState().view.showCompleted, true);
});

test("Mark Important: optimistic flag is set immediately and reverted on rejection", () => {
  realm.mount("realm-root", freshFixture(completedDayFixture));
  const eventId = realm.__test__.triggerFlagImportant(completedDayFixture.day.day_id);
  assert.equal(realm.getState().view.flagged[completedDayFixture.day.day_id], true);

  realm.receiveCallback({
    schema_version: "1.0.0",
    callback_id: "cb-6",
    event_id: eventId,
    event_type: "journey.reflection.flag_requested",
    status: "rejected",
    processed_at: "2026-07-14T12:05:01Z",
    new_revision: completedDayFixture.revision,
    errors: [{ code: "FLAG_NOT_ALLOWED", message: "Cannot flag." }]
  });

  assert.equal(realm.getState().view.flagged[completedDayFixture.day.day_id], false);
});

test("emitEvent: closed vocabulary excludes ad-hoc event types", () => {
  assert.ok(realm.__test__.CLOSED_EVENT_TYPES.indexOf("journey.reflection.delete_everything") === -1);
  assert.deepEqual(realm.__test__.CLOSED_EVENT_TYPES, [
    "journey.reflection.save_requested",
    "journey.day.seal_requested",
    "journey.reflection.flag_requested",
    "realm.navigate_requested",
    "journey.section.viewed"
  ]);
});

test("emitEvent: throws (no silent failure) when bubble_fn_realm_event is not defined", () => {
  delete global.bubble_fn_realm_event;
  realm.mount("realm-root", freshFixture(activeDayFixture));
  assert.throws(() => realm.__test__.triggerSaveReflection("no sender registered"));
});

test("destroy: resets state so a subsequent mount starts clean", () => {
  realm.mount("realm-root", freshFixture(activeDayFixture));
  realm.__test__.triggerSaveReflection("in progress");
  realm.destroy();

  const state = realm.getState();
  assert.equal(state.mounted, false);
  assert.equal(state.canonical, null);
  assert.deepEqual(state.pending, {});

  realm.mount("realm-root", freshFixture(completedDayFixture));
  assert.equal(realm.getState().mounted, true);
});

test("getState: returns a detached deep copy", () => {
  realm.mount("realm-root", freshFixture(activeDayFixture));
  const state = realm.getState();
  state.canonical.revision = 999999;
  state.view.reflectionDraft = "mutated externally";
  const freshState = realm.getState();
  assert.equal(freshState.canonical.revision, activeDayFixture.revision);
  assert.equal(freshState.view.reflectionDraft, "");
});
