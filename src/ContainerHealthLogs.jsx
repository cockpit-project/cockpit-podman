/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2022 Red Hat, Inc.
 */

import React from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { DescriptionList, DescriptionListDescription, DescriptionListGroup, DescriptionListTerm } from "@patternfly/react-core/dist/esm/components/DescriptionList";
import { Icon } from "@patternfly/react-core/dist/esm/components/Icon";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex";
import { CheckCircleIcon, ErrorCircleOIcon } from "@patternfly/react-icons";

import cockpit from 'cockpit';
import { ListingTable } from "cockpit-components-table";

import * as client from './client.js';
import { containerScope, healthAge, healthDetail, normalizeExitCode } from './health.js';
import * as utils from './util.js';

const _ = cockpit.gettext;

const format_nanoseconds = (ns) => {
    const seconds = ns / 1000000000;
    return cockpit.format(cockpit.ngettext("$0 second", "$0 seconds", seconds), seconds);
};

const format_seconds = (seconds) => {
    if (!Number.isFinite(seconds))
        return _("unknown");
    return cockpit.format(cockpit.ngettext("$0 second", "$0 seconds", seconds), seconds);
};

const HealthcheckOnFailureActionText = {
    none: _("No action"),
    restart: _("Restart"),
    stop: _("Stop"),
    kill: _("Force stop"),
};

const ContainerHealthLogs = ({ con, container, onAddNotification, state, assessment }) => {
    const healthCheck = container.Config?.Healthcheck ?? container.Config?.Health ?? {}; // not-covered: only on old version
    const healthState = container.State?.Healthcheck ?? container.State?.Health ?? {}; // not-covered: only on old version
    const logs = [...(healthState.Log || [])].reverse(); // not-covered: Log should always exist, belt-and-suspenders
    const hasConfiguredHealthCheck = assessment?.configured ?? Boolean(healthCheck.Test?.length);
    const detail = healthDetail(assessment);
    const statusReason = (() => {
        switch (detail.code) {
        case "healthy":
            return null;
        case "unhealthy":
            return _("Health check failed");
        case "latest-check-failed":
            return _("Latest health check failed");
        case "details-pending":
            return _("Health details are still loading");
        case "starting":
            return _("Health check is in its startup grace period");
        case "missing":
            return _("No health check configured");
        case "stale":
            return _("The last health check is stale");
        case "scheduler-coverage-missing":
            return _("No active matching health schedule");
        case "scheduler-unavailable":
        case "scheduler-unknown":
            return _("Scheduler freshness is unknown");
        case "latest-check-unknown":
            return _("Latest health result is invalid");
        case "timestamp-future":
            return _("Health result timestamp is in the future");
        case "freshness-unknown":
            return _("Health result is present, but scheduler freshness is unknown");
        case "no-result":
            return _("No health result recorded");
        case "scheduler-error":
            return _("Health scheduler metadata is unavailable");
        case "collection-timeout":
            return _("Health data collection timed out");
        case "collection-error":
        case "error":
            return _("Health data collection failed");
        case "stopped":
            return detail.reason || _("Container is stopped; health result is not live");
        case "completed":
            return detail.reason || _("Container completed; health result is not live");
        case "retired":
            return detail.reason || _("Container is retired; health result is not live");
        case "infrastructure":
            return detail.reason || _("Infrastructure container; application health is not applicable");
        default:
            return _("Health status is unavailable");
        }
    })();
    const scope = assessment?.scope || containerScope(container);
    const age = healthAge(assessment);
    const ownerText = scope.ownerUid === null
        ? _("session user")
        : cockpit.format(_("UID $0"), scope.ownerUid);
    const scopeText = cockpit.format(_("$0 · $1"), scope.context, ownerText);

    return (
        <>
            <Flex alignItems={{ default: "alignItemsFlexStart" }}>
                <FlexItem grow={{ default: 'grow' }}>
                    <DescriptionList isAutoFit id="container-details-healthcheck">
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Status")}</DescriptionListTerm>
                            <DescriptionListDescription>{state}</DescriptionListDescription>
                        </DescriptionListGroup>
                        {statusReason && <DescriptionListGroup>
                            <DescriptionListTerm>{_("Reason")}</DescriptionListTerm>
                            <DescriptionListDescription className="healthcheck-reason" data-health-detail={statusReason}>{statusReason}</DescriptionListDescription>
                        </DescriptionListGroup>}
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Scope")}</DescriptionListTerm>
                            <DescriptionListDescription className="healthcheck-scope" data-health-scope={scope.fullId
                                ? `${scope.context}:${scope.ownerUid ?? "session"}:${scope.fullId}`
                                : ""}>{scopeText}</DescriptionListDescription>
                        </DescriptionListGroup>
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Container ID")}</DescriptionListTerm>
                            <DescriptionListDescription className="healthcheck-container-id" title={scope.fullId || scope.id || ""}>
                                {scope.fullId || scope.id || _("Unavailable")}
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                        {assessment?.lastChecked !== null && assessment?.lastChecked !== undefined && <DescriptionListGroup>
                            <DescriptionListTerm>{_("Last checked")}</DescriptionListTerm>
                            <DescriptionListDescription className="healthcheck-last-checked">
                                <utils.RelativeTime time={new Date(assessment.lastChecked)} />
                            </DescriptionListDescription>
                        </DescriptionListGroup>}
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Health age")}</DescriptionListTerm>
                            <DescriptionListDescription className="healthcheck-age" data-health-age-ms={age === null ? "" : age}>
                                {age === null ? _("Unavailable") : format_seconds(Math.floor(age / 1000))}
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                        {assessment?.schedule && <DescriptionListGroup>
                            <DescriptionListTerm>{_("Effective schedule")}</DescriptionListTerm>
                            <DescriptionListDescription className="healthcheck-schedule">
                                {assessment.schedule.effective_interval_seconds === null || assessment.schedule.effective_interval_seconds === undefined
                                    ? _("Unavailable")
                                    : format_seconds(assessment.schedule.effective_interval_seconds)}
                                {(assessment.schedule.schedule_source || assessment.schedule.schedules?.[0]?.schedule_source) &&
                                    ` (${assessment.schedule.schedule_source || assessment.schedule.schedules[0].schedule_source})`}
                            </DescriptionListDescription>
                        </DescriptionListGroup>}
                        {assessment?.staleAfterMs !== null && assessment?.staleAfterMs !== undefined && <DescriptionListGroup>
                            <DescriptionListTerm>{_("Freshness window")}</DescriptionListTerm>
                            <DescriptionListDescription className="healthcheck-freshness-window">
                                {format_seconds(assessment.staleAfterMs / 1000)}
                            </DescriptionListDescription>
                        </DescriptionListGroup>}
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Command")}</DescriptionListTerm>
                            <DescriptionListDescription className="healthcheck-command">
                                {hasConfiguredHealthCheck ? utils.quote_cmdline(healthCheck.Test) : _("Not configured")}
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                        {healthCheck.Interval && <DescriptionListGroup>
                            <DescriptionListTerm>{_("Interval")}</DescriptionListTerm>
                            <DescriptionListDescription className="healthcheck-interval">{format_nanoseconds(healthCheck.Interval)}</DescriptionListDescription>
                        </DescriptionListGroup>}
                        {healthCheck.Retries && <DescriptionListGroup>
                            <DescriptionListTerm>{_("Retries")}</DescriptionListTerm>
                            <DescriptionListDescription className="healthcheck-retries">{healthCheck.Retries}</DescriptionListDescription>
                        </DescriptionListGroup>}
                        {healthCheck.StartPeriod && <DescriptionListGroup>
                            <DescriptionListTerm>{_("Start period")}</DescriptionListTerm>
                            <DescriptionListDescription className="healthcheck-start-period">{format_nanoseconds(healthCheck.StartPeriod)}</DescriptionListDescription>
                        </DescriptionListGroup>}
                        {healthCheck.Timeout && <DescriptionListGroup>
                            <DescriptionListTerm>{_("Timeout")}</DescriptionListTerm>
                            <DescriptionListDescription className="healthcheck-timeout">{format_nanoseconds(healthCheck.Timeout)}</DescriptionListDescription>
                        </DescriptionListGroup>}
                        {container.Config?.HealthcheckOnFailureAction && <DescriptionListGroup>
                            <DescriptionListTerm>{_("When unhealthy")}</DescriptionListTerm>
                            <DescriptionListDescription className="healthcheck-when-unhealthy">{HealthcheckOnFailureActionText[container.Config.HealthcheckOnFailureAction]}</DescriptionListDescription>
                        </DescriptionListGroup>}
                        {healthState.FailingStreak && <DescriptionListGroup>
                            <DescriptionListTerm>{_("Failing streak")}</DescriptionListTerm>
                            <DescriptionListDescription className="healthcheck-failing-streak">{healthState.FailingStreak}</DescriptionListDescription>
                        </DescriptionListGroup>}
                    </DescriptionList>
                </FlexItem>
                { hasConfiguredHealthCheck && container.State.Status === "running" &&
                    <FlexItem>
                        <Button variant="secondary" onClick={() => {
                            client.runHealthcheck(con, container.Id)
                                    .catch(ex => {
                                        const error = cockpit.format(_("Failed to run health check on container $0"), container.Name); // not-covered: OS error
                                        onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                                    });
                        }}>
                            {_("Run health check")}
                        </Button>
                    </FlexItem>}
            </Flex>
            <ListingTable aria-label={_("Logs")}
                          className="health-logs"
                          variant='compact'
                          columns={[_("Last 5 runs"), _("Started at")]}
                      rows={
                          logs.map(log => {
                              const id = `hc${log.Start}${container.Id}`;
                              const exitCode = normalizeExitCode(log.ExitCode);
                              return {
                                  expandedContent: log.Output ? <pre>{log.Output}</pre> : null,
                                  columns: [
                                      {
                                          title: <Flex flexWrap={{ default: 'nowrap' }} spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
                                              {exitCode === 0 ? <Icon status="success"><CheckCircleIcon className="green" /></Icon> : <Icon status="danger"><ErrorCircleOIcon className="red" /></Icon>}
                                              <span>{exitCode === 0 ? _("Passed health run") : _("Failed health run")}</span>
                                          </Flex>
                                      },
                                      {
                                          title: <utils.RelativeTime time={log.Start} />
                                      }
                                  ],
                                  props: {
                                      key: id,
                                      "data-row-id": id,
                                  },
                              };
                          })
                      } />
        </>
    );
};

export default ContainerHealthLogs;
