import React from 'react';
import cockpit from 'cockpit';
import * as utils from './util.js';

import { DescriptionList, DescriptionListTerm, DescriptionListDescription, DescriptionListGroup } from "@patternfly/react-core";

import ImageUsedBy from './ImageUsedBy.jsx';
const _ = cockpit.gettext;

const truncate_id = (id) => {
    return id.substr(0, 12);
};

const ImageDetails = ({ containers, image, showAll }) => {
    return (
        <DescriptionList isHorizontal className='image-details' columnModifier={{
            default: '2Col'
        }}>
            <DescriptionListGroup>
                <DescriptionListTerm>{_("ID")}</DescriptionListTerm>
                <DescriptionListDescription title={image.Id}>{truncate_id(image.Id)}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Tags")}</DescriptionListTerm>
                <DescriptionListDescription>{image.RepoTags ? image.RepoTags.join(" ") : ""}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Entrypoint")}</DescriptionListTerm>
                <DescriptionListDescription>{image.Entrypoint ? image.Entrypoint.join(" ") : ""}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Command")}</DescriptionListTerm>
                <DescriptionListDescription>{image.Command ? utils.quote_cmdline(image.Command) : "" }</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Created")}</DescriptionListTerm>
                <DescriptionListDescription>{utils.localize_time(image.Created)}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Author")}</DescriptionListTerm>
                <DescriptionListDescription>{image.Author}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Ports")}</DescriptionListTerm>
                <DescriptionListDescription>{image.Ports ? image.Ports.join(', ') : ""}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Used by")}</DescriptionListTerm>
                <DescriptionListDescription><ImageUsedBy containers={containers} showAll={showAll} /></DescriptionListDescription>
            </DescriptionListGroup>
        </DescriptionList>
    );
};

export default ImageDetails;
