/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2020 Red Hat, Inc.
 *
 * Cockpit is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * Cockpit is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Cockpit; If not, see <http://www.gnu.org/licenses/>.
 */

import React from 'react';
import cockpit from 'cockpit';

class StorageUsage extends React.Component {
    render() {
        const goToStorage = () => cockpit.jump("/storage");
        const barWidth = "36%"; // how to calcualte this?
        return <div className="storage-usage-holder">
            <div>
                <span>{ cockpit.format_bytes(this.props.totalStorageUsage) }</span>
                <span>&nbsp;Used</span>
            </div>
            <div className="storage-usage-bar" style={{ width: barWidth }} />
            <a role="link" tabIndex="0" onKeyDown={goToStorage} onClick={goToStorage}>Storage...</a>
        </div>;
    }
}
export default StorageUsage;
