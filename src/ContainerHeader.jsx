import React from 'react';
import cockpit from 'cockpit';
import {
    FormSelect, FormSelectOption,
    TextInput, Toolbar, ToolbarContent, ToolbarItem,
} from '@patternfly/react-core';
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
            <Toolbar className="pf-m-page-insets">
                <ToolbarContent>
                    { this.props.twoOwners &&
                    <>
                        <ToolbarItem variant="label">
                            {_("Owner")}
                        </ToolbarItem>
                        <ToolbarItem>
                            <FormSelect id="containers-containers-owner" value={this.state.owner} onChange={this.handleOwnerChange}>
                                <FormSelectOption value='user' label={this.props.user} />
                                <FormSelectOption value='system' label={_("System")} />
                                <FormSelectOption value='all' label={_("All")} />
                            </FormSelect>
                        </ToolbarItem>
                    </>
                    }
                    <ToolbarItem>
                        <TextInput id="containers-filter"
                                   placeholder={_("Type to filter…")}
                                   onChange={this.handleFilterTextChange} />
                    </ToolbarItem>
                </ToolbarContent>
            </Toolbar>
        );
    }
}

export default ContainerHeader;
