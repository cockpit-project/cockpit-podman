/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React, { useState, useEffect } from 'react';

import cockpit from 'cockpit';

import { ImageSearchModal } from './ImageSearchModal.jsx';

/**
 * Component that renders the ImageSearchModal when URL parameters are present.
 * Uses declarative rendering based on URL state (the URL is the single source of truth).
 *
 * Supported URL formats:
 * - #?action=download-image
 * - #?action=download-image&search=cockpit
 * - #?action=download-image&registry=docker.io&search=cockpit&owner=user&tag=latest
 *
 * Parameters:
 * - action: 'download-image' (required to open dialog)
 * - registry: Registry to pre-select (optional)
 * - search: Search term to pre-fill and auto-search (optional)
 * - owner: 'system' or 'user' (optional, defaults to 'user')
 * - tag: Tag to pre-fill (optional, defaults to 'latest')
 */
export const ImageSearchDialogOpener = ({ downloadImage, users }) => {
    const [location, setLocation] = useState(cockpit.location);

    useEffect(() => {
        const handler = () => setLocation({ ...cockpit.location });
        cockpit.addEventListener("locationchanged", handler);
        return () => cockpit.removeEventListener("locationchanged", handler);
    }, []);

    const { options } = location;
    const action = options.action;

    // Determine if dialog should be shown
    const showDialog = action === 'download-image';

    // Don't render until users array is populated with connections to avoid flicker
    // The users array is initialized with dummy data (con: null) and later updated with real connections
    if (!showDialog || !users || users.length === 0 || !users[0].con) return null;

    // Parse URL parameters
    const initialRegistry = typeof options.registry === 'string' ? options.registry : undefined;
    const initialSearchTerm = typeof options.search === 'string' ? options.search : undefined;
    const initialTag = typeof options.tag === 'string' ? options.tag : 'latest';

    // Parse owner parameter - default to 'user', validate it's either 'system' or 'user'
    let initialOwner = 'user';
    if (typeof options.owner === 'string') {
        if (options.owner === 'system' || options.owner === 'user') {
            initialOwner = options.owner;
        }
    }

    // Close handler clears URL parameters
    const handleClose = () => {
        cockpit.location.replace(cockpit.location.path, {});
    };

    // Generate key from URL params to force re-mount when params change
    const dialogKey = `${action}-${options.registry}-${options.search}-${options.owner}-${options.tag}`;

    return (
        <ImageSearchModal
            key={dialogKey}
            downloadImage={downloadImage}
            users={users}
            initialRegistry={initialRegistry}
            initialSearchTerm={initialSearchTerm}
            initialOwner={initialOwner}
            initialTag={initialTag}
            onExternalClose={handleClose}
        />
    );
};
