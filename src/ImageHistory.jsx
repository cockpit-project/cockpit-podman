/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React, { useState, useEffect } from 'react';

import cockpit from 'cockpit';
import { ListingTable } from "cockpit-components-table";

import * as client from './client.js';
import * as utils from './util.js';

const _ = cockpit.gettext;

const IdColumn = Id => {
    Id = utils.truncate_id(Id);
    // Not an id but <missing> or something else
    if (/<[a-z]+>/.test(Id)) {
        return <div className="ct-grey-text">{Id}</div>;
    }
    return Id;
};

const ImageDetails = ({ con, image }) => {
    const [history, setHistory] = useState([]);
    const [error, setError] = useState(null);
    const id = image.Id;

    useEffect(() => {
        client.imageHistory(con, id).then(setHistory)
                .catch(ex => {
                    console.error("Cannot get image history", ex);
                    setError(true);
                });
    }, [con, id]);

    const columns = ["ID", _("Created"), _("Created by"), _("Size"), _("Comments")];
    let showComments = false;
    const rows = history.map(layer => {
        const row = {
            columns: [
                { title: IdColumn(layer.Id), props: { className: "ignore-pixels" } },
                { title: <utils.RelativeTime time={layer.Created * 1000} />, props: { className: "ignore-pixels" } },
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
