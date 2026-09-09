#!/usr/bin/env python3
# SPDX-License-Identifier: LGPL-2.1-or-later

"""Read-only systemd schedule metadata for the Cockpit Podman health view.

The caller supplies the already-collected Podman inventory for one owner
context on stdin.  This program only reads that inventory and the matching
systemd manager.  It never calls a healthcheck, changes a unit, or writes a
state file.

The systemd manager is selected from the owner UID: UID 0 uses the system
manager and every other UID uses that user's manager (``systemctl --user``).
For a non-zero UID this program is intended to run in that user's Cockpit
bridge context; it does not attempt to impersonate another user.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import selectors
import signal
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping, Sequence

SCHEMA = "train-health-scheduler-coverage/v1"
DEFAULT_TIMEOUT = 8.0
DEFAULT_MAX_UNITS = 512
# The limit applies to stdout and stderr together.  A malicious helper must
# not bypass the bound by splitting output across the two pipes.
MAX_OUTPUT_BYTES = 8 * 1024 * 1024

CONTAINER_ID_RE = re.compile(r"[0-9a-f]{64}\Z")
CONTAINER_NAME_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]*\Z")
UNIT_RE = re.compile(r"[^\s=]+\.(?:timer|service)\Z")

# A unit property list is deliberately finite.  Keeping the list explicit
# makes the subprocess output bounded and documents what the display trusts.
TIMER_PROPERTIES = (
    "Id",
    "ActiveState",
    "SubState",
    "Unit",
    "Triggers",
    "OnUnitActiveUSec",
    "OnUnitActiveSec",
    "OnUnitInactiveUSec",
    "OnUnitInactiveSec",
    "TimersMonotonic",
    "OnCalendar",
    "RandomizedDelayUSec",
    "RandomizedDelaySec",
    "AccuracyUSec",
    "AccuracySec",
    "LastTriggerUSec",
    "LastTriggerUSecRealtime",
    "NextElapseUSecRealtime",
    "NextElapseUSecMonotonic",
)
SERVICE_PROPERTIES = ("Id", "ExecStart", "ExecStartEx", "ActiveState", "SubState")


class CollectorInputError(ValueError):
    """The caller supplied an unsafe or unusable inventory."""


@dataclass(frozen=True)
class ContainerRef:
    uid: int
    container_id: str
    name: str | None
    source_index: int

    @property
    def key(self) -> str:
        # Keep this in lockstep with cockpit-podman's makeKey(uid, id).
        return f"{self.uid}-{self.container_id}"


@dataclass
class ContainerCoverage:
    ref: ContainerRef
    schedules: list[dict[str, Any]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


@dataclass
class CommandResult:
    argv: list[str]
    returncode: int
    stdout: str
    stderr: str
    timed_out: bool = False


def _number(value: float | None) -> int | float | None:
    """Emit integral durations as JSON integers while retaining fractions."""

    if value is None:
        return None
    if value.is_integer():
        return int(value)
    return value


def _command_error(prefix: str, result: CommandResult) -> str:
    # Never return systemctl stderr/stdout to the display.  It may contain
    # command lines, URLs, or application output.  Keep only a bounded,
    # allowlisted stage and the process outcome needed for diagnosis.
    stages = {
        "systemd timer inventory failed": "systemd-timer-inventory",
        "systemd timer metadata failed": "systemd-timer-metadata",
        "systemd health service metadata failed": "systemd-health-service-metadata",
    }
    stage = stages.get(prefix, "systemd-collector")
    if result.timed_out:
        return f"{stage}:timeout"
    return f"{stage}:exit-{result.returncode}"


def run_bounded(argv: Sequence[str], timeout: float) -> CommandResult:
    """Run one read-only command with a deadline and bounded pipe reads.

    ``subprocess.run(capture_output=True)`` accumulates arbitrary stdout and
    stderr before a caller can enforce a limit.  Read both pipes through a
    selector instead, terminate the process group at the first timeout or
    overflow, and close every descriptor on every exit path.
    """

    command = list(argv)

    def terminate(process: subprocess.Popen[bytes]) -> None:
        try:
            if hasattr(os, "killpg"):
                os.killpg(process.pid, signal.SIGKILL)
            else:
                process.kill()
        except (ProcessLookupError, OSError):
            pass
        try:
            process.wait(timeout=1)
        except subprocess.TimeoutExpired:
            try:
                process.kill()
            except ProcessLookupError:
                pass
            try:
                process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                # The process group has already been killed. Do not block the
                # collector forever on a broken child reaper.
                pass

    try:
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True,
        )
    except OSError as exc:
        return CommandResult(command, 127, "", str(exc))

    selector = selectors.DefaultSelector()
    buffers: dict[str, bytearray] = {"stdout": bytearray(), "stderr": bytearray()}
    total_output_bytes = 0
    streams = (("stdout", process.stdout), ("stderr", process.stderr))
    for name, stream in streams:
        if stream is not None:
            selector.register(stream, selectors.EVENT_READ, name)

    timed_out = False
    overflow = False
    deadline = time.monotonic() + timeout
    try:
        while selector.get_map():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                timed_out = True
                terminate(process)
                break
            events = selector.select(remaining)
            if not events:
                timed_out = True
                terminate(process)
                break
            for key, _ in events:
                stream = key.fileobj
                chunk = os.read(stream.fileno(), 64 * 1024)
                if not chunk:
                    selector.unregister(stream)
                    stream.close()
                    continue
                name = key.data
                if total_output_bytes + len(chunk) > MAX_OUTPUT_BYTES:
                    overflow = True
                    terminate(process)
                    break
                buffers[name].extend(chunk)
                total_output_bytes += len(chunk)
            if timed_out or overflow:
                break

        if not timed_out and not overflow:
            returncode = process.wait(timeout=max(0.1, deadline - time.monotonic()))
        else:
            returncode = 124 if timed_out else 75
        if timed_out:
            return CommandResult(command, returncode, "", "", timed_out=True)
        if overflow:
            return CommandResult(command, returncode, "", "output exceeded collector limit")
        return CommandResult(
            command,
            returncode,
            bytes(buffers["stdout"]).decode("utf-8", "replace"),
            bytes(buffers["stderr"]).decode("utf-8", "replace"),
        )
    except (OSError, subprocess.TimeoutExpired):
        terminate(process)
        return CommandResult(command, 124, "", "", timed_out=True)
    finally:
        selector.close()
        for _, stream in streams:
            if stream is not None and not stream.closed:
                stream.close()
        if process.poll() is None:
            terminate(process)


def parse_systemd_duration(value: str | None) -> float | None:
    """Parse a systemd ``*USec``/``*Sec`` duration into seconds.

    ``systemctl show`` normally returns values such as ``30s`` and ``1min``.
    The parser also accepts compound values and the microsecond spellings that
    systemd may expose on older versions.  ``infinity``, ``-`` and zero mean
    that a timer expression is disabled and therefore return ``None``.
    """

    if value is None:
        return None
    text = value.strip().lower()
    if not text or text in {"-", "infinity", "inf", "n/a", "na"}:
        return None

    # A bare integer from a *USec field is interpreted as microseconds.  A
    # bare integer from a *Sec fixture is handled by the caller by appending s.
    if re.fullmatch(r"[+]?(?:\d+(?:\.\d*)?|\.\d+)", text):
        try:
            raw = float(text)
        except ValueError:
            return None
        return raw / 1_000_000 if raw > 0 else None

    units = {
        "us": 1e-6,
        "\u00b5s": 1e-6,
        "μs": 1e-6,
        "microseconds": 1e-6,
        "ms": 1e-3,
        "milliseconds": 1e-3,
        "s": 1.0,
        "sec": 1.0,
        "secs": 1.0,
        "second": 1.0,
        "seconds": 1.0,
        "m": 60.0,
        "min": 60.0,
        "mins": 60.0,
        "minute": 60.0,
        "minutes": 60.0,
        "h": 3600.0,
        "hr": 3600.0,
        "hrs": 3600.0,
        "hour": 3600.0,
        "hours": 3600.0,
        "d": 86400.0,
        "day": 86400.0,
        "days": 86400.0,
        "w": 604800.0,
        "week": 604800.0,
        "weeks": 604800.0,
    }
    pattern = re.compile(r"([+]?(?:\d+(?:\.\d*)?|\.\d+))\s*([a-z\u00b5μ]+)")
    position = 0
    total = 0.0
    matched = False
    for match in pattern.finditer(text):
        if text[position : match.start()].strip():
            return None
        unit = units.get(match.group(2))
        if unit is None:
            return None
        total += float(match.group(1)) * unit
        matched = True
        position = match.end()
    if text[position:].strip() or not matched or total <= 0:
        return None
    return total


def _property_values(properties: Mapping[str, str], name: str) -> list[str]:
    direct = [value.strip() for value in properties.get(name, "").splitlines() if value.strip()]
    if direct:
        return direct
    # systemd 255 exposes monotonic timer expressions through the
    # TimersMonotonic array; the direct OnUnit* properties are not emitted for
    # those units.  Keep this extraction local to recurring expressions so a
    # nested next_elapse value is never mistaken for a configured interval.
    if name in {"OnUnitActiveUSec", "OnUnitInactiveUSec", "OnUnitActiveSec", "OnUnitInactiveSec"}:
        nested: list[str] = []
        pattern = re.compile(rf"(?:^|[ {{;]){re.escape(name)}=([^;}}]+)")
        for line in properties.get("TimersMonotonic", "").splitlines():
            match = pattern.search(line)
            if match:
                nested.append(match.group(1).strip())
        return nested
    return []


def _duration_value(properties: Mapping[str, str], names: Iterable[str]) -> tuple[float | None, str | None]:
    """Return the first finite recurring timer expression and its property."""

    for name in names:
        for value in _property_values(properties, name):
            # A bare numeric *Sec value is seconds; a bare *USec value is
            # handled by parse_systemd_duration as microseconds.
            if (
                name.endswith("Sec")
                and not name.endswith("USec")
                and re.fullmatch(r"[+]?(?:\d+(?:\.\d*)?|\.\d+)", value)
            ):
                value = f"{value}s"
            parsed = parse_systemd_duration(value)
            if parsed is not None:
                return parsed, name
    return None, None


def parse_unit_list(output: str) -> list[str]:
    """Parse the first (unit) column of ``systemctl list-units`` output."""

    units: list[str] = []
    seen: set[str] = set()
    for line in output.splitlines():
        fields = line.split()
        if not fields:
            continue
        unit = fields[0]
        if not unit.endswith(".timer") or not UNIT_RE.fullmatch(unit):
            continue
        if unit not in seen:
            units.append(unit)
            seen.add(unit)
    return units


def parse_show_sections(output: str) -> dict[str, dict[str, str]]:
    """Parse multi-unit ``systemctl show`` output keyed by ``Id``.

    systemd separates units with a blank line.  Handling an ``Id=`` transition
    as well keeps this parser compatible with versions that omit blank lines
    when only a small property set was requested.
    """

    sections: dict[str, dict[str, str]] = {}
    current: dict[str, str] = {}

    def finish() -> None:
        nonlocal current
        unit_id = current.get("Id", "").strip()
        if unit_id:
            sections[unit_id] = dict(current)
        current = {}

    for raw_line in output.splitlines():
        line = raw_line.rstrip("\r")
        if not line:
            finish()
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key == "Id" and current.get("Id"):
            finish()
        # TimersMonotonic is an array-like property and systemd emits one
        # property line for each monotonic expression (for example OnBootSec
        # and OnUnitActiveSec). Preserve repeated properties rather than
        # allowing the last line to hide the actual recurring expression.
        if key in current and key not in {"Id"}:
            current[key] = f"{current[key]}\n{value}"
        else:
            current[key] = value
    finish()
    return sections


def _inventory_rows(payload: Any) -> list[Any]:
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, Mapping):
        raise CollectorInputError("inventory must be a JSON array or object")
    rows = payload.get("containers", payload.get("items"))
    if isinstance(rows, list):
        return rows
    if isinstance(rows, Mapping):
        result: list[Any] = []
        for key, value in rows.items():
            if not isinstance(value, Mapping):
                result.append(value)
                continue
            copied = dict(value)
            if not any(field in copied for field in ("id", "Id", "ID", "container_id", "ContainerID")):
                match = re.fullmatch(r"(?:\d+|user)-([0-9a-f]{64})", str(key))
                if match:
                    copied["id"] = match.group(1)
            result.append(copied)
        return result
    raise CollectorInputError("inventory object must contain a containers array or map")


def _first_field(row: Mapping[str, Any], fields: Sequence[str]) -> Any:
    for field_name in fields:
        if field_name in row:
            return row[field_name]
    return None


def _normalise_name(value: Any) -> str | None:
    if isinstance(value, list):
        value = value[0] if value else None
    if not isinstance(value, str):
        return None
    value = value.strip()
    if value.startswith("/"):
        value = value[1:]
    return value or None


def parse_inventory(payload: Any, uid: int) -> list[ContainerRef]:
    """Validate a single owner-context inventory before any systemd query."""

    refs: list[ContainerRef] = []
    seen_ids: set[str] = set()
    for index, raw in enumerate(_inventory_rows(payload)):
        if not isinstance(raw, Mapping):
            raise CollectorInputError(f"inventory row {index} is not an object")
        raw_id = _first_field(raw, ("container_id", "ContainerID", "id", "Id", "ID"))
        if not isinstance(raw_id, str):
            raise CollectorInputError(f"inventory row {index} has no container ID")
        container_id = raw_id.strip().lower()
        if CONTAINER_ID_RE.fullmatch(container_id) is None:
            raise CollectorInputError(f"inventory row {index} does not contain a full 64-character container ID")
        if container_id in seen_ids:
            raise CollectorInputError(f"inventory contains duplicate container ID {container_id}")

        raw_uid = _first_field(raw, ("uid", "Uid", "UID", "owner_uid"))
        row_uid = uid if raw_uid is None else raw_uid
        if isinstance(row_uid, bool) or not isinstance(row_uid, int):
            raise CollectorInputError(f"inventory row {index} has a non-integer UID")
        if row_uid != uid:
            raise CollectorInputError(f"inventory row {index} UID {row_uid} does not match collector UID {uid}")

        name = _normalise_name(_first_field(raw, ("name", "Name", "Names", "container_name")))
        if name is not None and CONTAINER_NAME_RE.fullmatch(name) is None:
            raise CollectorInputError(f"inventory row {index} has an invalid container name")
        refs.append(ContainerRef(uid=uid, container_id=container_id, name=name, source_index=index))
        seen_ids.add(container_id)
    return refs


def _unit_valid(unit: str | None, suffix: str) -> bool:
    return bool(unit and unit.endswith(suffix) and UNIT_RE.fullmatch(unit))


def _service_unit(properties: Mapping[str, str], timer_unit: str) -> str | None:
    value = properties.get("Unit", "").strip()
    if _unit_valid(value, ".service"):
        return value
    triggers = properties.get("Triggers", "")
    for candidate in triggers.split():
        if _unit_valid(candidate, ".service"):
            return candidate
    # This fallback is only a unit relationship guess.  ExecStart validation
    # below remains mandatory before a timer is attributed to a container.
    if timer_unit.endswith(".timer"):
        candidate = f"{timer_unit[:-6]}.service"
        if _unit_valid(candidate, ".service"):
            return candidate
    return None


def _timer_schedule(properties: Mapping[str, str], *, executing: bool = False) -> tuple[dict[str, Any], list[str]]:
    errors: list[str] = []
    interval_candidates: list[tuple[float, str]] = []
    for names in (("OnUnitActiveUSec", "OnUnitActiveSec"), ("OnUnitInactiveUSec", "OnUnitInactiveSec")):
        value, source = _duration_value(properties, names)
        if value is not None and source is not None:
            interval_candidates.append((value, source))

    calendar = properties.get("OnCalendar", "").strip()
    if len(interval_candidates) > 1:
        # Both expressions can fire.  Expose the ambiguity rather than
        # inventing one cadence for stale-result decisions.
        values = {round(value, 9) for value, _ in interval_candidates}
        if len(values) > 1:
            errors.append("multiple-recurring-intervals")
    if interval_candidates:
        interval = interval_candidates[0][0] if len({round(v, 9) for v, _ in interval_candidates}) == 1 else None
        interval_source = interval_candidates[0][1] if interval is not None else "multiple"
    else:
        interval = None
        interval_source = "OnCalendar" if calendar else None
        errors.append("missing-recurring-interval")

    jitter, jitter_source = _duration_value(properties, ("RandomizedDelayUSec", "RandomizedDelaySec"))
    if jitter is None:
        # systemd's default is no random delay.  Preserve that fact as a
        # value while making the source explicit; no configured value is made
        # up for accuracy or interval.
        jitter = 0.0
        jitter_source = "systemd-default"

    accuracy, accuracy_source = _duration_value(properties, ("AccuracyUSec", "AccuracySec"))
    if accuracy is None:
        errors.append("missing-accuracy")

    next_realtime = properties.get("NextElapseUSecRealtime", "").strip()
    next_monotonic = properties.get("NextElapseUSecMonotonic", "").strip()
    valid_next_realtime = (
        next_realtime if next_realtime.lower() not in {"", "-", "n/a", "na", "infinity", "inf", "0"} else None
    )
    valid_next_monotonic = (
        next_monotonic if next_monotonic.lower() not in {"", "-", "n/a", "na", "infinity", "inf", "0"} else None
    )
    if valid_next_realtime is None and valid_next_monotonic is None and not (executing and interval is not None):
        # An active unit with no next elapse can be a one-shot or already
        # elapsed timer. Its configured interval is insufficient evidence of
        # future health checks, so freshness must remain unavailable.
        errors.append("missing-next-trigger")

    schedule = {
        "effective_interval_seconds": _number(interval),
        "effective_interval_source": interval_source,
        "interval_candidates": [
            {"seconds": _number(value), "source": source} for value, source in interval_candidates
        ],
        "calendar": calendar or None,
        "jitter_seconds": _number(jitter),
        "jitter_source": jitter_source,
        "accuracy_seconds": _number(accuracy),
        "accuracy_source": accuracy_source,
        "last_trigger": properties.get("LastTriggerUSecRealtime") or properties.get("LastTriggerUSec") or None,
        "next_trigger": valid_next_realtime,
        "next_trigger_monotonic": valid_next_monotonic,
    }
    return schedule, errors


def _contains_token(text: str, token: str) -> bool:
    if not token:
        return False
    # Unit arguments, shell-safe argv[] fragments and --name=value all use
    # punctuation around the value.  Do not match a name or ID embedded in a
    # different identifier.
    pattern = rf"(?<![A-Za-z0-9_.-]){re.escape(token)}(?![A-Za-z0-9_.-])"
    return re.search(pattern, text) is not None


def _exec_start(properties: Mapping[str, str]) -> str:
    return " ".join(value for key, value in properties.items() if key in {"ExecStart", "ExecStartEx"} and value)


def _looks_like_health_command(exec_start: str) -> bool:
    lowered = exec_start.lower()
    return "healthcheck" in lowered and ("podman" in lowered or "healthcheck-run-safe" in lowered)


def _looks_like_health_unit(timer_unit: str, service_unit: str | None) -> bool:
    text = f"{timer_unit} {service_unit or ''}".lower()
    return "healthcheck" in text or "podman-health" in text


def _name_index(refs: Sequence[ContainerRef]) -> dict[str, list[ContainerRef]]:
    index: dict[str, list[ContainerRef]] = {}
    for ref in refs:
        if ref.name is not None:
            index.setdefault(ref.name, []).append(ref)
    return index


def _find_container(
    refs: Sequence[ContainerRef],
    names: Mapping[str, list[ContainerRef]],
    service_unit: str,
    exec_start: str,
) -> tuple[ContainerRef | None, str | None]:
    # Full IDs are authoritative.  A named service is only a fallback because
    # names are labels and can collide in malformed or mixed inventories.
    id_matches = [ref for ref in refs if _contains_token(exec_start, ref.container_id)]
    if len(id_matches) == 1:
        return id_matches[0], "full-id"
    if len(id_matches) > 1:
        return None, "ambiguous-full-id"

    named_match: ContainerRef | None = None
    named_matches: list[ContainerRef] = []
    for name, candidates in names.items():
        if _contains_token(exec_start, name):
            named_matches.extend(candidates)
    if len(named_matches) == 1:
        named_match = named_matches[0]
    elif len(named_matches) > 1:
        return None, "ambiguous-container-name"
    if named_match is not None:
        return named_match, "container-name"

    # The service instance itself is useful as a guard against a command that
    # happens to contain an unrelated container name, but it cannot authorize
    # attribution on its own.  Returning no match keeps stale/deleted IDs from
    # being assigned to a newly created same-name container.
    return None, None


def _initial_record(coverage: ContainerCoverage) -> dict[str, Any]:
    return {
        "key": coverage.ref.key,
        "uid": coverage.ref.uid,
        "container_id": coverage.ref.container_id,
        "name": coverage.ref.name,
        "active_coverage_count": 0,
        # Alias retained for clients that use the shorter noun while the
        # explicit field above is the canonical schema field.
        "coverage_count": 0,
        "effective_interval_seconds": None,
        "effective_interval_source": None,
        "jitter_seconds": None,
        "accuracy_seconds": None,
        "schedules": [],
        "coverage_status": "uncovered",
        "coverage_reason": "no-active-matching-health-timer",
        "collector_errors": list(coverage.errors),
    }


def _finalise_record(coverage: ContainerCoverage) -> dict[str, Any]:
    record = _initial_record(coverage)
    schedules = sorted(coverage.schedules, key=lambda item: (str(item.get("unit")), str(item.get("service_unit"))))
    record["schedules"] = schedules
    count = len(schedules)
    record["active_coverage_count"] = count
    record["coverage_count"] = count
    if count:
        record["coverage_status"] = "covered"
        record["coverage_reason"] = "active-matching-health-timer"
        for field_name in (
            "effective_interval_seconds",
            "effective_interval_source",
            "jitter_seconds",
            "accuracy_seconds",
        ):
            values = {json.dumps(item.get(field_name), sort_keys=True) for item in schedules}
            if len(values) == 1:
                record[field_name] = schedules[0].get(field_name)
            else:
                record[field_name] = None
                record["collector_errors"].append(f"multiple-{field_name}")
        if count > 1:
            # One effective recurring schedule is required.  Keep every
            # matching unit visible for diagnosis, but never present
            # duplicate named/native coverage as settled coverage, even when
            # both timers happen to use the same cadence.
            record["collector_errors"].append("duplicate-active-health-timers")
            record["coverage_status"] = "error"
            record["coverage_reason"] = "duplicate-active-health-timers"
    if record["collector_errors"]:
        if count == 0:
            record["coverage_status"] = "error"
        elif count == 1:
            record["coverage_status"] = "covered-with-errors"
    # Preserve order and avoid repeating the same error from a timer and its
    # service metadata path.
    record["collector_errors"] = list(dict.fromkeys(record["collector_errors"]))
    return record


def collect_coverage(
    refs: Sequence[ContainerRef],
    *,
    uid: int,
    manager: str,
    systemctl_bin: str = "/usr/bin/systemctl",
    timeout: float = DEFAULT_TIMEOUT,
    max_units: int = DEFAULT_MAX_UNITS,
) -> dict[str, Any]:
    """Collect one owner context without querying Podman or mutating systemd."""

    if manager not in {"system", "user"}:
        raise ValueError("manager must be system or user")
    if uid == 0 and manager != "system":
        raise ValueError("UID 0 must use the system systemd manager")
    if uid != 0 and manager != "user":
        raise ValueError("non-zero UIDs must use a user systemd manager")
    if timeout <= 0 or timeout > 60:
        raise ValueError("overall timeout must be greater than zero and at most 60 seconds")
    if max_units <= 0 or max_units > 4096:
        raise ValueError("max-units must be between 1 and 4096")

    contexts = {ref.key: ContainerCoverage(ref) for ref in refs}
    global_errors: list[str] = []
    unattributed: list[dict[str, Any]] = []
    prefix = [systemctl_bin] + ([] if manager == "system" else ["--user"])
    deadline = time.monotonic() + timeout

    def invoke(command: Sequence[str]) -> CommandResult:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return CommandResult(list(command), 124, "", "", timed_out=True)
        return run_bounded(command, remaining)

    listed = invoke(
        [*prefix, "list-units", "--type=timer", "--state=active", "--all", "--no-legend", "--plain", "--no-pager"],
    )
    if listed.returncode != 0:
        global_errors.append(_command_error("systemd timer inventory failed", listed))
        for coverage in contexts.values():
            coverage.errors.append("systemd-timer-inventory-unavailable")
        return _result(refs, contexts, uid, manager, global_errors, unattributed, listed_units=0, unit_query_count=1)

    timer_units = parse_unit_list(listed.stdout)
    if len(timer_units) > max_units:
        global_errors.append("systemd-timer-inventory-too-large")
        for coverage in contexts.values():
            coverage.errors.append("systemd-timer-inventory-too-large")
        return _result(
            refs,
            contexts,
            uid,
            manager,
            global_errors,
            unattributed,
            listed_units=len(timer_units),
            unit_query_count=1,
        )

    if not timer_units:
        return _result(refs, contexts, uid, manager, global_errors, unattributed, listed_units=0, unit_query_count=1)

    timer_property_arg = "--property=" + ",".join(TIMER_PROPERTIES)
    shown_timers = invoke([*prefix, "show", "--no-pager", timer_property_arg, *timer_units])
    timer_sections = parse_show_sections(shown_timers.stdout) if shown_timers.returncode == 0 else {}
    if shown_timers.returncode != 0:
        global_errors.append(_command_error("systemd timer metadata failed", shown_timers))
        for coverage in contexts.values():
            coverage.errors.append("systemd-timer-metadata-unavailable")
        return _result(
            refs,
            contexts,
            uid,
            manager,
            global_errors,
            unattributed,
            listed_units=len(timer_units),
            unit_query_count=2,
        )

    service_units: list[str] = []
    for timer_unit in timer_units:
        service_unit = _service_unit(timer_sections.get(timer_unit, {}), timer_unit)
        if service_unit and service_unit not in service_units:
            service_units.append(service_unit)
    if len(service_units) > max_units:
        global_errors.append("systemd-service-metadata-too-large")
        for coverage in contexts.values():
            coverage.errors.append("systemd-service-metadata-too-large")
        return _result(
            refs,
            contexts,
            uid,
            manager,
            global_errors,
            unattributed,
            listed_units=len(timer_units),
            unit_query_count=2,
        )

    service_sections: dict[str, dict[str, str]] = {}
    if service_units:
        service_property_arg = "--property=" + ",".join(SERVICE_PROPERTIES)
        shown_services = invoke([*prefix, "show", "--no-pager", service_property_arg, *service_units])
        service_sections = parse_show_sections(shown_services.stdout) if shown_services.returncode == 0 else {}
        if shown_services.returncode != 0:
            global_errors.append(_command_error("systemd health service metadata failed", shown_services))
            for coverage in contexts.values():
                coverage.errors.append("systemd-health-service-metadata-unavailable")
            return _result(
                refs,
                contexts,
                uid,
                manager,
                global_errors,
                unattributed,
                listed_units=len(timer_units),
                unit_query_count=3,
            )

    unit_query_count = 2 + bool(service_units)
    # Timer and service metadata are read separately. A short one-shot may
    # finish between those reads, leaving an old running timer beside a now
    # inactive service. Re-read those timers once under the same overall
    # deadline; only fresh waiting/executing evidence can establish coverage.
    reconcile_units = [
        unit
        for unit in timer_units
        if timer_sections.get(unit, {}).get("SubState") == "running"
        and (
            service_sections.get(_service_unit(timer_sections.get(unit, {}), unit) or "", {}).get("ActiveState"),
            service_sections.get(_service_unit(timer_sections.get(unit, {}), unit) or "", {}).get("SubState"),
        )
        not in {("activating", "start"), ("active", "running")}
    ]
    if reconcile_units:
        refreshed = invoke([*prefix, "show", "--no-pager", timer_property_arg, *reconcile_units])
        unit_query_count += 1
        refreshed_sections = parse_show_sections(refreshed.stdout) if refreshed.returncode == 0 else {}
        for unit in reconcile_units:
            # Missing/failed refreshed metadata must not retain an old timer.
            timer_sections.pop(unit, None)
            if unit in refreshed_sections:
                timer_sections[unit] = refreshed_sections[unit]
        if refreshed.returncode != 0:
            global_errors.append(_command_error("systemd timer reconciliation failed", refreshed))

    names = _name_index(refs)
    for timer_unit in timer_units:
        timer = timer_sections.get(timer_unit)
        if timer is None:
            unattributed.append({"unit": timer_unit, "reason": "timer-metadata-missing"})
            continue
        service_unit = _service_unit(timer, timer_unit)
        service = service_sections.get(service_unit or "")
        potential_health = _looks_like_health_unit(timer_unit, service_unit)
        executing = timer.get("SubState") == "running" and (
            ((service or {}).get("ActiveState"), (service or {}).get("SubState"))
            in {("activating", "start"), ("active", "running")}
        )
        if timer.get("ActiveState") != "active" or (timer.get("SubState") != "waiting" and not executing):
            # A recurring timer temporarily has no next elapse while its
            # associated service executes. Elapsed/stopped timers still do
            # not prove recurring coverage.
            if potential_health:
                unattributed.append({
                    "unit": timer_unit,
                    "service_unit": service_unit,
                    "reason": "timer-not-waiting",
                })
            continue
        exec_start = _exec_start(service or {})
        if not service:
            if potential_health:
                unattributed.append({
                    "unit": timer_unit,
                    "service_unit": service_unit,
                    "reason": "service-metadata-missing",
                })
            continue
        if not _looks_like_health_command(exec_start):
            if potential_health:
                unattributed.append({
                    "unit": timer_unit,
                    "service_unit": service_unit,
                    "reason": "service-is-not-podman-healthcheck",
                })
            continue

        ref, match_method = _find_container(refs, names, service_unit or "", exec_start)
        if ref is None:
            unattributed.append({
                "unit": timer_unit,
                "service_unit": service_unit,
                "reason": match_method or "no-container-match",
            })
            continue

        schedule, schedule_errors = _timer_schedule(timer, executing=executing)
        schedule.update({
            "unit": timer_unit,
            "service_unit": service_unit,
            "active": True,
            "match_method": match_method,
            "schedule_source": "systemd",
            "timer_active_state": timer.get("ActiveState"),
            "timer_sub_state": timer.get("SubState"),
        })
        contexts[ref.key].schedules.append(schedule)
        contexts[ref.key].errors.extend(schedule_errors)

    return _result(
        refs,
        contexts,
        uid,
        manager,
        global_errors,
        unattributed,
        listed_units=len(timer_units),
        unit_query_count=unit_query_count,
    )


def _result(
    refs: Sequence[ContainerRef],
    contexts: Mapping[str, ContainerCoverage],
    uid: int,
    manager: str,
    global_errors: Sequence[str],
    unattributed: Sequence[Mapping[str, Any]],
    *,
    listed_units: int,
    unit_query_count: int,
) -> dict[str, Any]:
    records = {ref.key: _finalise_record(contexts[ref.key]) for ref in refs}
    return {
        "schema": SCHEMA,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "uid": uid,
        "manager": manager,
        "manager_scope": "rootful" if uid == 0 else "rootless",
        "read_only": True,
        "native_podman_health_is_authoritative": True,
        "systemctl": {"unit_query_count": unit_query_count, "listed_active_timer_count": listed_units},
        "collector_errors": list(dict.fromkeys(global_errors)),
        "unattributed_health_timers": list(unattributed),
        "containers": records,
    }


def _error_document(uid: int, manager: str, message: str) -> dict[str, Any]:
    return {
        "schema": SCHEMA,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "uid": uid,
        "manager": manager,
        "manager_scope": "rootful" if uid == 0 else "rootless",
        "read_only": True,
        "native_podman_health_is_authoritative": True,
        "systemctl": {"unit_query_count": 0, "listed_active_timer_count": 0},
        "collector_errors": [message],
        "unattributed_health_timers": [],
        "containers": {},
    }


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--uid", type=int, required=True, help="Podman owner UID (0 selects systemd system manager)")
    parser.add_argument("--manager", choices=("system", "user"), help="Override the manager derived from --uid")
    parser.add_argument("--systemctl-bin", default=os.environ.get("SYSTEMCTL_BIN", "/usr/bin/systemctl"))
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT, help="per-command timeout in seconds")
    parser.add_argument("--max-units", type=int, default=DEFAULT_MAX_UNITS)
    parser.add_argument("--inventory", help="JSON inventory path; stdin is used when omitted")
    parser.add_argument("--indent", type=int, default=None, help="pretty-print JSON with this indentation")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    manager = args.manager or ("system" if args.uid == 0 else "user")
    try:
        if args.uid < 0:
            raise CollectorInputError("UID must be non-negative")
        if args.inventory:
            with open(args.inventory, "r", encoding="utf-8") as stream:
                payload = json.load(stream)
        else:
            payload = json.load(sys.stdin)
        refs = parse_inventory(payload, args.uid)
        result = collect_coverage(
            refs,
            uid=args.uid,
            manager=manager,
            systemctl_bin=args.systemctl_bin,
            timeout=args.timeout,
            max_units=args.max_units,
        )
        print(json.dumps(result, indent=args.indent, sort_keys=True))
        return 0
    except (CollectorInputError, OSError, ValueError, json.JSONDecodeError):
        print(
            json.dumps(
                _error_document(args.uid, manager, "collector-input-invalid"), indent=args.indent, sort_keys=True
            )
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
