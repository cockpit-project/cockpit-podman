/* SPDX-License-Identifier: LGPL-2.1-or-later */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { healthAssessment, isValidHealthDetails } from "../src/health.js";
import { KeyedRequestGate, mapWithConcurrency, OwnerRefreshGate, RequestConcurrencyGate, SchedulerRequestGate, withTimeout } from "../src/scheduler-request.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(await readFile(resolve(here, "scheduler-refresh-fixture.json"), "utf8"));

// A closed connection can still deliver one final stats frame after a
// same-UID reconnect. The production guard must run before that stale frame
// can replace the new connection's pending batch or cancel its timer.
const applicationSource = await readFile(resolve(here, "../src/app.jsx"), "utf8");
// Exercise the production inventory mapping with a real list-shaped one-shot.
const inventoryMapperStart = applicationSource.indexOf("const containerFromInventory =");
const inventoryMapperEnd = applicationSource.indexOf("\n// sort order", inventoryMapperStart);
const mapInventory = new Function(applicationSource.slice(inventoryMapperStart, inventoryMapperEnd) + "\nreturn containerFromInventory;")();
for (const [exitCode, expected] of [[0, "completed"], ["0", "completed"], [1, "stopped"], [null, "stopped"], [undefined, "stopped"]]) {
    const row = mapInventory({ Id: "one-shot", Names: ["one-shot"], State: "exited", ExitCode: exitCode,
        Labels: { "com.docker.compose.oneoff": "True" } }, 0, "0-one-shot");
    assert.equal(healthAssessment(row).status, expected);
}

const statsQueueStart = applicationSource.indexOf("    queueContainerStats(con, stats) {");
const statsQueueEnd = applicationSource.indexOf("\n    clearContainerStats", statsQueueStart);
assert.ok(statsQueueStart >= 0 && statsQueueEnd > statsQueueStart);
const statsQueueBody = applicationSource.slice(statsQueueStart, statsQueueEnd);
assert.ok(statsQueueBody.startsWith("    queueContainerStats(con, stats) {\n        if (!this.isCurrentConnection(con))\n            return;"));

// Scheduler metadata must start from the validated inventory snapshot in the
// periodic owner pass. The explicit request arguments keep scheduler and
// health results tied to the same generations.
const ownerHealthStart = applicationSource.indexOf("    async collectOwnerHealth(con, request) {");
const ownerHealthEnd = applicationSource.indexOf("\n    schedulerErrorRecord", ownerHealthStart);
const ownerHealthBody = applicationSource.slice(ownerHealthStart, ownerHealthEnd);
const ownerSchedulerStart = ownerHealthBody.indexOf("schedulerPromise = this.updateSchedulerCoverage");
const ownerInspectStart = ownerHealthBody.indexOf("const results = await mapWithConcurrency");
assert.ok(ownerSchedulerStart >= 0 && ownerSchedulerStart < ownerInspectStart);
assert.match(ownerHealthBody.slice(ownerSchedulerStart, ownerInspectStart),
             /schedulerRequest, request,[\s\S]*HEALTH_SCHEDULER_TIMEOUT_MS/);
assert.match(ownerHealthBody, /result && !isValidHealthDetails\(inventory, result\.detail\)/);
assert.match(ownerHealthBody, /errors\[key\] = CONTAINER_INSPECT_INVALID/);
assert.match(ownerHealthBody, /failed\.healthDetailsLoaded = false/);
assert.match(applicationSource, /if \(!isValidHealthDetails\(\{ Id: id \}, details\)\)/);

// The owner refresh must classify null/undefined and malformed truthy detail
// replies as collection failures, while a later exact inspect clears that
// failure and is eligible to mark details loaded.
const ownerInventory = { Id: "owner-refresh-container" };
const validOwnerDetail = { Id: ownerInventory.Id, State: { Status: "running" }, Config: {} };
for (const malformed of [null, undefined, { ...validOwnerDetail, Id: "other" },
    { ...validOwnerDetail, State: {} }, { ...validOwnerDetail, Config: [] }])
    assert.equal(isValidHealthDetails(ownerInventory, malformed), false);
assert.equal(isValidHealthDetails(ownerInventory, validOwnerDetail), true);

const initialHealthStart = applicationSource.indexOf("    async collectInitialContainers(con, refreshRequest) {");
const initialHealthEnd = applicationSource.indexOf("\n    updateImages", initialHealthStart);
const initialHealthBody = applicationSource.slice(initialHealthStart, initialHealthEnd);
const initialSchedulerStart = initialHealthBody.indexOf("schedulerPromise = this.updateSchedulerCoverage");
const initialInspectStart = initialHealthBody.indexOf("const results = await mapWithConcurrency");
assert.equal(initialSchedulerStart, -1);
assert.equal(initialInspectStart, -1);
assert.match(applicationSource,
             /this\.healthRefreshFollowups = new Map\(\)/);
assert.match(applicationSource,
             /healthRefreshFollowups\.set\(ownerKey, con\)[\s\S]*setTimeout\(\(\) =>/);
const gate = new SchedulerRequestGate();
const applied = [];

const older = gate.begin(fixture.owner_uid);
const newer = gate.begin(fixture.owner_uid);
assert.equal(older.generation, fixture.responses.find(response => response.label === "older").generation);
assert.equal(newer.generation, fixture.responses.find(response => response.label === "newer").generation);

const responses = fixture.responses.map(response => new Promise(resolveResponse => {
    setTimeout(() => {
        const request = response.label === "older" ? older : newer;
        if (gate.isCurrent(fixture.owner_uid, request))
            applied.push(response.label);
        resolveResponse();
    }, response.delay_ms);
}));
await Promise.all(responses);

assert.deepEqual(applied, fixture.expected_applied);
assert.equal(gate.isCurrent(fixture.owner_uid, older), false);
assert.equal(gate.isCurrent(fixture.owner_uid, newer), true);

const refreshGate = new OwnerRefreshGate();
const active = new Map();
const maxActive = new Map();
const run = (uid, delay) => refreshGate.start(uid, async request => {
    const count = (active.get(request.key) || 0) + 1;
    active.set(request.key, count);
    maxActive.set(request.key, Math.max(maxActive.get(request.key) || 0, count));
    await new Promise(resolveResponse => setTimeout(resolveResponse, delay));
    active.set(request.key, active.get(request.key) - 1);
    return request;
});
const ownerA = run(1000, 10);
const ownerARepeat = run(1000, 1);
const ownerB = run(2000, 1);
assert.equal(ownerA, ownerARepeat);
assert.notEqual(ownerA, ownerB);
refreshGate.invalidate(1000);
await Promise.all([ownerA.promise, ownerB.promise]);
assert.equal(maxActive.get("1000"), 1);
assert.equal(maxActive.get("2000"), 1);
assert.equal(refreshGate.isCurrent(1000, ownerA.request), false);
assert.equal(refreshGate.isCurrent(2000, ownerB.request), true);

// Invalidating an in-flight owner must not make a reconnect reuse the old
// promise.  The fresh generation waits for the old operation to settle even
// when a global owner slot is available.
const reconnectGate = new OwnerRefreshGate(2);
const reconnectEvents = [];
const staleReconnect = reconnectGate.start("reconnect-owner", async () => {
    reconnectEvents.push("old-start");
    await new Promise(resolveResponse => setTimeout(resolveResponse, 10));
    reconnectEvents.push("old-done");
    return "old-result";
});
reconnectGate.invalidate("reconnect-owner");
const freshReconnect = reconnectGate.start("reconnect-owner", async () => {
    reconnectEvents.push("fresh-start");
    return "fresh-result";
});
assert.notEqual(staleReconnect, freshReconnect);
assert.equal(await staleReconnect.promise, "old-result");
assert.equal(await freshReconnect.promise, "fresh-result");
assert.deepEqual(reconnectEvents, ["old-start", "old-done", "fresh-start"]);
assert.equal(reconnectGate.isCurrent("reconnect-owner", staleReconnect.request), false);
assert.equal(reconnectGate.isCurrent("reconnect-owner", freshReconnect.request), true);

// Model the initial-load lifecycle: an invalidated generation may resolve
// without committing `containersLoaded`, so the caller must start the queued
// fresh generation and eventually settle loaded state.
const initialLifecycleGate = new OwnerRefreshGate(2);
let initialLoaded = false;
let initialRuns = 0;
const runInitialLoad = () => {
    initialLifecycleGate.invalidate("initial-owner");
    const entry = initialLifecycleGate.start("initial-owner", async request => {
        initialRuns++;
        await new Promise(resolveResponse => setTimeout(resolveResponse, 2));
        if (!initialLifecycleGate.isCurrent("initial-owner", request))
            return;
        initialLoaded = true;
    });
    return entry.promise.then(() => {
        if (!initialLoaded)
            return runInitialLoad();
    });
};
const initialLoad = runInitialLoad();
initialLifecycleGate.invalidate("initial-owner");
await initialLoad;
assert.equal(initialLoaded, true);
assert.equal(initialRuns, 2);

// Event detail requests are keyed by full owner/container identity. A newer
// event for B must discard only B's older inspect while an in-flight A inspect
// remains applicable. The production path uses a separate owner gate for
// scheduler coverage, so scheduler invalidation cannot drop container detail.
const eventDetailGate = new SchedulerRequestGate();
const detailAKey = "event-guard-owner-a";
const detailBKey = "event-guard-owner-b";
const detailA = eventDetailGate.begin(detailAKey);
const detailBOld = eventDetailGate.begin(detailBKey);
const detailBNew = eventDetailGate.begin(detailBKey);
assert.equal(eventDetailGate.isCurrent(detailAKey, detailA), true);
assert.equal(eventDetailGate.isCurrent(detailBKey, detailBOld), false);
assert.equal(eventDetailGate.isCurrent(detailBKey, detailBNew), true);

// Health and exec events do not launch scheduler collection, so they must not
// invalidate an in-flight owner scheduler result with no replacement. A
// topology event does request a new owner-scoped scheduler generation.
const schedulerCoverageGate = new SchedulerRequestGate();
const schedulerOwner = "event-guard-scheduler-owner";
const schedulerInFlight = schedulerCoverageGate.begin(schedulerOwner);
assert.equal(schedulerCoverageGate.isCurrent(schedulerOwner, schedulerInFlight), true);
const topologyRefresh = schedulerCoverageGate.begin(schedulerOwner);
assert.equal(schedulerCoverageGate.isCurrent(schedulerOwner, schedulerInFlight), false);
assert.equal(schedulerCoverageGate.isCurrent(schedulerOwner, topologyRefresh), true);

// Health events can arrive continuously while both owner inventories are
// inspected. Model the actual event path: each event starts a per-container
// inspect, records its generation/action, and commits only when that event is
// still current. The initial inventory captures generations before listing,
// preserves event-updated rows at commit, and merges event-created rows that
// were absent from the listing. Exercise the observed 84/72-row scopes.
const sleep = delay => new Promise(resolveResponse => setTimeout(resolveResponse, delay));
const eventFloodGate = new OwnerRefreshGate(2);
const runEventFloodInitialLoad = async (rowCount, ownerIndex) => {
    const uid = `event-flood-${ownerIndex}`;
    const ids = Array.from({ length: rowCount }, (_, index) =>
        `${index.toString(16).padStart(2, "0")}${"0".repeat(62)}`);
    const eventGate = new SchedulerRequestGate();
    const eventGenerations = new Map();
    const eventActions = new Map();
    const pendingEvents = new Map();
    const state = new Map();
    const schedulerGate = new SchedulerRequestGate();
    const initialEventGenerations = new Map(eventGenerations);
    let eventCount = 0;
    let loaded = false;

    const emitContainerEvent = (id, action = "health_status") => {
        const key = `${uid}-${id}`;
        const request = eventGate.begin(key);
        eventGenerations.set(key, request.generation);
        eventActions.set(key, action);
        const wait = pendingEvents.get(key) || Promise.resolve();
        const operation = wait.then(async () => {
            await sleep(1);
            if (eventGate.isCurrent(key, request))
                state.set(key, { Id: id, source: "event", generation: request.generation });
        });
        pendingEvents.set(key, operation);
        operation.finally(() => {
            if (pendingEvents.get(key) === operation)
                pendingEvents.delete(key);
        });
        return operation;
    };

    const entry = eventFloodGate.start(uid, async request => {
        // getContainers() resolves before the bounded 8-worker inspect fanout.
        await sleep(2);
        const inventory = ids.map(id => ({ Id: id }));
        const inspected = await mapWithConcurrency(inventory, async row => {
            await sleep(1);
            return { ...row, source: "inventory" };
        }, 8);
        assert.equal(eventFloodGate.isCurrent(uid, request), true);

        const listedKeys = new Set(inspected.map(row => `${uid}-${row.Id}`));
        const committed = new Map();
        for (const [key, row] of state) {
            if (key.startsWith(`${uid}-`) && !listedKeys.has(key)) {
                const snapshotGeneration = initialEventGenerations.get(key) || 0;
                const currentGeneration = eventGenerations.get(key) || 0;
                if (currentGeneration !== snapshotGeneration && eventActions.get(key) !== "remove")
                    committed.set(key, row);
            }
        }
        for (const row of inspected) {
            const key = `${uid}-${row.Id}`;
            const snapshotGeneration = initialEventGenerations.get(key) || 0;
            const currentGeneration = eventGenerations.get(key) || 0;
            if (currentGeneration !== snapshotGeneration) {
                if (eventActions.get(key) === "remove")
                    continue;
                const current = state.get(key);
                if (current) {
                    committed.set(key, current);
                    continue;
                }
            }
            committed.set(key, row);
        }
        state.clear();
        for (const [key, row] of committed)
            state.set(key, row);
        loaded = true;

        // The scheduler collector runs after the inventory commit. Health
        // events must not invalidate this owner-scoped result while they
        // continue through independent per-container detail requests.
        const schedulerRequest = schedulerGate.begin(uid);
        await sleep(2);
        assert.equal(schedulerGate.isCurrent(uid, schedulerRequest), true);
    });

    // This is the health_status stream that previously invalidated the owner
    // generation on every event. It deliberately never invalidates the owner
    // gate; only the per-container inspect generation changes.
    const events = setInterval(() => {
        const id = ids[eventCount % ids.length];
        eventCount++;
        void emitContainerEvent(id);
    }, 1);
    await entry.promise;
    clearInterval(events);
    await Promise.all([...pendingEvents.values()]);
    assert.equal(loaded, true);
    assert.equal(state.size, rowCount);
    assert.ok(eventCount > 0);
    return { state, eventCount };
};

const eventFloodLoads = await Promise.all([84, 72].map(runEventFloodInitialLoad));
assert.deepEqual(eventFloodLoads.map(result => result.state.size), [84, 72]);
assert.ok(eventFloodLoads.every(result => result.eventCount > 0));

// A remove tombstone must win over the stale inventory row, while an event
// created row absent from that inventory must survive the initial rebuild.
const mergeGate = new SchedulerRequestGate();
const mergeOwner = "event-merge-owner";
const removedId = "a".repeat(64);
const createdId = "b".repeat(64);
const removedKey = `${mergeOwner}-${removedId}`;
const createdKey = `${mergeOwner}-${createdId}`;
const mergeGenerations = new Map();
const mergeActions = new Map();
const mergeState = new Map([[removedKey, { Id: removedId, source: "old" }],
    [createdKey, { Id: createdId, source: "event" }]]);
const mergeSnapshot = new Map(mergeGenerations);
const removedRequest = mergeGate.begin(removedKey);
mergeGenerations.set(removedKey, removedRequest.generation);
mergeActions.set(removedKey, "remove");
const createdRequest = mergeGate.begin(createdKey);
mergeGenerations.set(createdKey, createdRequest.generation);
mergeActions.set(createdKey, "create");
const mergeInventory = [{ Id: removedId }];
const mergedState = new Map();
for (const [key, row] of mergeState) {
    if (mergeInventory.some(container => `${mergeOwner}-${container.Id}` === key))
        continue;
    if ((mergeGenerations.get(key) || 0) !== (mergeSnapshot.get(key) || 0) &&
        mergeActions.get(key) !== "remove")
        mergedState.set(key, row);
}
for (const container of mergeInventory) {
    const key = `${mergeOwner}-${container.Id}`;
    if (mergeActions.get(key) === "remove")
        continue;
    mergedState.set(key, mergeState.get(key) || container);
}
assert.equal(mergeGate.isCurrent(removedKey, removedRequest), true);
assert.equal(mergeGate.isCurrent(createdKey, createdRequest), true);
assert.equal(mergedState.has(removedKey), false);
assert.equal(mergedState.get(createdKey)?.source, "event");

// The timer may enumerate many owner sockets. A per-owner gate alone would
// still start one inventory and scheduler collector per owner at once; the
// global cap keeps the next timer fire bounded while retaining owner
// isolation.
const globalGate = new OwnerRefreshGate(2);
let globalActive = 0;
let globalMaxActive = 0;
const globalRuns = [1, 2, 3, 4].map(uid => globalGate.start(uid, async () => {
    globalActive++;
    globalMaxActive = Math.max(globalMaxActive, globalActive);
    await new Promise(resolveResponse => setTimeout(resolveResponse, 4));
    globalActive--;
}));
await Promise.all(globalRuns.map(entry => entry.promise));
assert.equal(globalMaxActive, 2);

const queuedGate = new OwnerRefreshGate(1);
const queuedOwner = queuedGate.start("queued-owner", async () => {
    await new Promise(resolveResponse => setTimeout(resolveResponse, 4));
});
const waitingOwner = queuedGate.start("waiting-owner", async () => undefined);
assert.equal(queuedGate.start("waiting-owner", async () => undefined), waitingOwner);
await Promise.all([queuedOwner.promise, waitingOwner.promise]);

// Shared Podman HTTP calls have a global cap, and a timeout must remove a
// queued call before it can start later and re-saturate the connection.
const requestGate = new RequestConcurrencyGate(1);
let requestStarts = 0;
const heldRequest = requestGate.run(async () => {
    requestStarts++;
    await new Promise(resolveResponse => setTimeout(resolveResponse, 4));
});
const canceledRequest = requestGate.run(async () => {
    requestStarts++;
});
canceledRequest.close("timeout");
await assert.rejects(canceledRequest, /timeout/);
await heldRequest;
assert.equal(requestStarts, 1);

const activeRequestGate = new RequestConcurrencyGate(1);
let activeClosed = false;
const activeCancellable = activeRequestGate.run(() => {
    const request = new Promise(() => {});
    request.close = () => { activeClosed = true; };
    return request;
});
activeCancellable.close("timeout");
await assert.rejects(activeCancellable, /timeout/);
assert.equal(activeClosed, true);

// A container event must not reuse an inspect that began before that event,
// and a reconnect with the same UID must not reuse the old connection's
// promise. Newer requests wait behind a running request for that ID.
const keyedRuns = [];
const keyedGate = new KeyedRequestGate(operation => operation());
const firstConnection = {};
const secondConnection = {};
const keyedRequest = (con, generation, value) => keyedGate.request(
    "owner-container",
    { con, generation },
    async () => {
        keyedRuns.push(value);
        await new Promise(resolveResponse => setTimeout(resolveResponse, 2));
        return value;
    },
    metadata => metadata.con === con && metadata.generation === generation,
);
const preEvent = keyedRequest(firstConnection, 0, "pre-event");
const eventRefresh = keyedRequest(firstConnection, 1, "event");
assert.notEqual(preEvent, eventRefresh);
assert.equal(await preEvent, "pre-event");
assert.equal(await eventRefresh, "event");
const reconnectRefresh = keyedRequest(secondConnection, 0, "reconnect");
assert.notEqual(reconnectRefresh, eventRefresh);
assert.equal(await reconnectRefresh, "reconnect");
assert.deepEqual(keyedRuns, ["pre-event", "event", "reconnect"]);

const capacityGate = new RequestConcurrencyGate(8);
let activeRequests = 0;
let maxActiveRequests = 0;
const capacityRuns = Array.from({ length: 156 }, (_, index) => capacityGate.run(async () => {
    activeRequests++;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    await new Promise(resolveResponse => setTimeout(resolveResponse, index % 3));
    activeRequests--;
    return index;
}));
assert.deepEqual(await Promise.all(capacityRuns), Array.from({ length: 156 }, (_, index) => index));
assert.ok(maxActiveRequests <= 8);

let activeWorkers = 0;
let maxWorkers = 0;
const bounded = await mapWithConcurrency([1, 2, 3, 4, 5], async value => {
    activeWorkers++;
    maxWorkers = Math.max(maxWorkers, activeWorkers);
    await new Promise(resolveResponse => setTimeout(resolveResponse, 2));
    activeWorkers--;
    return value * 2;
}, 2);
assert.deepEqual(bounded, [2, 4, 6, 8, 10]);
assert.equal(maxWorkers, 2);
await assert.rejects(withTimeout(new Promise(() => {}), 2, "fixture-timeout"), /fixture-timeout/);

console.log("scheduler-refresh fixture: PASS");
