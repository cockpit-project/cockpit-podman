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
    for (const arg of args) {
        if (arg instanceof Error && arg.stack)
            _origConsoleError.call(console, "TRACE:", arg.stack);
    }
};

document.addEventListener("DOMContentLoaded", function () {
    const root = createRoot(document.getElementById('app'));
    root.render(<Application />);
});
