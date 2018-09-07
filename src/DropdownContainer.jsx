import React from 'react';
import PropTypes from 'prop-types';
import {SplitButton, MenuItem} from 'react-bootstrap';

class DropdownContainer extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            show: false,
            title: this.props.actions[0].label
        };

        this.handleClick = this.handleClick.bind(this);
        this.setShow = this.setShow.bind(this);
    }

    setShow() {
        this.setState((prevState) => ({
            show: !prevState.show
        }));
    }

    handleClick (props, event) {
        if (event.button !== 0)
            return;
        var action = props.actions[event.currentTarget.getAttribute('data-value')];
        if (!action.disabled && action.onActivate)
            action.onActivate();
        this.setState({
            title: action.label
        });
    }

    render() {
        const menuItems = this.props.actions.map((action, index) => {
            return (
                <MenuItem
                    key={index}
                    disabled={action.disabled}
                    data-value={index} tabIndex="0"
                    onClick={(event) => this.handleClick(this.props, event)}
                >
                    {action.label}
                </MenuItem>
            );
        });

        return (
            <SplitButton
                className={this.state.title + "-btn"}
                bsStyle="default"
                title={this.state.title}
                data-value="0"
                onClick={(event) => this.handleClick(this.props, event)}
                pullRight id="split-button-pull-right"
            >
                {menuItems}
            </SplitButton>

        );
    }
}

DropdownContainer.PropTypes = {
    actions: PropTypes.array.isRequired
};

export default DropdownContainer;
