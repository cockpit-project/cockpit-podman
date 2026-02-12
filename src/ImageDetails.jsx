/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { DescriptionList, DescriptionListDescription, DescriptionListGroup, DescriptionListTerm } from "@patternfly/react-core/dist/esm/components/DescriptionList";

import cockpit from 'cockpit';

import ImageUsedBy from './ImageUsedBy.jsx';
import * as utils from './util.js';

const _ = cockpit.gettext;

const ImageDetails = ({ containers, image, showAll }) => {
    const labels = image?.Labels;
    return (
        <DescriptionList className='image-details' isAutoFit>
            {labels?.["org.opencontainers.image.description"] &&
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Description")}</DescriptionListTerm>
                <DescriptionListDescription data-label="description">{labels["org.opencontainers.image.description"]}</DescriptionListDescription>
            </DescriptionListGroup>
            }
            {labels?.["org.opencontainers.image.version"] &&
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Version")}</DescriptionListTerm>
                <DescriptionListDescription data-label="version">{labels["org.opencontainers.image.version"]}</DescriptionListDescription>
            </DescriptionListGroup>
            }
            {labels?.["org.opencontainers.image.documentation"] &&
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Links")}</DescriptionListTerm>
                <DescriptionListDescription data-label="documentation">
                    <Button variant="link" isInline component="a" href={labels["org.opencontainers.image.documentation"]} target="_blank noreferrer">
                        {_("Documentation")}
                    </Button>
                </DescriptionListDescription>
            </DescriptionListGroup>
            }
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
