import React from 'react';
import cockpit from 'cockpit';
import { ListingTable } from "cockpit-components-table.jsx";
import * as utils from './util.js';

import '@patternfly/react-styles/css/utilities/Sizing/sizing.css';
import { cellWidth } from '@patternfly/react-table';

const _ = cockpit.gettext;

const columnTitles = [
    _("#"),
    _("Created"),
    _("Size"),
    { title: _("Created By"), transforms: [cellWidth(80)] },
];

const render_image_history = (history) => {
    if (!history)
        return null;

    let count = history.length;
    return history.map(record => {
        const columns = [
            count--,
            { title: utils.localize_time(record.Created), props: { modifier: "nowrap" } },
            { title: cockpit.format_bytes(record.Size, 1000), props: { modifier: "nowrap" } },
            { title: <span className="ct-code">{record.CreatedBy}</span>, props: { modifier: "breakWord" } },
        ];

        return (
            { columns }
        );
    });
};

const ImageHistory = ({ image }) => {
    const history = (image && image.History.length !== 0) ? render_image_history(image.History) : null;
    return (
        <div className='ct-image-history'>
            <ListingTable
                variant='compact'
                isStickyHeader
                emptyCaption={null}
                columns={columnTitles}
                rows={history} />
        </div>
    );
};

export default ImageHistory;
