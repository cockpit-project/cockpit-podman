import React from 'react';
import cockpit from 'cockpit';
import * as Select from '../lib/cockpit-components-select.jsx';
const _ = cockpit.gettext;

class ContainerHeader extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            owner: 'all',
            filterText: ''
        };
        this.handleFilterTextChange = this.handleFilterTextChange.bind(this);
        this.handleOwnerChange = this.handleOwnerChange.bind(this);
    }

    filterChanged() {
        if (this.props.onFilterChanged)
            this.props.onFilterChanged(this.state.filterText);
    }

    handleOwnerChange (value) {
        this.setState({ owner: value });
        if (this.props.onOwnerChanged) {
            this.props.onOwnerChanged(value);
        }
    }

    handleFilterTextChange() {
        this.setState({ filterText: this.refs.filterTextInput.value }, this.filterChanged);
    }

    render() {
        return (
            <>
                { this.props.twoOwners &&
                    <>
                        <label className="heading-label" htmlFor="containers-containers-owner">{_("Owner")}</label>
                        <Select.Select id="containers-containers-owner" initial={this.state.owner} onChange={this.handleOwnerChange}>
                            <Select.SelectEntry data='user'>{this.props.user ? this.props.user.name : _("User")}</Select.SelectEntry>
                            <Select.SelectEntry data='system'>{_("System")}</Select.SelectEntry>
                            <Select.SelectEntry data='all'>{_("All")}</Select.SelectEntry>
                        </Select.Select>
                    </>
                }
                <input type="text"
                       id="containers-filter"
                       ref="filterTextInput"
                       className="form-control"
                       placeholder={_("Type to filter…")}
                       onChange={this.handleFilterTextChange} />
            </>
        );
    }
}

export default ContainerHeader;
