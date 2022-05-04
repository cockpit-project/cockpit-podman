# cockpit-podman

This is the [Cockpit](https://cockpit-project.org/) user interface for [podman
containers](https://podman.io/).

## Technologies

 - cockpit-podman communicates to podman through its [REST API](https://podman.readthedocs.io/en/latest/_static/api.html).

 - This project is based on the [Cockpit Starter Kit](https://github.com/cockpit-project/starter-kit).
   See [Starter Kit Intro](http://cockpit-project.org/blog/cockpit-starter-kit.html) for details.

# Getting and building the source

Make sure you have `npm` available (usually from your distribution package).
These commands check out the source and build it into the `dist/` directory:

```
git clone https://github.com/cockpit-project/cockpit-podman
cd cockpit-podman
make
```

# Installing

`sudo make install` installs the package in `/usr/share/cockpit/`. This depends
on the `dist` target, which generates the distribution tarball.

You can also run `make rpm` to build RPMs for local installation.

In `production` mode, source files are automatically minified and compressed.
Set `NODE_ENV=production` if you want to duplicate this behavior.

# Development instructions

See [HACKING.md](./HACKING.md) for details about how to efficiently change the
code, run, and test it.

# Automated release

Releases are automated using [Cockpituous release](https://github.com/cockpit-project/cockpituous/tree/main/release)
and [Packit](https://packit.dev/) which aim to fully automate project releases
to GitHub, Fedora, Ubuntu, COPR, Docker Hub, and other places. The intention is
that the only manual step for releasing a project is to create a signed tag for
the version number.

The release steps are controlled by the
[cockpituous-release](./cockpituous-release) script and the [packit.yaml](./packit.yaml)
control file.

Pushing the release tag triggers the [release.yml](.github/workflows/release.yml)
[GitHub action](https://github.com/features/actions) workflow. This uses the
[secrets from the release environment](https://github.com/cockpit-project/cockpit-podman/settings/environments).

# Automated maintenance

It is important to keep your [NPM modules](./package.json) up to date, to keep
up with security updates and bug fixes. This is done with the
[npm-update bot script](https://github.com/cockpit-project/bots/blob/main/npm-update)
which is run weekly or upon [manual request](https://github.com/cockpit-project/starter-kit/actions) through the
[npm-update.yml](.github/workflows/npm-update.yml) [GitHub action](https://github.com/features/actions).

Similarly, translations are refreshed every Tuesday evening (or manually) through the
[weblate-sync-po.yml](.github/workflows/weblate-sync-po.yml) action.
Conversely, the PO template is uploaded to weblate every day through the
[weblate-sync-pot.yml](.github/workflows/weblate-sync-pot.yml) action.
