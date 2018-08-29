import React from 'react';
import cockpit from 'cockpit';
import * as Select from '../lib/cockpit-components-select.jsx';
const _ = cockpit.gettext;

class ContainerHeader extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            filter: 'running',
            filterText: ''
        };
        this.handleFilterChange = this.handleFilterChange.bind(this);
        this.handleFilterTextChange = this.handleFilterTextChange.bind(this);
    }

    filterChanged() {
        if (this.props.onFilterChanged)
            this.props.onFilterChanged(this.state.filter, this.state.filterText);
    }

    handleFilterChange (value) {
        this.setState({ filter: value });
        if (this.props.onChange) {
            this.props.onChange(value);
        }
    }

    handleFilterTextChange() {
        this.setState({ filterText: this.refs.filterTextInput.value }, this.filterChanged);
    }

    render() {
        return (
            <div className="content-filter" >
                <Select.Select id="containers-containers-filter" initial={this.state.filter} onChange={this.handleFilterChange}>
                    <Select.SelectEntry data='all'>{_("Everything")}</Select.SelectEntry>
                    <Select.SelectEntry data='running'>{_("Images and running containers")}</Select.SelectEntry>
                </Select.Select>
                <input type="text"
                       id="containers-filter"
                       ref="filterTextInput"
                       className="form-control"
                       placeholder={_("Type to filter…")}
                       onChange={this.handleFilterTextChange} />
            </div>
        );
    }
}

export default ContainerHeader;
