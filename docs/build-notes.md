# Building the plugin

These are some basic notes on building the plugin

## yarn

The subscription-manager plugin for cockpit is built using webpack 2.x.  Although npm can be used to install the various
dependencies, it is recommended to install [yarn][-yarnpkg] and use it instead:

```
yarn install
```

After this command finishes, all the node_modules will be installed.

## babel

The .babelrc file contains the settings for the various things babel can do, namely transform es6 to es5 code, and to
transform react jsx code to regular javascript. When building, the webpack.config.js setting will output a bundled file
in ./build/bundle.js.  It will run the babel-loader plugin to transform es6 to es5

**TODO**: Figure out how to configure babelrc to transform jsx code

## index.js

This is the entry point for webpack, and will most likely contain the main parent react component.


## Directory layout

The main package files are located in the [src](src) directory. These are processed during compilation and
packaging.

## Building

You can use `make` to compile to code or `make install` to compile and install in `/usr/share/cockpit/`.

The convenience make targets `srpm` and `rpm` build the source and binary rpms, respectively. Both of these make
use of the `dist-gzip` target, which is used to generate the distribution tarball. In `production` mode, source files
are automatically minified and compressed. Set `NODE_ENV=production` if you want to duplicate this behavior.

Optionally, you can use `yarn` or `npm` to run the build, both of which in turn call `webpack`:

```
yarn run build
```

or alternatively if you didn't install yarn:

```
npm run build
```

This works because the package.json file has a scripts object, and the build key tells us to run the webpack command
with the build option.

Why do it this way instead of just doing `npm install -g webpack` and then `webpack build`?  By doing that, different
users trying to build the plugin might have different versions of webpack installed.  By installing webpack as a dev
dependency, and then using yarn or npm to run a command, it will use the webpack version installed locally.

[-yarnpkg]: https://yarnpkg.com

## Hacking with webpack
A fairly simple workflow for development uses webpack directly and doesn't require root privileges.

First, ensure that all dependencies are met and the code compiles:
```
npm install
make
```

Then, link the `dist` directory in a place where cockpit can find it, without installing to the system directory.
Call the following script from the git checkout:
```
ln -s ln -s ./dist subscription-manager
```

Then use webpack to monitor the filesystem for changes, also from the git checkout:
```
webpack --watch
```

After logging into Cockpit, you can refresh the page to load the newly built code after each change to the source files.
