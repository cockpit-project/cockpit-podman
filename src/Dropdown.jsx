import React from 'react';
import PropTypes from 'prop-types';
import * as Select from '../lib/cockpit-components-select.jsx';

class Dropdown extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            show: false,
            title: this.props.actions[0].label
        };

        this.handleClick = this.handleClick.bind(this);
    }

    // TODO
    handleClick (event) {

    }

    render() {
        const menuItems = this.props.actions.map((action, index) => {
            return (
                <Select.SelectEntry
                    data={action.label}
                    key={index}
                    disabled={action.disabled}
                >
                    {action.label}
                </Select.SelectEntry>
            );
        });

        return (
            <Select.Select initial={this.state.title} onChange={(event) => this.handleClick(event)}>
                {menuItems}
            </Select.Select>
        );
    }
}

Dropdown.PropTypes = {
    actions: PropTypes.array.isRequired
};

export default Dropdown;
