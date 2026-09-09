/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2017 Red Hat, Inc.
 */

import React from 'react';

import { Alert, AlertActionCloseButton, AlertGroup } from "@patternfly/react-core/dist/esm/components/Alert";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { EmptyState, EmptyStateFooter, EmptyStateActions, EmptyStateVariant } from "@patternfly/react-core/dist/esm/components/EmptyState";
import { Page, PageSection, } from "@patternfly/react-core/dist/esm/components/Page";
import { Stack } from "@patternfly/react-core/dist/esm/layouts/Stack";
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { WithDialogs } from "dialogs.jsx";

import cockpit from 'cockpit';
import { basename } from "cockpit-path";
import * as python from "python";
import { superuser } from "superuser";

import ContainerHeader from './ContainerHeader.tsx';
import Containers from './Containers.jsx';
import Images from './Images.jsx';
import * as client from './client.js';
import detect_quadlets from './detect-quadlets.py';
import scheduler_collector from './health-scheduler.py';
import { isValidHealthDetails, shouldInspectHealth } from './health.js';
import rest from './rest.js';
import { KeyedRequestGate, mapWithConcurrency, OwnerRefreshGate, RequestConcurrencyGate, SchedulerRequestGate, withTimeout } from './scheduler-request.js';
import { makeKey, WithPodmanInfo, debug } from './util.js';

const _ = cockpit.gettext;

const errorText = error => error?.message || error?.toString() || "Unknown error";
const FULL_CONTAINER_ID = /^[0-9a-f]{64}$/;
const SCHEDULER_SCHEMA = "train-health-scheduler-coverage/v1";
const SCHEDULER_FAILURE = "scheduler-collector-failed";
const SCHEDULER_INCOMPLETE = "scheduler-coverage-incomplete";
const SCHEDULER_STATUSES = new Set(["covered", "covered-with-errors", "uncovered", "error"]);
const HEALTH_REFRESH_INTERVAL_MS = 15000;
const HEALTH_REFRESH_TIMEOUT_MS = 15000;
const HEALTH_INSPECT_TIMEOUT_MS = 5000;
const HEALTH_EVENT_INSPECT_TIMEOUT_MS = 5000;
const HEALTH_INSPECT_CONCURRENCY = 8;
const HEALTH_SCHEDULER_TIMEOUT_MS = 8000;
const CONTAINER_INSPECT_INVALID = "Container inspect response is invalid";
// Stats are streamed independently for every owner. Coalesce a burst into a
// single render while keeping the displayed values boundedly fresh.
const CONTAINER_STATS_FLUSH_INTERVAL_MS = 100;

const isContainerInventoryRow = container => container !== null &&
    typeof container === "object" && !Array.isArray(container) &&
    typeof container.Id === "string" && container.Id.trim().length > 0;

const containerFromInventory = (inventory, uid, key, current = null) => {
    const inventoryState = typeof inventory?.State === "string"
        ? { Status: inventory.State.toLowerCase() }
        : (inventory?.State || {});
    const state = {
        ...(current?.State || {}),
        ...inventoryState,
        // Podman's list response keeps the exit code at the top level.
        // Preserve it when rendering a completed job without an inspect.
        ...(Object.prototype.hasOwnProperty.call(inventory, "ExitCode") ? { ExitCode: inventory.ExitCode } : {}),
    };
    const id = inventory.Id;
    const name = inventory.Names?.[0]?.replace(/^\//, "") || inventory.Name || current?.Name || id;
    const inventoryConfig = inventory.Config || {};
    const currentConfig = current?.Config || {};
    const config = {
        ...inventoryConfig,
        ...currentConfig,
        Labels: {
            ...(inventory.Labels || {}),
            ...(inventoryConfig.Labels || {}),
            ...(currentConfig.Labels || {}),
        },
        Env: currentConfig.Env || inventoryConfig.Env || inventory.Env || [],
        Cmd: currentConfig.Cmd || inventoryConfig.Cmd || inventory.Command || [],
    };
    const networkSettings = {
        ...(inventory.NetworkSettings || {}),
        ...(current?.NetworkSettings || {}),
        Ports: current?.NetworkSettings?.Ports || inventory.NetworkSettings?.Ports || {},
    };
    return {
        ...inventory,
        ...(current || {}),
        Id: id,
        Name: name,
        ImageName: inventory.ImageName || inventory.Image || current?.ImageName || current?.Image || id,
        Config: config,
        NetworkSettings: networkSettings,
        Mounts: current?.Mounts || inventory.Mounts || [],
        State: state,
        uid,
        key,
        // An inventory-only row has enough data for lifecycle rendering but
        // must remain pending until its first full inspect establishes health
        // configuration and the native result.
        healthDetailsLoaded: current?.healthDetailsLoaded === true,
    };
};

// sort order of "users" state for dialogs: system, session user, then other users by ascending name
function compareUser(a, b) {
    if (a.uid === 0)
        return -1;
    if (b.uid === 0)
        return 1;
    if (a.uid === null)
        return -1;
    if (b.uid === null)
        return 1;
    return a.name.localeCompare(b.name);
}

class Application extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            // currently connected services per user: { con, uid, name, dbus: { client, subscription }, imagesLoaded, containersLoaded, podsLoaded, quadletsLoaded }
            // start with dummy state to wait for initialization
            users: [{ con: null, uid: 0, name: _("system"), dbus: null }, { con: null, uid: null, name: _("user"), dbus: null }],
            images: null,
            containers: null,
            // A failed inspect invalidates any previously cached health result
            // for the same (owner, full container ID) key.
            containerErrors: {},
            // A context-level failure covers every cached row belonging to the
            // affected Podman socket until a successful refresh clears it.
            contextErrors: {},
            // Effective systemd/native scheduler metadata is keyed by the
            // display's owner-scoped full container ID.
            schedulerCoverage: {},
            schedulerErrors: {},
            containersFilter: "all",
            containersStats: {},
            // Mapping of quadlet containers and pods on the system to show
            // inactive containers and pods as quadlets are ephemeral and the
            // container/pod is not kept around when they are stopped.
            // { "$uid-$name.service": { source_path, name, exec, image, pod  } }
            quadletContainers: {},
            // { "$uid-$name-pod.service": { source_path, name } }
            quadletPods: {},
            textFilter: "",
            ownerFilter: "all",
            dropDownValue: 'Everything',
            notifications: [],
            version: '1.3.0',
            selinuxAvailable: false,
            userPodmanRestartAvailable: false,
            userLingeringEnabled: null,
            location: {},
        };
        this.onAddNotification = this.onAddNotification.bind(this);
        this.onDismissNotification = this.onDismissNotification.bind(this);
        this.onFilterChanged = this.onFilterChanged.bind(this);
        this.onOwnerChanged = this.onOwnerChanged.bind(this);
        this.onContainerFilterChanged = this.onContainerFilterChanged.bind(this);
        this.updateContainer = this.updateContainer.bind(this);
        this.goToServicePage = this.goToServicePage.bind(this);
        this.onNavigate = this.onNavigate.bind(this);

        this.pendingUpdateContainer = {}; // key (uid-id) → promise
        this.containerEventGenerations = new Map();
        this.containerEventActions = new Map();
        this.containerEventRequests = new SchedulerRequestGate();
        this.schedulerRequests = new SchedulerRequestGate();
        this.healthRefreshGate = new OwnerRefreshGate();
        // A timer tick that lands during a running refresh must result in one
        // follow-up pass. OwnerRefreshGate coalesces that tick by design, so
        // retain the request here instead of allowing a slow owner to miss a
        // polling interval indefinitely.
        this.healthRefreshFollowups = new Map();
        // Keep all owner refreshes and event-driven inspects within one
        // bounded Podman HTTP request pool. Per-request deadlines start when
        // a queued request actually reaches the transport.
        this.containerRequestGate = new RequestConcurrencyGate(HEALTH_INSPECT_CONCURRENCY);
        this.containerInspectRequests = new KeyedRequestGate(operation => this.containerRequestGate.run(operation));
        this.pendingContainerStats = new Map();
        this.containerStatsTimers = new Map();
        this.ownerConnections = new Map();
        this.healthRefreshTimer = null;
        this.sessionUser = null;
    }

    onAddNotification(notification) {
        this.setState(prevState => {
            notification.index = prevState.notifications.length;
            return {
                notifications: [
                    ...prevState.notifications,
                    notification
                ]
            };
        });
    }

    onDismissNotification(notificationIndex) {
        this.setState(prevState => ({
            notifications: prevState.notifications.filter(current => current.index != notificationIndex)
        }));
    }

    updateUrl(options) {
        cockpit.location.go([], options);
    }

    onFilterChanged(value) {
        this.setState({
            textFilter: value
        });

        const options = { ...this.state.location };
        if (value === "")
            delete options.name;
        else
            options.name = value;
        this.updateUrl(options);
    }

    onOwnerChanged(value) {
        this.setState({
            ownerFilter: value
        });

        const options = { ...this.state.location };
        if (value == "all")
            delete options.owner;
        else
            options.owner = value.toString();
        this.updateUrl(options);
    }

    onContainerFilterChanged(value) {
        this.setState({
            containersFilter: value
        });

        const options = { ...this.state.location };
        if (value == "running")
            delete options.container;
        else
            options.container = value;
        this.updateUrl(options);
    }

    updateState(state, key, newValue) {
        this.setState(prevState => {
            return {
                [state]: { ...prevState[state], [key]: newValue }
            };
        });
    }

    schedulerUid(con) {
        return con.uid === null ? this.sessionUser?.id ?? null : con.uid;
    }

    isCurrentConnection(con) {
        return this.ownerConnections.get(con.uid) === con;
    }

    markContainerEvent(con, id, action) {
        const key = makeKey(con.uid, id);
        const generation = (this.containerEventGenerations.get(key) || 0) + 1;
        this.containerEventGenerations.set(key, generation);
        this.containerEventActions.set(key, action || "update");
        return generation;
    }

    invalidateOwner(con) {
        const uid = typeof con === "object" ? con.uid : con;
        if (typeof con === "object" && this.ownerConnections.get(uid) !== con)
            return false;
        this.healthRefreshFollowups.delete(uid === null ? "user" : String(uid));
        this.healthRefreshGate.invalidate(uid);
        this.schedulerRequests.begin(uid);
        const ownerPrefix = `${uid ?? "user"}-`;
        for (const key of this.containerEventGenerations.keys()) {
            if (key.startsWith(ownerPrefix)) {
                this.containerEventGenerations.delete(key);
                this.containerEventActions.delete(key);
            }
        }
        for (const key of this.containerEventRequests.generations.keys()) {
            if (key.startsWith(ownerPrefix))
                this.containerEventRequests.begin(key);
        }
        for (const key of Object.keys(this.pendingUpdateContainer)) {
            if (key.startsWith(ownerPrefix))
                delete this.pendingUpdateContainer[key];
        }
        this.containerInspectRequests.closeWhere(metadata => metadata.con === con ||
                                                        (typeof con !== "object" && metadata.con.uid === uid),
                                                 "owner-disconnected");
        if (typeof con === "object" && this.ownerConnections.get(uid) === con)
            this.ownerConnections.delete(uid);
        return true;
    }

    refreshHealthOwners() {
        for (const user of this.state.users) {
            if (user.con && user.containersLoaded)
                this.refreshOwnerHealth(user.con);
        }
    }

    refreshOwnerHealth(con) {
        const ownerKey = con.uid === null ? "user" : String(con.uid);
        const running = this.healthRefreshGate.running.get(ownerKey);
        const entry = this.healthRefreshGate.start(con.uid, request => this.collectOwnerHealth(con, request));
        if (running && entry === running)
            this.healthRefreshFollowups.set(ownerKey, con);
        else
            // A new or queued entry is itself the requested follow-up.
            this.healthRefreshFollowups.delete(ownerKey);

        return entry.promise.catch(error => {
            console.warn("periodic health refresh failed", { uid: con.uid, stage: "health-refresh", error: error?.message || "unknown" });
            this.markOwnerHealthUnavailable(con, entry.request, error);
        }).finally(() => {
            if (this.healthRefreshFollowups.get(ownerKey) !== con)
                return;
            this.healthRefreshFollowups.delete(ownerKey);
            // Let OwnerRefreshGate remove the completed entry before starting
            // the guaranteed follow-up; otherwise start() would coalesce it
            // back onto the just-finished promise.
            setTimeout(() => {
                if (this.isCurrentConnection(con) &&
                    this.state.users.find(user => user.uid === con.uid)?.containersLoaded)
                    this.refreshOwnerHealth(con);
            }, 0);
        });
    }

    inspectContainer(con, id) {
        const key = makeKey(con.uid, id);
        const generation = this.containerEventGenerations.get(key) || 0;
        return this.containerInspectRequests.request(
            key,
            { con, generation },
            () => client.inspectContainer(con, id),
            metadata => metadata.con === con && metadata.generation === generation,
        );
    }

    getContainerInventory(con) {
        return this.containerRequestGate.run(() => client.getContainers(con));
    }

    async withContainerRequestTimeout(request, timeoutMs, message) {
        // If the queued request is canceled while waiting for a shared slot,
        // its promise rejects before the result timeout is installed below.
        // Observe that rejection immediately so a canceled inspect cannot
        // become an unhandled rejection while we wait on request.started.
        const observedRequest = Promise.resolve(request);
        observedRequest.catch(() => undefined);
        const startedAt = Date.now();
        if (request.started) {
            const started = await withTimeout(request.started, timeoutMs, message,
                                              () => request.close?.("timeout"));
            if (!started)
                throw new Error(message);
        }
        return withTimeout(observedRequest,
                           Math.max(1, timeoutMs - (Date.now() - startedAt)),
                           message,
                           () => request.close?.("timeout"));
    }

    markOwnerHealthUnavailable(con, refreshRequest, error) {
        if (!this.isCurrentConnection(con) ||
            (refreshRequest && !this.healthRefreshGate.isCurrent(con.uid, refreshRequest)))
            return;

        // A failed refresh must invalidate both the context-level health result
        // and any scheduler result from the previous inventory.  Otherwise a
        // rejected refresh can leave an old green row visible indefinitely.
        const schedulerRequest = this.schedulerRequests.begin(con.uid);
        const reason = errorText(error) || "health collection failed";
        const containers = Object.values(this.state.containers || {})
                .filter(container => container.uid === con.uid);
        this.setState(prevState => {
            if (!this.isCurrentConnection(con) ||
                (refreshRequest && !this.healthRefreshGate.isCurrent(con.uid, refreshRequest)))
                return null;
            return { contextErrors: { ...prevState.contextErrors, [con.uid]: reason } };
        });
        this.applySchedulerCoverage(con, this.schedulerUid(con), containers, null,
                                    SCHEDULER_FAILURE, schedulerRequest);
    }

    async collectOwnerHealth(con, request) {
        if (!this.isCurrentConnection(con) || !this.healthRefreshGate.isCurrent(con.uid, request))
            return;

        const refreshDeadline = Date.now() + HEALTH_REFRESH_TIMEOUT_MS;
        const initialEventGenerations = new Map();
        const initialEventActions = new Map();
        const ownerPrefix = `${con.uid ?? "user"}-`;
        for (const [key, generation] of this.containerEventGenerations) {
            if (key.startsWith(ownerPrefix)) {
                initialEventGenerations.set(key, generation);
                initialEventActions.set(key, this.containerEventActions.get(key));
            }
        }
        let containerList;
        try {
            const inventoryRequest = this.getContainerInventory(con);
            containerList = await this.withContainerRequestTimeout(inventoryRequest,
                                                                   Math.max(1, refreshDeadline - Date.now()),
                                                                   "Container inventory refresh timed out");
            if (!Array.isArray(containerList))
                throw new Error("container inventory is not an array");
        } catch (error) {
            this.markOwnerHealthUnavailable(con, request, error);
            return;
        }

        const validInventory = containerList.filter(isContainerInventoryRow);
        const invalidInventoryRow = validInventory.length !== containerList.length;
        let schedulerPromise = null;
        if (!invalidInventoryRow) {
            const schedulerRequest = this.schedulerRequests.begin(con.uid);
            // Scheduler metadata uses the inventory identity and can run
            // independently while the bounded inspect workers collect the
            // detailed health state. Both results carry the same owner and
            // refresh generations, so a topology event discards stale output.
            schedulerPromise = this.updateSchedulerCoverage(con, validInventory, schedulerRequest, request,
                                                            HEALTH_SCHEDULER_TIMEOUT_MS);
        }

        // The inventory response is sufficient for lifecycle and identity
        // updates.  A full inspect is reserved for running rows whose health
        // details are pending or configured; rows already known to have no
        // check, and every stopped/completed row, can be rendered without
        // another expensive request.
        const inspectList = validInventory.filter(container => {
            const key = makeKey(con.uid, container.Id);
            return shouldInspectHealth(container, this.state.containers?.[key]);
        });
        const results = await mapWithConcurrency(inspectList, async container => {
            if (!isContainerInventoryRow(container))
                return { container, error: new Error("Container inventory row is invalid") };
            const remaining = Math.min(HEALTH_INSPECT_TIMEOUT_MS, refreshDeadline - Date.now());
            if (remaining <= 0)
                return { container, error: new Error("Container health refresh timed out") };
            try {
                const inspectRequest = this.inspectContainer(con, container.Id);
                const detail = await this.withContainerRequestTimeout(inspectRequest, remaining,
                                                                      "Container inspect timed out");
                return { container, detail };
            } catch (error) {
                return { container, error };
            }
        }, HEALTH_INSPECT_CONCURRENCY);
        if (!this.isCurrentConnection(con) || !this.healthRefreshGate.isCurrent(con.uid, request))
            return;

        const resultByKey = new Map();
        for (const result of results) {
            if (isContainerInventoryRow(result.container))
                resultByKey.set(makeKey(con.uid, result.container.Id), result);
        }

        const snapshot = [];
        const errors = {};
        for (const inventory of containerList) {
            if (!isContainerInventoryRow(inventory)) {
                continue;
            }
            const id = inventory.Id;
            const key = makeKey(con.uid, id);
            const result = resultByKey.get(key);
            if (result?.error) {
                const old = this.state.containers?.[key] || null;
                const failed = containerFromInventory(inventory, con.uid, key, old);
                failed.healthDetailsLoaded = false;
                snapshot.push(failed);
                errors[key] = errorText(result.error);
            } else if (result && !isValidHealthDetails(inventory, result.detail)) {
                const old = this.state.containers?.[key] || null;
                const failed = containerFromInventory(inventory, con.uid, key, old);
                failed.healthDetailsLoaded = false;
                snapshot.push(failed);
                errors[key] = CONTAINER_INSPECT_INVALID;
            } else if (result?.detail) {
                const detail = { ...result.detail, uid: con.uid, key };
                detail.healthDetailsLoaded = true;
                snapshot.push(detail);
            } else {
                const old = this.state.containers?.[key] || null;
                snapshot.push(containerFromInventory(inventory, con.uid, key, old));
            }
        }

        this.setState(prevState => {
            if (!this.isCurrentConnection(con) || !this.healthRefreshGate.isCurrent(con.uid, request))
                return null;

            const containers = {};
            const containerErrors = {};
            Object.entries(prevState.containers || {}).forEach(([key, container]) => {
                if (container.uid !== con.uid) {
                    containers[key] = container;
                    if (prevState.containerErrors?.[key])
                        containerErrors[key] = prevState.containerErrors[key];
                }
            });
            const listedKeys = new Set(snapshot.map(container => container.key));
            Object.entries(prevState.containers || {}).forEach(([key, container]) => {
                if (container.uid !== con.uid || listedKeys.has(key))
                    return;
                const snapshotGeneration = initialEventGenerations.get(key) || 0;
                const currentGeneration = this.containerEventGenerations.get(key) || 0;
                const eventAction = currentGeneration === snapshotGeneration
                    ? initialEventActions.get(key)
                    : this.containerEventActions.get(key);
                if (eventAction === "remove" || currentGeneration === snapshotGeneration)
                    return;
                containers[key] = container;
                if (prevState.containerErrors?.[key])
                    containerErrors[key] = prevState.containerErrors[key];
            });
            snapshot.forEach(container => {
                const key = container.key;
                const snapshotGeneration = initialEventGenerations.get(key) || 0;
                const currentGeneration = this.containerEventGenerations.get(key) || 0;
                const eventAction = currentGeneration === snapshotGeneration
                    ? initialEventActions.get(key)
                    : this.containerEventActions.get(key);
                if (eventAction === "remove")
                    return;
                if (currentGeneration !== snapshotGeneration) {
                    const current = prevState.containers?.[key];
                    if (current) {
                        containers[key] = current;
                        if (prevState.containerErrors?.[key])
                            containerErrors[key] = prevState.containerErrors[key];
                        return;
                    }
                }
                containers[container.key] = container;
                if (errors[container.key])
                    containerErrors[container.key] = errors[container.key];
            });
            const contextErrors = { ...prevState.contextErrors };
            if (invalidInventoryRow)
                contextErrors[con.uid] = "Container inventory row is invalid";
            else
                delete contextErrors[con.uid];
            return { containers, containerErrors, contextErrors };
        });

        if (!this.isCurrentConnection(con) || !this.healthRefreshGate.isCurrent(con.uid, request))
            return;
        if (invalidInventoryRow) {
            const schedulerRequest = this.schedulerRequests.begin(con.uid);
            this.applySchedulerCoverage(con, this.schedulerUid(con), snapshot, null,
                                        SCHEDULER_FAILURE, schedulerRequest);
            return;
        }
        await schedulerPromise;
    }

    schedulerErrorRecord(con, container, contextUid, reason) {
        return {
            key: makeKey(con.uid, container.Id),
            uid: contextUid,
            container_id: container.Id,
            name: container.Name,
            active_coverage_count: 0,
            coverage_count: 0,
            effective_interval_seconds: null,
            effective_interval_source: null,
            jitter_seconds: null,
            accuracy_seconds: null,
            schedules: [],
            coverage_status: "error",
            coverage_reason: "collector-error",
            collector_errors: [reason],
        };
    }

    applySchedulerCoverage(con, contextUid, containers, coverage, failure = null, request = null) {
        if (!this.isCurrentConnection(con))
            return false;
        if (request && !this.schedulerRequests.isCurrent(con.uid, request))
            return false;
        // Collector diagnostics are intentionally reduced to static codes at
        // the UI boundary.  Cockpit errors can contain URLs, command lines,
        // and health output; none belongs in a badge, title, or reason.
        const sourceErrors = Array.isArray(coverage?.collector_errors) ? coverage.collector_errors : [];
        const topErrors = failure ? [SCHEDULER_FAILURE] : (sourceErrors.length > 0 ? [SCHEDULER_INCOMPLETE] : []);
        const rawRecords = coverage?.containers && typeof coverage.containers === "object"
            ? coverage.containers
            : {};
        const records = {};
        for (const container of containers) {
            const id = container.Id;
            const key = makeKey(con.uid, id);
            const candidate = FULL_CONTAINER_ID.test(id)
                ? rawRecords[`${contextUid}-${id}`]
                : null;
            let record = candidate && typeof candidate === "object" && !Array.isArray(candidate) &&
                SCHEDULER_STATUSES.has(candidate.coverage_status)
                ? candidate
                : null;
            if (!record) {
                record = this.schedulerErrorRecord(con, container, contextUid,
                                                   FULL_CONTAINER_ID.test(id)
                                                       ? (candidate ? "scheduler-record-invalid" : "scheduler-record-missing")
                                                       : "scheduler-container-id-invalid");
            } else {
                record = { ...record, key };
            }
            if (topErrors.length > 0) {
                record = {
                    ...record,
                    coverage_status: "error",
                    coverage_reason: "collector-error",
                    collector_errors: [...(record.collector_errors || []), ...topErrors],
                };
            }
            const recordErrors = Array.isArray(record.collector_errors) && record.collector_errors.length > 0
                ? [SCHEDULER_INCOMPLETE]
                : [];
            record.collector_errors = [...new Set([...recordErrors, ...topErrors])];
            records[key] = record;
        }

        const ownerPrefix = `${con.uid ?? "user"}-`;
        this.setState(prevState => {
            if (request && !this.schedulerRequests.isCurrent(con.uid, request))
                return null;
            const schedulerCoverage = {};
            Object.entries(prevState.schedulerCoverage || {}).forEach(([key, value]) => {
                if (!key.startsWith(ownerPrefix))
                    schedulerCoverage[key] = value;
            });
            Object.assign(schedulerCoverage, records);
            const schedulerErrors = { ...(prevState.schedulerErrors || {}) };
            if (topErrors.length > 0)
                schedulerErrors[con.uid] = topErrors[0];
            else
                delete schedulerErrors[con.uid];
            return { schedulerCoverage, schedulerErrors };
        });
        return true;
    }

    async updateSchedulerCoverage(con, containers, request = null, refreshRequest = null, timeoutMs = HEALTH_SCHEDULER_TIMEOUT_MS) {
        if (!this.isCurrentConnection(con) ||
            (refreshRequest && !this.healthRefreshGate.isCurrent(con.uid, refreshRequest)))
            return;
        request ||= this.schedulerRequests.begin(con.uid);
        const contextUid = this.schedulerUid(con);
        if (!Number.isInteger(contextUid) || contextUid < 0) {
            this.applySchedulerCoverage(con, null, containers, null, "Session user UID is unavailable", request);
            return;
        }

        const identity = {
            containers: containers.map(container => ({
                uid: contextUid,
                id: container.Id,
                name: container.Name || container.Names?.[0]?.replace(/^\//, "") || null,
            })),
        };
        const owner = this.state.users.find(user => user.uid === con.uid);
        const options = {
            err: "message",
            environ: ["LC_ALL=C"],
        };
        let process;
        try {
            if (con.uid === null || con.uid === 0) {
                if (con.uid === 0)
                    options.superuser = "require";
                process = python.spawn(scheduler_collector,
                                       ["--uid", String(contextUid), "--timeout", "8"], options);
            } else {
                // A numeric --uid alone must never make root's systemctl --user
                // manager look like another user's manager. Run the helper in
                // the actual service user's bridge context instead.
                if (!owner?.name)
                    throw new Error("Service user name is unavailable");
                process = cockpit.spawn([
                    "runuser", "--preserve-environment", "-u", owner.name, "--",
                    "/usr/bin/python3", "-c", scheduler_collector,
                    "--uid", String(contextUid), "--timeout", "8",
                ], {
                    ...options,
                    superuser: "require",
                    environ: ["LC_ALL=C", `XDG_RUNTIME_DIR=/run/user/${contextUid}`],
                });
            }
            process.input(JSON.stringify(identity));
            process.input(null);
            const output = JSON.parse(await withTimeout(process, timeoutMs,
                                                        "Scheduler coverage collection timed out",
                                                        () => process?.close?.()));
            if (refreshRequest && !this.healthRefreshGate.isCurrent(con.uid, refreshRequest))
                return;
            if (output.schema !== SCHEDULER_SCHEMA || output.uid !== contextUid ||
                !output.containers || typeof output.containers !== "object")
                throw new Error("Scheduler collector returned an invalid schema");
            this.applySchedulerCoverage(con, contextUid, containers, output, null, request);
        } catch {
            if (refreshRequest && !this.healthRefreshGate.isCurrent(con.uid, refreshRequest))
                return;
            console.warn("scheduler coverage collection failed", { uid: con.uid, stage: "scheduler-collector" });
            this.applySchedulerCoverage(con, contextUid, containers, null, SCHEDULER_FAILURE, request);
        }
    }

    queueContainerStats(con, stats) {
        if (!this.isCurrentConnection(con))
            return;
        if (!Array.isArray(stats) || stats.length === 0)
            return;

        const uid = con.uid;
        let pending = this.pendingContainerStats.get(uid);
        if (pending && pending.con !== con) {
            const oldTimer = this.containerStatsTimers.get(uid);
            if (oldTimer !== undefined) {
                clearTimeout(oldTimer);
                this.containerStatsTimers.delete(uid);
            }
            pending = null;
        }
        if (!pending)
            pending = { con, values: {} };

        for (const stat of stats) {
            if (!stat || typeof stat.ContainerID !== "string")
                continue;
            pending.values[makeKey(uid, stat.ContainerID)] = stat;
        }
        if (Object.keys(pending.values).length === 0)
            return;
        this.pendingContainerStats.set(uid, pending);

        if (this.containerStatsTimers.has(uid))
            return;
        const timer = setTimeout(() => {
            this.containerStatsTimers.delete(uid);
            const current = this.pendingContainerStats.get(uid);
            if (!current || current !== pending)
                return;
            this.pendingContainerStats.delete(uid);
            if (!this.isCurrentConnection(con))
                return;
            this.setState(prevState => ({
                containersStats: { ...prevState.containersStats, ...current.values },
            }));
        }, CONTAINER_STATS_FLUSH_INTERVAL_MS);
        this.containerStatsTimers.set(uid, timer);
    }

    clearContainerStats(con, removeState = false) {
        const uid = con.uid;
        const timer = this.containerStatsTimers.get(uid);
        if (timer !== undefined) {
            clearTimeout(timer);
            this.containerStatsTimers.delete(uid);
        }
        const pending = this.pendingContainerStats.get(uid);
        if (!pending || pending.con === con)
            this.pendingContainerStats.delete(uid);
        if (!removeState)
            return;

        this.setState(prevState => {
            const ownerPrefix = `${uid ?? "user"}-`;
            const containersStats = {};
            Object.entries(prevState.containersStats || {}).forEach(([key, value]) => {
                if (!key.startsWith(ownerPrefix))
                    containersStats[key] = value;
            });
            return { containersStats };
        });
    }

    updateContainerStats(con) {
        client.streamContainerStats(con, reply => {
            if (reply.Error != null) // executed when container stop
                console.warn("Failed to update container stats:", JSON.stringify(reply.message));
            else
                this.queueContainerStats(con, reply.Stats);
        }).catch(ex => {
            if (ex.cause == "no support for CGroups V1 in rootless environments" || ex.cause == "Container stats resource only available for cgroup v2") {
                console.log("This OS does not support CgroupsV2. Some information may be missing.");
            } else
                console.warn("Failed to update container stats:", JSON.stringify(ex.message));
        });
    }

    initContainers(con) {
        // Initial inventory and deferred health work use the same global owner
        // gate as periodic refreshes. This prevents startup from launching an
        // unbounded burst across every discovered Podman context.
        this.healthRefreshGate.invalidate(con.uid);
        const entry = this.healthRefreshGate.start(con.uid, refreshRequest =>
            this.collectInitialContainers(con, refreshRequest));
        return entry.promise.then(() => {
            // An event can invalidate the initial inventory after Podman has
            // returned it but before the guarded state commit.  The old
            // generation then resolves without marking the owner loaded; make
            // that lifecycle self-healing instead of leaving the page in a
            // permanent container-loading state.
            if (this.isCurrentConnection(con) &&
                !this.healthRefreshGate.isCurrent(con.uid, entry.request) &&
                !this.state.users.find(user => user.uid === con.uid)?.containersLoaded)
                return this.initContainers(con);

            // Inventory rows are committed before the expensive detail pass.
            // Start that pass only after the initial gate has settled so the
            // first render is not held behind one inspect per container.
            if (this.isCurrentConnection(con)) {
                setTimeout(() => {
                    if (this.isCurrentConnection(con))
                        this.refreshOwnerHealth(con);
                }, 0);
            }
        }).catch(error => {
            console.warn("initContainers uid", con.uid, "failed:", error?.toString?.() || error);
            this.markOwnerHealthUnavailable(con, entry.request, error);
            this.setState(prevState => {
                if (!this.isCurrentConnection(con) || !this.healthRefreshGate.isCurrent(con.uid, entry.request))
                    return null;
                const users = prevState.users.map(u => u.uid === con.uid ? { ...u, containersLoaded: true } : u);
                return { users };
            });
        });
    }

    async collectInitialContainers(con, refreshRequest) {
        const request = this.schedulerRequests.begin(con.uid);
        const deadline = Date.now() + HEALTH_REFRESH_TIMEOUT_MS;
        const initialEventGenerations = new Map();
        const initialEventActions = new Map();
        const ownerPrefix = `${con.uid ?? "user"}-`;
        for (const [key, generation] of this.containerEventGenerations) {
            if (key.startsWith(ownerPrefix)) {
                initialEventGenerations.set(key, generation);
                initialEventActions.set(key, this.containerEventActions.get(key));
            }
        }
        try {
            const inventoryRequest = this.getContainerInventory(con);
            const containerList = await this.withContainerRequestTimeout(inventoryRequest,
                                                                         Math.max(1, deadline - Date.now()),
                                                                         "Initial container inventory timed out");
            if (!Array.isArray(containerList))
                throw new Error("container inventory is not an array");
            const validInventory = containerList.filter(isContainerInventoryRow);
            const invalidInventoryRow = validInventory.length !== containerList.length;
            if (!this.isCurrentConnection(con))
                return;

            this.setState(prevState => {
                const stillLoading = !prevState.users.find(user => user.uid === con.uid)?.containersLoaded;
                if (!this.isCurrentConnection(con) ||
                    (!this.healthRefreshGate.isCurrent(con.uid, refreshRequest) && !stillLoading))
                    return null;
                // keep/copy the containers of other users
                const copyContainers = {};
                const copyContainerErrors = {};
                Object.entries(prevState.containers || {}).forEach(([id, container]) => {
                    if (container.uid !== con.uid) {
                        copyContainers[id] = container;
                        if (prevState.containerErrors?.[id])
                            copyContainerErrors[id] = prevState.containerErrors[id];
                    }
                });
                const listedKeys = new Set(validInventory.map(container => makeKey(con.uid, container.Id)));
                Object.entries(prevState.containers || {}).forEach(([key, container]) => {
                    if (container.uid !== con.uid || listedKeys.has(key))
                        return;
                    const snapshotGeneration = initialEventGenerations.get(key) || 0;
                    const currentGeneration = this.containerEventGenerations.get(key) || 0;
                    const eventAction = currentGeneration === snapshotGeneration
                        ? initialEventActions.get(key)
                        : this.containerEventActions.get(key);
                    if (eventAction === "remove" || currentGeneration === snapshotGeneration)
                        return;
                    copyContainers[key] = container;
                    if (prevState.containerErrors?.[key])
                        copyContainerErrors[key] = prevState.containerErrors[key];
                });
                for (const inventory of validInventory) {
                    const id = inventory.Id;
                    const key = makeKey(con.uid, id);
                    const snapshotGeneration = initialEventGenerations.get(key) || 0;
                    const currentGeneration = this.containerEventGenerations.get(key) || 0;
                    const eventAction = currentGeneration === snapshotGeneration
                        ? initialEventActions.get(key)
                        : this.containerEventActions.get(key);
                    if (eventAction === "remove")
                        continue;
                    if (currentGeneration !== snapshotGeneration) {
                        const current = prevState.containers?.[key];
                        if (current) {
                            copyContainers[key] = current;
                            if (prevState.containerErrors?.[key])
                                copyContainerErrors[key] = prevState.containerErrors[key];
                            continue;
                        }
                    }
                    // The inventory call is deliberately the first render
                    // source. It supplies lifecycle and identity while the
                    // owner health refresh obtains the optional detail.
                    const current = prevState.containers?.[key] || null;
                    copyContainers[key] = containerFromInventory(inventory, con.uid, key, current);
                    if (current && prevState.containerErrors?.[key])
                        copyContainerErrors[key] = prevState.containerErrors[key];
                }

                const users = prevState.users.map(u => u.uid === con.uid ? { ...u, containersLoaded: true } : u);
                const contextErrors = { ...prevState.contextErrors };
                if (invalidInventoryRow)
                    contextErrors[con.uid] = "Container inventory row is invalid";
                else
                    delete contextErrors[con.uid];
                return { containers: copyContainers, containerErrors: copyContainerErrors, contextErrors, users };
            });
            this.updateContainerStats(con);
            if (invalidInventoryRow) {
                const schedulerRequest = this.schedulerRequests.begin(con.uid);
                this.applySchedulerCoverage(con, this.schedulerUid(con), validInventory, null,
                                            SCHEDULER_FAILURE, schedulerRequest);
            }
            // The deferred owner health pass starts scheduler collection from
            // the same inventory snapshot as its bounded detail requests.
        } catch (error) {
            if (!this.isCurrentConnection(con))
                return;
            console.warn("initContainers uid", con.uid, "getContainers failed:", error?.toString?.() || error);
            this.setState(prevState => {
                const stillLoading = !prevState.users.find(user => user.uid === con.uid)?.containersLoaded;
                if (!this.isCurrentConnection(con) ||
                    (!this.healthRefreshGate.isCurrent(con.uid, refreshRequest) && !stillLoading))
                    return null;
                const users = prevState.users.map(u => u.uid === con.uid ? { ...u, containersLoaded: true } : u);
                return {
                    containers: prevState.containers || {},
                    contextErrors: { ...prevState.contextErrors, [con.uid]: errorText(error) },
                    users,
                };
            });
            this.applySchedulerCoverage(con, this.schedulerUid(con), [], null, SCHEDULER_FAILURE, request);
        }
    }

    updateImages(con) {
        client.getImages(con)
                .then(reply => {
                    this.setState(prevState => {
                        // Copy only images that could not be deleted with this event
                        // So when event from one uid comes, only copy the other images
                        const copyImages = {};
                        Object.entries(prevState.images || {}).forEach(([Id, image]) => {
                            if (image.uid !== con.uid)
                                copyImages[Id] = image;
                        });
                        Object.entries(reply).forEach(([Id, image]) => {
                            image.uid = con.uid;
                            image.key = makeKey(con.uid, Id);
                            copyImages[image.key] = image;
                        });

                        const users = prevState.users.map(u => u.uid === con.uid ? { ...u, imagesLoaded: true } : u);
                        return { images: copyImages, users };
                    });
                })
                .catch(ex => {
                    console.warn("Failed to do updateImages for uid", con.uid, ":", JSON.stringify(ex));
                });
    }

    updatePods(con) {
        return client.getPods(con)
                .then(reply => {
                    this.setState(prevState => {
                        // Copy only pods that could not be deleted with this event
                        // So when event from one uid comes, only copy the other pods
                        const copyPods = {};
                        Object.entries(prevState.pods || {}).forEach(([id, pod]) => {
                            if (pod.uid !== con.uid)
                                copyPods[id] = pod;
                        });
                        for (const pod of reply || []) {
                            pod.uid = con.uid;
                            pod.key = makeKey(con.uid, pod.Id);
                            copyPods[pod.key] = pod;
                        }

                        const users = prevState.users.map(u => u.uid === con.uid ? { ...u, podsLoaded: true } : u);
                        return { pods: copyPods, users };
                    });
                })
                .catch(ex => {
                    console.warn("Failed to do updatePods for uid", con.uid, ":", JSON.stringify(ex));
                });
    }

    updateContainer(con, id, event) {
        if (!this.isCurrentConnection(con))
            return Promise.resolve();
        const key = makeKey(con.uid, id);
        this.markContainerEvent(con, id, event?.Action);
        // A Podman event is newer than a periodic snapshot that may still be
        // in flight.  Invalidate that snapshot and let the serialized inspect
        // below become the owner-scoped source of truth.
        if (!["health_status", "exec_died"].includes(event?.Action))
            this.healthRefreshGate.invalidate(con.uid);
        const request = this.containerEventRequests.begin(key);
        const schedulerRequest = ["create", "rename", "start"].includes(event?.Action)
            ? this.schedulerRequests.begin(con.uid)
            : null;
        /* when firing off multiple calls in parallel, podman can return them in a random order.
         * This messes up the state. So we need to serialize them for a particular container. */
        const wait = this.pendingUpdateContainer[key] ?? Promise.resolve();

        const new_wait = wait.catch(() => undefined).then(() => {
            // A newer event may have arrived while this container's previous
            // inspect was queued. Do not spend another global request slot on
            // an event whose result is already obsolete.
            if (!this.isCurrentConnection(con) || !this.containerEventRequests.isCurrent(key, request))
                return;
            const inspectRequest = this.inspectContainer(con, id);
            return this.withContainerRequestTimeout(inspectRequest,
                                                    HEALTH_EVENT_INSPECT_TIMEOUT_MS,
                                                    "Container event inspect timed out");
        })
                .then(details => {
                    if (!this.isCurrentConnection(con) || !this.containerEventRequests.isCurrent(key, request))
                        return;
                    if (!isValidHealthDetails({ Id: id }, details)) {
                        this.setState(prevState => {
                            if (!this.isCurrentConnection(con) || !this.containerEventRequests.isCurrent(key, request))
                                return null;
                            return { containerErrors: { ...prevState.containerErrors, [key]: CONTAINER_INSPECT_INVALID } };
                        });
                        return;
                    }
                    details.uid = con.uid;
                    details.key = key;
                    details.healthDetailsLoaded = true;
                    // HACK: during restart State never changes from "running"
                    //       override it to reconnect console after restart
                    if (event?.Action === "restart")
                        details.State.Status = "restarting";
                    this.setState(prevState => {
                        if (!this.isCurrentConnection(con) || !this.containerEventRequests.isCurrent(key, request))
                            return null;
                        const containerErrors = { ...prevState.containerErrors };
                        delete containerErrors[key];
                        return {
                            containers: { ...prevState.containers, [key]: details },
                            containerErrors,
                        };
                    }, () => {
                        if (["create", "rename", "start"].includes(event?.Action) &&
                            this.isCurrentConnection(con) && this.containerEventRequests.isCurrent(key, request)) {
                            const containers = Object.values(this.state.containers || {})
                                    .filter(container => container.uid === con.uid);
                            this.updateSchedulerCoverage(con, containers, schedulerRequest);
                        }
                    });
                })
                .catch(e => {
                    if (!this.isCurrentConnection(con) || !this.containerEventRequests.isCurrent(key, request))
                        return;
                    console.warn("updateContainer uid", con.uid, "inspectContainer failed:", e.toString());
                    this.setState(prevState => ({
                        containerErrors: { ...prevState.containerErrors, [key]: errorText(e) }
                    }));
                });
        this.pendingUpdateContainer[key] = new_wait;
        const clearPending = () => {
            if (this.pendingUpdateContainer[key] === new_wait)
                delete this.pendingUpdateContainer[key];
        };
        new_wait.then(clearPending, clearPending);

        return new_wait;
    }

    updateImage(con, id) {
        client.getImages(con, id)
                .then(reply => {
                    const image = reply[id];
                    image.uid = con.uid;
                    image.key = makeKey(con.uid, id);
                    this.updateState("images", image.key, image);
                })
                .catch(ex => {
                    console.warn("Failed to do updateImage for uid", con.uid, ":", JSON.stringify(ex));
                });
    }

    updatePod(con, id) {
        return client.getPods(con, id)
                .then(reply => {
                    if (reply && reply.length > 0) {
                        const pod = reply[0];

                        pod.uid = con.uid;
                        pod.key = makeKey(con.uid, id);
                        this.updateState("pods", pod.key, pod);
                    }
                })
                .catch(ex => {
                    console.warn("Failed to do updatePod for uid", con.uid, ":", JSON.stringify(ex));
                });
    }

    // see https://docs.podman.io/en/latest/markdown/podman-events.1.html

    handleImageEvent(event, con) {
        switch (event.Action) {
        case 'push':
        case 'save':
        case 'tag':
            this.updateImage(con, event.Actor.ID);
            break;
        case 'pull': // Pull event has not event.id
        case 'untag':
        case 'remove':
        case 'prune':
        case 'build':
            this.updateImages(con);
            break;
        default:
            console.warn('Unhandled event type ', event.Type, event.Action);
        }
    }

    handleContainerEvent(event, con) {
        const id = event.Actor.ID;

        switch (event.Action) {
        /* The following events do not need to trigger any state updates */
        case 'attach':
        case 'exec':
        case 'export':
        case 'import':
        case 'init':
        case 'kill':
        case 'mount':
        case 'prune':
        case 'restart':
        case 'sync':
        case 'unmount':
        case 'wait':
            break;
        /* The following events need only to update the Container list
         * We do get the container affected in the event object but for
         * now we 'll do a batch update
         */
        case 'start':
            // HACK: We don't get 'started' event for pods got started by the first container which was added to them
            // https://github.com/containers/podman/issues/7213
            (event.Actor.Attributes.podId
                ? this.updatePod(con, event.Actor.Attributes.podId)
                : this.updatePods(con)
            ).then(() => this.updateContainer(con, id, event));
            break;
        case 'checkpoint':
        case 'cleanup':
        case 'create':
        case 'died':
        case 'exec_died': // HACK: pick up health check runs with older podman versions, see https://github.com/containers/podman/issues/19237
        case 'health_status':
        case 'pause':
        case 'restore':
        case 'stop':
        case 'unpause':
        case 'rename': // rename event is available starting podman v4.1; until then the container does not get refreshed after renaming
            this.updateContainer(con, id, event);
            break;

        case 'remove': {
            this.markContainerEvent(con, id, event?.Action || "remove");
            // Invalidate an inspect started for an earlier event before
            // removing the row.  Otherwise its late response could
            // resurrect a container that Podman has already deleted.
            this.containerEventRequests.begin(makeKey(con.uid, id));
            this.healthRefreshGate.invalidate(con.uid);
            const request = this.schedulerRequests.begin(con.uid);
            this.setState(prevState => {
                const containers = { ...prevState.containers };
                delete containers[makeKey(con.uid, id)];
                const containerErrors = { ...prevState.containerErrors };
                delete containerErrors[makeKey(con.uid, id)];
                const schedulerCoverage = { ...prevState.schedulerCoverage };
                delete schedulerCoverage[makeKey(con.uid, id)];
                let pods;

                if (event.Actor.Attributes.podId) {
                    const podKey = makeKey(con.uid, event.Actor.Attributes.podId);
                    const newPod = { ...prevState.pods[podKey] };
                    newPod.Containers = newPod.Containers.filter(container => container.Id !== id);
                    pods = { ...prevState.pods, [podKey]: newPod };
                } else {
                    // HACK: with podman < 4.3.0 we don't get a pod event when a container in a pod is removed
                    // https://github.com/containers/podman/issues/15408
                    pods = prevState.pods;
                    this.updatePods(con);
                }
                return { containers, containerErrors, schedulerCoverage, pods };
            }, () => {
                // Read the post-removal state from the setState callback.  The
                // old immediate read could feed the deleted container back to
                // the scheduler and resurrect stale coverage.
                if (!this.isCurrentConnection(con) || !this.schedulerRequests.isCurrent(con.uid, request))
                    return;
                const remaining = Object.values(this.state.containers || {})
                        .filter(container => container.uid === con.uid && container.Id !== id);
                this.updateSchedulerCoverage(con, remaining, request);
            });
            break;
        }

        // only needs to update the Image list, this ought to be an image event
        case 'commit':
            this.updateImages(con);
            break;
        default:
            console.warn('Unhandled event type ', event.Type, event.Action);
        }
    }

    handlePodEvent(event, con) {
        switch (event.Action) {
        case 'create':
        case 'kill':
        case 'pause':
        case 'start':
        case 'stop':
        case 'unpause':
            this.updatePod(con, event.Actor.ID);
            break;
        case 'remove':
            this.setState(prevState => {
                const pods = { ...prevState.pods };
                delete pods[makeKey(con.uid, event.Actor.ID)];
                return { pods };
            });
            break;
        default:
            console.warn('Unhandled event type ', event.Type, event.Action);
        }
    }

    handleEvent(event, con) {
        switch (event.Type) {
        case 'container':
            this.handleContainerEvent(event, con);
            break;
        case 'image':
            this.handleImageEvent(event, con);
            break;
        case 'pod':
            this.handlePodEvent(event, con);
            break;
        default:
            console.warn('Unhandled event type ', event.Type);
        }
    }

    cleanupAfterService(con) {
        if (!this.invalidateOwner(con))
            return;
        this.clearContainerStats(con, true);
        debug("cleanupAfterService", con.uid, "current owner filter:", this.state.ownerFilter);
        this.setState(prevState => {
            const next = {};
            ["images", "containers", "pods"].forEach(t => {
                if (!prevState[t])
                    return;
                next[t] = {};
                Object.entries(prevState[t]).forEach(([id, value]) => {
                    if (value.uid !== con.uid)
                        next[t][id] = value;
                });
            });

            const containerErrors = {};
            Object.entries(prevState.containerErrors || {}).forEach(([id, error]) => {
                if (!id.startsWith(`${con.uid ?? "user"}-`))
                    containerErrors[id] = error;
            });
            const contextErrors = { ...prevState.contextErrors };
            delete contextErrors[con.uid];
            const schedulerCoverage = {};
            Object.entries(prevState.schedulerCoverage || {}).forEach(([id, value]) => {
                if (!id.startsWith(`${con.uid ?? "user"}-`))
                    schedulerCoverage[id] = value;
            });
            const schedulerErrors = { ...prevState.schedulerErrors };
            delete schedulerErrors[con.uid];
            return { ...next, containerErrors, contextErrors, schedulerCoverage, schedulerErrors };
        });

        // keep dummy (null) connections from other users, only remove valid ones
        this.setState(prevState => ({ users: prevState.users.filter(u => u.con === null || u.uid !== con.uid) }));

        // reset owner filter if the current filter is the closed connection
        if (con.uid == this.state.ownerFilter)
            this.onOwnerChanged("all");
    }

    // Read information about quadlets from /run/ until podman provides a remote API for this.
    // https://github.com/containers/podman/issues/27119
    // Required for cockpit-podman to show inactive quadlets which have no
    // stopped container/pod associated with them as they are ephemeral.
    // The state object of the container or pod has just enough properties to mock a real inactive container or pod.
    async initQuadlets(con) {
        let path = "/run/systemd/generator";
        let quadlets = { pods: {}, containers: {} };

        if (con.uid === null) {
            path = `${sessionStorage.getItem('XDG_RUNTIME_DIR')}/systemd/generator`;
        } else if (con.uid !== 0) {
            // TODO: support loading other users quadlets
            debug(`unsupported connection ${con.uid} for loading quadlets`);
            this.setState(prevState => {
                const users = prevState.users.map(u => u.uid === con.uid ? { ...u, quadletsLoaded: true } : u);
                return { users };
            });
            return;
        }

        try {
            const quadlets_str = await python.spawn(detect_quadlets, [path]);
            quadlets = JSON.parse(quadlets_str);
        } catch (exc) {
            console.warn(`error during discovering of quadlets for ${con.uid}`, exc);
            this.setState(prevState => {
                const users = prevState.users.map(u => u.uid === con.uid ? { ...u, quadletsLoaded: true } : u);
                return { users };
            });
            return;
        }

        // { id-service_name: { } }
        this.setState(prevState => {
            const podNameServiceMap = {};

            const copyQuadletPods = {};
            // keep/copy the pods of other users
            Object.entries(prevState.quadletPods || {}).forEach(([id, container]) => {
                if (container.uid !== con.uid)
                    copyQuadletPods[id] = container;
            });

            for (const key of Object.keys(quadlets.pods)) {
                const quadlet_pod = quadlets.pods[key];
                const container_key = makeKey(con.uid, key);

                const pod = {
                    uid: con.uid,
                    key: container_key,
                    Id: container_key,
                    Status: "Exited",
                    Name: quadlet_pod.name,
                    Labels: {
                        PODMAN_SYSTEMD_UNIT: key,
                    }
                };
                copyQuadletPods[pod.key] = pod;

                // The key is the service name, but that isn't used in reference
                podNameServiceMap[basename(quadlet_pod.source_path)] = key;
            }

            const copyQuadletContainers = {};
            // keep/copy the containers of other users
            Object.entries(prevState.quadletContainers || {}).forEach(([id, container]) => {
                if (container.uid !== con.uid)
                    copyQuadletContainers[id] = container;
            });

            for (const key of Object.keys(quadlets.containers)) {
                const quadlet = quadlets.containers[key];
                const container_key = makeKey(con.uid, key);

                // Mock podman container state
                const container = {
                    uid: con.uid,
                    key: container_key,
                    Id: key,
                    // This is a display-only row synthesized from a systemd
                    // unit; it does not have a Podman container ID.
                    IsQuadlet: true,
                    IsService: false,
                    IsInfra: false,
                    Name: quadlet.name,
                    ImageName: quadlet.image,
                    NetworkSettings: {
                        Ports: [],
                    },
                    Mounts: [],
                    Config: {
                        Labels: {
                            PODMAN_SYSTEMD_UNIT: key,
                        },
                    },
                    State: {
                        Status: 'exited'
                    }
                };

                if (quadlet.exec) {
                    container.Config.Cmd = quadlet.exec;
                }

                const found_pod = podNameServiceMap[quadlet.pod];
                if (found_pod) {
                    container.Pod = found_pod;
                }
                copyQuadletContainers[container.key] = container;
            }

            const users = prevState.users.map(u => u.uid === con.uid ? { ...u, quadletsLoaded: true } : u);
            return { quadletContainers: copyQuadletContainers, quadletPods: copyQuadletPods, users };
        });
    }

    async subscribeDaemonReload(con) {
        // We don't support subscribing on reload events for "other" users.
        if (con.uid !== 0 && con.uid !== null) {
            return;
        }

        debug('subscribe daemon reload', con);

        const options = con.uid === 0 ? { bus: "system", superuser: "try" } : { bus: "session" };
        const subscribe = (client) => {
            const subscription = client.subscribe({ interface: "org.freedesktop.systemd1.Manager", member: "Reloading" }, (_path, _iface, _signal, [reloading]) => {
                if (!reloading)
                    this.initQuadlets(con);
            });

            this.setState(prevState => {
                const users = prevState.users.map(u => u.uid === con.uid ? { ...u, dbus: { client, subscription } } : u);
                return { users };
            });
        };

        let client = null;
        const user = this.state.users.find(u => u.uid === con.uid);

        // don't add multiple Reload subscriptions
        if (user?.dbus?.subscription) {
            return;
        }

        if (user?.dbus) {
            client = user.dbus.client;
        } else {
            client = cockpit.dbus("org.freedesktop.systemd1", options);
        }

        client.call("/org/freedesktop/systemd1", "org.freedesktop.systemd1.Manager", "Subscribe", []).then(() => {
            subscribe(client);
        })
                .catch(err => {
                    if (err.name === "org.freedesktop.systemd1.AlreadySubscribed") {
                        subscribe(client);
                    } else {
                        client.close();
                        console.error(`Cannot subscribe systemd reload event for ${con.uid}`);
                    }
                });
    }

    async init(uid, username) {
        debug("init uid", uid, "name", username);
        const system = uid === 0;
        const is_other_user = (uid !== 0 && uid !== null);

        let con = null;

        try {
            const start_args = [
                ...(is_other_user ? ["runuser", "-u", username, "--"] : []),
                "systemctl",
                ...(system ? [] : ["--user"]),
                "start", "podman.socket"
            ];
            const environ = is_other_user ? [`XDG_RUNTIME_DIR=/run/user/${uid}`] : [];
            await cockpit.spawn(start_args, { superuser: uid === null ? null : "require", err: "message", environ });
            con = rest.connect(uid);
            const reply = await client.getInfo(con);
            this.ownerConnections.set(uid, con);
            this.setState(prevState => {
                const users = prevState.users.filter(u => u.uid !== uid);
                users.push({ con, uid, name: username, containersLoaded: false, podsLoaded: false, imagesLoaded: false, quadletsLoaded: false });
                // keep a nice sort order for dialogs
                users.sort(compareUser);
                debug("init uid", uid, "username", username, "new users:", users);
                return {
                    users,
                    version: reply.version.Version,
                    registries: reply.registries,
                    cgroupVersion: reply.host.cgroupVersion,
                };
            });
        } catch (err) {
            if (!system || err.problem != 'access-denied')
                console.warn("init uid", uid, "getInfo failed:", err.toString());

            this.setState(prevState => ({ users: prevState.users.filter(u => u.uid !== uid) }));
            return;
        }

        this.updateImages(con);
        this.initContainers(con);
        this.initQuadlets(con);
        this.subscribeDaemonReload(con);
        this.updatePods(con);

        client.streamEvents(con, message => this.handleEvent(message, con))
                .catch(e => console.error("uid", uid, "streamEvents failed:", JSON.stringify(e)))
                .finally(() => {
                    console.log("uid", uid, "podman service closed");
                    this.cleanupAfterService(con);
                    const user = this.state.users.find(u => u.uid === uid);
                    if (user?.dbus) {
                        user.dbus?.subscription?.remove();
                        user.dbus?.client?.close();
                    }
                });
    }

    componentDidMount() {
        this.healthRefreshTimer = window.setInterval(() => this.refreshHealthOwners(), HEALTH_REFRESH_INTERVAL_MS);
        superuser.addEventListener("changed", () => this.init(0, _("system")));

        cockpit.user().then(user => {
            this.sessionUser = user;
            // there is no "user service" for root, ignore that
            if (user.id === 0) {
                // clear the dummy init user, otherwise UI waits forever for initialization
                this.setState(prevState => ({ users: prevState.users.filter(u => u.uid !== null) }));
                return;
            }

            cockpit.spawn(["printenv", "XDG_RUNTIME_DIR"])
                    .then(xrd => {
                        sessionStorage.setItem('XDG_RUNTIME_DIR', xrd.trim());
                        this.init(null, user.name || _("User"));
                        this.checkUserRestartService();
                    })
                    .catch(e => console.log("Could not read $XDG_RUNTIME_DIR:", e.message));

            // HACK: https://github.com/systemd/systemd/issues/22244#issuecomment-1210357701
            cockpit.file(`/var/lib/systemd/linger/${user.name}`).watch((content, tag) => {
                if (content == null && tag === '-') {
                    this.setState({ userLingeringEnabled: false });
                } else {
                    this.setState({ userLingeringEnabled: true });
                }
            });

            // detect which other users have containers running
            cockpit.spawn([
                'find', '/sys/fs/cgroup',
                // RHEL 8 version still calls it "podman-*.scope", newer ones "libpod*"
                '(', '-name', 'libpod.*scope', '-o', '-name', 'podman-*.scope',
                '-o', '-name', 'libpod-payload*', ')',
                '-exec', 'stat', '--format=%u %U', '{}', ';'],
                          // this find command doesn't need root, but user switching does;
                          // hence skip the whole detection for unpriv sessions
                          { superuser: "require", error: "message" })
                    .then(output => {
                        const other_users = [];
                        const trimmed = output.trim();
                        if (!trimmed)
                            return;

                        trimmed.split('\n').forEach(line => {
                            const [uid_str, username] = line.split(' ');
                            const uid = parseInt(uid_str);
                            if (isNaN(uid)) {
                                console.error(`User container detection: invalid uid '${uid_str}' in output '${output}'`); // not-covered: Should Not Happen™
                                return; // not-covered: ditto
                            }
                            // ignore standard users
                            if (uid === 0 || uid === user.id)
                                return;
                            if (!other_users.find(u => u.uid === uid))
                                other_users.push({ uid, name: username, con: null });
                        });
                        debug("other users who have containers running:", JSON.stringify(other_users));
                        this.setState(prevState => ({ users: prevState.users.concat(other_users) }));
                    })
                    .catch(ex => {
                        if (ex.problem == 'access-denied')
                            debug("unprivileged session, skipping detection of other users");
                        else
                            console.warn("failed to detect other users:", ex);
                    });
        });

        cockpit.spawn("selinuxenabled", { error: "ignore" })
                .then(() => this.setState({ selinuxAvailable: true }))
                .catch(() => this.setState({ selinuxAvailable: false }));

        cockpit.addEventListener("locationchanged", this.onNavigate);
        this.onNavigate();
    }

    componentWillUnmount() {
        cockpit.removeEventListener("locationchanged", this.onNavigate);

        if (this.healthRefreshTimer !== null)
            window.clearInterval(this.healthRefreshTimer);
        for (const con of this.ownerConnections.values()) {
            this.invalidateOwner(con);
            this.clearContainerStats(con);
        }
        this.pendingContainerStats.clear();
        this.containerStatsTimers.forEach(timer => clearTimeout(timer));
        this.containerStatsTimers.clear();
        this.ownerConnections.clear();

        // Cleanup DBus subscriptions
        this.state.users.forEach(user => {
            if (user?.dbus) {
                user.dbus?.subscription?.remove();
                user.dbus?.client?.close();
            }
        });
    }

    onNavigate() {
        // HACK: Use usePageLocation when this is rewritten into a functional component
        const { options, path } = cockpit.location;
        this.setState({ location: options }, () => {
            // only use the root path
            if (path.length === 0) {
                if (options.name) {
                    this.onFilterChanged(options.name);
                }
                if (options.container) {
                    this.onContainerFilterChanged(options.container);
                }
                if (["all", undefined].includes(options.owner)) {
                    // disconnect all non-standard users
                    this.setState(prevState => ({
                        users: prevState.users.map(u => {
                            if (u.uid !== 0 && u.uid !== null && u.con) {
                                debug("onNavigate All: closing unused connection to", u.name);
                                u.con.close();
                                return { uid: u.uid, name: u.name, con: null };
                            } else
                                return u;
                        }),
                        ownerFilter: "all",
                    }));
                } else {
                    const uid = options.owner === "user" ? null : parseInt(options.owner);
                    const user = this.state.users.find(u => u.uid === uid);
                    if (user) {
                        // disconnect other non-standard users, to avoid piling up connections
                        this.setState(prevState => ({
                            users: prevState.users.map(u => {
                                if (u.uid !== uid && u.uid !== 0 && u.uid !== null && u.con) {
                                    debug("onNavigate", user.name, ": closing unused connection to", u.name);
                                    u.con.close();
                                    return { uid: u.uid, name: u.name, con: null };
                                } else
                                    return u;
                            }),
                            ownerFilter: uid === null ? "user" : uid,
                        }), () => {
                            if (user.con === null) {
                                debug("onNavigate", user.name, ": initializing connection");
                                this.init(user.uid, user.name);
                            } else {
                                debug("onNavigate", user.name, ": connection already initialized");
                            }
                        });
                    } else {
                        console.warn("Unknown user", options.owner, "in URL, ignoring");
                        debug("known users:", JSON.stringify(this.state.users.map(u => [u.name, u.uid])));
                        // reset URL to current value
                        this.updateUrl({ ...this.state.location, owner: this.state.ownerFilter });
                    }
                }
            }
        });
    }

    async checkUserRestartService() {
        const out = await cockpit.spawn(
            ["systemctl", "--user", "show", "--value", "-p", "LoadState", "podman-restart"],
            { environ: ["LC_ALL=C"], error: "ignore" });
        this.setState({ userPodmanRestartAvailable: out.trim() === "loaded" });
    }

    goToServicePage(e) {
        if (!e || e.button !== 0)
            return;
        cockpit.jump("/system/services#/podman.socket");
    }

    render() {
        // show troubleshoot if no users are available, i.e. all user's podman services failed
        if (this.state.users.length === 0) {
            return (
                <Page className="pf-m-no-sidebar">
                    <PageSection hasBodyWrapper={false}>
                        <EmptyState headingLevel="h2" icon={ExclamationCircleIcon} titleText={_("Podman service failed")} variant={EmptyStateVariant.full}>
                            <EmptyStateFooter>
                                <EmptyStateActions>
                                    <Button variant="primary" onClick={this.goToServicePage}>
                                        {_("Troubleshoot")}
                                    </Button>
                                </EmptyStateActions>
                            </EmptyStateFooter>
                        </EmptyState>
                    </PageSection>
                </Page>
            );
        }

        if (this.state.users.find(u => u.con === null && (u.uid === 0 || u.uid === null))) // not initialized yet
            return null;

        let imageContainerList = {};
        if (this.state.containers !== null) {
            Object.keys(this.state.containers).forEach(c => {
                const container = this.state.containers[c];
                const imageKey = makeKey(container.uid, container.Image);
                if (!imageContainerList[imageKey])
                    imageContainerList[imageKey] = [];
                imageContainerList[imageKey].push({
                    container,
                    stats: this.state.containersStats[makeKey(container.uid, container.Id)],
                });
            });
        } else
            imageContainerList = null;

        const loadingImages = this.state.users.find(u => u.con && !u.imagesLoaded);
        const loadingContainers = this.state.users.find(u => u.con && !u.containersLoaded);
        const loadingPods = this.state.users.find(u => u.con && !u.podsLoaded);
        const loadingQuadlets = this.state.users.find(u => u.con && !u.quadletsLoaded);

        const imageList = (
            <Images
                key="imageList"
                images={loadingImages ? null : this.state.images}
                imageContainerList={imageContainerList}
                onAddNotification={this.onAddNotification}
                textFilter={this.state.textFilter}
                ownerFilter={this.state.ownerFilter}
                showAll={ () => this.setState({ containersFilter: "all" }) }
                users={this.state.users}
            />
        );
        const containerList = (
            <Containers
                key="containerList"
                version={this.state.version}
                images={loadingImages ? null : this.state.images}
                containers={loadingContainers ? null : this.state.containers}
                containerErrors={this.state.containerErrors}
                contextErrors={this.state.contextErrors}
                schedulerCoverage={this.state.schedulerCoverage}
                schedulerErrors={this.state.schedulerErrors}
                pods={loadingPods ? null : this.state.pods}
                containersStats={this.state.containersStats}
                filter={this.state.containersFilter}
                handleFilterChange={this.onContainerFilterChanged}
                textFilter={this.state.textFilter}
                ownerFilter={this.state.ownerFilter}
                users={this.state.users}
                onAddNotification={this.onAddNotification}
                cgroupVersion={this.state.cgroupVersion}
                updateContainer={this.updateContainer}
                quadletContainers={loadingQuadlets ? null : this.state.quadletContainers}
                quadletPods={loadingQuadlets ? null : this.state.quadletPods}
            />
        );

        const notificationList = (
            <AlertGroup isToast>
                {this.state.notifications.map((notification, index) => {
                    return (
                        <Alert key={index} title={notification.error} variant={notification.type}
                               isLiveRegion
                               actionClose={<AlertActionCloseButton onClose={() => this.onDismissNotification(notification.index)} />}>
                            {notification.errorDetail}
                        </Alert>
                    );
                })}
            </AlertGroup>
        );

        const contextInfo = {
            cgroupVersion: this.state.cgroupVersion,
            registries: this.state.registries,
            selinuxAvailable: this.state.selinuxAvailable,
            userPodmanRestartAvailable: this.state.userPodmanRestartAvailable,
            userLingeringEnabled: this.state.userLingeringEnabled,
            version: this.state.version,
        };

        return (
            <WithPodmanInfo value={contextInfo}>
                <WithDialogs>
                    <Page id="overview" key="overview" className="pf-m-no-sidebar">
                        {notificationList}
                        <PageSection hasBodyWrapper={false} className="content-filter"
                        >
                            <ContainerHeader
                              handleFilterChanged={this.onFilterChanged}
                              handleOwnerChanged={this.onOwnerChanged}
                              ownerFilter={this.state.ownerFilter}
                              textFilter={this.state.textFilter}
                              users={this.state.users}
                            />
                        </PageSection>
                        <PageSection hasBodyWrapper={false} className='ct-pagesection-mobile'>
                            <Stack hasGutter>
                                {imageList}
                                {containerList}
                            </Stack>
                        </PageSection>
                    </Page>
                </WithDialogs>
            </WithPodmanInfo>
        );
    }
}

export default Application;
