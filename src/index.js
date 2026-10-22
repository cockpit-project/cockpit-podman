/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2017 Red Hat, Inc.
 */

import "cockpit-dark-theme";
import React from 'react';

import { createRoot } from 'react-dom/client';

import 'patternfly/patternfly-6-cockpit.scss';
import Application from './app.jsx';
import './podman.scss';

const _origConsoleError = console.error;
console.error = (...args) => {
    _origConsoleError.apply(console, args);
    _origConsoleError.call(console, "ARGS: " + JSON.stringify(args, (_key, value) => {
        if (value instanceof Error || (value && typeof value.stack === "string"))
            return { message: value.message, stack: value.stack };
        return value;
    }));
};

document.addEventListener("DOMContentLoaded", function () {
    const root = createRoot(document.getElementById('app'));
    root.render(<Application />);
});
