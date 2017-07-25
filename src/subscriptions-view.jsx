/*jshint esversion: 6 */
/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2017 Red Hat, Inc.
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

export class Subscriptions extends React.Component {
    constructor() {
        super();
        // a good place to initialize this.state
    }

    render() {
        let title = this.props.title?(<a href="#">{this.props.title}</a>):"Empty title";
        return (
            <div class="container-fluid">
                <h3>{title}</h3>
                <div>
                    <span>Some content</span>
                </div>
            </div>
        );
    }
}
