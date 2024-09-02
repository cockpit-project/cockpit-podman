import React from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { InputGroup, InputGroupText } from "@patternfly/react-core/dist/esm/components/InputGroup";
import { Modal } from "@patternfly/react-core/dist/esm/components/Modal";
import { NumberInput } from "@patternfly/react-core/dist/esm/components/NumberInput";
import { Popover } from "@patternfly/react-core/dist/esm/components/Popover";
import { Radio } from "@patternfly/react-core/dist/esm/components/Radio";
import { Tab, TabTitleText, Tabs } from "@patternfly/react-core/dist/esm/components/Tabs";
import { Text, TextContent, TextList, TextListItem, TextVariants } from "@patternfly/react-core/dist/esm/components/Text";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { ToggleGroup, ToggleGroupItem } from "@patternfly/react-core/dist/esm/components/ToggleGroup";
import { Select, SelectGroup, SelectOption, SelectVariant } from "@patternfly/react-core/dist/esm/deprecated/components/Select";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex";
import { Grid, GridItem } from "@patternfly/react-core/dist/esm/layouts/Grid";
import { OutlinedQuestionCircleIcon } from '@patternfly/react-icons';
import { FormHelper } from "cockpit-components-form-helper.jsx";
import * as dockerNames from 'docker-names';
import { debounce } from 'throttle-debounce';

import cockpit from 'cockpit';
import { DynamicListForm } from 'cockpit-components-dynamic-list.jsx';

import { onDownloadContainer, onDownloadContainerFinished } from './Containers.jsx';
import { EnvVar, validateEnvVar } from './Env.jsx';
import { ErrorNotification } from './Notification.jsx';
import { PublishPort, validatePublishPort } from './PublishPort.jsx';
import { validateVolume, Volume } from './Volume.jsx';
import * as client from './client.js';
import rest from './rest.js';
import * as utils from './util.js';

import "./ImageRunModal.scss";

const _ = cockpit.gettext;

const systemOwner = "system";

const units = {
    KB: {
        name: "KB",
        baseExponent: 1,
    },
    MB: {
        name: "MB",
        baseExponent: 2,
    },
    GB: {
        name: "GB",
        baseExponent: 3,
    },
};

// healthchecks.go HealthCheckOnFailureAction
const HealthCheckOnFailureActionOrder = [
    { value: 0, label: _("No action") },
    { value: 3, label: _("Restart") },
    { value: 4, label: _("Stop") },
    { value: 2, label: _("Force stop") },
];

export class ImageRunModal extends React.Component {
    constructor(props) {
        super(props);

        let command = "";
        if (this.props.image && this.props.image.Command) {
            command = utils.quote_cmdline(this.props.image.Command);
        }

        const entrypoint = utils.quote_cmdline(this.props.image?.Entrypoint);

        let selectedImage = "";
        if (this.props.image) {
            selectedImage = utils.image_name(this.props.image);
        }

        let default_owner = this.props.systemServiceAvailable ? systemOwner : this.props.user;
        if (this.props.pod)
            default_owner = this.props.pod.isSystem ? systemOwner : this.props.user;

        this.state = {
            command,
            containerName: dockerNames.getRandomName(),
            entrypoint,
            env: [],
            hasTTY: true,
            publish: [],
            image: props.image,
            memory: 512,
            cpuShares: 1024,
            memoryConfigure: false,
            cpuSharesConfigure: false,
            memoryUnit: 'MB',
            validationFailed: {},
            volumes: [],
            restartPolicy: "no",
            restartTries: 5,
            pullLatestImage: false,
            activeTabKey: 0,
            owner: default_owner,
            /* image select */
            selectedImage,
            searchFinished: false,
            searchInProgress: false,
            searchText: "",
            imageResults: {},
            isImageSelectOpen: false,
            searchByRegistry: 'all',
            /* health check */
            healthcheck_command: "",
            healthcheck_interval: 30,
            healthcheck_timeout: 30,
            healthcheck_start_period: 0,
            healthcheck_retries: 3,
            healthcheck_action: 0,
        };
        this.getCreateConfig = this.getCreateConfig.bind(this);
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
            const memorySize = Number.parseInt(this.state.memory * (1000 ** units[this.state.memoryUnit].baseExponent));
            resourceLimit.memory = { limit: memorySize };
            createConfig.resource_limits = resourceLimit;
        }
        if (this.state.cpuSharesConfigure && this.state.cpuShares !== 0) {
            resourceLimit.cpu = { shares: this.state.cpuShares };
            createConfig.resource_limits = resourceLimit;
        }
        createConfig.terminal = this.state.hasTTY;
        if (this.state.publish.some(port => port !== undefined))
            createConfig.portmappings = this.state.publish
                    .filter(port => port?.containerPort)
                    .map(port => {
                        const pm = { container_port: parseInt(port.containerPort), protocol: port.protocol };
                        if (port.hostPort !== null)
                            pm.host_port = parseInt(port.hostPort);
                        if (port.IP !== null)
                            pm.host_ip = port.IP;
                        return pm;
                    });
        if (this.state.env.some(item => item !== undefined)) {
            const envs = {};
            this.state.env.forEach(item => {
                if (item !== undefined)
                    envs[item.envKey] = item.envValue;
            });
            createConfig.env = envs;
        }
        if (this.state.volumes.some(volume => volume !== undefined)) {
            createConfig.mounts = this.state.volumes
                    .filter(volume => volume?.hostPath && volume?.containerPath)
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
                createConfig.restart_tries = this.state.restartTries;
            }
            // Enable podman-restart.service for system containers, for user
            // sessions enable-linger needs to be enabled for containers to start on boot.
            if (this.state.restartPolicy === "always" && (this.props.podmanInfo.userLingeringEnabled || this.props.systemServiceAvailable)) {
                this.enablePodmanRestartService();
            }
        }

        if (this.state.healthcheck_command !== "") {
            createConfig.healthconfig = {
                Interval: this.state.healthcheck_interval * 1000000000,
                Retries: this.state.healthcheck_retries,
                StartPeriod: this.state.healthcheck_start_period * 1000000000,
                Test: utils.unquote_cmdline(this.state.healthcheck_command),
                Timeout: this.state.healthcheck_timeout * 1000000000,
            };
            createConfig.health_check_on_failure_action = this.state.healthcheck_action;
        }

        return createConfig;
    }

    createContainer = (isSystem, createConfig, runImage) => {
        const Dialogs = this.props.dialogs;
        client.createContainer(isSystem, createConfig)
                .then(reply => {
                    if (runImage) {
                        client.postContainer(isSystem, "start", reply.Id, {})
                                .then(() => Dialogs.close())
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
                        Dialogs.close();
                    }
                })
                .catch(ex => {
                    this.setState({
                        dialogError: _("Container failed to be created"),
                        dialogErrorDetail: cockpit.format("$0: $1", ex.reason, ex.message)
                    });
                });
    };

    async onCreateClicked(runImage = false) {
        if (!await this.validateForm())
            return;

        const Dialogs = this.props.dialogs;
        const createConfig = this.getCreateConfig();
        const { pullLatestImage } = this.state;
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
            Dialogs.close();
            const tempImage = { ...createConfig };

            // Assign temporary properties to allow rendering
            tempImage.Id = tempImage.name;
            tempImage.isSystem = isSystem;
            tempImage.State = { Status: _("downloading") };
            tempImage.Created = new Date();
            tempImage.Name = tempImage.name;
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

    onPlusOne(key) {
        this.setState(state => ({ [key]: parseFloat(state[key]) + 1 }));
    }

    onMinusOne(key) {
        this.setState(state => ({ [key]: parseFloat(state[key]) - 1 }));
    }

    onNumberValue(key, value, minimum = 0, is_float = false) {
        const parseFunc = is_float ? Number.parseFloat : Number.parseInt;
        value = parseFunc(value);
        if (isNaN(value) || value < minimum) {
            value = minimum;
        }
        this.onValueChanged(key, value);
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
        if (Object.keys(this.props.podmanInfo.registries).length !== 0 || value.includes('/')) {
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
                                dialogErrorDetail = result.reason ? cockpit.format(_("Failed to search for images: $0"), result.reason.message) : _("Failed to search for images.");
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
    };

    clearImageSelection = () => {
        // Reset command if it was prefilled
        let command = this.state.command;
        if (this.state.command === utils.quote_cmdline(this.state.selectedImage?.Command))
            command = "";

        this.setState({
            selectedImage: "",
            image: "",
            isImageSelectOpen: false,
            imageResults: {},
            searchText: "",
            searchFinished: false,
            command,
            entrypoint: "",
        });
    };

    onImageSelectToggle = (_, isOpen) => {
        this.setState({
            isImageSelectOpen: isOpen,
        });
    };

    onImageSelect = (event, value, placeholder) => {
        if (event === undefined)
            return;

        let command = this.state.command;
        if (value.Command && !command)
            command = utils.quote_cmdline(value.Command);

        const entrypoint = utils.quote_cmdline(value?.Entrypoint);

        this.setState({
            selectedImage: value,
            isImageSelectOpen: false,
            command,
            entrypoint,
        });
    };

    handleImageSelectInput = value => {
        this.setState({
            searchText: value,
            // Reset searchFinished status when text input changes
            searchFinished: false,
            selectedImage: "",
        });
        this.onSearchTriggered(value);
    };

    debouncedInputChanged = debounce(300, this.handleImageSelectInput);

    handleOwnerSelect = (event) => {
        const value = event.currentTarget.value;
        this.setState({
            owner: value
        });
    };

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

        // Strip out all non-allowed container image characters when filtering.
        let regexString = searchText.replace(/[^/\w_.:-]/g, "");
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
    };

    // Similar to the output of podman search and podman's /libpod/images/search endpoint only show the root domain.
    truncateRegistryDomain = (domain) => {
        const parts = domain.split('.');
        if (parts.length > 2) {
            return parts[parts.length - 2] + "." + parts[parts.length - 1];
        }
        return domain;
    };

    enablePodmanRestartService = () => {
        const argv = ["systemctl", "enable", "podman-restart.service"];
        if (!this.isSystem()) {
            argv.splice(1, 0, "--user");
        }

        cockpit.spawn(argv, { superuser: this.isSystem() ? "require" : "", err: "message" })
                .catch(err => {
                    console.warn("Failed to start podman-restart.service:", JSON.stringify(err));
                });
    };

    isSystem = () => {
        const { owner } = this.state;
        return owner === systemOwner;
    };

    isFormInvalid = validationFailed => {
        const groupHasError = row => row && Object.values(row)
                .filter(val => val) // Filter out empty/undefined properties
                .length > 0; // If one field has error, the whole group (dynamicList) is invalid

        // If at least one group is invalid, then the whole form is invalid
        return validationFailed.publish?.some(groupHasError) ||
            validationFailed.volumes?.some(groupHasError) ||
            validationFailed.env?.some(groupHasError) ||
            !!validationFailed.containerName;
    };

    async validateContainerName(containerName) {
        try {
            await client.containerExists(this.isSystem(), containerName);
        } catch (error) {
            return;
        }
        return _("Name already in use");
    }

    async validateForm() {
        const { publish, volumes, env, containerName } = this.state;
        const validationFailed = { };

        const publishValidation = publish.map(a => {
            if (a === undefined)
                return undefined;

            return {
                IP: validatePublishPort(a.IP, "IP"),
                hostPort: validatePublishPort(a.hostPort, "hostPort"),
                containerPort: validatePublishPort(a.containerPort, "containerPort"),
            };
        });
        if (publishValidation.some(entry => entry && Object.keys(entry).length > 0))
            validationFailed.publish = publishValidation;

        const volumesValidation = volumes.map(a => {
            if (a === undefined)
                return undefined;

            return {
                hostPath: validateVolume(a.hostPath, "hostPath"),
                containerPath: validateVolume(a.containerPath, "containerPath"),
            };
        });
        if (volumesValidation.some(entry => entry && Object.keys(entry).length > 0))
            validationFailed.volumes = volumesValidation;

        const envValidation = env.map(a => {
            if (a === undefined)
                return undefined;

            return {
                envKey: validateEnvVar(a.envKey, "envKey"),
                envValue: validateEnvVar(a.envValue, "envValue"),
            };
        });
        if (envValidation.some(entry => entry && Object.keys(entry).length > 0))
            validationFailed.env = envValidation;

        const containerNameValidation = await this.validateContainerName(containerName);

        if (containerNameValidation)
            validationFailed.containerName = containerNameValidation;

        this.setState({ validationFailed });

        return !this.isFormInvalid(validationFailed);
    }

    /* Updates a validation object of the whole dynamic list's form (e.g. the whole port-mapping form)
    *
    * Arguments
    *   - key: [publish/volumes/env] - Specifies the validation of which dynamic form of the Image run dialog is being updated
    *   - value: An array of validation errors of the form. Each item of the array represents a row of the dynamic list.
    *            Index needs to correlate with a row number
    */
    dynamicListOnValidationChange = (key, value) => {
        const validationFailedDelta = { ...this.state.validationFailed };

        validationFailedDelta[key] = value;

        if (validationFailedDelta[key].every(a => a === undefined))
            delete validationFailedDelta[key];

        this.onValueChanged('validationFailed', validationFailedDelta);
    };

    render() {
        const Dialogs = this.props.dialogs;
        const { registries, podmanRestartAvailable, userLingeringEnabled, userPodmanRestartAvailable, selinuxAvailable, version } = this.props.podmanInfo;
        const { image } = this.props;
        const dialogValues = this.state;
        const { activeTabKey, owner, selectedImage } = this.state;

        let imageListOptions = [];
        if (!image) {
            imageListOptions = this.filterImages();
        }

        const localImage = this.state.image || (selectedImage && this.props.localImages.some(img => img.Id === selectedImage.Id));
        const podmanRegistries = registries && registries.search ? registries.search : utils.fallbackRegistries;

        // Add the search component
        const footer = (
            <ToggleGroup className='image-search-footer' aria-label={_("Search by registry")}>
                <ToggleGroupItem text={_("All")} key='all' isSelected={this.state.searchByRegistry == 'all'} onChange={(ev, _) => {
                    ev.stopPropagation();
                    this.setState({ searchByRegistry: 'all' });
                }}
                // Ignore SelectToggle's touchstart's default behaviour
                onTouchStart={ev => {
                    ev.stopPropagation();
                }}
                />
                <ToggleGroupItem text={_("Local")} key='local' isSelected={this.state.searchByRegistry == 'local'} onChange={(ev, _) => {
                    ev.stopPropagation();
                    this.setState({ searchByRegistry: 'local' });
                }}
                onTouchStart={ev => {
                    ev.stopPropagation();
                }}
                />
                {podmanRegistries.map(registry => {
                    const index = this.truncateRegistryDomain(registry);
                    return (
                        <ToggleGroupItem
                            text={index} key={index}
                            isSelected={ this.state.searchByRegistry == index }
                            onChange={ (ev, _) => {
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
            <Form>
                {this.state.dialogError && <ErrorNotification errorMessage={this.state.dialogError} errorDetail={this.state.dialogErrorDetail} />}
                <FormGroup id="image-name-group" fieldId='run-image-dialog-name' label={_("Name")} className="ct-m-horizontal">
                    <TextInput id='run-image-dialog-name'
                           className="image-name"
                           placeholder={_("Container name")}
                           validated={dialogValues.validationFailed.containerName ? "error" : "default"}
                           value={dialogValues.containerName}
                           onChange={(_, value) => {
                               utils.validationClear(dialogValues.validationFailed, "containerName", (value) => this.onValueChanged("validationFailed", value));
                               utils.validationDebounce(async () => {
                                   const delta = await this.validateContainerName(value);
                                   if (delta)
                                       this.onValueChanged("validationFailed", { ...dialogValues.validationFailed, containerName: delta });
                               });
                               this.onValueChanged('containerName', value);
                           }} />
                    <FormHelper helperTextInvalid={dialogValues.validationFailed.containerName} />
                </FormGroup>
                <Tabs activeKey={activeTabKey} onSelect={this.handleTabClick}>
                    <Tab eventKey={0} title={<TabTitleText>{_("Details")}</TabTitleText>} className="pf-v5-c-form pf-m-horizontal">
                        { this.props.userServiceAvailable && this.props.systemServiceAvailable &&
                        <FormGroup isInline hasNoPaddingTop fieldId='run-image-dialog-owner' label={_("Owner")}
                                   labelIcon={
                                       <Popover aria-label={_("Owner help")}
                                          enableFlip
                                          bodyContent={
                                              <>
                                                  <TextContent>
                                                      <Text component={TextVariants.h4}>{_("System")}</Text>
                                                      <TextList>
                                                          <TextListItem>
                                                              {_("Ideal for running services")}
                                                          </TextListItem>
                                                          <TextListItem>
                                                              {_("Resource limits can be set")}
                                                          </TextListItem>
                                                          <TextListItem>
                                                              {_("Checkpoint and restore support")}
                                                          </TextListItem>
                                                          <TextListItem>
                                                              {_("Ports under 1024 can be mapped")}
                                                          </TextListItem>
                                                      </TextList>
                                                  </TextContent>
                                                  <TextContent>
                                                      <Text component={TextVariants.h4}>{cockpit.format("$0 $1", _("User:"), this.props.user)}</Text>
                                                      <TextList>
                                                          <TextListItem>
                                                              {_("Ideal for development")}
                                                          </TextListItem>
                                                          <TextListItem>
                                                              {_("Restricted by user account permissions")}
                                                          </TextListItem>
                                                      </TextList>
                                                  </TextContent>
                                              </>
                                          }>
                                           <button onClick={e => e.preventDefault()} className="pf-v5-c-form__group-label-help">
                                               <OutlinedQuestionCircleIcon />
                                           </button>
                                       </Popover>
                                   }>
                            <Radio value="system"
                                   label={_("System")}
                                   id="run-image-dialog-owner-system"
                                   isChecked={owner === "system"}
                                   isDisabled={this.props.pod}
                                   onChange={this.handleOwnerSelect} />
                            <Radio value={this.props.user}
                                   label={cockpit.format("$0 $1", _("User:"), this.props.user)}
                                   id="run-image-dialog-owner-user"
                                   isDisabled={this.props.pod}
                                   isChecked={owner === this.props.user}
                                   onChange={this.handleOwnerSelect} />
                        </FormGroup>
                        }
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
                                  <button onClick={e => e.preventDefault()} className="pf-v5-c-form__group-label-help">
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
                                onTypeaheadInputChanged={this.debouncedInputChanged}
                                footer={footer}
                                isDisabled={!!this.props.image}
                            >
                                {imageListOptions}
                            </Select>
                        </FormGroup>

                        {(image || localImage) &&
                        <FormGroup fieldId="run-image-dialog-pull-latest-image">
                            <Checkbox isChecked={this.state.pullLatestImage} id="run-image-dialog-pull-latest-image"
                                      onChange={(_event, value) => this.onValueChanged('pullLatestImage', value)} label={_("Pull latest image")}
                            />
                        </FormGroup>
                        }

                        {dialogValues.entrypoint &&
                        <FormGroup fieldId='run-image-dialog-entrypoint' hasNoPaddingTop label={_("Entrypoint")}>
                            <Text id="run-image-dialog-entrypoint">{dialogValues.entrypoint}</Text>
                        </FormGroup>
                        }

                        <FormGroup fieldId='run-image-dialog-command' label={_("Command")}>
                            <TextInput id='run-image-dialog-command'
                           value={dialogValues.command || ''}
                           onChange={(_, value) => this.onValueChanged('command', value)} />
                        </FormGroup>

                        <FormGroup fieldId="run=image-dialog-tty">
                            <Checkbox id="run-image-dialog-tty"
                              isChecked={this.state.hasTTY}
                              label={_("With terminal")}
                              onChange={(_event, checked) => this.onValueChanged('hasTTY', checked)} />
                        </FormGroup>

                        <FormGroup fieldId='run-image-dialog-memory' label={_("Memory limit")}>
                            <Flex alignItems={{ default: 'alignItemsCenter' }} className="ct-input-group-spacer-sm modal-run-limiter" id="run-image-dialog-memory-limit">
                                <Checkbox id="run-image-dialog-memory-limit-checkbox"
                                  isChecked={this.state.memoryConfigure}
                                  onChange={(_event, checked) => this.onValueChanged('memoryConfigure', checked)} />
                                <NumberInput
                                   value={dialogValues.memory}
                                   id="run-image-dialog-memory"
                                   min={0}
                                   isDisabled={!this.state.memoryConfigure}
                                   onClick={() => !this.state.memoryConfigure && this.onValueChanged('memoryConfigure', true)}
                                   onPlus={() => this.onPlusOne('memory')}
                                   onMinus={() => this.onMinusOne('memory')}
                                   minusBtnAriaLabel={_("Decrease memory")}
                                   plusBtnAriaLabel={_("Increase memory")}
                                   onChange={ev => this.onNumberValue('memory', ev.target.value, 0, true)} />
                                <FormSelect id='memory-unit-select'
                                    aria-label={_("Memory unit")}
                                    value={this.state.memoryUnit}
                                    isDisabled={!this.state.memoryConfigure}
                                    className="dialog-run-form-select"
                                    onChange={(_event, value) => this.onValueChanged('memoryUnit', value)}>
                                    <FormSelectOption value={units.KB.name} key={units.KB.name} label={_("KB")} />
                                    <FormSelectOption value={units.MB.name} key={units.MB.name} label={_("MB")} />
                                    <FormSelectOption value={units.GB.name} key={units.GB.name} label={_("GB")} />
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
                                      <button onClick={e => e.preventDefault()} className="pf-v5-c-form__group-label-help">
                                          <OutlinedQuestionCircleIcon />
                                      </button>
                                  </Popover>
                              }>
                                <Flex alignItems={{ default: 'alignItemsCenter' }} className="ct-input-group-spacer-sm modal-run-limiter" id="run-image-dialog-cpu-priority">
                                    <Checkbox id="run-image-dialog-cpu-priority-checkbox"
                                        isChecked={this.state.cpuSharesConfigure}
                                        onChange={(_event, checked) => this.onValueChanged('cpuSharesConfigure', checked)} />
                                    <NumberInput
                                        id="run-image-cpu-priority"
                                        value={dialogValues.cpuShares}
                                        onClick={() => !this.state.cpuSharesConfigure && this.onValueChanged('cpuSharesConfigure', true)}
                                        min={2}
                                        max={262144}
                                        isDisabled={!this.state.cpuSharesConfigure}
                                        onPlus={() => this.onPlusOne('cpuShares')}
                                        onMinus={() => this.onMinusOne('cpuShares')}
                                        minusBtnAriaLabel={_("Decrease CPU shares")}
                                        plusBtnAriaLabel={_("Increase CPU shares")}
                                        onChange={ev => this.onNumberValue('cpuShares', ev.target.value, 2)} />
                                </Flex>
                            </FormGroup>
                        }
                        {((userLingeringEnabled && userPodmanRestartAvailable) || (this.isSystem() && podmanRestartAvailable)) &&
                        <Grid hasGutter md={6} sm={3}>
                            <GridItem>
                                <FormGroup fieldId='run-image-dialog-restart-policy' label={_("Restart policy")}
                          labelIcon={
                              <Popover aria-label={_("Restart policy help")}
                                enableFlip
                                bodyContent={userLingeringEnabled ? _("Restart policy to follow when containers exit. Using linger for auto-starting containers may not work in some circumstances, such as when ecryptfs, systemd-homed, NFS, or 2FA are used on a user account.") : _("Restart policy to follow when containers exit.")}>
                                  <button onClick={e => e.preventDefault()} className="pf-v5-c-form__group-label-help">
                                      <OutlinedQuestionCircleIcon />
                                  </button>
                              </Popover>
                          }
                                >
                                    <FormSelect id="run-image-dialog-restart-policy"
                              aria-label={_("Restart policy help")}
                              value={dialogValues.restartPolicy}
                              onChange={(_event, value) => this.onValueChanged('restartPolicy', value)}>
                                        <FormSelectOption value='no' key='no' label={_("No")} />
                                        <FormSelectOption value='on-failure' key='on-failure' label={_("On failure")} />
                                        <FormSelectOption value='always' key='always' label={_("Always")} />
                                    </FormSelect>
                                </FormGroup>
                            </GridItem>
                            {dialogValues.restartPolicy === "on-failure" &&
                                <FormGroup fieldId='run-image-dialog-restart-retries'
                                  label={_("Maximum retries")}>
                                    <NumberInput
                              id="run-image-dialog-restart-retries"
                              value={dialogValues.restartTries}
                              min={1}
                              max={65535}
                              widthChars={5}
                              minusBtnAriaLabel={_("Decrease maximum retries")}
                              plusBtnAriaLabel={_("Increase maximum retries")}
                              onMinus={() => this.onMinusOne('restartTries')}
                              onPlus={() => this.onPlusOne('restartTries')}
                              onChange={ev => this.onNumberValue('restartTries', ev.target.value, 1)}
                                    />
                                </FormGroup>
                            }
                        </Grid>
                        }
                    </Tab>
                    <Tab eventKey={1} title={<TabTitleText>{_("Integration")}</TabTitleText>} id="create-image-dialog-tab-integration" className="pf-v5-c-form">

                        <DynamicListForm id='run-image-dialog-publish'
                                 emptyStateString={_("No ports exposed")}
                                 formclass='publish-port-form'
                                 label={_("Port mapping")}
                                 actionLabel={_("Add port mapping")}
                                 validationFailed={dialogValues.validationFailed.publish}
                                 onValidationChange={value => this.dynamicListOnValidationChange('publish', value)}
                                 onChange={value => this.onValueChanged('publish', value)}
                                 default={{ IP: null, containerPort: null, hostPort: null, protocol: 'tcp' }}
                                 itemcomponent={ <PublishPort />} />
                        <DynamicListForm id='run-image-dialog-volume'
                                 emptyStateString={_("No volumes specified")}
                                 formclass='volume-form'
                                 label={_("Volumes")}
                                 actionLabel={_("Add volume")}
                                 validationFailed={dialogValues.validationFailed.volumes}
                                 onValidationChange={value => this.dynamicListOnValidationChange('volumes', value)}
                                 onChange={value => this.onValueChanged('volumes', value)}
                                 default={{ containerPath: null, hostPath: null, mode: 'rw' }}
                                 options={{ selinuxAvailable }}
                                 itemcomponent={ <Volume />} />

                        <DynamicListForm id='run-image-dialog-env'
                                 emptyStateString={_("No environment variables specified")}
                                 formclass='env-form'
                                 label={_("Environment variables")}
                                 actionLabel={_("Add variable")}
                                 validationFailed={dialogValues.validationFailed.env}
                                 onValidationChange={value => this.dynamicListOnValidationChange('env', value)}
                                 onChange={value => this.onValueChanged('env', value)}
                                 default={{ envKey: null, envValue: null }}
                                 helperText={_("Paste one or more lines of key=value pairs into any field for bulk import")}
                                 itemcomponent={ <EnvVar />} />
                    </Tab>
                    <Tab eventKey={2} title={<TabTitleText>{_("Health check")}</TabTitleText>} id="create-image-dialog-tab-healthcheck" className="pf-v5-c-form pf-m-horizontal">
                        <FormGroup fieldId='run-image-dialog-healthcheck-command' label={_("Command")}>
                            <TextInput id='run-image-dialog-healthcheck-command'
                           value={dialogValues.healthcheck_command || ''}
                           onChange={(_, value) => this.onValueChanged('healthcheck_command', value)} />
                        </FormGroup>

                        <FormGroup fieldId='run-image-healthcheck-interval' label={_("Interval")}
                              labelIcon={
                                  <Popover aria-label={_("Health check interval help")}
                                      enableFlip
                                      bodyContent={_("Interval how often health check is run.")}>
                                      <button onClick={e => e.preventDefault()} className="pf-v5-c-form__group-label-help">
                                          <OutlinedQuestionCircleIcon />
                                      </button>
                                  </Popover>
                              }>
                            <InputGroup>
                                <NumberInput
                                        id="run-image-healthcheck-interval"
                                        value={dialogValues.healthcheck_interval}
                                        min={0}
                                        max={262144}
                                        widthChars={6}
                                        minusBtnAriaLabel={_("Decrease interval")}
                                        plusBtnAriaLabel={_("Increase interval")}
                                        onMinus={() => this.onMinusOne('healthcheck_interval')}
                                        onPlus={() => this.onPlusOne('healthcheck_interval')}
                                        onChange={ev => this.onNumberValue('healthcheck_interval', ev.target.value)} />
                                <InputGroupText isPlain>{_("seconds")}</InputGroupText>
                            </InputGroup>
                        </FormGroup>
                        <FormGroup fieldId='run-image-healthcheck-timeout' label={_("Timeout")}
                              labelIcon={
                                  <Popover aria-label={_("Health check timeout help")}
                                      enableFlip
                                      bodyContent={_("The maximum time allowed to complete the health check before an interval is considered failed.")}>
                                      <button onClick={e => e.preventDefault()} className="pf-v5-c-form__group-label-help">
                                          <OutlinedQuestionCircleIcon />
                                      </button>
                                  </Popover>
                              }>
                            <InputGroup>
                                <NumberInput
                                        id="run-image-healthcheck-timeout"
                                        value={dialogValues.healthcheck_timeout}
                                        min={0}
                                        max={262144}
                                        widthChars={6}
                                        minusBtnAriaLabel={_("Decrease timeout")}
                                        plusBtnAriaLabel={_("Increase timeout")}
                                        onMinus={() => this.onMinusOne('healthcheck_timeout')}
                                        onPlus={() => this.onPlusOne('healthcheck_timeout')}
                                        onChange={ev => this.onNumberValue('healthcheck_timeout', ev.target.value)} />
                                <InputGroupText isPlain>{_("seconds")}</InputGroupText>
                            </InputGroup>
                        </FormGroup>
                        <FormGroup fieldId='run-image-healthcheck-start-period' label={_("Start period")}
                              labelIcon={
                                  <Popover aria-label={_("Health check start period help")}
                                      enableFlip
                                      bodyContent={_("The initialization time needed for a container to bootstrap.")}>
                                      <button onClick={e => e.preventDefault()} className="pf-v5-c-form__group-label-help">
                                          <OutlinedQuestionCircleIcon />
                                      </button>
                                  </Popover>
                              }>
                            <InputGroup>
                                <NumberInput
                                        id="run-image-healthcheck-start-period"
                                        value={dialogValues.healthcheck_start_period}
                                        min={0}
                                        max={262144}
                                        widthChars={6}
                                        minusBtnAriaLabel={_("Decrease start period")}
                                        plusBtnAriaLabel={_("Increase start period")}
                                        onMinus={() => this.onMinusOne('healthcheck_start_period')}
                                        onPlus={() => this.onPlusOne('healthcheck_start_period')}
                                        onChange={ev => this.onNumberValue('healthcheck_start_period', ev.target.value)} />
                                <InputGroupText isPlain>{_("seconds")}</InputGroupText>
                            </InputGroup>
                        </FormGroup>
                        <FormGroup fieldId='run-image-healthcheck-retries' label={_("Retries")}
                              labelIcon={
                                  <Popover aria-label={_("Health check retries help")}
                                      enableFlip
                                      bodyContent={_("The number of retries allowed before a healthcheck is considered to be unhealthy.")}>
                                      <button onClick={e => e.preventDefault()} className="pf-v5-c-form__group-label-help">
                                          <OutlinedQuestionCircleIcon />
                                      </button>
                                  </Popover>
                              }>
                            <NumberInput
                                    id="run-image-healthcheck-retries"
                                    value={dialogValues.healthcheck_retries}
                                    min={0}
                                    max={999}
                                    widthChars={3}
                                    minusBtnAriaLabel={_("Decrease retries")}
                                    plusBtnAriaLabel={_("Increase retries")}
                                    onMinus={() => this.onMinusOne('healthcheck_retries')}
                                    onPlus={() => this.onPlusOne('healthcheck_retries')}
                                    onChange={ev => this.onNumberValue('healthcheck_retries', ev.target.value)} />
                        </FormGroup>
                        {version.localeCompare("4.3", undefined, { numeric: true, sensitivity: 'base' }) >= 0 &&
                        <FormGroup isInline hasNoPaddingTop fieldId='run-image-healthcheck-action' label={_("When unhealthy") }
                              labelIcon={
                                  <Popover aria-label={_("Health failure check action help")}
                                      enableFlip
                                      bodyContent={_("Action to take once the container transitions to an unhealthy state.")}>
                                      <button onClick={e => e.preventDefault()} className="pf-v5-c-form__group-label-help">
                                          <OutlinedQuestionCircleIcon />
                                      </button>
                                  </Popover>
                              }>
                            {HealthCheckOnFailureActionOrder.map(item =>
                                <Radio value={item.value}
                                       key={item.value}
                                       label={item.label}
                                       id={`run-image-healthcheck-action-${item.value}`}
                                       isChecked={dialogValues.healthcheck_action === item.value}
                                       onChange={() => this.onValueChanged('healthcheck_action', item.value)} />
                            )}
                        </FormGroup>
                        }
                    </Tab>
                </Tabs>
            </Form>
        );
        return (
            <Modal isOpen
                   position="top" variant="medium"
                   onClose={Dialogs.close}
                   // TODO: still not ideal on chromium https://github.com/patternfly/patternfly-react/issues/6471
                   onEscapePress={() => {
                       if (this.state.isImageSelectOpen) {
                           this.onImageSelectToggle(!this.state.isImageSelectOpen);
                       } else {
                           Dialogs.close();
                       }
                   }}
                   title={this.props.pod ? cockpit.format(_("Create container in $0"), this.props.pod.Name) : _("Create container")}
                   footer={<>
                       <Button variant='primary' id="create-image-create-run-btn" onClick={() => this.onCreateClicked(true)} isDisabled={(!image && selectedImage === "") || this.isFormInvalid(dialogValues.validationFailed)}>
                           {_("Create and run")}
                       </Button>
                       <Button variant='secondary' id="create-image-create-btn" onClick={() => this.onCreateClicked(false)} isDisabled={(!image && selectedImage === "") || this.isFormInvalid(dialogValues.validationFailed)}>
                           {_("Create")}
                       </Button>
                       <Button variant='link' className='btn-cancel' onClick={Dialogs.close}>
                           {_("Cancel")}
                       </Button>
                   </>}
            >
                {defaultBody}
            </Modal>
        );
    }
}
