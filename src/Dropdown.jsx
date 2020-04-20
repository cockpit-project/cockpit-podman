import React from 'react';
import { DropdownButton, MenuItem } from 'patternfly-react';

const DropDown = (props) => {
    const actions = props.actions;
    const buttonsHtml = actions
            .map((button, index) => {
                return (
                    <MenuItem key={index} eventKey={index} onClick={button.onActivate}>
                        {button.label}
                    </MenuItem>
                );
            });

    return (
        <DropdownButton
            variant="default"
            title={actions[0].label}
            id={actions[0].label + "-dropdown"}>
            {buttonsHtml}
        </DropdownButton>
    );
};

DropDown.defaultProps = {
    actions: [{ label: '' }]
};

export default DropDown;
