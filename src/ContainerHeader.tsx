/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React from 'react';

import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { SearchInput } from "@patternfly/react-core/dist/esm/components/SearchInput";
import { Toolbar, ToolbarContent, ToolbarItem } from "@patternfly/react-core/dist/esm/components/Toolbar";

import cockpit from 'cockpit';
const _ = cockpit.gettext;

// TODO: move to app.tsx when ported to TypeScript
interface User {
    name: string;
    uid: number | null;
}

interface ContainerHeaderProps {
    users: User[];
    ownerFilter: string;
    handleOwnerChanged: (value: string) => void;
    textFilter: string;
    handleFilterChanged: (value: string) => void;
}

const ContainerHeader = ({ users, ownerFilter, handleOwnerChanged, textFilter, handleFilterChanged }: ContainerHeaderProps) => {
    return (
        <Toolbar inset={{ sm: 'insetSm', default: 'insetNone' }}>
            <ToolbarContent alignItems='baseline'>
                { users.length >= 2 &&
                    <>
                        <ToolbarItem variant="label">
                            {_("Owner")}
                        </ToolbarItem>
                        <ToolbarItem>
                            <FormSelect id="containers-containers-owner" value={ownerFilter} onChange={(_, value) => handleOwnerChanged(value)}>
                                { users.map(user => <FormSelectOption key={user.name}
                                                                      value={user.uid == null ? "user" : user.uid}
                                                                      label={user.name} />) }
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
