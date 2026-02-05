/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React from 'react';

import { Badge } from "@patternfly/react-core/dist/esm/components/Badge";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { List, ListItem } from "@patternfly/react-core/dist/esm/components/List";
import { Flex } from "@patternfly/react-core/dist/esm/layouts/Flex";

import cockpit from 'cockpit';

const _ = cockpit.gettext;

const ImageUsedBy = ({ containers, showAll }) => {
    if (containers === null)
        return _("Loading...");
    if (containers === undefined)
        return _("No containers are using this image");

    return (
        <List isPlain>
            {containers.map(c => {
                const container = c.container;
                const isRunning = container.State?.Status === "running";
                return (
                    <ListItem key={container.Id}>
                        <Flex>
                            <Button variant="link"
                                    isInline
                                    onClick={() => {
                                        const loc = document.location.toString().split('#')[0];
                                        document.location = loc + '#' + container.Id;

                                        if (!isRunning)
                                            showAll();
                                    }}>
                                {container.Name}
                            </Button>
                            {isRunning && <Badge className="ct-badge-container-running">{_("Running")}</Badge>}
                        </Flex>
                    </ListItem>
                );
            })}
        </List>
    );
};

export default ImageUsedBy;
