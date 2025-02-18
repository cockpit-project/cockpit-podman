import React from 'react';

import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { SearchInput } from "@patternfly/react-core/dist/esm/components/SearchInput";
import { Toolbar, ToolbarContent, ToolbarItem } from "@patternfly/react-core/dist/esm/components/Toolbar";

import cockpit from 'cockpit';
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
                            <FormSelect id="containers-containers-owner" value={ownerFilter} onChange={(_, value) => handleOwnerChanged(value)}>
                                <FormSelectOption value='user' label={user} />
                                <FormSelectOption value={0} label={_("System")} />
                                <FormSelectOption value='all' label={_("All")} />
                            </FormSelect>
                        </ToolbarItem>
                    </>
                }
                <ToolbarItem>
                    <SearchInput id="containers-filter"
                                 placeholder={_("Type to filter…")}
                                 value={textFilter}
                                 onChange={(_, value) => handleFilterChanged(value)}
                                 onClear={() => handleFilterChanged('')}
                    />
                </ToolbarItem>
            </ToolbarContent>
        </Toolbar>
    );
};

export default ContainerHeader;
