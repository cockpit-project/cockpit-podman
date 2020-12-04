/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2019 Red Hat, Inc.
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
import { Alert, AlertActionCloseButton } from '@patternfly/react-core';

import cockpit from 'cockpit';

const _ = cockpit.gettext;

let last_error = "";

function log_error_if_changed(error) {
    // Put the error in the browser log, for easier debugging and
    // matching of known issues in the integration tests.
    if (error != last_error) {
        last_error = error;
        console.error(error);
    }
}

export const ErrorNotification = ({ errorMessage, errorDetail, onDismiss }) => {
    log_error_if_changed(errorMessage + (errorDetail ? ": " + errorDetail : ""));
    return (
        <Alert isInline variant='danger' title={errorMessage}
            actionClose={onDismiss ? <AlertActionCloseButton onClose={onDismiss} /> : null}>
            { errorDetail && <p> {_("Error message")}: <samp>{errorDetail}</samp> </p> }
        </Alert>
    );
};
