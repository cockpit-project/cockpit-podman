/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { DataList, DataListCell, DataListItem, DataListItemCells, DataListItemRow } from "@patternfly/react-core/dist/esm/components/DataList";
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Radio } from "@patternfly/react-core/dist/esm/components/Radio";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Flex } from "@patternfly/react-core/dist/esm/layouts/Flex";
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { useDialogs } from "dialogs.jsx";

import cockpit from 'cockpit';
import { EmptyStatePanel } from "cockpit-components-empty-state.tsx";

import { ErrorNotification } from './Notification.jsx';
import * as client from './client.js';
import rest from './rest.js';
import { fallbackRegistries, usePodmanInfo } from './util.js';

import './ImageSearchModal.css';

const _ = cockpit.gettext;

export const ImageSearchModal = ({ downloadImage, users }) => {
    const [searchInProgress, setSearchInProgress] = useState(false);
    const [searchFinished, setSearchFinished] = useState(false);
    const [imageIdentifier, setImageIdentifier] = useState('');
    const [imageList, setImageList] = useState([]);
    const [imageTag, setImageTag] = useState("");
    const [user, setUser] = useState(users[0]);
    const [selectedRegistry, setSelectedRegistry] = useState("");
    const [selected, setSelected] = useState("");
    const [dialogError, setDialogError] = useState("");
    const [dialogErrorDetail, setDialogErrorDetail] = useState("");
    const [typingTimeout, setTypingTimeout] = useState(null);

    let activeConnection = null;
    const { registries } = usePodmanInfo();
    const Dialogs = useDialogs();
    // Registries to use for searching
    const searchRegistries = registries?.search && registries.search.length !== 0 ? registries.search : fallbackRegistries;

    // Don't use on selectedRegistry state variable for finding out the
    // registry to search in as with useState we can only call something after a
    // state update with useEffect but as onSearchTriggered also changes state we
    // can't use that so instead we pass the selected registry.
    const onSearchTriggered = (searchRegistry = "", forceSearch = false) => {
        // When search re-triggers close any existing active connection
        activeConnection = rest.connect(user.uid);
        if (activeConnection)
            activeConnection.close();
        setSearchFinished(false);

        // Do not call the SearchImage API if the input string  is not at least 2 chars,
        // unless Enter is pressed, which should force start the search.
        // The comparison was done considering the fact that we miss always one letter due to delayed setState
        if (imageIdentifier.length < 2 && !forceSearch)
            return;

        setSearchInProgress(true);

        let queryRegistries = searchRegistries;
        if (searchRegistry !== "") {
            queryRegistries = [searchRegistry];
        }
        // if a user searches for `docker.io/cockpit` let podman search in the user specified registry.
        if (imageIdentifier.includes('/')) {
            queryRegistries = [""];
        }

        const searches = queryRegistries.map(rr => {
            const registry = rr.length < 1 || rr[rr.length - 1] === "/" ? rr : rr + "/";
            return activeConnection.call({
                method: "GET",
                path: client.VERSION + "libpod/images/search",
                body: "",
                params: {
                    term: registry + imageIdentifier
                }
            });
        });

        Promise.allSettled(searches)
                .then(reply => {
                    if (reply) {
                        let results = [];

                        for (const result of reply) {
                            if (result.status === "fulfilled") {
                                results = results.concat(JSON.parse(result.value));
                            } else {
                                setDialogError(_("Failed to search for new images"));
                                setDialogErrorDetail(result.reason ? cockpit.format(_("Failed to search for images: $0"), result.reason.message) : _("Failed to search for images."));
                            }
                        }

                        setImageList(results || []);
                        setSearchInProgress(false);
                        setSearchFinished(true);
                    }
                });
    };

    const onKeyDown = (e) => {
        if (e.key != ' ') { // Space should not trigger search
            const forceSearch = e.key == 'Enter';
            if (forceSearch) {
                e.preventDefault();
            }

            // Reset the timer, to make the http call after 250MS
            clearTimeout(typingTimeout);
            setTypingTimeout(setTimeout(() => onSearchTriggered(selectedRegistry, forceSearch), 250));
        }
    };

    const onToggleUser = ev => setUser(users.find(u => u.name === ev.currentTarget.value));
    const onDownloadClicked = () => {
        const selectedImageName = imageList[selected].Name;
        if (activeConnection)
            activeConnection.close();
        Dialogs.close();
        downloadImage(selectedImageName, imageTag, user.con);
    };

    const handleClose = () => {
        if (activeConnection)
            activeConnection.close();
        Dialogs.close();
    };

    return (
        <Modal isOpen className="podman-search"
               position="top" variant="large"
               onClose={handleClose}
        >
            <ModalHeader title={_("Search for an image")} />
            <ModalBody>
                <Form isHorizontal>
                    {dialogError && <ErrorNotification errorMessage={dialogError} errorDetail={dialogErrorDetail} />}
                    { users.length > 1 &&
                    <FormGroup id="as-user" label={_("Owner")} isInline>
                        { users.map(u => (
                            <Radio key={u.name}
                                   value={u.name}
                                   label={u.name}
                                   id={"image-search-modal-owner-" + u.name}
                                   onChange={onToggleUser}
                                   isChecked={u === user} />))
                        }
                    </FormGroup>}
                    <Flex spaceItems={{ default: 'inlineFlex', modifier: 'spaceItemsXl' }}>
                        <FormGroup fieldId="search-image-dialog-name" label={_("Search for")}>
                            <TextInput id='search-image-dialog-name'
                                       type='text'
                                       placeholder={_("Search by name or description")}
                                       value={imageIdentifier}
                                       onKeyDown={onKeyDown}
                                       onChange={(_event, value) => setImageIdentifier(value)} />
                        </FormGroup>
                        <FormGroup fieldId="registry-select" label={_("in")}>
                            <FormSelect id='registry-select'
                                value={selectedRegistry}
                                onChange={(_ev, value) => { setSelectedRegistry(value); clearTimeout(typingTimeout); onSearchTriggered(value, false) }}>
                                <FormSelectOption value="" key="all" label={_("All registries")} />
                                {(searchRegistries || []).map(r => <FormSelectOption value={r} key={r} label={r} />)}
                            </FormSelect>
                        </FormGroup>
                    </Flex>
                </Form>

                {searchInProgress && <EmptyStatePanel loading title={_("Searching...")} /> }

                {((!searchInProgress && !searchFinished) || imageIdentifier == "") && <EmptyStatePanel title={_("No images found")} paragraph={_("Start typing to look for images.")} /> }

                {searchFinished && imageIdentifier !== '' && <>
                    {imageList.length == 0 && <EmptyStatePanel icon={ExclamationCircleIcon}
                                                                          title={cockpit.format(_("No results for $0"), imageIdentifier)}
                                                                          paragraph={_("Retry another term.")}
                    />}
                    {imageList.length > 0 &&
                    <DataList isCompact
                              selectedDataListItemId={"image-list-item-" + selected}
                              onSelectDataListItem={(_, key) => setSelected(key.split('-').slice(-1)[0])}>
                        {imageList.map((image, iter) => {
                            return (
                                <DataListItem id={"image-list-item-" + iter} key={iter}>
                                    <DataListItemRow>
                                        <DataListItemCells
                                                  dataListCells={[
                                                      <DataListCell key="primary content">
                                                          <span className='image-name'>{image.Name}</span>
                                                      </DataListCell>,
                                                      <DataListCell key="secondary content" wrapModifier="truncate">
                                                          <span className='image-description'>{image.Description}</span>
                                                      </DataListCell>
                                                  ]}
                                        />
                                    </DataListItemRow>
                                </DataListItem>
                            );
                        })}
                    </DataList>}
                </>}
            </ModalBody>
            <ModalFooter>
                <Form isHorizontal className="image-search-tag-form">
                    <FormGroup fieldId="image-search-tag" label={_("Tag")}>
                        <TextInput className="image-tag-entry"
                               id="image-search-tag"
                               type='text'
                               placeholder="latest"
                               value={imageTag || ''}
                               onChange={(_event, value) => setImageTag(value)} />
                    </FormGroup>
                </Form>
                <Button variant='primary' isDisabled={selected === ""} onClick={onDownloadClicked}>
                    {_("Download")}
                </Button>
                <Button variant='link' className='btn-cancel' onClick={handleClose}>
                    {_("Cancel")}
                </Button>
            </ModalFooter>
        </Modal>
    );
};
