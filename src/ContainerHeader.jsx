import React from 'react';
import cockpit from 'cockpit';
import { TextInput, FormSelect, FormSelectOption } from '@patternfly/react-core';
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

    handleFilterTextChange(value) {
        this.setState({ filterText: value }, this.filterChanged);
    }

    render() {
        return (
            <>
                { this.props.twoOwners &&
                    <>
                        <label className="heading-label" htmlFor="containers-containers-owner">{_("Owner")}</label>
                        <FormSelect id="containers-containers-owner" value={this.state.owner} onChange={this.handleOwnerChange}>
                            <FormSelectOption value='user' label={this.props.user} />
                            <FormSelectOption value='system' label={_("System")} />
                            <FormSelectOption value='all' label={_("All")} />
                        </FormSelect>
                    </>
                }
                <TextInput id="containers-filter"
                           className="form-control"
                           placeholder={_("Type to filter…")}
                           onChange={this.handleFilterTextChange} />
            </>
        );
    }
}

export default ContainerHeader;
