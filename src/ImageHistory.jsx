import React, { useState, useEffect } from 'react';
import cockpit from 'cockpit';
import * as utils from './util.js';
import * as client from './client.js';

import { ListingTable } from "cockpit-components-table.jsx";

const _ = cockpit.gettext;

const IdColumn = Id => {
    Id = utils.truncate_id(Id);
    // Not an id but <missing> or something else
    if (/<[a-z]+>/.test(Id)) {
        return <div className="pf-v5-u-disabled-color-100">{Id}</div>;
    }
    return Id;
};

const ImageDetails = ({ image }) => {
    const [history, setHistory] = useState([]);
    const [error, setError] = useState(null);
    const isSystem = image.isSystem;
    const id = image.Id;

    useEffect(() => {
        client.imageHistory(isSystem, id).then(setHistory)
                .catch(ex => {
                    console.error("Cannot get image history", ex);
                    setError(true);
                });
    }, [isSystem, id]);

    const columns = ["ID", _("Created"), _("Created by"), _("Size"), _("Comments")];
    let showComments = false;
    const rows = history.map(layer => {
        const row = {
            columns: [
                { title: IdColumn(layer.Id), props: { className: "ignore-pixels" } },
                { title: utils.localize_time(layer.Created), props: { className: "ignore-pixels" } },
                { title: layer.CreatedBy, props: { className: "ignore-pixels" } },
                { title: cockpit.format_bytes(layer.Size), props: { className: "ignore-pixels" } },
                { title: layer.Comment, props: { className: "ignore-pixels" } },
            ]
        };
        if (layer.Comment) {
            showComments = true;
        }
        return row;
    });

    if (!showComments) {
        columns.pop();
    }

    return (
        <ListingTable
            variant='compact'
            isStickyHeader
            emptyCaption={error ? _("Unable to load image history") : _("Loading details...")}
            columns={columns}
            rows={rows} />
    );
};

export default ImageDetails;
