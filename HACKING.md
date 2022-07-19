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
[watch mode](https://webpack.js.org/guides/development/#using-watch-mode) to
automatically update the webpack on every code change with

    $ make watch

When developing against a virtual machine, webpack can also automatically upload
the code changes by setting the `RSYNC` environment variable to
the remote hostname.

    $ RSYNC=c make watch

## Running eslint

Cockpit Podman uses [ESLint](https://eslint.org/) to automatically check
JavaScript code style in `.jsx` and `.js` files.

The linter is executed within every build as a webpack preloader.

For developer convenience, the ESLint can be started explicitly by:

    $ npm run eslint

Violations of some rules can be fixed automatically by:

    $ npm run eslint:fix

Rules configuration can be found in the `.eslintrc.json` file.

## Running stylelint

Cockpit uses [Stylelint](https://stylelint.io/) to automatically check CSS code
style in `.css` and `scss` files.

The linter is executed within every build as a webpack preloader.

For developer convenience, the Stylelint can be started explicitly by:

    $ npm run stylelint

Violations of some rules can be fixed automatically by:

    $ npm run stylelint:fix

Rules configuration can be found in the `.stylelintrc.json` file.

During fast iterative development, you can also choose to not run stylelint.
This speeds up the build and avoids build failures due to e. g. ill-formatted
css or other issues:

    $ make STYLELINT=0

# Running tests locally

Run `make vm` to build an RPM and install it into a standard Cockpit test VM.
This will be `fedora-35` by default. You can set `$TEST_OS` to use a different
image, for example

    TEST_OS=centos-8-stream make vm

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

    TEST_OS=centos-8-stream make check

However, this is rather expensive, and most of the time it's better to let the
CI machinery do this on a draft pull request.

Please see [Cockpit's test documentation](https://github.com/cockpit-project/cockpit/blob/main/test/README.md)
for details how to run against existing VMs, interactive browser window,
interacting with the test VM, and more.
