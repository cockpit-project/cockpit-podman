import React from 'react';
<<<<<<< HEAD
import Listing from '../lib/cockpit-components-listing.jsx';
import cockpit from 'cockpit';

import ContainerDetails from './ContainerDetails.js';
const _ = cockpit.gettext;

class Containers extends React.Component {
    constructor(props) {
        super(props);
        console.log(props.containers);
        
        this.renderRow = this.renderRow.bind(this);
        this.getContainerState = this.getContainerState.bind(this);
    }

    navigateToContainer (container) {
        cockpit.location.go([ container.ID ]);
    }
    //TODO
    deleteContainer(event, container) {
        return undefined;
    }
    //TODO
    stopContainer(container) {
        return undefined;
    }
    //TODO
    startContainer(container) {
        return undefined;
    }

    //TODO
    restartContainer(container) {
        return undefined;
    }

    getContainerState(state) {
        if (state.Status)
            return state.Status;
        if (state.Running)
            return "running";
        if (state.Paused)
            return "paused";
        if (state.Restarting)
            return "restarting";
        if (state.FinishedAt && state.FinishedAt.indexOf("0001") === 0)
            return "created";
        return "exited";
    }
    renderRow(container) {
        let isRunning = !!container.State.Running;
        //TODO: check container.Image == container.ImageID
        let image = container.ImageName;
        let state = this.getContainerState(container.State);
            
        let columns = [
            { name: container.Name.replace(/^\//, ''), header: true },
            image,
            // util.render_container_cmdline(container),
            container.Config.Entrypoint === "" ? container.Config.Cmd.join(" "):container.Config.Cmd.join(""),
            // TODO: CpuUsage
            "",
            // 
            // TODO: MemoryUsage, MemoryLimit
            "",
            state,
            
        ];
        let tabs = [{
            name: _("Details"),
            renderer: ContainerDetails,
            data: { container: container }
        }];

        let startStopActions = [];
        if (isRunning)
            startStopActions.push({ label: _("Stop"), onActivate: this.stopContainer.bind(this, container) });
        else
            startStopActions.push({ label: _("Start"), onActivate: this.startContainer.bind(this, container) });

        startStopActions.push({
            label: _("Restart"),
            onActivate: this.restartContainer.bind(this, container),
            disabled: !isRunning
        });

        var actions = [
            <button className="btn btn-danger btn-delete pficon pficon-delete"
                    onClick={ this.deleteContainer.bind(this, container) } />,
            <button className="btn btn-default"
                    disabled={isRunning}
                    data-container-id={container.ID}
                    data-toggle="modal" data-target="#container-commit-dialog">
                {_("Commit")}
            </button>,
            //TODO: stop or start dropdown menu
            // <Dropdown actions={startStopActions} />
        ];

        return <Listing.ListingRow key={container.Id}
                                   columns={columns}
                                   tabRenderers={tabs}
                                   navigateToItem={ this.navigateToContainer.bind(this, container) }
                                   listingActions={actions} />;
    }

    render() {
        console.log(this.props.onlyShowRunning);
        const _ = cockpit.gettext;
        const columnTitles = [_("Name"), _("Image"), _("Command"), _("CPU"), _("Memory"), _("State")];
        //TODO
        let emptyCaption = _("No containers");
        
        let filtered = this.props.containers.filter((container)=>{
            if (this.props.onlyShowRunning && !container.State.Running)
                return false;
            return true;
            //TODO: check filter text
        });
        // console.log(filtered);
        let rows = filtered.map(this.renderRow);
        return(
            <div className="container-fluid ">
                {/* <h1>This div for containers table</h1> */}
                <div>
                    <Listing.Listing title={_("Containers")} columnTitles={columnTitles} emptyCaption={emptyCaption}>
                        {rows}
                    </Listing.Listing>

                </div>
=======

class Containers extends React.Component {
    render() {
        return(
            <div className="container-fluid ">
                <h1>This div for containers table</h1>
>>>>>>> 5c7ccf8... create js files images & containers
            </div>

        );
    }
}

export default Containers;