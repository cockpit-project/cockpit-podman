import React from 'react';
import PropTypes from 'prop-types';
import {
    Button, Checkbox,
    EmptyState, EmptyStateBody,
    Form, FormGroup, FormFieldGroup, FormFieldGroupHeader,
    FormSelect, FormSelectOption,
    Grid, GridItem,
    HelperText, HelperTextItem,
    Modal, Select, SelectVariant,
    SelectOption, SelectGroup, Stack,
    TextInput, Tabs, Tab, TabTitleText,
    ToggleGroup, ToggleGroupItem,
    Flex, FlexItem,
    Popover,
} from '@patternfly/react-core';
import { MinusIcon, OutlinedQuestionCircleIcon } from '@patternfly/react-icons';
import * as dockerNames from 'docker-names';

import { ErrorNotification } from './Notification.jsx';
import { FileAutoComplete } from 'cockpit-components-file-autocomplete.jsx';
import * as utils from './util.js';
import * as client from './client.js';
import rest from './rest.js';
import cockpit from 'cockpit';
import { onDownloadContainer, onDownloadContainerFinished } from './Containers.jsx';

import { debounce } from 'throttle-debounce';

import "./ImageRunModal.scss";

const _ = cockpit.gettext;

const systemOwner = "system";

const units = {
    KiB: {
        name: "KiB",
        base1024Exponent: 1,
    },
    MiB: {
        name: "MiB",
        base1024Exponent: 2,
    },
    GiB: {
        name: "GiB",
        base1024Exponent: 3,
    },
};

const PublishPort = ({ id, item, onChange, idx, removeitem, itemCount }) =>
    (
        <Grid hasGutter id={id}>
            <FormGroup className="pf-m-4-col-on-md"
                label={_("IP address")}
                fieldId={id + "-ip-address"}
                labelIcon={
                    <Popover aria-label={_("IP address help")}
                        enableFlip
                        bodyContent={_("If host IP is set to 0.0.0.0 or not set at all, the port will be bound on all IPs on the host.")}>
                        <button onClick={e => e.preventDefault()} className="pf-c-form__group-label-help">
                            <OutlinedQuestionCircleIcon />
                        </button>
                    </Popover>
                }>
                <TextInput id={id + "-ip-address"}
                        value={item.IP || ''}
                        onChange={value => onChange(idx, 'IP', value)} />
            </FormGroup>
            <FormGroup className="pf-m-2-col-on-md"
                    label={_("Host port")}
                    fieldId={id + "-host-port"}
                    labelIcon={
                        <Popover aria-label={_("Host port help")}
                            enableFlip
                            bodyContent={_("If the host port is not set the container port will be randomly assigned a port on the host.")}>
                            <button onClick={e => e.preventDefault()} className="pf-c-form__group-label-help">
                                <OutlinedQuestionCircleIcon />
                            </button>
                        </Popover>
                    }>
                <TextInput id={id + "-host-port"}
                            type='number'
                            step={1}
                            min={1}
                            max={65535}
                            value={item.hostPort || ''}
                            onChange={value => onChange(idx, 'hostPort', value)} />
            </FormGroup>
            <FormGroup className="pf-m-3-col-on-md"
                        label={_("Container port")}
                        fieldId={id + "-container-port"} isRequired>
                <TextInput id={id + "-container-port"}
                            type='number'
                            step={1}
                            min={1}
                            max={65535}
                            value={item.containerPort || ''}
                            onChange={value => onChange(idx, 'containerPort', value)} />
            </FormGroup>
            <FormGroup className="pf-m-2-col-on-md"
                        label={_("Protocol")}
                        fieldId={id + "-protocol"}>
                <FormSelect className='pf-c-form-control container-port-protocol'
                            id={id + "-protocol"}
                            value={item.protocol}
                            onChange={value => onChange(idx, 'protocol', value)}>
                    <FormSelectOption value='tcp' key='tcp' label={_("TCP")} />
                    <FormSelectOption value='udp' key='udp' label={_("UDP")} />
                </FormSelect>
            </FormGroup>
            <FormGroup className="pf-m-1-col-on-md remove-button-group">
                <Button variant='secondary'
                            className="btn-close"
                            id={id + "-btn-close"}
                            isSmall
                            aria-label={_("Remove item")}
                            icon={<MinusIcon />}
                            onClick={() => removeitem(idx)} />
            </FormGroup>
        </Grid>
    );

const handleEnvValue = (key, value, idx, onChange, additem, itemCount) => {
    // Allow the input of KEY=VALUE separated value pairs for bulk import
    if (value.includes('=')) {
        const parts = value.trim().split(" ");
        let index = idx;
        for (const part of parts) {
            const [envKey, envVar] = part.split('=', 2);
            if (!envKey || !envVar) {
                continue;
            }

            if (index !== idx) {
                additem();
            }
            onChange(index, 'envKey', envKey);
            onChange(index, 'envValue', envVar);
            index++;
        }
    } else {
        onChange(idx, key, value);
    }
};

const EnvVar = ({ id, item, onChange, idx, removeitem, additem, itemCount }) =>
    (
        <Grid hasGutter id={id}>
            <FormGroup className="pf-m-5-col-on-md" label={_("Key")} fieldId={id + "-key-address"}>
                <TextInput id={id + "-key"}
                       value={item.envKey || ''}
                       onChange={value => handleEnvValue('envKey', value, idx, onChange, additem, itemCount)} />
            </FormGroup>
            <FormGroup className="pf-m-5-col-on-md" label={_("Value")} fieldId={id + "-value-address"}>
                <TextInput id={id + "-value"}
                       value={item.envValue || ''}
                       onChange={value => handleEnvValue('envValue', value, idx, onChange, additem, itemCount)} />
            </FormGroup>
            <FormGroup className="pf-m-1-col-on-md remove-button-group">
                <Button variant='secondary'
                    className="btn-close"
                    id={id + "-btn-close"}
                    isSmall
                    aria-label={_("Remove item")}
                    icon={<MinusIcon />}
                    onClick={() => removeitem(idx)} />
            </FormGroup>
        </Grid>
    );

const Volume = ({ id, item, onChange, idx, removeitem, additem, options, itemCount }) =>
    (
        <Grid hasGutter id={id}>
            <FormGroup className="pf-m-3-col-on-md" label={_("Host path")} fieldId={id + "-host-path"}>
                <FileAutoComplete id={id + "-host-path"}
                    value={item.hostPath || ''}
                    onChange={ value => onChange(idx, 'hostPath', value) } />
            </FormGroup>
            <FormGroup className="pf-m-3-col-on-md" label={_("Container path")} fieldId={id + "-container-path"}>
                <TextInput id={id + "-container-path"}
                    value={item.containerPath || ''}
                    onChange={value => onChange(idx, 'containerPath', value)} />
            </FormGroup>
            <FormGroup className="pf-m-2-col-on-md" label={_("Mode")} fieldId={id + "-mode"}>
                <Checkbox id={id + "-mode"}
                    label={_("Writable")}
                    isChecked={item.mode == "rw"}
                    onChange={value => onChange(idx, 'mode', value ? "rw" : "ro")} />
            </FormGroup>
            { options && options.selinuxAvailable &&
            <FormGroup className="pf-m-3-col-on-md" label={_("SELinux")} fieldId={id + "-selinux"}>
                <FormSelect id={id + "-selinux"} className='pf-c-form-control'
                            value={item.selinux}
                            onChange={value => onChange(idx, 'selinux', value)}>
                    <FormSelectOption value='' key='' label={_("No label")} />
                    <FormSelectOption value='z' key='z' label={_("Shared")} />
                    <FormSelectOption value='Z' key='Z' label={_("Private")} />
                </FormSelect>
            </FormGroup> }
            <FormGroup className="pf-m-1-col-on-md remove-button-group">
                <Button variant='secondary'
                    className="btn-close"
                    id={id + "-btn-close"}
                    aria-label={_("Remove item")}
                    isSmall
                    icon={<MinusIcon />}
                    onClick={() => removeitem(idx)} />
            </FormGroup>
        </Grid>
    );

class DynamicListForm extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            list: [],
        };
        this.keyCounter = 0;
        this.removeItem = this.removeItem.bind(this);
        this.addItem = this.addItem.bind(this);
        this.onItemChange = this.onItemChange.bind(this);
    }

    removeItem(idx, field, value) {
        this.setState(state => {
            const items = state.list.concat();
            items.splice(idx, 1);
            return { list: items };
        }, () => this.props.onChange(this.state.list.concat()));
    }

    addItem() {
        this.setState(state => {
            return { list: [...state.list, Object.assign({ key: this.keyCounter++ }, this.props.default)] };
        }, () => this.props.onChange(this.state.list.concat()));
    }

    onItemChange(idx, field, value) {
        this.setState(state => {
            const items = state.list.concat();
            items[idx][field] = value || null;
            return { list: items };
        }, () => this.props.onChange(this.state.list.concat()));
    }

    render () {
        const { id, label, actionLabel, formclass, emptyStateString, helperText } = this.props;
        const dialogValues = this.state;
        return (
            <FormFieldGroup header={
                <FormFieldGroupHeader
                    titleText={{ text: label }}
                    actions={<Button variant="secondary" className="btn-add" onClick={this.addItem}>{actionLabel}</Button>}
                />
            } className={"dynamic-form-group " + formclass}>
                {
                    dialogValues.list.length
                        ? <>
                            {dialogValues.list.map((item, idx) => {
                                return React.cloneElement(this.props.itemcomponent, {
                                    idx: idx, item: item, id: id + "-" + idx,
                                    key: idx,
                                    onChange: this.onItemChange, removeitem: this.removeItem, additem: this.addItem, options: this.props.options,
                                    itemCount: Object.keys(dialogValues.list).length,
                                });
                            })
                            }
                            {helperText &&
                            <HelperText>
                                <HelperTextItem>{helperText}</HelperTextItem>
                            </HelperText>
                            }
                        </>
                        : <EmptyState>
                            <EmptyStateBody>
                                {emptyStateString}
                            </EmptyStateBody>
                        </EmptyState>
                }
            </FormFieldGroup>
        );
    }
}
DynamicListForm.propTypes = {
    emptyStateString: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    id: PropTypes.string.isRequired,
    itemcomponent: PropTypes.object.isRequired,
    formclass: PropTypes.string,
    options: PropTypes.object,
};

export class ImageRunModal extends React.Component {
    constructor(props) {
        super(props);
        let command = "sh";
        if (this.props.image && this.props.image.Command) {
            command = utils.quote_cmdline(this.props.image.Command);
        }
        let selectedImage = "";
        if (this.props.image) {
            selectedImage = utils.image_name(this.props.image);
        }

        this.state = {
            command,
            containerName: dockerNames.getRandomName(),
            env: [],
            hasTTY: true,
            publish: [],
            image: props.image,
            memory: 512,
            cpuShares: 1024,
            memoryConfigure: false,
            cpuSharesConfigure: false,
            memoryUnit: 'MiB',
            validationFailed: {},
            volumes: [],
            runImage: true,
            restartPolicy: "no",
            restartTries: 5,
            pullLatestImage: false,
            activeTabKey: 0,
            owner: this.props.systemServiceAvailable ? systemOwner : this.props.user,
            /* image select */
            selectedImage,
            searchFinished: false,
            searchInProgress: false,
            searchText: "",
            imageResults: {},
            isImageSelectOpen: false,
            searchByRegistry: 'all',
        };
        this.getCreateConfig = this.getCreateConfig.bind(this);
        this.onCreateClicked = this.onCreateClicked.bind(this);
        this.onValueChanged = this.onValueChanged.bind(this);
    }

    componentDidMount() {
        this._isMounted = true;
        this.onSearchTriggered(this.state.searchText);
    }

    componentWillUnmount() {
        this._isMounted = false;

        if (this.activeConnection)
            this.activeConnection.close();
    }

    getCreateConfig() {
        const createConfig = {};

        if (this.props.pod) {
            createConfig.pod = this.props.pod.Id;
        }

        if (this.state.image) {
            createConfig.image = this.state.image.RepoTags ? this.state.image.RepoTags[0] : "";
        } else {
            let img = this.state.selectedImage.Name;
            // Make implicit :latest
            if (!img.includes(":")) {
                img += ":latest";
            }
            createConfig.image = img;
        }
        if (this.state.containerName)
            createConfig.name = this.state.containerName;
        if (this.state.command) {
            createConfig.command = utils.unquote_cmdline(this.state.command);
        }
        const resourceLimit = {};
        if (this.state.memoryConfigure && this.state.memory) {
            const memorySize = this.state.memory * (1024 ** units[this.state.memoryUnit].base1024Exponent);
            resourceLimit.memory = { limit: memorySize };
            createConfig.resource_limits = resourceLimit;
        }
        if (this.state.cpuSharesConfigure && this.state.cpuShares !== 0) {
            resourceLimit.cpu = { shares: this.state.cpuShares };
            createConfig.resource_limits = resourceLimit;
        }
        createConfig.terminal = this.state.hasTTY;
        if (this.state.publish.length > 0)
            createConfig.portmappings = this.state.publish
                    .filter(port => port.containerPort)
                    .map(port => {
                        const pm = { container_port: parseInt(port.containerPort), protocol: port.protocol };
                        if (port.hostPort !== null)
                            pm.host_port = parseInt(port.hostPort);
                        if (port.IP !== null)
                            pm.host_ip = port.IP;
                        return pm;
                    });
        if (this.state.env.length > 0) {
            const ports = {};
            this.state.env.forEach(item => { ports[item.envKey] = item.envValue });
            createConfig.env = ports;
        }
        if (this.state.volumes.length > 0) {
            createConfig.mounts = this.state.volumes
                    .filter(volume => volume.hostPath && volume.containerPath)
                    .map(volume => {
                        const record = { source: volume.hostPath, destination: volume.containerPath, type: "bind" };
                        record.options = [];
                        if (volume.mode)
                            record.options.push(volume.mode);
                        if (volume.selinux)
                            record.options.push(volume.selinux);
                        return record;
                    });
        }

        if (this.state.restartPolicy !== "no") {
            createConfig.restart_policy = this.state.restartPolicy;
            if (this.state.restartPolicy === "on-failure" && this.state.restartTries !== null) {
                createConfig.restart_tries = parseInt(this.state.restartTries);
            }
            // Enable podman-restart.service for system containers, for user
            // sessions enable-linger needs to be enabled for containers to start on boot.
            if (this.state.restartPolicy === "always" && this.props.systemServiceAvailable) {
                this.enablePodmanRestartService();
            }
        }

        return createConfig;
    }

    createContainer = (isSystem, createConfig, runImage) => {
        client.createContainer(isSystem, createConfig)
                .then(reply => {
                    if (runImage) {
                        client.postContainer(isSystem, "start", reply.Id, {})
                                .then(() => this.props.close())
                                .catch(ex => {
                                    // If container failed to start remove it, so a user can fix the settings and retry and
                                    // won't get another error that the container name is already taken.
                                    client.delContainer(isSystem, reply.Id, true)
                                            .then(() => {
                                                this.setState({
                                                    dialogError: _("Container failed to be started"),
                                                    dialogErrorDetail: cockpit.format("$0: $1", ex.reason, ex.message)
                                                });
                                            })
                                            .catch(ex => {
                                                this.setState({
                                                    dialogError: _("Failed to clean up container"),
                                                    dialogErrorDetail: cockpit.format("$0: $1", ex.reason, ex.message)
                                                });
                                            });
                                });
                    } else {
                        this.props.close();
                    }
                })
                .catch(ex => {
                    this.setState({
                        dialogError: _("Container failed to be created"),
                        dialogErrorDetail: cockpit.format("$0: $1", ex.reason, ex.message)
                    });
                });
    }

    async onCreateClicked() {
        const createConfig = this.getCreateConfig();
        const { runImage, pullLatestImage } = this.state;
        const isSystem = this.isSystem();
        let imageExists = true;

        try {
            await client.imageExists(isSystem, createConfig.image);
        } catch (error) {
            imageExists = false;
        }

        if (imageExists && !pullLatestImage) {
            this.createContainer(isSystem, createConfig, runImage);
        } else {
            this.props.close();
            const tempImage = { ...createConfig };

            // Assign temporary properties to allow rendering
            tempImage.Id = tempImage.name;
            tempImage.isSystem = isSystem;
            tempImage.State = _("downloading");
            tempImage.Created = new Date();
            tempImage.Names = [tempImage.name];
            tempImage.Image = createConfig.image;
            tempImage.isDownloading = true;

            onDownloadContainer(tempImage);

            client.pullImage(isSystem, createConfig.image).then(reply => {
                client.createContainer(isSystem, createConfig)
                        .then(reply => {
                            if (runImage) {
                                client.postContainer(isSystem, "start", reply.Id, {})
                                        .then(() => onDownloadContainerFinished(createConfig))
                                        .catch(ex => {
                                            onDownloadContainerFinished(createConfig);
                                            const error = cockpit.format(_("Failed to run container $0"), tempImage.name);
                                            this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                                        });
                            }
                        })
                        .catch(ex => {
                            onDownloadContainerFinished(createConfig);
                            const error = cockpit.format(_("Failed to create container $0"), tempImage.name);
                            this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.reason });
                        });
            })
                    .catch(ex => {
                        onDownloadContainerFinished(createConfig);
                        const error = cockpit.format(_("Failed to pull image $0"), tempImage.image);
                        this.props.onAddNotification({ type: 'danger', error, errorDetail: ex.message });
                    });
        }
    }

    onValueChanged(key, value) {
        this.setState({ [key]: value });
    }

    handleTabClick = (event, tabIndex) => {
        // Prevent the form from being submitted.
        event.preventDefault();
        this.setState({
            activeTabKey: tabIndex,
        });
    };

    onSearchTriggered = value => {
        // Do not call the SearchImage API if the input string  is not at least 2 chars,
        // The comparison was done considering the fact that we miss always one letter due to delayed setState
        if (value.length < 2)
            return;

        // Don't search for a value with a tag specified
        const patt = /:[\w|\d]+$/;
        if (patt.test(value)) {
            return;
        }

        if (this.activeConnection)
            this.activeConnection.close();

        this.setState({ searchFinished: false, searchInProgress: true });
        this.activeConnection = rest.connect(client.getAddress(this.isSystem()), this.isSystem());
        let searches = [];

        // If there are registries configured search in them, or if a user searches for `docker.io/cockpit` let
        // podman search in the user specified registry.
        if (Object.keys(this.props.registries).length !== 0 || value.includes('/')) {
            searches.push(this.activeConnection.call({
                method: "GET",
                path: client.VERSION + "libpod/images/search",
                body: "",
                params: {
                    term: value,
                }
            }));
        } else {
            searches = searches.concat(utils.fallbackRegistries.map(registry =>
                this.activeConnection.call({
                    method: "GET",
                    path: client.VERSION + "libpod/images/search",
                    body: "",
                    params: {
                        term: registry + "/" + value
                    }
                })));
        }

        Promise.allSettled(searches)
                .then(reply => {
                    if (reply && this._isMounted) {
                        let imageResults = [];
                        let dialogError = "";
                        let dialogErrorDetail = "";

                        for (const result of reply) {
                            if (result.status === "fulfilled") {
                                imageResults = imageResults.concat(JSON.parse(result.value));
                            } else {
                                dialogError = _("Failed to search for new images");
                                // TODO: add registry context, podman does not include it in the reply.
                                dialogErrorDetail = cockpit.format(_("Failed to search for images: $0"), result.reason);
                            }
                        }
                        // Group images on registry
                        const images = {};
                        imageResults.forEach(image => {
                            // Add Tag is it's there
                            image.toString = function imageToString() {
                                if (this.Tag) {
                                    return this.Name + ':' + this.Tag;
                                }
                                return this.Name;
                            };

                            let index = image.Index;

                            // listTags results do not return the registry Index.
                            // https://github.com/containers/common/pull/803
                            if (!index) {
                                index = image.Name.split('/')[0];
                            }

                            if (index in images) {
                                images[index].push(image);
                            } else {
                                images[index] = [image];
                            }
                        });
                        this.setState({
                            imageResults: images || {},
                            searchFinished: true,
                            searchInProgress: false,
                            dialogError,
                            dialogErrorDetail,
                        });
                    }
                });
    }

    clearImageSelection = () => {
        this.setState({
            selectedImage: "",
            image: "",
            isImageSelectOpen: false,
            imageResults: {},
            searchText: "",
            searchFinished: false,
        });
    }

    onImageSelectToggle = isOpen => {
        this.setState({
            isImageSelectOpen: isOpen,
        });
    }

    onImageSelect = (event, value, placeholder) => {
        if (event === undefined)
            return;

        this.setState({
            selectedImage: value,
            isImageSelectOpen: false,
        });
    }

    handleImageSelectInput = value => {
        this.setState({
            searchText: value,
            // Reset searchFinished status when text input changes
            searchFinished: false,
            selectedImage: "",
        });
        this.onSearchTriggered(value);
    }

    debouncedInputChanged = debounce(300, this.handleImageSelectInput);

    handleOwnerSelect = (_, event) => {
        const id = event.currentTarget.id;
        this.setState({
            owner: id
        });
    }

    filterImages = () => {
        const { localImages } = this.props;
        const { imageResults, searchText } = this.state;
        const local = _("Local images");
        const images = { ...imageResults };
        const isSystem = this.isSystem();

        let imageRegistries = [];
        if (this.state.searchByRegistry == 'local' || this.state.searchByRegistry == 'all') {
            imageRegistries.push(local);
            images[local] = localImages;

            if (this.state.searchByRegistry == 'all')
                imageRegistries = imageRegistries.concat(Object.keys(imageResults));
        } else {
            imageRegistries.push(this.state.searchByRegistry);
        }

        let regexString = searchText;
        // Strip image registry option if set for comparing results for docker.io searching for docker.io/fedora
        // returns docker.io/$username/fedora for example.
        if (regexString.includes('/')) {
            regexString = searchText.replace(searchText.split('/')[0], '');
        }
        const input = new RegExp(regexString, 'i');

        const results = imageRegistries
                .map((reg, index) => {
                    const filtered = (reg in images ? images[reg] : [])
                            .filter(image => {
                                if (image.isSystem && !isSystem) {
                                    return false;
                                }
                                if ('isSystem' in image && !image.isSystem && isSystem) {
                                    return false;
                                }
                                return image.Name.search(input) !== -1;
                            })
                            .map((image, index) => {
                                return (
                                    <SelectOption
                                        key={index}
                                        value={image}
                                        {...(image.Description && { description: image.Description })}
                                    />
                                );
                            });

                    if (filtered.length === 0) {
                        return [];
                    } else {
                        return (
                            <SelectGroup label={reg} key={index} value={reg}>
                                {filtered}
                            </SelectGroup>
                        );
                    }
                })
                .filter(group => group.length !== 0); // filter out empty groups

        // Remove <SelectGroup> when there is a filter selected.
        if (this.state.searchByRegistry !== 'all' && imageRegistries.length === 1 && results.length === 1) {
            return results[0].props.children;
        }

        return results;
    }

    // Similar to the output of podman search and podman's /libpod/images/search endpoint only show the root domain.
    truncateRegistryDomain = (domain) => {
        const parts = domain.split('.');
        if (parts.length > 2) {
            return parts[parts.length - 2] + "." + parts[parts.length - 1];
        }
        return domain;
    }

    enablePodmanRestartService = () => {
        const argv = ["systemctl", "enable", "podman-restart.service"];

        cockpit.spawn(argv, { superuser: "require", err: "message" })
                .catch(err => {
                    console.warn("Failed to start podman-restart.service:", JSON.stringify(err));
                });
    }

    isSystem = () => {
        const { owner } = this.state;
        return owner === systemOwner;
    }

    render() {
        const { image } = this.props;
        const dialogValues = this.state;
        const { activeTabKey, owner, selectedImage } = this.state;

        let imageListOptions = [];
        if (!image) {
            imageListOptions = this.filterImages();
        }

        const localImage = this.state.image || (selectedImage && this.props.localImages.some(img => img.Id === selectedImage.Id));
        const registries = this.props.registries && this.props.registries.search ? this.props.registries.search : utils.fallbackRegistries;

        // Add the search component
        const footer = (
            <ToggleGroup className='image-search-footer' aria-label={_("Search by registry")}>
                <ToggleGroupItem text={_("All")} key='all' isSelected={this.state.searchByRegistry == 'all'} onChange={(_, ev) => {
                    ev.stopPropagation();
                    this.setState({ searchByRegistry: 'all' });
                }}
                // Ignore SelectToggle's touchstart's default behaviour
                onTouchStart={ev => {
                    ev.stopPropagation();
                }}
                />
                <ToggleGroupItem text={_("Local")} key='local' isSelected={this.state.searchByRegistry == 'local'} onChange={(_, ev) => {
                    ev.stopPropagation();
                    this.setState({ searchByRegistry: 'local' });
                }}
                onTouchStart={ev => {
                    ev.stopPropagation();
                }}
                />
                {registries.map(registry => {
                    const index = this.truncateRegistryDomain(registry);
                    return (
                        <ToggleGroupItem
                            text={index} key={index}
                            isSelected={ this.state.searchByRegistry == index }
                            onChange={ (_, ev) => {
                                ev.stopPropagation();
                                this.setState({ searchByRegistry: index });
                            } }
                            onTouchStart={ ev => ev.stopPropagation() }
                        />
                    );
                })}
            </ToggleGroup>
        );

        const defaultBody = (
            <Form isHorizontal={activeTabKey == 0}>
                <Flex className="run-image-dialog-header pf-c-form pf-m-horizontal" justifyContent={{ default: 'justifyContentSpaceBetween' }}>
                    <FormGroup fieldId='run-image-dialog-name' label={_("Name")}>
                        <TextInput id='run-image-dialog-name'
                           className="image-name"
                           placeholder={_("Container name")}
                           value={dialogValues.containerName}
                           onChange={value => this.onValueChanged('containerName', value)} />
                    </FormGroup>
                    { this.props.userServiceAvailable && this.props.systemServiceAvailable &&
                    <FormGroup fieldId='run-image-dialog-owner' label={_("Owner")}>
                        <ToggleGroup aria-label={_("Default with single selectable")}>
                            <ToggleGroupItem text={_("System")} buttonId="system" isSelected={owner === "system"}
                                             onChange={this.handleOwnerSelect} />
                            <ToggleGroupItem text={cockpit.format("$0 $1", _("User:"), this.props.user)}
                                             buttonId={this.props.user}
                                             isSelected={owner === this.props.user}
                                             onChange={this.handleOwnerSelect} />
                        </ToggleGroup>
                    </FormGroup>
                    }
                </Flex>
                <Tabs activeKey={activeTabKey} onSelect={this.handleTabClick}>
                    <Tab eventKey={0} title={<TabTitleText>{_("Details")}</TabTitleText>} className="pf-c-form pf-m-horizontal">

                        <FormGroup fieldId="create-image-image-select-typeahead" label={_("Image")}
                          labelIcon={!this.props.image &&
                              <Popover aria-label={_("Image selection help")}
                                enableFlip
                                bodyContent={
                                    <Flex direction={{ default: 'column' }}>
                                        <FlexItem>{_("host[:port]/[user]/container[:tag]")}</FlexItem>
                                        <FlexItem>{cockpit.format(_("Example: $0"), "quay.io/libpod/busybox")}</FlexItem>
                                        <FlexItem>{cockpit.format(_("Searching: $0"), "quay.io/busybox")}</FlexItem>
                                    </Flex>
                                }>
                                  <button onClick={e => e.preventDefault()} className="pf-c-form__group-label-help">
                                      <OutlinedQuestionCircleIcon />
                                  </button>
                              </Popover>
                          }
                        >
                            <Select
                                // We are unable to set id of the input directly, the select component appends
                                // '-select-typeahead' to toggleId.
                                toggleId='create-image-image'
                                isGrouped
                                {...(this.state.searchInProgress && { loadingVariant: 'spinner' })}
                                menuAppendTo={() => document.body}
                                variant={SelectVariant.typeahead}
                                noResultsFoundText={_("No images found")}
                                onToggle={this.onImageSelectToggle}
                                isOpen={this.state.isImageSelectOpen}
                                selections={selectedImage}
                                isInputValuePersisted
                                placeholderText={_("Search string or container location")}
                                onSelect={this.onImageSelect}
                                onClear={this.clearImageSelection}
                                // onFilter must be set or the spinner crashes https://github.com/patternfly/patternfly-react/issues/6384
                                onFilter={() => {}}
                                onTypeaheadInputChanged={value => this.debouncedInputChanged(value)}
                                footer={footer}
                                isDisabled={!!this.props.image}
                            >
                                {imageListOptions}
                            </Select>
                        </FormGroup>

                        {(image || localImage) &&
                        <FormGroup fieldId="run-image-dialog-pull-latest-image">
                            <Checkbox isChecked={this.state.pullLatestImage} id="run-image-dialog-pull-latest-image"
                                      onChange={value => this.onValueChanged('pullLatestImage', value)} label={_("Pull latest image")}
                            />
                        </FormGroup>
                        }

                        <FormGroup fieldId='run-image-dialog-command' label={_("Command")}>
                            <TextInput id='run-image-dialog-command'
                           value={dialogValues.command || ''}
                           onChange={value => this.onValueChanged('command', value)} />
                        </FormGroup>

                        <FormGroup fieldId="run=image-dialog-tty">
                            <Checkbox id="run-image-dialog-tty"
                              isChecked={this.state.hasTTY}
                              label={_("With terminal")}
                              onChange={checked => this.onValueChanged('hasTTY', checked)} />
                        </FormGroup>

                        <FormGroup fieldId='run-image-dialog-memory' label={_("Memory limit")}>
                            <Flex alignItems={{ default: 'alignItemsCenter' }} className="ct-input-group-spacer-sm modal-run-limiter" id="run-image-dialog-memory-limit">
                                <Checkbox id="run-image-dialog-memory-limit-checkbox"
                                  isChecked={this.state.memoryConfigure}
                                  onChange={checked => this.onValueChanged('memoryConfigure', checked)} />
                                <TextInput type='number'
                                   value={dialogValues.memory}
                                   id="run-image-dialog-memory"
                                   className="dialog-run-form-input"
                                   step={1}
                                   min={0}
                                   isReadOnly={!this.state.memoryConfigure}
                                   onClick={() => !this.state.memoryConfigure && this.onValueChanged('memoryConfigure', true)}
                                   onChange={value => this.onValueChanged('memory', value)} />
                                <FormSelect id='memory-unit-select'
                                    aria-label={_("Memory unit")}
                                    value={this.state.memoryUnit}
                                    isDisabled={!this.state.memoryConfigure}
                                    className="dialog-run-form-select"
                                    onChange={value => this.onValueChanged('memoryUnit', value)}>
                                    <FormSelectOption value={units.KiB.name} key={units.KiB.name} label={_("KiB")} />
                                    <FormSelectOption value={units.MiB.name} key={units.MiB.name} label={_("MiB")} />
                                    <FormSelectOption value={units.GiB.name} key={units.GiB.name} label={_("GiB")} />
                                </FormSelect>
                            </Flex>
                        </FormGroup>

                        {this.isSystem() &&
                            <FormGroup
                              fieldId='run-image-cpu-priority'
                              label={_("CPU shares")}
                              labelIcon={
                                  <Popover aria-label={_("CPU Shares help")}
                                      enableFlip
                                      bodyContent={_("CPU shares determine the priority of running containers. Default priority is 1024. A higher number prioritizes this container. A lower number decreases priority.")}>
                                      <button onClick={e => e.preventDefault()} className="pf-c-form__group-label-help">
                                          <OutlinedQuestionCircleIcon />
                                      </button>
                                  </Popover>
                              }>
                                <Flex alignItems={{ default: 'alignItemsCenter' }} className="ct-input-group-spacer-sm modal-run-limiter" id="run-image-dialog-cpu-priority">
                                    <Checkbox id="run-image-dialog-cpu-priority-checkbox"
                                        isChecked={this.state.cpuSharesConfigure}
                                        onChange={checked => this.onValueChanged('cpuSharesConfigure', checked)} />
                                    <TextInput type='number'
                                        id="run-image-cpu-priority"
                                        value={dialogValues.cpuShares}
                                        onClick={() => !this.state.cpuSharesConfigure && this.onValueChanged('cpuSharesConfigure', true)}
                                        step={1}
                                        min={2}
                                        max={262144}
                                        isReadOnly={!this.state.cpuSharesConfigure}
                                        onChange={value => this.onValueChanged('cpuShares', parseInt(value))} />
                                </Flex>
                            </FormGroup>
                        }
                        {this.isSystem() && this.props.podmanRestartAvailable &&
                        <Grid hasGutter md={6} sm={3}>
                            <GridItem>
                                <FormGroup fieldId='run-image-dialog-restart-policy' label={_("Restart policy")}
                          labelIcon={
                              <Popover aria-label={_("Restart policy help")}
                                enableFlip
                                bodyContent={_("Restart policy to follow when containers exit.")}>
                                  <button onClick={e => e.preventDefault()} className="pf-c-form__group-label-help">
                                      <OutlinedQuestionCircleIcon />
                                  </button>
                              </Popover>
                          }
                                >
                                    <FormSelect id="run-image-dialog-restart-policy"
                              aria-label={_("Restart policy help")}
                              value={dialogValues.restartPolicy}
                              onChange={value => this.onValueChanged('restartPolicy', value)}>
                                        <FormSelectOption value='no' key='no' label={_("No")} />
                                        <FormSelectOption value='on-failure' key='on-failure' label={_("On failure")} />
                                        <FormSelectOption value='always' key='always' label={_("Always")} />
                                    </FormSelect>
                                </FormGroup>
                            </GridItem>
                            {dialogValues.restartPolicy === "on-failure" &&
                                <FormGroup fieldId='run-image-dialog-restart-retries'
                                  label={_("Maximum retries")}>
                                    <TextInput
                              type="number"
                              id="run-image-dialog-restart-retries"
                              className="run-image-dialog-restart-retries"
                              value={dialogValues.restartTries}
                              step={1}
                              min={1}
                              max={65535}
                              onChange={value => this.onValueChanged('restartTries', value)}
                                    />
                                </FormGroup>
                            }
                        </Grid>
                        }
                        <FormGroup fieldId='run-image-dialog-start-after-creation' label={_("Options")} hasNoPaddingTop>
                            <Stack hasGutter>
                                <Checkbox isChecked={this.state.runImage} id="run-image-dialog-start-after-creation"
                                      onChange={value => this.onValueChanged('runImage', value)} label={_("Start after creation")} />
                            </Stack>
                        </FormGroup>
                    </Tab>
                    <Tab eventKey={1} title={<TabTitleText>{_("Integration")}</TabTitleText>} id="create-image-dialog-tab-integration" className="pf-c-form">

                        <DynamicListForm id='run-image-dialog-publish'
                                 emptyStateString={_("No ports exposed")}
                                 formclass='publish-port-form'
                                 label={_("Port mapping")}
                                 actionLabel={_("Add port mapping")}
                                 onChange={value => this.onValueChanged('publish', value)}
                                 default={{ IP: null, containerPort: null, hostPort: null, protocol: 'tcp' }}
                                 itemcomponent={ <PublishPort />} />

                        <DynamicListForm id='run-image-dialog-volume'
                                 emptyStateString={_("No volumes specified")}
                                 formclass='volume-form'
                                 label={_("Volumes")}
                                 actionLabel={_("Add volume")}
                                 onChange={value => this.onValueChanged('volumes', value)}
                                 default={{ containerPath: null, hostPath: null, mode: 'rw' }}
                                 options={{ selinuxAvailable: this.props.selinuxAvailable }}
                                 itemcomponent={ <Volume />} />

                        <DynamicListForm id='run-image-dialog-env'
                                 emptyStateString={_("No environment variables specified")}
                                 formclass='env-form'
                                 label={_("Environment variables")}
                                 actionLabel={_("Add variable")}
                                 onChange={value => this.onValueChanged('env', value)}
                                 default={{ envKey: null, envValue: null }}
                                 helperText={_("Paste one or more lines of key=value pairs into any field for bulk import")}
                                 itemcomponent={ <EnvVar />} />
                    </Tab>
                </Tabs>
            </Form>
        );
        return (
            <Modal isOpen
                   position="top" variant="medium"
                   onClose={this.props.close}
                   // TODO: still not ideal on chromium https://github.com/patternfly/patternfly-react/issues/6471
                   onEscapePress={() => {
                       if (this.state.isImageSelectOpen) {
                           this.onImageSelectToggle(!this.state.isImageSelectOpen);
                       } else {
                           this.props.close();
                       }
                   }}
                   title={this.props.pod ? cockpit.format(_("Create container in $0"), this.props.pod.Name) : _("Create container")}
                   footer={<>
                       {this.state.dialogError && <ErrorNotification errorMessage={this.state.dialogError} errorDetail={this.state.dialogErrorDetail} />}
                       <Button variant='primary' onClick={this.onCreateClicked} isDisabled={!image && selectedImage === ""}>
                           {_("Create")}
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
