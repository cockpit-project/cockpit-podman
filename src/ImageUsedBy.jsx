import React from 'react';
import cockpit from 'cockpit';
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Badge } from "@patternfly/react-core/dist/esm/components/Badge";
import { Flex } from "@patternfly/react-core/dist/esm/layouts/Flex";
import { List, ListItem } from "@patternfly/react-core/dist/esm/components/List";

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
