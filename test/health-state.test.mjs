/* SPDX-License-Identifier: LGPL-2.1-or-later */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { healthAssessment, healthStates, isValidHealthDetails, shouldInspectHealth } from "../src/health.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(await readFile(resolve(here, "browser-health-fixtures.json"), "utf8"));
const now = Date.parse(fixtures.now);

assert.equal(shouldInspectHealth({ Id: "running-missing", State: "running" }, {
    State: { Status: "running" },
    healthDetailsLoaded: true,
    Config: { Healthcheck: { Test: ["NONE"] } },
}), false);
assert.equal(shouldInspectHealth({ Id: "running-configured", State: "running" }, {
    State: { Status: "running" },
    healthDetailsLoaded: true,
    Config: { Healthcheck: { Test: ["CMD-SHELL", "true"] } },
}), true);
assert.equal(shouldInspectHealth({ Id: "stopped-configured", State: "exited" }, {
    State: { Status: "exited" },
    healthDetailsLoaded: true,
    Config: { Healthcheck: { Test: ["CMD-SHELL", "true"] } },
}), false);
assert.equal(shouldInspectHealth({ Id: "running-pending", State: "running" }, {
    State: { Status: "running" },
    healthDetailsLoaded: false,
}), true);
assert.equal(healthAssessment({
    Id: "inventory-only",
    State: { Status: "running" },
    healthDetailsLoaded: false,
}, now).status, healthStates.starting);
assert.equal(healthAssessment({
    Id: "inventory-only",
    State: { Status: "running" },
    healthDetailsLoaded: false,
}, now).reason, "details-pending");

// A detail response can be truthy while still being unusable. It must carry
// the exact inventory identity and the objects consumed by the row renderer;
// otherwise collection must remain failed and the next refresh must retry it.
const inspectInventory = { Id: "inspect-owner-container" };
const inspectDetail = {
    Id: inspectInventory.Id,
    State: { Status: "running" },
    Config: {},
};
assert.equal(isValidHealthDetails(inspectInventory, inspectDetail), true);
for (const [label, malformed] of [
    ["null detail", null],
    ["undefined detail", undefined],
    ["truthy scalar", "inspect failed"],
    ["mismatched id", { ...inspectDetail, Id: "different-container" }],
    ["missing state", { ...inspectDetail, State: undefined }],
    ["malformed state", { ...inspectDetail, State: "running" }],
    ["missing state status", { ...inspectDetail, State: {} }],
    ["missing config", { ...inspectDetail, Config: undefined }],
    ["malformed config", { ...inspectDetail, Config: [] }],
])
    assert.equal(isValidHealthDetails(inspectInventory, malformed), false, label);

const failedInspectRow = { ...inspectInventory, State: { Status: "running" }, healthDetailsLoaded: false };
assert.equal(healthAssessment(failedInspectRow, now, "Container inspect response is invalid").status,
             healthStates.error);
const recoveredInspect = structuredClone(fixtures.healthy.container);
recoveredInspect.Id = inspectInventory.Id;
recoveredInspect.healthDetailsLoaded = true;
assert.equal(isValidHealthDetails(inspectInventory, recoveredInspect), true);
assert.equal(healthAssessment(recoveredInspect, now, null, fixtures.healthy.scheduler).status,
             healthStates.healthy);

assert.equal(healthAssessment({
    Id: "partial-health-config",
    Config: { Healthcheck: {} },
    State: { Status: "running" },
}, now, null, null).status, healthStates.missing);
assert.equal(healthAssessment({
    Id: "interval-only-health-config",
    Config: { Healthcheck: { Interval: 30000000000 } },
    State: { Status: "running" },
}, now, null, null).status, healthStates.missing);
assert.equal(healthAssessment({
    Id: "disabled-health-config",
    Config: { Healthcheck: { Test: ["NONE"], Interval: 30000000000 } },
    State: { Status: "running" },
}, now, null, null).status, healthStates.missing);
assert.equal(healthAssessment({
    Id: "malformed-health-config",
    Config: { Healthcheck: { Test: ["CMD-SHELL", ""] } },
    State: { Status: "running" },
}, now, null, null).status, healthStates.missing);

for (const name of ["healthy", "unhealthy", "starting", "missing", "stale", "freshness-unknown", "collector-error", "stopped", "latest-failed"]) {
    const fixture = fixtures[name];
    const assessment = healthAssessment(fixture.container, now, fixture.error, fixture.scheduler);
    assert.equal(assessment.status, fixture.expected, name);
}

const latestFailed = healthAssessment(fixtures["latest-failed"].container, now, null, fixtures["latest-failed"].scheduler);
assert.equal(latestFailed.status, healthStates.unhealthy);
assert.equal(latestFailed.reason, "latest-check-failed");
assert.equal(latestFailed.latestExitCode, -1);
assert.equal(latestFailed.rawStatus, "healthy");
assert.equal(healthAssessment(fixtures["latest-failed"].container, now, null, {
    coverage_status: "error",
    collector_errors: ["collector failed"],
}).status, healthStates.unhealthy);

for (const malformedExitCode of [null, "", false]) {
    const malformed = structuredClone(fixtures["latest-failed"].container);
    malformed.State.Health.Log.at(-1).ExitCode = malformedExitCode;
    const assessment = healthAssessment(malformed, now, null, fixtures["latest-failed"].scheduler);
    assert.equal(assessment.status, healthStates.unknown, `malformed exit code ${String(malformedExitCode)}`);
    assert.equal(assessment.reason, "latest-check-unknown");
    assert.equal(assessment.rawStatus, "healthy");
    assert.equal(assessment.latestExitCode, null);
}

const sanitized = healthAssessment(fixtures["collector-error"].container, now, fixtures["collector-error"].error, fixtures["collector-error"].scheduler);
assert.equal(sanitized.status, healthStates.error);
assert.equal(sanitized.error, "health-collection-failed");
assert.doesNotMatch(sanitized.error, /podman\.sock|secret|token|https?:\/\//i);
const timedOut = healthAssessment(fixtures["collector-error"].container, now, "Container inspect timed out", fixtures["collector-error"].scheduler);
assert.equal(timedOut.status, healthStates.error);
assert.equal(timedOut.reason, "collection-timeout");
assert.equal(timedOut.error, "health-collection-timeout");

const schedulerSecret = healthAssessment(fixtures.healthy.container, now, null, {
    coverage_status: "error",
    collector_errors: ["systemd timer failed: https://user:password@example.invalid/?token=secret"],
});
assert.equal(schedulerSecret.status, healthStates.error);
assert.equal(schedulerSecret.error, "scheduler-metadata-unavailable");
assert.doesNotMatch(schedulerSecret.error, /https?:\/\/|password|token|secret/i);
assert.equal(healthAssessment(fixtures.healthy.container, now, null, {
    coverage_status: "covered",
    active_coverage_count: 2,
    effective_interval_seconds: 30,
    collector_errors: [],
}).status, healthStates.error);
assert.equal(healthAssessment(fixtures.healthy.container, now, null, {
    coverage_status: "unexpected",
    effective_interval_seconds: 30,
    collector_errors: [],
}).status, healthStates.error);

// A covered scheduler record must carry a complete, self-consistent count
// and cadence. Missing or contradictory metadata must never produce green
// health or a freshness window.
const completeCovered = {
    coverage_status: "covered",
    active_coverage_count: 1,
    coverage_count: 1,
    effective_interval_seconds: 30,
    jitter_seconds: 0,
    accuracy_seconds: 1,
    schedule_source: "systemd",
    collector_errors: [],
};
assert.equal(healthAssessment(fixtures.healthy.container, now, null, completeCovered).status, healthStates.healthy);
for (const [label, malformed] of [
    ["missing active count", { ...completeCovered, active_coverage_count: undefined }],
    ["zero covered count", { ...completeCovered, active_coverage_count: 0, coverage_count: 0 }],
    ["mismatched counts", { ...completeCovered, coverage_count: 0 }],
    ["missing collector errors", { ...completeCovered, collector_errors: undefined }],
    ["missing cadence", { ...completeCovered, effective_interval_seconds: undefined }],
    ["missing cadence source", { ...completeCovered, schedule_source: undefined }],
])
    assert.equal(healthAssessment(fixtures.healthy.container, now, null, malformed).status,
                 healthStates.error, label);

const collision = fixtures["permission-context-collision"];
const healthyKey = `${collision.healthyOwner.uid}-${collision.sameId}`;
const errorKey = `${collision.errorOwner.uid}-${collision.sameId}`;
assert.notEqual(healthyKey, errorKey);
assert.equal(healthAssessment(fixtures.healthy.container, now, collision.healthyOwner.error, fixtures.healthy.scheduler).status, healthStates.healthy);
assert.equal(healthAssessment(fixtures.healthy.container, now, collision.errorOwner.error, fixtures.healthy.scheduler).status, healthStates.error);

const recreated = fixtures["recreated-id"];
assert.notEqual(`${recreated.old.uid}-${recreated.old.id}`, `${recreated.new.uid}-${recreated.new.id}`);
assert.equal(healthAssessment(fixtures.healthy.container, now, recreated.old.error, fixtures.healthy.scheduler).status, healthStates.error);
assert.equal(healthAssessment(fixtures.healthy.container, now, recreated.new.error, fixtures.healthy.scheduler).status, healthStates.healthy);

assert.equal(healthAssessment(fixtures.stopped.container, now, null, fixtures.stopped.scheduler).status, healthStates.stopped);
assert.equal(healthAssessment(fixtures.stopped.container, now, "inventory refresh timed out", fixtures.stopped.scheduler).status,
             healthStates.stopped);

// An exit code of zero is not sufficient to call an arbitrary workload a
// completed one-shot job.  Without explicit metadata it remains stopped.
const exitedSuccessfully = structuredClone(fixtures.stopped.container);
exitedSuccessfully.State.ExitCode = 0;
assert.equal(healthAssessment(exitedSuccessfully, now, null, fixtures.stopped.scheduler).status, healthStates.stopped);

const completedOneShot = structuredClone(exitedSuccessfully);
completedOneShot.Config.Labels = { "com.docker.compose.oneoff": "True" };
assert.equal(healthAssessment(completedOneShot, now, null, fixtures.stopped.scheduler).status, healthStates.completed);
assert.equal(healthAssessment(completedOneShot, now, "inventory refresh timed out", fixtures.stopped.scheduler).status,
             healthStates.completed);

const explicitStateOneShot = structuredClone(exitedSuccessfully);
explicitStateOneShot.State.OneShot = true;
assert.equal(healthAssessment(explicitStateOneShot, now, null, fixtures.stopped.scheduler).status, healthStates.completed);

const restartPolicyOnly = structuredClone(exitedSuccessfully);
restartPolicyOnly.Config.Labels = { "io.kubernetes.container.restartPolicy": "Never" };
assert.equal(healthAssessment(restartPolicyOnly, now, null, fixtures.stopped.scheduler).status, healthStates.stopped);

const slowSchedule = { ...fixtures.stale.scheduler, effective_interval_seconds: 180, jitter_seconds: 10, accuracy_seconds: 1 };
assert.equal(healthAssessment(fixtures.stale.container, now, null, slowSchedule).status, healthStates.healthy);
assert.equal(healthAssessment(fixtures.stale.container, now, null, fixtures.stale.scheduler).staleAfterMs, 36000);
assert.equal(healthAssessment(fixtures.healthy.container, now, null, {
    coverage_status: "uncovered",
    active_coverage_count: 0,
    coverage_count: 0,
    coverage_reason: "no-active-matching-health-timer",
    collector_errors: [],
}).status, healthStates.unknown);

// A repeated inspect is the source of the timestamp update.  Keep the native
// status and scheduler cadence unchanged while asserting that a newer Podman
// health log advances freshness instead of leaving a cached timestamp behind.
const repeated = structuredClone(fixtures.healthy.container);
const first = healthAssessment(repeated, now, null, fixtures.healthy.scheduler);
repeated.State.Health.Log.push({
    Start: "2026-09-08T12:01:00Z",
    End: "2026-09-08T12:01:01Z",
    ExitCode: 0,
});
const second = healthAssessment(repeated, Date.parse("2026-09-08T12:01:02Z"), null, fixtures.healthy.scheduler);
assert.equal(first.status, healthStates.healthy);
assert.equal(second.status, healthStates.healthy);
assert.equal(second.lastChecked, Date.parse("2026-09-08T12:01:01Z"));
assert.ok(second.lastChecked > first.lastChecked);

console.log("health-state fixtures: PASS");
