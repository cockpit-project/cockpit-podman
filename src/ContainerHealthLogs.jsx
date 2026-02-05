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
import * as utils from './util.js';

const _ = cockpit.gettext;

const format_nanoseconds = (ns) => {
    const seconds = ns / 1000000000;
    return cockpit.format(cockpit.ngettext("$0 second", "$0 seconds", seconds), seconds);
};

const HealthcheckOnFailureActionText = {
    none: _("No action"),
    restart: _("Restart"),
    stop: _("Stop"),
    kill: _("Force stop"),
};

const ContainerHealthLogs = ({ con, container, onAddNotification, state }) => {
    const healthCheck = container.Config?.Healthcheck ?? container.Config?.Health ?? {}; // not-covered: only on old version
    const healthState = container.State?.Healthcheck ?? container.State?.Health ?? {}; // not-covered: only on old version
    const logs = [...(healthState.Log || [])].reverse(); // not-covered: Log should always exist, belt-and-suspenders

    return (
        <>
            <Flex alignItems={{ default: "alignItemsFlexStart" }}>
                <FlexItem grow={{ default: 'grow' }}>
                    <DescriptionList isAutoFit id="container-details-healthcheck">
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Status")}</DescriptionListTerm>
                            <DescriptionListDescription>{state}</DescriptionListDescription>
                        </DescriptionListGroup>
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Command")}</DescriptionListTerm>
                            <DescriptionListDescription className="healthcheck-command">{utils.quote_cmdline(healthCheck.Test)}</DescriptionListDescription>
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
                { container.State.Status === "running" &&
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
                                  const id = "hc" + log.Start + container.Id;
                                  return {
                                      expandedContent: log.Output ? <pre>{log.Output}</pre> : null,
                                      columns: [
                                          {
                                              title: <Flex flexWrap={{ default: 'nowrap' }} spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
                                                  {log.ExitCode === 0 ? <Icon status="success"><CheckCircleIcon className="green" /></Icon> : <Icon status="danger"><ErrorCircleOIcon className="red" /></Icon>}
                                                  <span>{log.ExitCode === 0 ? _("Passed health run") : _("Failed health run")}</span>
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
