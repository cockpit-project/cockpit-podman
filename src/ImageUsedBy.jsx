import React from 'react';
import cockpit from 'cockpit';
import * as utils from './util.js';
import * as Listing from '../lib/cockpit-components-listing.jsx';

const _ = cockpit.gettext;

const renderRow = (containerStats, container, showAll) => {
    const isRunning = container.status == "running";
    let proc = "";
    let mem = "";
    if (containerStats) {
        proc = containerStats.cpu ? utils.format_cpu_percent(containerStats.cpu * 100) : <abbr title={_("not available")}>{_("n/a")}</abbr>;
        mem = containerStats.mem_usage ? utils.format_memory_and_limit(containerStats.mem_usage, containerStats.mem_limit) : <abbr title={_("not available")}>{_("n/a")}</abbr>;
    }

    const columns = [
        { name: container.names, header: true },
        utils.quote_cmdline(container.command),
        proc,
        mem,
        container.status /* TODO: i18n */,

    ];
    return <Listing.ListingRow
                navigateToItem={() => {
                    let loc = document.location.toString().split('#')[0];
                    document.location = loc + '#' + container.id;
                    if (!isRunning)
                        showAll();
                    return false;
                }}
                key={"usedby-" + container.id}
                rowId={"usedby-" + container.id}
                columns={columns}
    />;
};

const ImageUsedBy = (props) => {
    const columnTitles = [_("Name"), _("Command"), _("CPU"), _("Memory"), _("State")];
    let emptyCaption = _("No containers are using this image");
    let containers = [];
    let cs = props.containers;

    if (cs === undefined)
        cs = [];

    if (cs !== null) {
        cs.forEach(c => {
            containers.push(renderRow(c.stats, c.container, props.showAll));
        });
    } else {
        emptyCaption = _("Loading...");
    }

    return (
        <Listing.Listing columnTitles={columnTitles} emptyCaption={emptyCaption}>
            { containers }
        </Listing.Listing>
    );
};

export default ImageUsedBy;
