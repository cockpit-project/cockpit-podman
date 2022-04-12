import React from 'react';
import cockpit from 'cockpit';

import { DescriptionList, DescriptionListTerm, DescriptionListDescription, DescriptionListGroup, List, ListItem } from "@patternfly/react-core";

import VolumeUsedBy from './VolumeUsedBy.jsx';
const _ = cockpit.gettext;

const render_map = (labels) => {
    if (!labels)
        return null;

    const result = Object.keys(labels).map((key, value) => {
        return (
            <ListItem key={ key }>
                { key }: { value }
            </ListItem>
        );
    });

    return <List isPlain>{result}</List>;
};

const VolumeDetails = ({ volume, containers, showAll }) => {
    const labels = volume.Labels && render_map(volume.Labels);
    const options = volume.Options && render_map(volume.Options);

    return (
        <DescriptionList className='volume-details' isAutoFit>
            {volume.Labels.length &&
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Labels")}</DescriptionListTerm>
                <DescriptionListDescription>{labels}</DescriptionListDescription>
            </DescriptionListGroup>
            }
            {volume.Scope &&
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Scope")}</DescriptionListTerm>
                <DescriptionListDescription>{volume.Scope}</DescriptionListDescription>
            </DescriptionListGroup>
            }
            {volume.Options.length &&
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Options")}</DescriptionListTerm>
                <DescriptionListDescription>{options}</DescriptionListDescription>
            </DescriptionListGroup>
            }
            {containers &&
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Used by")}</DescriptionListTerm>
                <DescriptionListDescription><VolumeUsedBy containers={containers} showAll={showAll} /></DescriptionListDescription>
            </DescriptionListGroup>
            }
        </DescriptionList>
    );
};

export default VolumeDetails;
