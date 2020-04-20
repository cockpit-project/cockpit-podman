import React, { useState } from 'react';
import {
    Dropdown,
    DropdownToggle,
    DropdownToggleAction,
    DropdownItem,
} from '@patternfly/react-core';

export const DropDown = ({ actions }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownItems = actions
            .map(button => {
                return (
                    <DropdownItem key={button.label} onClick={button.onActivate}>
                        {button.label}
                    </DropdownItem>
                );
            });

    return (
        <Dropdown
            onSelect={() => setIsOpen(!isOpen)}
            id={actions[0].label + "-dropdown"}
            toggle={
                <DropdownToggle
                    splitButtonItems={[
                        <DropdownToggleAction key="default-action" onClick={actions[0].onActivate}>
                            {actions[0].label}
                        </DropdownToggleAction>
                    ]}
                    splitButtonVariant="action"
                    onToggle={open => setIsOpen(open)}
                />
            }
            isOpen={isOpen}
            dropdownItems={dropdownItems}
        />
    );
};
DropDown.defaultProps = {
    actions: [{ label: '' }]
};
