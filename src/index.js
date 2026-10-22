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

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error("RENDER ERROR:", error.message, "\nStack:", error.stack, "\nComponent stack:", info.componentStack);
        this.setState({ hasError: false });
    }

    render() {
        return this.props.children;
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const root = createRoot(document.getElementById('app'));
    root.render(<ErrorBoundary><Application /></ErrorBoundary>);
});
