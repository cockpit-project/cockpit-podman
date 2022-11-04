/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2022 Red Hat, Inc.
 *
 * Cockpit is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * Cockpit is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Cockpit; If not, see <http://www.gnu.org/licenses/>.
 */

import React from 'react';
import cockpit from 'cockpit';
import * as utils from './util.js';
import * as client from './client.js';

import { ListingTable } from "cockpit-components-table.jsx";
import {
    Button,
    DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription,
    Flex, FlexItem,
} from '@patternfly/react-core';
import { CheckCircleIcon, ErrorCircleOIcon } from "@patternfly/react-icons";

const _ = cockpit.gettext;

const format_nanoseconds = (ns) => {
    const seconds = ns / 1000000000;
    return cockpit.format(cockpit.ngettext("$0 second", "$0 seconds", seconds), seconds);
};

const ContainerHealthLogs = ({ container, containerDetail, onAddNotification, state }) => {
    let healthCheck = {};
    let failingStreak = 0;
    let logs = [];
    if (containerDetail) {
        healthCheck = containerDetail.Config.Healthcheck || containerDetail.Config.Health;
        const healthState = containerDetail.State.Healthcheck || containerDetail.State.Health;
        failingStreak = healthState.FailingStreak || 0;
        logs = [...(healthState.Log || [])].reverse();
    }

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
                            <DescriptionListDescription>{utils.quote_cmdline(healthCheck.Test)}</DescriptionListDescription>
                        </DescriptionListGroup>
                        {healthCheck.Interval && <DescriptionListGroup>
                            <DescriptionListTerm>{_("Interval")}</DescriptionListTerm>
                            <DescriptionListDescription>{format_nanoseconds(healthCheck.Interval)}</DescriptionListDescription>
                        </DescriptionListGroup>}
                        {healthCheck.Retries && <DescriptionListGroup>
                            <DescriptionListTerm>{_("Retries")}</DescriptionListTerm>
                            <DescriptionListDescription>{healthCheck.Retries}</DescriptionListDescription>
                        </DescriptionListGroup>}
                        {healthCheck.StartPeriod && <DescriptionListGroup>
                            <DescriptionListTerm>{_("Start period")}</DescriptionListTerm>
                            <DescriptionListDescription>{format_nanoseconds(healthCheck.StartPeriod)}</DescriptionListDescription>
                        </DescriptionListGroup>}
                        {healthCheck.Timeout && <DescriptionListGroup>
                            <DescriptionListTerm>{_("Timeout")}</DescriptionListTerm>
                            <DescriptionListDescription>{format_nanoseconds(healthCheck.Timeout)}</DescriptionListDescription>
                        </DescriptionListGroup>}
                        {failingStreak !== 0 && <DescriptionListGroup>
                            <DescriptionListTerm>{_("Failing streak")}</DescriptionListTerm>
                            <DescriptionListDescription>{failingStreak}</DescriptionListDescription>
                        </DescriptionListGroup>}
                    </DescriptionList>
                </FlexItem>
                { container.State === "running" &&
                    <FlexItem>
                        <Button variant="secondary" onClick={() => {
                            client.runHealthcheck(container.isSystem, container.Id)
                                    .catch(ex => {
                                        const error = cockpit.format(_("Failed to run health check on container $0"), container.Names);
                                        onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                                    });
                        }}>
                            {_("Run health check")}
                        </Button>
                    </FlexItem>}
            </Flex>
            <ListingTable aria-label={_("Logs")}
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
                                                  {log.ExitCode === 0 ? <CheckCircleIcon className="green" /> : <ErrorCircleOIcon className="red" />}
                                                  <span>{log.ExitCode === 0 ? _("Passed health run") : _("Failed health run")}</span>
                                              </Flex>
                                          },
                                          utils.localize_time(Date.parse(log.Start) / 1000)
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
