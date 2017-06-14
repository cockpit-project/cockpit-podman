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

**TODO**: describe the high level layout of the folders, eg. component folder is for react components.

# Making a build

To actually build the plugin, simply run:

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
