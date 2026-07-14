/**
 * SELF JOURNEY realm runtime.
 *
 * Contract:
 *  - The realm never mutates canonical state on its own initiative. It only emits
 *    closed-vocabulary events via `bubble_fn_realm_event`; canonical state changes
 *    only after an `accepted` callback is delivered via `receiveCallback`.
 *  - No network/storage/eval APIs are used here (see static-safety scan in CI).
 */
(function (root) {
  "use strict";

  var SCHEMA_VERSION = "1.0.0";

  var CLOSED_EVENT_TYPES = [
    "journey.reflection.save_requested",
    "journey.day.seal_requested",
    "journey.reflection.flag_requested",
    "realm.navigate_requested",
    "journey.section.viewed"
  ];

  var CALLBACK_STATUSES = [
    "accepted",
    "rejected",
    "invalid",
    "stale_revision",
    "conflict",
    "server_error"
  ];

  // ---------------------------------------------------------------------
  // Minimal JSON-schema validator (subset: type, enum, required, properties,
  // additionalProperties:false, items). No external dependency.
  // ---------------------------------------------------------------------
  function typeMatches(type, value) {
    if (value === null) return type === "null";
    switch (type) {
      case "object":
        return typeof value === "object" && !Array.isArray(value) && value !== null;
      case "array":
        return Array.isArray(value);
      case "string":
        return typeof value === "string";
      case "number":
        return typeof value === "number";
      case "integer":
        return typeof value === "number" && Number.isInteger(value);
      case "boolean":
        return typeof value === "boolean";
      default:
        return true;
    }
  }

  function validate(schema, data, path) {
    path = path || "$";
    var errors = [];
    if (!schema) return errors;

    var types = Array.isArray(schema.type) ? schema.type : (schema.type ? [schema.type] : null);
    if (types && !types.some(function (t) { return typeMatches(t, data); })) {
      errors.push(path + ": expected type " + types.join("|") + " but got " + JSON.stringify(data));
      return errors;
    }

    if (schema.enum && schema.enum.indexOf(data) === -1) {
      errors.push(path + ": value " + JSON.stringify(data) + " not in enum " + JSON.stringify(schema.enum));
    }

    if (types && types.indexOf("object") !== -1 && data && typeof data === "object" && !Array.isArray(data)) {
      var props = schema.properties || {};
      (schema.required || []).forEach(function (key) {
        if (!(key in data)) errors.push(path + "." + key + ": missing required field");
      });
      if (schema.additionalProperties === false) {
        Object.keys(data).forEach(function (key) {
          if (!(key in props)) errors.push(path + "." + key + ": unexpected additional property");
        });
      }
      Object.keys(props).forEach(function (key) {
        if (key in data) {
          errors = errors.concat(validate(props[key], data[key], path + "." + key));
        }
      });
    }

    if (types && types.indexOf("array") !== -1 && Array.isArray(data) && schema.items) {
      data.forEach(function (item, i) {
        errors = errors.concat(validate(schema.items, item, path + "[" + i + "]"));
      });
    }

    return errors;
  }

  var BUBBLE_INPUT_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["schema_version", "realm_id", "payload_id", "generated_at", "permissions", "revision"],
    properties: {
      schema_version: { type: "string" },
      realm_id: { type: "string", enum: ["today", "overview", "reflection"] },
      payload_id: { type: "string" },
      generated_at: { type: "string" },
      user: {
        type: "object",
        additionalProperties: false,
        required: ["user_id"],
        properties: { user_id: { type: "string" } }
      },
      journey: {
        type: "object",
        additionalProperties: false,
        properties: {
          journey_id: { type: "string" },
          phase_id: { type: "string" },
          phase_title: { type: "string" },
          day_index: { type: "integer" },
          total_days: { type: "integer" },
          progress_percent: { type: "number" },
          phases: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["phase_id", "phase_title"],
              properties: { phase_id: { type: "string" }, phase_title: { type: "string" } }
            }
          },
          days: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["day_id", "status"],
              properties: {
                day_id: { type: "string" },
                status: { type: "string", enum: ["active", "completed", "locked"] },
                sealed_at: { type: ["string", "null"] }
              }
            }
          }
        }
      },
      day: {
        type: "object",
        additionalProperties: false,
        required: ["day_id", "status"],
        properties: {
          day_id: { type: "string" },
          title: { type: "string" },
          status: { type: "string", enum: ["active", "completed", "locked"] },
          sealed_at: { type: ["string", "null"] },
          practice: {
            type: "object",
            additionalProperties: false,
            required: ["completed"],
            properties: { completed: { type: "boolean" } }
          },
          reflection: {
            type: "object",
            additionalProperties: false,
            required: ["prompt", "existing_text"],
            properties: {
              prompt: { type: "string" },
              existing_text: { type: "string" },
              important: { type: "boolean" }
            }
          }
        }
      },
      permissions: {
        type: "object",
        additionalProperties: false,
        properties: {
          can_edit_reflection: { type: "boolean" },
          can_complete_practice: { type: "boolean" },
          can_seal_day: { type: "boolean" },
          can_flag_reflection: { type: "boolean" }
        }
      },
      revision: { type: "integer" }
    }
  };

  var REALM_EVENT_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["schema_version", "event_id", "event_type", "realm_id", "occurred_at", "source_revision", "actor", "target", "payload"],
    properties: {
      schema_version: { type: "string" },
      event_id: { type: "string" },
      event_type: { type: "string", enum: CLOSED_EVENT_TYPES },
      realm_id: { type: "string" },
      occurred_at: { type: "string" },
      source_revision: { type: "integer" },
      actor: {
        type: "object",
        additionalProperties: false,
        required: ["user_id", "interaction_type"],
        properties: {
          user_id: { type: "string" },
          interaction_type: { type: "string", enum: ["human", "system"] }
        }
      },
      target: {
        type: "object",
        additionalProperties: false,
        properties: { journey_id: { type: "string" }, day_id: { type: "string" } }
      },
      payload: { type: "object" },
      context: { type: "object" },
      evidence: { type: "object" }
    }
  };

  var BUBBLE_CALLBACK_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["schema_version", "callback_id", "event_id", "event_type", "status", "processed_at", "new_revision"],
    properties: {
      schema_version: { type: "string" },
      callback_id: { type: "string" },
      event_id: { type: "string" },
      event_type: { type: "string" },
      status: { type: "string", enum: CALLBACK_STATUSES },
      processed_at: { type: "string" },
      new_revision: { type: "integer" },
      result: { type: "object" },
      canonical_patch: { type: "object" },
      errors: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["code", "message"],
          properties: { code: { type: "string" }, message: { type: "string" } }
        }
      },
      evidence: { type: "object" }
    }
  };

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  function deepClone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function genId() {
    if (typeof root.crypto !== "undefined" && typeof root.crypto.randomUUID === "function") {
      return root.crypto.randomUUID();
    }
    var s = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
    return s.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function applyPatch(target, patch) {
    Object.keys(patch || {}).forEach(function (dottedPath) {
      var parts = dottedPath.split(".");
      var cursor = target;
      for (var i = 0; i < parts.length - 1; i++) {
        var key = parts[i];
        if (typeof cursor[key] !== "object" || cursor[key] === null) cursor[key] = {};
        cursor = cursor[key];
      }
      cursor[parts[parts.length - 1]] = patch[dottedPath];
    });
  }

  function initialState() {
    return {
      mounted: false,
      containerId: null,
      container: null,
      canonical: null,
      view: {},
      pending: {},
      errors: []
    };
  }

  var state = initialState();

  function deriveView(canonical, previousView) {
    previousView = previousView || {};
    var view = {
      showCompleted: previousView.showCompleted || false,
      selectedPhaseId: (canonical.journey && canonical.journey.phase_id) || previousView.selectedPhaseId || null,
      flagged: previousView.flagged || {},
      flagging: previousView.flagging || {}
    };

    if (canonical.day) {
      view.reflectionDraft =
        previousView.reflectionDraft !== undefined
          ? previousView.reflectionDraft
          : (canonical.day.reflection ? canonical.day.reflection.existing_text || "" : "");
      view.saving = false;
      view.sealing = false;
      if (canonical.day.reflection && canonical.day.reflection.important) {
        view.flagged[canonical.day.day_id] = true;
      }
    }

    return view;
  }

  function getEventSender() {
    if (typeof root.bubble_fn_realm_event === "function") return root.bubble_fn_realm_event;
    if (typeof global !== "undefined" && typeof global.bubble_fn_realm_event === "function") {
      return global.bubble_fn_realm_event;
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Rendering (best-effort; only touches the DOM when one is present)
  // ---------------------------------------------------------------------
  function renderIfPossible() {
    if (typeof document === "undefined" || !state.container) return;
    var c = state.canonical;
    var v = state.view;
    var html = "";

    if (c.realm_id === "today") {
      var reflectionEnabled = !!(c.permissions && c.permissions.can_edit_reflection) && c.day && c.day.status !== "completed";
      var sealEnabled = !!(c.permissions && c.permissions.can_seal_day);
      if (!c.day) {
        html = '<div class="realm-empty">Welcome. Your journey will begin soon.</div>';
      } else {
        html =
          '<h1 class="realm-day-title">' + (c.day.title || "") + "</h1>" +
          '<p class="realm-prompt">' + ((c.day.reflection && c.day.reflection.prompt) || "") + "</p>" +
          '<textarea class="realm-reflection-input" ' + (reflectionEnabled ? "" : "disabled") + ">" +
          (v.reflectionDraft || "") +
          "</textarea>" +
          '<button class="realm-save-btn" ' + (reflectionEnabled && !v.saving ? "" : "disabled") + ">Save</button>" +
          '<button class="realm-seal-btn" ' + (sealEnabled && !v.sealing ? "" : "disabled") + ">Seal Day</button>";
      }
    } else if (c.realm_id === "overview") {
      var phases = (c.journey && c.journey.phases) || [];
      var days = (c.journey && c.journey.days) || [];
      var visibleDays = v.showCompleted ? days : days.filter(function (d) { return d.status !== "completed"; });
      html =
        '<select class="realm-phase-select">' +
        phases.map(function (p) {
          return '<option value="' + p.phase_id + '"' + (p.phase_id === v.selectedPhaseId ? " selected" : "") + ">" + p.phase_title + "</option>";
        }).join("") +
        "</select>" +
        '<label><input type="checkbox" class="realm-toggle-completed" ' + (v.showCompleted ? "checked" : "") + "/> Show completed</label>" +
        '<ul class="realm-day-list">' +
        visibleDays.map(function (d) { return "<li>" + d.day_id + " (" + d.status + ")</li>"; }).join("") +
        "</ul>";
    } else if (c.realm_id === "reflection") {
      html =
        '<textarea class="realm-reflection-input">' + (v.reflectionDraft || "") + "</textarea>" +
        '<button class="realm-submit-btn">Submit</button>' +
        '<button class="realm-flag-btn">' + (c.day && v.flagged[c.day.day_id] ? "★ Important" : "☆ Mark Important") + "</button>";
    }

    state.container.innerHTML = html;
  }

  function bindIfPossible() {
    if (typeof document === "undefined" || !state.container) return;
    if (state.container.__umiSolanBound) return;
    state.container.__umiSolanBound = true;

    state.container.addEventListener("click", function (evt) {
      var target = evt.target;
      if (!target || !target.classList) return;
      if (target.classList.contains("realm-save-btn")) {
        var textarea = state.container.querySelector(".realm-reflection-input");
        triggerSaveReflection(textarea ? textarea.value : "");
      } else if (target.classList.contains("realm-seal-btn")) {
        triggerSealDay();
      } else if (target.classList.contains("realm-submit-btn")) {
        var ta2 = state.container.querySelector(".realm-reflection-input");
        triggerSaveReflection(ta2 ? ta2.value : "");
      } else if (target.classList.contains("realm-flag-btn")) {
        if (state.canonical.day) triggerFlagImportant(state.canonical.day.day_id);
      }
    });

    state.container.addEventListener("change", function (evt) {
      var target = evt.target;
      if (!target || !target.classList) return;
      if (target.classList.contains("realm-phase-select")) {
        triggerNavigatePhase(target.value);
      } else if (target.classList.contains("realm-toggle-completed")) {
        triggerToggleCompleted();
      }
    });
  }

  function unbindIfPossible() {
    if (state.container) {
      state.container.__umiSolanBound = false;
      state.container.innerHTML = "";
    }
  }

  // ---------------------------------------------------------------------
  // Public core API
  // ---------------------------------------------------------------------
  function mount(containerId, payload) {
    if (typeof containerId !== "string" || !containerId) {
      throw new Error("mount requires a non-empty containerId string");
    }
    var errors = validate(BUBBLE_INPUT_SCHEMA, payload);
    if (errors.length) {
      state.errors = errors.map(function (m) { return { code: "INVALID_PAYLOAD", message: m }; });
      throw new Error("Invalid bubble input: " + errors.join("; "));
    }

    var container = null;
    if (typeof document !== "undefined") {
      container = document.getElementById(containerId);
      if (!container) throw new Error("Container not found: " + containerId);
    }

    state = initialState();
    state.mounted = true;
    state.containerId = containerId;
    state.container = container;
    state.canonical = deepClone(payload);
    state.view = deriveView(state.canonical, {});

    renderIfPossible();
    bindIfPossible();
  }

  function update(newPayload) {
    if (!state.mounted) throw new Error("Cannot update before mount");
    var errors = validate(BUBBLE_INPUT_SCHEMA, newPayload);
    if (errors.length) {
      state.errors = state.errors.concat(errors.map(function (m) { return { code: "INVALID_PAYLOAD", message: m }; }));
      return { ok: false, errors: errors };
    }
    if (newPayload.revision < state.canonical.revision) {
      return { ok: false, error: "stale_revision" };
    }
    state.canonical = deepClone(newPayload);
    state.view = deriveView(state.canonical, state.view);
    renderIfPossible();
    return { ok: true };
  }

  function emitEvent(type, payload) {
    if (!state.mounted) throw new Error("Cannot emit an event before mount");
    if (CLOSED_EVENT_TYPES.indexOf(type) === -1) {
      throw new Error("Unknown event_type: " + type);
    }
    var event = {
      schema_version: SCHEMA_VERSION,
      event_id: genId(),
      event_type: type,
      realm_id: state.canonical.realm_id,
      occurred_at: new Date().toISOString(),
      source_revision: state.canonical.revision,
      actor: { user_id: (state.canonical.user && state.canonical.user.user_id) || "unknown", interaction_type: "human" },
      target: {},
      payload: payload || {},
      context: { screen: state.canonical.realm_id },
      evidence: { client_timestamp: new Date().toISOString() }
    };
    if (state.canonical.journey && state.canonical.journey.journey_id) event.target.journey_id = state.canonical.journey.journey_id;
    if (state.canonical.day && state.canonical.day.day_id) event.target.day_id = state.canonical.day.day_id;

    var schemaErrors = validate(REALM_EVENT_SCHEMA, event);
    if (schemaErrors.length) {
      throw new Error("Constructed event failed schema validation: " + schemaErrors.join("; "));
    }

    var sender = getEventSender();
    if (!sender) {
      throw new Error("bubble_fn_realm_event is not defined; cannot dispatch event " + type);
    }

    state.pending[event.event_id] = { event_type: type };
    sender(JSON.stringify(event));
    return event.event_id;
  }

  function finalizeOptimistic(pendingEntry, success) {
    switch (pendingEntry.event_type) {
      case "journey.reflection.save_requested":
        state.view.saving = false;
        if (success && state.canonical.day && state.canonical.day.reflection) {
          state.view.reflectionDraft = state.canonical.day.reflection.existing_text;
        }
        break;
      case "journey.day.seal_requested":
        state.view.sealing = false;
        break;
      case "journey.reflection.flag_requested":
        if (!success && state.canonical.day) {
          var dayId = state.canonical.day.day_id;
          state.view.flagged[dayId] = !state.view.flagged[dayId];
        }
        break;
      default:
        break;
    }
  }

  function receiveCallback(callback) {
    if (!state.mounted) return;
    var errors = validate(BUBBLE_CALLBACK_SCHEMA, callback);
    if (errors.length) {
      state.errors.push({ code: "INVALID_CALLBACK", message: errors.join("; ") });
      return;
    }

    var pendingEntry = state.pending[callback.event_id];
    if (!pendingEntry) return; // unknown or already-resolved event_id: ignore
    delete state.pending[callback.event_id];

    if (callback.status === "accepted") {
      if (callback.new_revision < state.canonical.revision) return; // stale accepted callback: ignore
      if (callback.canonical_patch) applyPatch(state.canonical, callback.canonical_patch);
      state.canonical.revision = callback.new_revision;
      if (callback.result && callback.result.next_bubble_input) {
        update(callback.result.next_bubble_input);
        return;
      }
      finalizeOptimistic(pendingEntry, true);
    } else {
      finalizeOptimistic(pendingEntry, false);
      state.errors = state.errors.concat(callback.errors || []);
    }

    renderIfPossible();
  }

  function destroy() {
    unbindIfPossible();
    state = initialState();
  }

  function getState() {
    return deepClone({
      mounted: state.mounted,
      canonical: state.canonical,
      view: state.view,
      pending: state.pending,
      errors: state.errors
    });
  }

  // ---------------------------------------------------------------------
  // UI trigger actions (bound to DOM events; not part of the public API
  // surface exposed on window.UMI_SOLAN, but reachable in tests via
  // module.exports.__test__).
  // ---------------------------------------------------------------------
  function triggerSaveReflection(text) {
    if (!state.mounted) throw new Error("Cannot save reflection before mount");
    if (!state.canonical.permissions || !state.canonical.permissions.can_edit_reflection) {
      state.errors.push({ code: "NO_EDIT_PERMISSION", message: "Cannot edit reflection now." });
      return;
    }
    state.view.reflectionDraft = text;
    state.view.saving = true;
    return emitEvent("journey.reflection.save_requested", { reflection_text: text });
  }

  function triggerSealDay() {
    if (!state.mounted) throw new Error("Cannot seal day before mount");
    if (!state.canonical.permissions || !state.canonical.permissions.can_seal_day) {
      state.errors.push({ code: "SEAL_NOT_ALLOWED", message: "Complete practice before sealing." });
      return;
    }
    state.view.sealing = true;
    return emitEvent("journey.day.seal_requested", { confirmation: true });
  }

  function triggerNavigatePhase(phaseId) {
    if (!state.mounted) throw new Error("Cannot navigate before mount");
    state.view.selectedPhaseId = phaseId;
    return emitEvent("realm.navigate_requested", { destination: "today", phase_id: phaseId });
  }

  function triggerToggleCompleted() {
    if (!state.mounted) throw new Error("Cannot toggle before mount");
    state.view.showCompleted = !state.view.showCompleted;
    renderIfPossible();
    return state.view.showCompleted;
  }

  function triggerFlagImportant(dayId) {
    if (!state.mounted) throw new Error("Cannot flag before mount");
    var wasFlagged = !!state.view.flagged[dayId];
    state.view.flagged[dayId] = !wasFlagged;
    return emitEvent("journey.reflection.flag_requested", { day_id: dayId, flag: !wasFlagged });
  }

  // ---------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------
  var UMI_SOLAN = {
    mount: mount,
    update: update,
    receiveCallback: receiveCallback,
    destroy: destroy,
    getState: getState
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Object.assign({}, UMI_SOLAN, {
      __test__: {
        triggerSaveReflection: triggerSaveReflection,
        triggerSealDay: triggerSealDay,
        triggerNavigatePhase: triggerNavigatePhase,
        triggerToggleCompleted: triggerToggleCompleted,
        triggerFlagImportant: triggerFlagImportant,
        validate: validate,
        schemas: {
          bubbleInput: BUBBLE_INPUT_SCHEMA,
          realmEvent: REALM_EVENT_SCHEMA,
          bubbleCallback: BUBBLE_CALLBACK_SCHEMA
        },
        CLOSED_EVENT_TYPES: CLOSED_EVENT_TYPES,
        CALLBACK_STATUSES: CALLBACK_STATUSES
      }
    });
  }
  if (root) {
    root.UMI_SOLAN = UMI_SOLAN;
  }
})(typeof window !== "undefined" ? window : globalThis);
