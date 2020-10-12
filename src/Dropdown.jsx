import React, { useState } from 'react';
import {
    Dropdown,
    DropdownToggle,
    DropdownToggleAction,
    DropdownItem,
    KebabToggle,
} from '@patternfly/react-core';

export const DropDown = ({ actions, isKebab }) => {
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
                isKebab ? <KebabToggle onToggle={open => setIsOpen(open)} splitButtonVariant="action" />
                    : <DropdownToggle
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
            isPlain={isKebab}
        />
    );
};
DropDown.defaultProps = {
    actions: [{ label: '' }]
};
