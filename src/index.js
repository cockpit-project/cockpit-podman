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

window.addEventListener("error", event => {
    console.error("ERROR:", event.message, event.filename + ":" + event.lineno + ":" + event.colno, event.error?.stack);
});

document.addEventListener("DOMContentLoaded", function () {
    const root = createRoot(document.getElementById('app'));
    root.render(<Application />);
});
