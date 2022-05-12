import React from 'react';
import {
    Button, DataList, DataListItem, DataListItemRow, DataListCell, DataListItemCells,
    Flex, Form, FormGroup, FormSelect, FormSelectOption, Modal, Radio, TextInput
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';

import { EmptyStatePanel } from "cockpit-components-empty-state.jsx";
import { ErrorNotification } from './Notification.jsx';
import cockpit from 'cockpit';
import rest from './rest.js';
import * as client from './client.js';
import { fallbackRegistries } from './util.js';

import './ImageSearchModal.css';

const _ = cockpit.gettext;

export class ImageSearchModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            imageIdentifier: '',
            imageList: [],
            searchInProgress: false,
            searchFinished: false,
            isSystem: props.systemServiceAvailable,
            registry: "",
        };
        this.onDownloadClicked = this.onDownloadClicked.bind(this);
        this.onItemSelected = this.onItemSelected.bind(this);
        this.onSearchTriggered = this.onSearchTriggered.bind(this);
        this.onValueChanged = this.onValueChanged.bind(this);
        this.onKeyPress = this.onKeyPress.bind(this);
        this.onToggleUser = this.onToggleUser.bind(this);
    }

    componentDidMount() {
        this._isMounted = true;
    }

    componentWillUnmount() {
        this._isMounted = false;

        if (this.activeConnection)
            this.activeConnection.close();
    }

    onToggleUser(_, ev) {
        this.setState({ isSystem: ev.currentTarget.value === "system" });
    }

    onDownloadClicked() {
        const selectedImageName = this.state.imageList[this.state.selected].Name;

        this.props.close();
        this.props.downloadImage(selectedImageName, this.state.imageTag, this.state.isSystem);
    }

    onItemSelected(key) {
        this.setState({ selected: key.split('-').slice(-1)[0] });
    }

    onSearchTriggered(forceSearch) {
        // When search re-triggers close any existing active connection
        if (this.activeConnection)
            this.activeConnection.close();
        this.setState({ searchFinished: false });

        // Do not call the SearchImage API if the input string  is not at least 2 chars,
        // unless Enter is pressed, which should force start the search.
        // The comparison was done considering the fact that we miss always one letter due to delayed setState
        if (this.state.imageIdentifier.length < 2 && !forceSearch)
            return;

        this.setState({ searchInProgress: true });

        this.activeConnection = rest.connect(client.getAddress(this.state.isSystem), this.state.isSystem);
        let registries = Object.keys(this.props.registries).length !== 0 ? [this.state.registry] : fallbackRegistries;
        // if a user searches for `docker.io/cockpit` let podman search in the user specified registry.
        if (this.state.imageIdentifier.includes('/')) {
            registries = [""];
        }

        const searches = registries.map(rr => {
            const registry = rr.length < 1 || rr[rr.length - 1] === "/" ? rr : rr + "/";
            return this.activeConnection.call({
                method: "GET",
                path: client.VERSION + "libpod/images/search",
                body: "",
                params: {
                    term: registry + this.state.imageIdentifier
                }
            });
        });

        Promise.allSettled(searches)
                .then(reply => {
                    if (reply && this._isMounted) {
                        let results = [];
                        let dialogError = "";
                        let dialogErrorDetail = "";

                        for (const result of reply) {
                            if (result.status === "fulfilled") {
                                results = results.concat(JSON.parse(result.value));
                            } else {
                                dialogError = _("Failed to search for new images");
                                dialogErrorDetail = cockpit.format(_("Failed to search for images: $0"), result.reason);
                            }
                        }

                        this.setState({
                            imageList: results || [], searchInProgress: false,
                            searchFinished: true, dialogError, dialogErrorDetail
                        });
                    }
                });
    }

    onValueChanged(key, value) {
        if (key == 'imageIdentifier')
            this.setState({ [key]: value.trim() });
        else
            this.setState({ [key]: value });
    }

    onKeyPress(e) {
        if (e.key != ' ') { // Space should not trigger search
            const forceSearch = e.key == 'Enter';
            if (forceSearch) {
                e.preventDefault();
            }

            // Clears the previously set timer.
            clearTimeout(this.typingTimeout);

            // Reset the timer, to make the http call after 250MS
            this.typingTimeout = setTimeout(() => this.onSearchTriggered(forceSearch), 250);
        }
    }

    render() {
        const defaultBody = (
            <>
                <Form isHorizontal>
                    { this.props.userServiceAvailable && this.props.systemServiceAvailable &&
                    <FormGroup id="as-user" label={_("Owner")} isInline>
                        <Radio name="user" value="system" id="system" onChange={this.onToggleUser} isChecked={this.state.isSystem} label={_("system")} />
                        <Radio name="user" value="user" id="user" onChange={this.onToggleUser} isChecked={!this.state.isSystem} label={this.props.user} />
                    </FormGroup>}
                    <Flex spaceItems={{ default: 'inlineFlex', modifier: 'spaceItemsXl' }}>
                        <FormGroup fieldId="search-image-dialog-name" label={_("Search for")}>
                            <TextInput id='search-image-dialog-name'
                                       type='text'
                                       placeholder={_("Search by name or description")}
                                       value={this.state.imageIdentifier}
                                       onKeyPress={this.onKeyPress}
                                       onChange={value => this.onValueChanged('imageIdentifier', value)} />
                        </FormGroup>
                        <FormGroup fieldId="registry-select" label={_("in")}>
                            <FormSelect id='registry-select'
                                value={this.state.registry}
                                onChange={value =>
                                    this.setState({ registry: value }, () => this.onSearchTriggered(false))
                                }>
                                <FormSelectOption value="" key="all" label={_("All registries")} />
                                {(this.props.registries.search || []).map(r => <FormSelectOption value={r} key={r} label={r} />)}
                            </FormSelect>
                        </FormGroup>
                    </Flex>
                </Form>

                {this.state.searchInProgress && <EmptyStatePanel loading title={_("Searching...")} /> }

                {((!this.state.searchInProgress && !this.state.searchFinished) || this.state.imageIdentifier == "") && <EmptyStatePanel title={_("No images found")} paragraph={_("Start typing to look for images.")} /> }

                {this.state.searchFinished && this.state.imageIdentifier !== '' && <>
                    {this.state.imageList.length == 0 && <EmptyStatePanel icon={ExclamationCircleIcon}
                                                                          title={cockpit.format(_("No results for $0"), this.state.imageIdentifier)}
                                                                          paragraph={_("Retry another term.")}
                    />}
                    {this.state.imageList.length > 0 &&
                    <DataList isCompact
                              selectedDataListItemId={"image-list-item-" + this.state.selected}
                              onSelectDataListItem={this.onItemSelected}>
                        {this.state.imageList.map((image, iter) => {
                            return (
                                <DataListItem id={"image-list-item-" + iter} key={iter}>
                                    <DataListItemRow>
                                        <DataListItemCells
                                                  dataListCells={[
                                                      <DataListCell key="primary content">
                                                          <span className='image-name'>{image.Name}</span>
                                                      </DataListCell>,
                                                      <DataListCell key="secondary content">
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
            </>
        );

        return (
            <Modal isOpen className="podman-search"
                   position="top" variant="large"
                   onClose={this.props.close}
                   title={_("Search for an image")}
                   footer={<>
                       {this.state.dialogError && <ErrorNotification errorMessage={this.state.dialogError} errorDetail={this.state.dialogErrorDetail} />}
                       <Form isHorizontal className="image-search-tag-form">
                           <FormGroup fieldId="image-search-tag" label={_("Tag")}>
                               <TextInput className="image-tag-entry"
                                      id="image-search-tag"
                                      type='text'
                                      placeholder="latest"
                                      value={this.state.imageTag || ''}
                                      onChange={value => this.onValueChanged('imageTag', value)} />
                           </FormGroup>
                       </Form>
                       <Button variant='primary' isDisabled={this.state.selected == undefined} onClick={this.onDownloadClicked}>
                           {_("Download")}
                       </Button>
                       <Button variant='link' className='btn-cancel' onClick={ this.props.close }>
                           {_("Cancel")}
                       </Button>
                   </>}
            >
                {defaultBody}
            </Modal>
        );
    }
}
