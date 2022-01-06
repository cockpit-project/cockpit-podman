# Hacking on Cockpit Podman

Here's where to get the code:

    $ git clone https://github.com/cockpit-project/cockpit-podman
    $ cd cockpit-podman

The remainder of the commands assume you're in the top level of the
Cockpit Podman git repository checkout.

For development, you usually want to run your module straight out of the git
tree. To do that, link that to the location were `cockpit-bridge` looks for packages:

```
mkdir -p ~/.local/share/cockpit
ln -s `pwd`/dist ~/.local/share/cockpit/podman
```

After changing the code and running `make` again, reload the Cockpit page in
your browser.

You can also use
[watch mode](https://webpack.js.org/guides/development/#using-watch-mode) to
automatically update the webpack on every code change with

    $ npm run watch

or

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
