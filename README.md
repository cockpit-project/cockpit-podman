# cockpit-podman

This is the [Cockpit](https://cockpit-project.org/) user interface for [podman
containers](https://podman.io/).

It is being actively developed and has not yet reached feature parity
with [cockpit-docker](https://cockpit-project.org/guide/latest/feature-docker.html).
For now you can do basic image and container tasks for both system and user containers.

## Technologies

 - cockpit-podman communicates to podman through its [REST API](https://podman.readthedocs.io/en/latest/_static/api.html).

 - This project is based on the [Cockpit Starter Kit](https://github.com/cockpit-project/starter-kit).
   See [Starter Kit Intro](http://cockpit-project.org/blog/cockpit-starter-kit.html) for details.

# Automated release

Releases are automated using [Cockpituous release](https://github.com/cockpit-project/cockpituous/tree/master/release)
which aims to fully automate project releases to GitHub, Fedora, Ubuntu, COPR, Docker
Hub, and other places. The intention is that the only manual step for releasing
a project is to create a signed tag for the version number.

The release steps are controlled by the
[cockpituous-release](./cockpituous-release) script.

Pushing the release tag triggers the [release.yml](.github/workflows/release.yml)
[GitHub action](https://github.com/features/actions) workflow. This uses the
[cockpit-project organization secrets](https://github.com/organizations/cockpit-project/settings/secrets).

# Automated maintenance

It is important to keep your [NPM modules](./package.json) up to date, to keep
up with security updates and bug fixes. This is done with the
[npm-update bot script](https://github.com/cockpit-project/bots/blob/master/npm-update)
which is run weekly or upon [manual request](https://github.com/cockpit-project/starter-kit/actions) through the
[npm-update.yml](.github/workflows/npm-update.yml) [GitHub action](https://github.com/features/actions).

Similarly, translations are refreshed every Tuesday evening (or manually) through the
[po-refresh.yml](.github/workflows/po-refresh.yml) action.
