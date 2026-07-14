"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const realm = require(path.join(__dirname, "..", "realm.js"));
const { validate, schemas, CLOSED_EVENT_TYPES, CALLBACK_STATUSES } = realm.__test__;

const activeDay = require(path.join(__dirname, "..", "fixtures", "active-day.json"));
const completedDay = require(path.join(__dirname, "..", "fixtures", "completed-day.json"));
const emptyState = require(path.join(__dirname, "..", "fixtures", "empty-state.json"));
const overview = require(path.join(__dirname, "..", "fixtures", "overview.json"));
const phaseSwitch = require(path.join(__dirname, "..", "fixtures", "phase-switch.json"));

test("bubble-input schema: all fixtures are valid", () => {
  for (const fixture of [activeDay, completedDay, emptyState, overview, phaseSwitch]) {
    assert.deepEqual(validate(schemas.bubbleInput, fixture), []);
  }
});

test("bubble-input schema: rejects unknown top-level properties", () => {
  const bad = Object.assign({}, activeDay, { unexpected_field: true });
  const errors = validate(schemas.bubbleInput, bad);
  assert.ok(errors.some((e) => e.includes("unexpected_field")));
});

test("bubble-input schema: rejects missing required fields", () => {
  const bad = Object.assign({}, activeDay);
  delete bad.revision;
  const errors = validate(schemas.bubbleInput, bad);
  assert.ok(errors.some((e) => e.includes("revision")));
});

test("bubble-input schema: rejects invalid realm_id enum value", () => {
  const bad = Object.assign({}, activeDay, { realm_id: "not-a-real-page" });
  const errors = validate(schemas.bubbleInput, bad);
  assert.ok(errors.length > 0);
});

test("realm-event schema: valid event passes", () => {
  const event = {
    schema_version: "1.0.0",
    event_id: "evt-reflect-123",
    event_type: "journey.reflection.save_requested",
    realm_id: "today",
    occurred_at: "2026-07-14T12:00:00Z",
    source_revision: 12,
    actor: { user_id: "user-abc", interaction_type: "human" },
    target: { journey_id: "j-001", day_id: "day-018" },
    payload: { reflection_text: "I observed X, learned Y." },
    context: { screen: "today" },
    evidence: { capture_mode: "direct_human_interaction" }
  };
  assert.deepEqual(validate(schemas.realmEvent, event), []);
});

test("realm-event schema: rejects event_type outside the closed vocabulary", () => {
  const event = {
    schema_version: "1.0.0",
    event_id: "evt-x",
    event_type: "journey.reflection.delete_everything",
    realm_id: "today",
    occurred_at: "2026-07-14T12:00:00Z",
    source_revision: 1,
    actor: { user_id: "user-abc", interaction_type: "human" },
    target: {},
    payload: {}
  };
  const errors = validate(schemas.realmEvent, event);
  assert.ok(errors.length > 0);
  assert.ok(CLOSED_EVENT_TYPES.indexOf(event.event_type) === -1);
});

test("bubble-callback schema: valid accepted callback passes", () => {
  const callback = {
    schema_version: "1.0.0",
    callback_id: "uuid-cb-789",
    event_id: "evt-reflect-123",
    event_type: "journey.reflection.save_requested",
    status: "accepted",
    processed_at: "2026-07-14T12:00:01Z",
    new_revision: 13,
    result: { saved: true },
    canonical_patch: { "day.reflection.existing_text": "I observed X, learned Y." },
    errors: [],
    evidence: { server_timestamp: "2026-07-14T12:00:01Z" }
  };
  assert.deepEqual(validate(schemas.bubbleCallback, callback), []);
});

test("bubble-callback schema: rejects unknown status", () => {
  const callback = {
    schema_version: "1.0.0",
    callback_id: "uuid-cb-1",
    event_id: "evt-1",
    event_type: "journey.reflection.save_requested",
    status: "totally_fine_i_promise",
    processed_at: "2026-07-14T12:00:01Z",
    new_revision: 13
  };
  const errors = validate(schemas.bubbleCallback, callback);
  assert.ok(errors.length > 0);
  assert.ok(CALLBACK_STATUSES.indexOf(callback.status) === -1);
});
