/* SPDX-License-Identifier: LGPL-2.1-or-later */

/*
 * Keep health interpretation independent from React.  Apart from making the
 * row renderer easier to audit, this gives the browser tests a deterministic
 * contract for missing, stale, and collection-error states.
 */

export const healthStates = Object.freeze({
    healthy: "healthy",
    unhealthy: "unhealthy",
    starting: "starting",
    missing: "missing",
    stale: "stale",
    unknown: "unknown",
    error: "error",
    stopped: "stopped",
    completed: "completed",
    retired: "retired",
    infrastructure: "infrastructure",
});

// A lifecycle disposition is optional source metadata from the protected
// bootstrap collector. Podman does not infer that an exited container was a
// one-shot job, and the display must not turn names, exit codes, service names,
// labels, or arbitrary inspect fields into that claim.
export const lifecycleDispositionClasses = Object.freeze({
    completed: "completed_one_shot",
    retired: "retired",
    infrastructure: "infrastructure_only",
    stopped: "stopped",
});

const LIFECYCLE_CLASSES = new Set(Object.values(lifecycleDispositionClasses));
const LIFECYCLE_TEXT_MAX_LENGTH = 240;
const FULL_LIFECYCLE_ID = /^[0-9a-f]{64}$/;
const FULL_CONTAINER_ID = /^[0-9a-f]{64}$/;
const FULL_SHA256 = /^[0-9a-f]{64}$/;
const LIFECYCLE_POLICY_SHA256 = "b58d2c2b95f46efc3cbd4fdf3b2c62a0024190c091d668e0a6f754d553ee4f81";
const LIFECYCLE_POLICY_EVIDENCE_REF = "worktrees/misc-source/train.home.complete.tech/ops/fleet-recovery-20260907.md";

const containsControlCharacter = value => {
    for (const character of value) {
        const code = character.codePointAt(0);
        if (code <= 0x1f || code === 0x7f)
            return true;
    }
    return false;
};

const lifecycleText = value => {
    if (typeof value !== "string" || value.length === 0 || value.length > LIFECYCLE_TEXT_MAX_LENGTH ||
        containsControlCharacter(value) || /https?:\/\//i.test(value))
        return null;
    return value.trim() || null;
};

// Keep operator-facing detail deliberately small and inert.  Collection
// failures and lifecycle records can originate outside the browser process;
// a command line, URL, control character, or unbounded payload must never be
// copied into a badge, tooltip, or health summary.
export const sanitizeHealthDetail = value => {
    if (typeof value !== "string" || value.length === 0 || value.length > LIFECYCLE_TEXT_MAX_LENGTH ||
        containsControlCharacter(value) || /https?:\/\//i.test(value))
        return null;
    return value.trim() || null;
};

// The route UID identifies the Cockpit connection (the session-user route is
// represented by null), while ownerUid identifies the Podman namespace that
// owns the container.  Keep both values so a same-named or same-short-ID row
// can never inherit another context's health result.
export const containerScope = container => {
    const routeUid = container?.uid === null ||
        (typeof container?.uid === "number" && Number.isInteger(container.uid) && container.uid >= 0)
        ? container.uid
        : null;
    const ownerUid = typeof container?.ownerUid === "number" && Number.isInteger(container.ownerUid) && container.ownerUid >= 0
        ? container.ownerUid
        : routeUid;
    const id = typeof container?.Id === "string" && container.Id.length > 0 ? container.Id : null;
    const context = container?.context === "rootful" || container?.context === "rootless"
        ? container.context
        : ownerUid === 0 ? "rootful" : ownerUid === null ? "unknown" : "rootless";
    return {
        routeUid,
        ownerUid,
        context,
        id,
        fullId: id && FULL_CONTAINER_ID.test(id) ? id : null,
    };
};

const SAFE_HEALTH_REASON_CODES = new Set([
    "details-pending", "starting", "missing", "stale", "scheduler-coverage-missing",
    "scheduler-unavailable", "scheduler-unknown", "latest-check-unknown", "freshness-unknown",
    "no-result", "scheduler-error", "collection-timeout", "collection-error", "unhealthy",
    "latest-check-failed", "timestamp-future", "stopped", "completed", "retired", "infrastructure", "error", "healthy",
]);

export const healthDetail = assessment => {
    const reason = sanitizeHealthDetail(assessment?.disposition?.reason);
    const code = SAFE_HEALTH_REASON_CODES.has(assessment?.reason) ? assessment.reason : "unknown";
    switch (assessment?.status) {
    case healthStates.healthy:
        return { code: "healthy", reason: null };
    case healthStates.unhealthy:
        return {
            code: assessment.reason === "latest-check-failed" ? "latest-check-failed" : "unhealthy",
            reason: null,
        };
    case healthStates.starting:
        return {
            code: assessment.reason === "details-pending" ? "details-pending" : "starting",
            reason: null,
        };
    case healthStates.missing:
        return { code: "missing", reason: null };
    case healthStates.stale:
        return { code: "stale", reason: null };
    case healthStates.unknown:
        return { code, reason: null };
    case healthStates.error:
        return { code: code === "unknown" ? "error" : code, reason: null };
    case healthStates.stopped:
        return { code: "stopped", reason };
    case healthStates.completed:
        return { code: "completed", reason };
    case healthStates.retired:
        return { code: "retired", reason };
    case healthStates.infrastructure:
        return { code: "infrastructure", reason };
    default:
        return { code: "unknown", reason: null };
    }
};

export const healthAge = assessment => {
    const age = assessment?.ageMs;
    return Number.isFinite(age) && age >= 0 ? age : null;
};

const lifecycleClass = value => {
    return typeof value === "string" && LIFECYCLE_CLASSES.has(value) ? value : null;
};

const lifecycleMetadataObject = container => {
    const value = container?.LifecycleDisposition;
    return value && typeof value === "object" && !Array.isArray(value) &&
        value.provenance && typeof value.provenance === "object" && !Array.isArray(value.provenance)
        ? { value, source: "record" }
        : null;
};

const lifecycleIdentityMatches = (container, metadata) => {
    const metadataId = metadata.id;
    if (metadataId !== container?.Id || !FULL_LIFECYCLE_ID.test(metadataId))
        return false;
    if (typeof metadata.uid !== "number" || !Number.isInteger(metadata.uid) || metadata.uid < 0 ||
        typeof metadata.host !== "string" || metadata.host.length === 0 ||
        typeof metadata.context !== "string" || !["rootful", "rootless"].includes(metadata.context))
        return false;
    const provenance = metadata.provenance;
    const state = typeof container?.State === "string"
        ? container.State
        : container?.State?.Status || container?.Status || "";
    if (typeof container?.ownerUid !== "number" || !Number.isInteger(container.ownerUid) || container.ownerUid < 0 ||
        typeof state !== "string" || state.length === 0)
        return false;
    return container.ownerUid === metadata.uid && container?.host === metadata.host &&
        container?.context === metadata.context && provenance.kind === "operator-policy" &&
        provenance.source === "source-decisions.json" && provenance.source_ref === LIFECYCLE_POLICY_EVIDENCE_REF &&
        provenance.policy_sha256 === LIFECYCLE_POLICY_SHA256 &&
        typeof provenance.owner_verified === "boolean" &&
        FULL_SHA256.test(provenance.manifest_sha256) && FULL_SHA256.test(provenance.decision_sha256) &&
        state.toLowerCase() !== "running" && !/^up\b/i.test(state);
};

// Return only owner-authored lifecycle metadata.  A null result is deliberate
// and keeps an ambiguous row on the ordinary stopped/no-health path.
export const lifecycleDisposition = container => {
    const candidate = lifecycleMetadataObject(container);
    if (!candidate || !lifecycleIdentityMatches(container, candidate.value))
        return null;

    const dispositionClass = lifecycleClass(candidate.value.class);
    if (!dispositionClass)
        return null;
    const reason = lifecycleText(candidate.value.reason);
    const evidence = lifecycleText(candidate.value.provenance.source);
    return {
        class: dispositionClass,
        reason,
        evidence,
        source: candidate.source,
        id: candidate.value.id,
        uid: candidate.value.uid,
        host: candidate.value.host,
        context: candidate.value.context,
        provenance: candidate.value.provenance,
    };
};

// Error details from Podman, systemd, and Cockpit can contain command lines,
// URLs, or health output.  The display only needs an allowlisted reason; the
// existing health-log detail view remains the place for an operator who has
// deliberately opened the raw Podman log.
const HEALTH_COLLECTION_ERROR = "health-collection-failed";
const HEALTH_COLLECTION_TIMEOUT = "health-collection-timeout";
const SCHEDULER_ERROR = "scheduler-metadata-unavailable";

const durationToMilliseconds = duration => {
    if (!Number.isFinite(duration) || duration <= 0)
        return 0;

    // Podman reports health timing fields as nanoseconds.
    return duration / 1000000;
};

const timestampToMilliseconds = timestamp => {
    if (timestamp instanceof Date)
        return timestamp.getTime();
    if (typeof timestamp === "number") {
        // Accept milliseconds for fixtures while handling Unix seconds too.
        return timestamp < 100000000000 ? timestamp * 1000 : timestamp;
    }
    if (typeof timestamp !== "string" || timestamp.length === 0)
        return null;

    const parsed = Date.parse(timestamp);
    return Number.isNaN(parsed) ? null : parsed;
};

export const healthConfig = container => container?.Config?.Healthcheck ?? container?.Config?.Health ?? null;

export const hasHealthCheck = container => {
    const config = healthConfig(container);
    if (!config || typeof config !== "object" || Object.keys(config).length === 0)
        return false;

    const test = config.Test;
    // Podman's health configuration is only actionable when Test is a
    // non-empty argv array.  Treat partial/malformed objects as missing so an
    // interval-only response can never produce a configured or passing badge.
    return Array.isArray(test) && test.length > 0 && test[0] !== "NONE" &&
        test.every(item => typeof item === "string" && item.length > 0);
};

export const healthState = container => container?.State?.Health ?? container?.State?.Healthcheck ?? null;

// An inspect response is the only source that can mark an inventory row's
// health details as loaded.  Require the identity and the two top-level
// inspect objects that the renderer consumes so a truthy but malformed API
// reply cannot permanently turn a row into a false "loaded" state.
export const isValidHealthDetails = (inventory, detail) => {
    if (!inventory || typeof inventory.Id !== "string" || inventory.Id.length === 0 ||
        !detail || typeof detail !== "object" || Array.isArray(detail) ||
        detail.Id !== inventory.Id)
        return false;

    const state = detail.State;
    if (!state || typeof state !== "object" || Array.isArray(state) ||
        typeof state.Status !== "string" || state.Status.length === 0)
        return false;

    const config = detail.Config;
    return Boolean(config && typeof config === "object" && !Array.isArray(config));
};

// Container inventory is intentionally cheaper than an inspect and is enough
// to keep lifecycle rows current.  Once a full inspect has established that a
// running container has no health check, repeating that inspect on every
// refresh only adds load and can starve the configured checks before their
// freshness window expires.  Keep full detail requests for pending rows and
// rows with a configured check; stopped/completed rows are explained by their
// lifecycle alone.
export const shouldInspectHealth = (inventory, current = null) => {
    const inventoryState = typeof inventory?.State === "string"
        ? inventory.State
        : inventory?.State?.Status;
    const currentState = current?.State?.Status;
    const lifecycle = String(inventoryState || currentState || "").toLowerCase();
    if (lifecycle && lifecycle !== "running")
        return false;

    if (!current || current.healthDetailsLoaded !== true)
        return true;
    return hasHealthCheck(current);
};

export const healthLogTime = log => timestampToMilliseconds(log?.End) ?? timestampToMilliseconds(log?.Start);

export const lastHealthCheck = state => {
    const logs = Array.isArray(state?.Log) ? state.Log : [];
    return logs.reduce((last, log) => {
        const timestamp = healthLogTime(log);
        return timestamp !== null && (last === null || timestamp > last) ? timestamp : last;
    }, null);
};

// Podman may retain State.Health.Status as "healthy" while a later retry is
// still represented by a failed log entry. Select the log by its timestamp,
// rather than trusting the API's array order, so the row reflects the latest
// observed health run.
export const latestHealthLog = state => {
    const logs = Array.isArray(state?.Log) ? state.Log : [];
    return logs.reduce((latest, log) => {
        const timestamp = healthLogTime(log);
        if (timestamp === null)
            return latest;
        if (!latest || timestamp >= latest.timestamp)
            return { log, timestamp };
        return latest;
    }, null)?.log || null;
};

// Podman can encode an exit code as either a JSON number or a decimal string.
// Keep one parser for assessment and log rendering so a passing string "0"
// cannot be shown as a failed run in the expanded view.
export const normalizeExitCode = value => {
    if (typeof value === "number")
        return Number.isSafeInteger(value) ? value : null;
    if (typeof value !== "string" || !/^[+-]?\d+$/.test(value.trim()))
        return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
};

const isTrueMarker = value => value === true ||
    (typeof value === "string" && ["1", "true", "yes"].includes(value.toLowerCase()));

// Podman exposes the exit code for every exited container, but an exit code of
// zero does not say that a workload was a one-shot job.  Only classify an
// exited container as completed when the inspect payload carries explicit
// one-shot metadata.  The direct fields also support normalized API fixtures;
// the labels cover the common Compose and Kubernetes sources that persist this
// distinction in Podman inspect output.
export const isCompletedContainer = container => {
    const state = container?.State;
    const config = container?.Config;
    const labels = config?.Labels || container?.Labels || {};
    const disposition = lifecycleDisposition(container);
    return disposition?.class === lifecycleDispositionClasses.completed ||
        isTrueMarker(container?.Completed) ||
        isTrueMarker(container?.OneShot) ||
        isTrueMarker(state?.Completed) ||
        isTrueMarker(state?.OneShot) ||
        isTrueMarker(config?.Completed) ||
        isTrueMarker(config?.OneShot) ||
        isTrueMarker(labels["com.docker.compose.oneoff"]);
};

export const observedHealthInterval = state => {
    const logs = (Array.isArray(state?.Log) ? state.Log : [])
            .map(healthLogTime)
            .filter(timestamp => timestamp !== null)
            .sort((a, b) => a - b);
    if (logs.length < 2)
        return null;

    const intervals = [];
    for (let index = 1; index < logs.length; index++) {
        const interval = logs[index] - logs[index - 1];
        if (interval > 0)
            intervals.push(interval);
    }
    if (intervals.length === 0)
        return null;

    // Keep the observed cadence available for diagnostics. It never drives a
    // stale decision: external schedules can be irregular or have no second
    // run yet, so the scheduler collector is the freshness authority.
    intervals.sort((a, b) => a - b);
    return intervals[Math.floor(intervals.length / 2)];
};

const schedulerError = scheduler => {
    if (!scheduler)
        return null;

    const errors = scheduler.collector_errors;
    const coverageStatus = scheduler.coverage_status;
    const coverageCount = scheduler.active_coverage_count;
    const declaredCoverageCount = scheduler.coverage_count;
    if (!["covered", "covered-with-errors", "uncovered", "error"].includes(coverageStatus))
        return SCHEDULER_ERROR;
    if (!Array.isArray(errors))
        return SCHEDULER_ERROR;
    if (!Number.isInteger(coverageCount) || coverageCount < 0)
        return SCHEDULER_ERROR;
    if (!Number.isInteger(declaredCoverageCount) || declaredCoverageCount !== coverageCount)
        return SCHEDULER_ERROR;
    if (scheduler.error)
        return SCHEDULER_ERROR;
    if (coverageStatus === "error" || coverageStatus === "covered-with-errors")
        return SCHEDULER_ERROR;
    if (coverageStatus === "covered" && coverageCount !== 1)
        return SCHEDULER_ERROR;
    if (coverageStatus === "uncovered" && coverageCount !== 0)
        return SCHEDULER_ERROR;
    if (coverageStatus === "covered") {
        const interval = Number(scheduler.effective_interval_seconds);
        const jitter = Number(scheduler.jitter_seconds);
        const accuracy = Number(scheduler.accuracy_seconds);
        const source = scheduler.schedule_source || scheduler.effective_interval_source;
        if (!Number.isFinite(interval) || interval <= 0 ||
            !Number.isFinite(jitter) || jitter < 0 ||
            !Number.isFinite(accuracy) || accuracy < 0 ||
            typeof source !== "string" || source.length === 0)
            return SCHEDULER_ERROR;
    }
    if (errors.length > 0)
        return SCHEDULER_ERROR;
    return null;
};

const schedulerFreshness = (config, scheduler) => {
    const effective = scheduler;
    if (!effective)
        return {
            staleAfterMs: null,
            cadenceSource: "scheduler-unavailable",
            schedulerError: SCHEDULER_ERROR,
            reason: "scheduler-unavailable",
        };

    const error = schedulerError(effective);
    if (effective.coverage_status === "uncovered" || effective.active_coverage_count === 0)
        return {
            staleAfterMs: null,
            cadenceSource: effective.effective_interval_source || "scheduler-coverage-missing",
            schedulerError: error,
            reason: "scheduler-coverage-missing",
        };
    const interval = Number(effective.effective_interval_seconds);
    if (!Number.isFinite(interval) || interval <= 0)
        return {
            staleAfterMs: null,
            cadenceSource: effective.effective_interval_source || "scheduler-unknown",
            schedulerError: error || (effective.coverage_status === "covered" ? SCHEDULER_ERROR : null),
            reason: effective.coverage_status === "uncovered" ? "scheduler-coverage-missing" : "scheduler-unknown",
        };

    const jitter = Number(effective.jitter_seconds);
    const accuracy = Number(effective.accuracy_seconds);
    const timeout = durationToMilliseconds(config?.Timeout);
    const jitterMs = Number.isFinite(jitter) && jitter >= 0 ? jitter * 1000 : 0;
    const accuracyMs = Number.isFinite(accuracy) && accuracy >= 0 ? accuracy * 1000 : 0;
    const source = effective.schedule_source || effective.effective_interval_source || "systemd";
    return {
        staleAfterMs: error ? null : Math.max(1000, interval * 1000 + jitterMs + accuracyMs + timeout),
        cadenceSource: source,
        schedulerError: error,
        reason: "schedule-known",
    };
};

const collectionReason = error => typeof error === "string" &&
    /\b(?:timed?\s*out|timeout)\b/i.test(error)
    ? "collection-timeout"
    : "collection-error";

export const staleAfter = (config, _state, scheduler = null) => schedulerFreshness(config, scheduler).staleAfterMs;

export const healthAssessment = (container, now = Date.now(), collectionError = null, scheduler = null) => {
    const config = healthConfig(container);
    const state = healthState(container);
    const observedLastChecked = lastHealthCheck(state);
    const lastChecked = observedLastChecked !== null && observedLastChecked <= now ? observedLastChecked : null;
    const latestLog = latestHealthLog(state);
    const latestLogTime = latestLog === null ? null : healthLogTime(latestLog);
    const futureTimestamp = latestLogTime !== null && latestLogTime > now;
    const latestExitCode = latestLog === null ? null : normalizeExitCode(latestLog.ExitCode);
    const ageMs = lastChecked === null ? null : Math.max(0, now - lastChecked);
    const effectiveScheduler = scheduler;
    const freshness = schedulerFreshness(config, effectiveScheduler);
    const staleAfterMs = freshness.staleAfterMs;
    const freshWindowMs = null;
    const nativeStatus = state?.Status || null;
    const disposition = lifecycleDisposition(container);
    const lifecycle = String(container?.State?.Status || "").toLowerCase();

    const base = extra => ({
        rawStatus: nativeStatus,
        latestExitCode,
        configured: hasHealthCheck(container),
        lastChecked,
        ageMs,
        staleAfterMs,
        freshWindowMs,
        cadenceSource: freshness.cadenceSource,
        schedule: effectiveScheduler || null,
        disposition,
        lifecycleStatus: lifecycle || null,
        scope: containerScope(container),
        ...extra,
    });

    const role = container?.IsInfra === true || disposition?.class === lifecycleDispositionClasses.infrastructure
        ? "infrastructure"
        : null;
    if (role === "infrastructure") {
        return base({
            status: healthStates.infrastructure,
            reason: "infrastructure",
            role,
        });
    }
    if (lifecycle && lifecycle !== "running") {
        const exitCode = container?.State?.ExitCode;
        const completed = lifecycle === "exited" && (exitCode === 0 || exitCode === "0") &&
            isCompletedContainer(container);
        const retired = disposition?.class === lifecycleDispositionClasses.retired;
        return base({
            status: completed ? healthStates.completed : retired ? healthStates.retired : healthStates.stopped,
            reason: completed ? "completed" : retired ? "retired" : "stopped",
            role,
        });
    }

    // A stopped or completed container has no live health result to collect.
    // Owner-wide refresh failures must not overwrite that lifecycle state.
    if (collectionError) {
        return base({
            status: healthStates.error,
            reason: collectionReason(collectionError),
            role,
            error: collectionReason(collectionError) === "collection-timeout"
                ? HEALTH_COLLECTION_TIMEOUT
                : HEALTH_COLLECTION_ERROR,
        });
    }

    // Inventory rows are rendered before their optional inspect payload. Do
    // not infer a missing check from the absence of Config while that detail
    // request is still pending.
    if (container?.healthDetailsLoaded === false) {
        return base({
            status: healthStates.starting,
            reason: "details-pending",
            role,
        });
    }

    if (!hasHealthCheck(container)) {
        return base({
            status: healthStates.missing,
            configured: false,
            reason: "missing",
            role,
        });
    }

    if (nativeStatus === "unhealthy") {
        return base({
            status: healthStates.unhealthy,
            reason: "unhealthy",
            role,
        });
    }

    if (nativeStatus === "starting") {
        return base({
            status: healthStates.starting,
            reason: "starting",
            role,
        });
    }

    if (futureTimestamp) {
        return base({
            status: healthStates.unknown,
            reason: "timestamp-future",
            role,
        });
    }

    // A transient failed run is still a confirmed failure even if Podman's
    // aggregate status has not crossed its retry threshold yet. Keep
    // rawStatus above so callers can distinguish the native aggregate state
    // from this latest-run result.
    if (latestExitCode !== null && latestExitCode !== 0) {
        return base({
            status: healthStates.unhealthy,
            reason: "latest-check-failed",
            role,
        });
    }

    if (latestLog !== null && latestExitCode === null) {
        return base({
            status: healthStates.unknown,
            reason: "latest-check-unknown",
            role,
        });
    }

    if (freshness.schedulerError) {
        return base({
            status: healthStates.error,
            reason: "scheduler-error",
            error: SCHEDULER_ERROR,
            role,
        });
    }

    if (nativeStatus === "healthy" && lastChecked !== null && staleAfterMs !== null && ageMs > staleAfterMs) {
        return base({
            status: healthStates.stale,
            reason: "stale",
            role,
        });
    }

    if (nativeStatus === "healthy" && lastChecked !== null && staleAfterMs !== null) {
        return base({
            status: healthStates.healthy,
            reason: "healthy",
            role,
        });
    }

    return base({
        status: healthStates.unknown,
        reason: nativeStatus === "healthy" ? freshness.reason : "no-result",
        role,
    });
};
