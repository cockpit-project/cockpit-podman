import React from 'react';
import { Button, ListGroup, ListGroupItem, Modal } from 'patternfly-react';

import { ErrorNotification } from './Notification.jsx';
import * as utils from './util.js';
import varlink from './varlink.js';
import cockpit from 'cockpit';

import '../lib/form-layout.less';
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
        };
        this.onDownloadClicked = this.onDownloadClicked.bind(this);
        this.onItemSelected = this.onItemSelected.bind(this);
        this.onSearchTriggered = this.onSearchTriggered.bind(this);
        this.onValueChanged = this.onValueChanged.bind(this);
        this.onKeyPress = this.onKeyPress.bind(this);
    }

    componentDidMount() {
        this._isMounted = true;
    }

    componentWillUnmount() {
        this._isMounted = false;

        if (this.activeConnection)
            this.activeConnection.close();
    }

    onDownloadClicked() {
        let selectedImageName = this.state.imageList[this.state.selected].name;

        this.props.close();
        this.props.downloadImage(selectedImageName, this.state.imageTag);
    }

    onItemSelected(key) {
        this.setState({ selected: key });
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

        varlink.connect(utils.PODMAN_ADDRESS)
                .then(connection => {
                    this.activeConnection = connection;

                    connection.call("io.podman.SearchImages", { query: this.state.imageIdentifier })
                            .then(reply => {
                                if (this._isMounted)
                                    this.setState({ imageList: reply.results || [], searchInProgress: false, searchFinished: true });
                            })
                            .catch(ex => {
                                // We expect new searches to close the connection for ongoing searches
                                if (ex.error == 'ConnectionClosed')
                                    return;

                                if (this._isMounted) {
                                    this.setState({
                                        searchInProgress: false,
                                        dialogError: _("Failed to search for new images"),
                                        dialogErrorDetail: cockpit.format("$0: $1", ex.error, ex.parameters && ex.parameters.reason)
                                    });
                                }
                            });
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
            let forceSearch = e.key == 'Enter';

            // Clears the previously set timer.
            clearTimeout(this.typingTimeout);

            // Reset the timer, to make the http call after 250MS
            this.typingTimeout = setTimeout(() => this.onSearchTriggered(forceSearch), 250);
        }
    }

    render() {
        let defaultBody = (
            <React.Fragment>
                <div className="input-group">
                    <span className="input-group-addon">
                        <span className="fa fa-search" />
                    </span>
                    <input id='search-image-dialog-name'
                        autoFocus
                        className='form-control'
                        type='text'
                        placeholder={_("Search by name or description")}
                        value={this.state.imageIdentifier}
                        onKeyPress={this.onKeyPress}
                        onChange={e => this.onValueChanged('imageIdentifier', e.target.value)} />
                </div>

                {this.state.searchInProgress && <div id='search-image-dialog-waiting' className='spinner' />}

                {this.state.searchFinished && !this.state.imageIdentifier == '' && <React.Fragment>
                    <h2> {_("Images")} </h2>
                    {this.state.imageList.length == 0 && <div> {cockpit.format(_("No results for $0. Please retry another term."), this.state.imageIdentifier)} </div>}
                    {this.state.imageList.length > 0 && <ListGroup>
                        {this.state.imageList.map((image, iter) => {
                            return (
                                <ListGroupItem active={this.state.selected == iter} onClick={() => this.onItemSelected(iter)} key={iter}>
                                    <div className='image-list-item'>
                                        <label className='control-label'>
                                            { image.name }
                                        </label>
                                        <div className='pull-right'> { image.description } </div>
                                    </div>
                                </ListGroupItem>
                            );
                        })}
                    </ListGroup>}
                </React.Fragment>}
            </React.Fragment>
        );

        return (
            <Modal show onHide={this.props.close} className="podman-search">
                <Modal.Header>
                    <Modal.CloseButton onClick={this.props.close} />
                    <Modal.Title> {_("Search Image")} </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {defaultBody}
                </Modal.Body>
                <Modal.Footer>
                    {this.state.dialogError && <ErrorNotification errorMessage={this.state.dialogError} errorDetail={this.state.dialogErrorDetail} />}
                    <input className='form-control image-tag-entry'
                           type='text'
                           placeholder={_("Tag")}
                           value={this.state.imageTag || ''}
                           onChange={e => this.onValueChanged('imageTag', e.target.value)} />
                    <Button bsStyle='default' className='btn-cancel' onClick={ this.props.close }>
                        {_("Cancel")}
                    </Button>
                    <Button bsStyle='primary' disabled={this.state.selected == undefined} onClick={this.onDownloadClicked}>
                        {_("Download")}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}
