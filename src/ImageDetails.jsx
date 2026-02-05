/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React from 'react';

import { DescriptionList, DescriptionListDescription, DescriptionListGroup, DescriptionListTerm } from "@patternfly/react-core/dist/esm/components/DescriptionList";

import cockpit from 'cockpit';

import ImageUsedBy from './ImageUsedBy.jsx';
import * as utils from './util.js';

const _ = cockpit.gettext;

const ImageDetails = ({ containers, image, showAll }) => {
    return (
        <DescriptionList className='image-details' isAutoFit>
            {image.Command &&
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Command")}</DescriptionListTerm>
                <DescriptionListDescription>{utils.quote_cmdline(image.Command)}</DescriptionListDescription>
            </DescriptionListGroup>
            }
            {image.Entrypoint &&
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Entrypoint")}</DescriptionListTerm>
                <DescriptionListDescription>{image.Entrypoint.join(" ")}</DescriptionListDescription>
            </DescriptionListGroup>
            }
            {image.RepoTags &&
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Tags")}</DescriptionListTerm>
                <DescriptionListDescription>{image.RepoTags ? image.RepoTags.join(" ") : ""}</DescriptionListDescription>
            </DescriptionListGroup>
            }
            {containers &&
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Used by")}</DescriptionListTerm>
                <DescriptionListDescription><ImageUsedBy containers={containers} showAll={showAll} /></DescriptionListDescription>
            </DescriptionListGroup>
            }
            {image.Ports.length !== 0 &&
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Ports")}</DescriptionListTerm>
                <DescriptionListDescription>{image.Ports.join(', ')}</DescriptionListDescription>
            </DescriptionListGroup>
            }
        </DescriptionList>
    );
};

export default ImageDetails;
