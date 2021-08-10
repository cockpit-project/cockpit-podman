import React from 'react';
import cockpit from 'cockpit';
import { Button, List, ListItem } from "@patternfly/react-core";

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
                const isRunning = container.State == "running";
                return (
                    <ListItem key={container.Id}>
                        <Button variant="link"
                                isInline
                                onClick={() => {
                                    const loc = document.location.toString().split('#')[0];
                                    document.location = loc + '#' + container.Id;

                                    if (!isRunning)
                                        showAll();
                                }}>
                            {container.Names}
                        </Button>
                    </ListItem>
                );
            })}
        </List>
    );
};

export default ImageUsedBy;
