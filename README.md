# Cockpit Starter Kit

Scaffolding for a [Cockpit](http://www.cockpit-project.org) module.

# Building

Run `npm install` to install dependencies and `make` to build the package. It
builds into the `dist` directory. Link or copy that to a location were
`cockpit-bridge` looks for packages.

`make install` compiles and installs the package in `/usr/share/cockpit/`. The
convenience targets `srpm` and `rpm` build the source and binary rpms,
respectively. Both of these make use of the `dist-gzip` target, which is used
to generate the distribution tarball. In `production` mode, source files are
automatically minified and compressed. Set `NODE_ENV=production` if you want to
duplicate this behavior.

# Vagrant

This directory contains a Vagrantfile that installs and starts cockpit on a
Fedora 26 cloud image. Run `vagrant up` to start it and `vagrant rsync` to
synchronize the `dist` directory to `/usr/local/share/cockit/starter-kit`. Use
`vagrant rsync-auto` to automatically sync when contents of the `dist`
directory change.
