/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React from 'react';

import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Flex } from "@patternfly/react-core/dist/esm/layouts/Flex";

import cockpit from 'cockpit';
const _ = cockpit.gettext;

// TODO: move to app.tsx when ported to TypeScript
interface User {
    name: string;
    uid: number | null;
    con: unknown;
}

interface OtherUsersHintProps {
    users: User[];
    ownerFilter: string | number;
    handleOwnerChanged: (value: string) => void;
}

/*
 * The "All" owner only covers the system and the logged in user. Connections
 * to other users, which were detected through their running containers, are
 * only made while one of them is selected. Without this hint, someone whose
 * containers all belong to other users just sees an empty page.
 */
export const OtherUsersHint = ({ users, ownerFilter, handleOwnerChanged }: OtherUsersHintProps) => {
    if (ownerFilter !== "all")
        return null;

    const others = users.filter(u => u.uid !== null && u.uid !== 0 && u.con === null);
    if (others.length === 0)
        return null;

    return (
        <Alert id="containers-other-users-hint"
               variant="info"
               isInline
               title={_("Containers and images of other users are not included")}>
            <p>{_("The owner \"All\" only shows the system and your own user. Select an owner to see theirs:")}</p>
            <Flex columnGap={{ default: 'columnGapMd' }}>
                { others.map(user =>
                    <Button key={user.name}
                            variant="link"
                            isInline
                            id={`containers-other-users-hint-${user.uid}`}
                            onClick={() => handleOwnerChanged(String(user.uid))}>
                        {user.name}
                    </Button>)
                }
            </Flex>
        </Alert>
    );
};
