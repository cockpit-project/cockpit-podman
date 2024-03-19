import React from 'react';
import cockpit from 'cockpit';

import { DescriptionList, DescriptionListTerm, DescriptionListDescription, DescriptionListGroup, List, ListItem } from "@patternfly/react-core";

import VolumeUsedBy from './VolumeUsedBy.jsx';
const _ = cockpit.gettext;

const render_map = (labels) => {
    if (!labels)
        return null;

    const result = Object.entries(labels).map(([key, value]) => {
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
    const options = volume.Options && Object.keys(volume.Options || {}).join(', ');

    return (
        <DescriptionList className='volume-details' isAutoFit>
            {Object.entries(volume.Labels).length !== 0 &&
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Labels")}</DescriptionListTerm>
                <DescriptionListDescription>{labels}</DescriptionListDescription>
            </DescriptionListGroup>
            }
            {options &&
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Mount options")}</DescriptionListTerm>
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
