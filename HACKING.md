# Hacking on Cockpit Podman

The commands here assume you're in the top level of the Cockpit Podman git
repository checkout.

## Running out of git checkout

For development, you usually want to run your module straight out of the git
tree. To do that, run `make devel-install`, which links your checkout to the
location were `cockpit-bridge` looks for packages. If you prefer to do this
manually:

```
mkdir -p ~/.local/share/cockpit
ln -s `pwd`/dist ~/.local/share/cockpit/podman
```

After changing the code and running `make` again, reload the Cockpit page in
your browser.

You can also use
[watch mode](https://esbuild.github.io/api/#watch) to
automatically update the bundle on every code change with

    $ make watch

When developing against a virtual machine, watch mode can also automatically upload
the code changes by setting the `RSYNC` environment variable to
the remote hostname.

    $ RSYNC=c make watch

When developing against a remote host as a normal user, `RSYNC_DEVEL` can be
set to upload code changes to `~/.local/share/cockpit/` instead of
`/usr/local`.

    $ RSYNC_DEVEL=example.com make watch

## Running eslint

Cockpit Podman uses [ESLint](https://eslint.org/) to automatically check
JavaScript code style in `.jsx` and `.js` files.

eslint is executed as part of `test/static-code`, aka. `make codecheck`.

For developer convenience, the ESLint can be started explicitly by:

    $ npm run eslint

Violations of some rules can be fixed automatically by:

    $ npm run eslint:fix

Rules configuration can be found in the `.eslintrc.json` file.

## Running stylelint

Cockpit uses [Stylelint](https://stylelint.io/) to automatically check CSS code
style in `.css` and `scss` files.

styleint is executed as part of `test/static-code`, aka. `make codecheck`.

For developer convenience, the Stylelint can be started explicitly by:

    $ npm run stylelint

Violations of some rules can be fixed automatically by:

    $ npm run stylelint:fix

Rules configuration can be found in the `.stylelintrc.json` file.

# Running tests locally

Run `make vm` to build an RPM and install it into a standard Cockpit test VM.
This will be `fedora-39` by default. You can set `$TEST_OS` to use a different
image, for example

    TEST_OS=centos-9-stream make vm

Then run

    make test/common

to pull in [Cockpit's shared test API](https://github.com/cockpit-project/cockpit/tree/main/test/common)
for running Chrome DevTools Protocol based browser tests.

With this preparation, you can manually run a single test without
rebuilding the VM, possibly with extra options for tracing and halting on test
failures (for interactive debugging):

    TEST_OS=... test/check-application TestApplication.testRunImageSystem -stv

Use this command to list all known tests:

    test/check-application -l

You can also run all of the tests:

    make check

However, this is rather expensive, and most of the time it's better to let the
CI machinery do this on a draft pull request.

Please see [Cockpit's test documentation](https://github.com/cockpit-project/cockpit/blob/main/test/README.md)
for details how to run against existing VMs, interactive browser window,
interacting with the test VM, and more.

# Running tests against a Cockpit pull request

The Cockpit testing infrastructure does not support testing a Cockpit pull
request against a cockpit-podman pull request directly, but this can be
achieved by using the packit copr build from the Cockpit pull request:

    ./bots/tests-trigger fedora-42/copr/packit/cockpit-project-cockpit-$prid
