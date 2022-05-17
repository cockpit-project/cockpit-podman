import React from 'react';
import cockpit from 'cockpit';
import {
    FormSelect, FormSelectOption,
    TextInput, Toolbar, ToolbarContent, ToolbarItem,
} from '@patternfly/react-core';
const _ = cockpit.gettext;

const ContainerHeader = ({ user, twoOwners, ownerFilter, handleOwnerChanged, textFilter, handleFilterChanged }) => {
    return (
        <Toolbar className="pf-m-page-insets">
            <ToolbarContent>
                { twoOwners &&
                    <>
                        <ToolbarItem variant="label">
                            {_("Owner")}
                        </ToolbarItem>
                        <ToolbarItem>
                            <FormSelect id="containers-containers-owner" value={ownerFilter} onChange={handleOwnerChanged}>
                                <FormSelectOption value='user' label={user} />
                                <FormSelectOption value='system' label={_("System")} />
                                <FormSelectOption value='all' label={_("All")} />
                            </FormSelect>
                        </ToolbarItem>
                    </>
                }
                <ToolbarItem>
                    <TextInput id="containers-filter"
                                   placeholder={_("Type to filter…")}
                                   value={textFilter}
                                   onChange={handleFilterChanged} />
                </ToolbarItem>
            </ToolbarContent>
        </Toolbar>
    );
};

export default ContainerHeader;
