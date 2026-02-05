/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2019 Red Hat, Inc.
 */
import React from 'react';

import { Alert, AlertActionCloseButton } from "@patternfly/react-core/dist/esm/components/Alert";

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
