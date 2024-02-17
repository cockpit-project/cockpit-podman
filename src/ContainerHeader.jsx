import React from 'react';
import cockpit from 'cockpit';
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Toolbar, ToolbarContent, ToolbarItem } from "@patternfly/react-core/dist/esm/components/Toolbar";
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
                                   onChange={(_, value) => handleFilterChanged(value)} />
                </ToolbarItem>
            </ToolbarContent>
        </Toolbar>
    );
};

export default ContainerHeader;
