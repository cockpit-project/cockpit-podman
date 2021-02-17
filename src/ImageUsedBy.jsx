import React from 'react';
import cockpit from 'cockpit';
import * as utils from './util.js';
import { ListingTable } from "cockpit-components-table.jsx";

const _ = cockpit.gettext;

const renderRow = (containerStats, container) => {
    const isRunning = container.State == "running";

    let proc = "";
    let mem = "";
    if (containerStats) {
        proc = containerStats.cpu_stats ? containerStats.cpu_stats.cpu.toFixed(2) + "%" : <div><abbr title={_("not available")}>{_("n/a")}</abbr></div>;
        mem = containerStats.memory_stats ? utils.format_memory_and_limit(containerStats.memory_stats.usage, containerStats.memory_stats.limit) : <div><abbr title={_("not available")}>{_("n/a")}</abbr></div>;
    }
    const columns = [
        { title: container.Names, header: true },
        utils.quote_cmdline(container.Command),
        proc,
        mem,
        _(container.State), // States are defined in util.js
    ];
    return {
        columns: columns,
        props: {
            key: "usedby-" + container.Id,
            running: isRunning,
            containerId: container.Id,
            "data-row-id": "usedby-" + container.Id,
        }
    };
};

const ImageUsedBy = (props) => {
    const columnTitles = [_("Name"), _("Command"), _("CPU"), _("Memory"), _("State")];
    let emptyCaption = _("No containers are using this image");
    const containers = [];
    let cs = props.containers;

    if (cs === undefined)
        cs = [];

    if (cs !== null) {
        cs.forEach(c => {
            containers.push(renderRow(c.stats, c.container));
        });
    } else {
        emptyCaption = _("Loading...");
    }

    return (
        <ListingTable
            onRowClick={(_, x) => {
                const loc = document.location.toString().split('#')[0];
                document.location = loc + '#' + x.props.containerId;
                if (!x.props.running)
                    props.showAll();
                return false;
            }}
            variant='compact'
            emptyCaption={emptyCaption}
            columns={columnTitles}
            rows={containers}
        />
    );
};

export default ImageUsedBy;
