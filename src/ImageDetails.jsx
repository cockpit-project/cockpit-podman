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

    // https://specs.opencontainers.org/image-spec/annotations/?v=v1.1.1
    const imageDescription = labels?.["org.opencontainers.image.description"];
    const imageDocumentation = labels?.["org.opencontainers.image.documentation"];
    const imageVersion = labels?.["org.opencontainers.image.version"];
    return (
        <DescriptionList className='image-details' isAutoFit>
            {imageDescription &&
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Description")}</DescriptionListTerm>
                <DescriptionListDescription data-label="description">{imageDescription}</DescriptionListDescription>
            </DescriptionListGroup>
            }
            {imageVersion &&
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Version")}</DescriptionListTerm>
                <DescriptionListDescription data-label="version">{imageVersion}</DescriptionListDescription>
            </DescriptionListGroup>
            }
            {imageDocumentation &&
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Links")}</DescriptionListTerm>
                <DescriptionListDescription data-label="documentation">
                    <Button variant="link" isInline component="a" href={imageDocumentation} target="_blank noreferrer">
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
