const path = require("path");
const copy = require("copy-webpack-plugin");
const extract = require("mini-css-extract-plugin");
const TerserJSPlugin = require('terser-webpack-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const webpack = require("webpack");
const CompressionPlugin = require("compression-webpack-plugin");

const nodedir = path.resolve((process.env.SRCDIR || __dirname), "node_modules");
const libdir = (process.env.SRCDIR || __dirname) + path.sep + "lib";
/* A standard nodejs and webpack pattern */
var production = process.env.NODE_ENV === 'production';

// Non-JS files which are copied verbatim to dist/
const copy_files = [
    "./src/index.html",
    "./src/manifest.json",
];

const plugins = [
    new copy({ patterns: copy_files }),
    new extract({filename: "[name].css"})
];

/* Only minimize when in production mode */
if (production) {
    plugins.unshift(new CompressionPlugin({
        test: /\.(js|html)$/,
        minRatio: 0.9,
        deleteOriginalAssets: true
    }));
}

module.exports = {
    mode: production ? 'production' : 'development',
    resolve: {
        alias: { 'font-awesome': path.resolve(nodedir, 'font-awesome-sass/assets/stylesheets') },
    },
    watchOptions: {
        ignored: /node_modules/,
    },
    entry: {
        index: "./src/index.js",
    },
    // cockpit.js gets included via <script>, everything else should be bundled
    externals: { "cockpit": "cockpit" },
    devtool: "source-map",
    stats: "errors-warnings",

    optimization: {
        minimize: production,
        minimizer: [new TerserJSPlugin({}), new OptimizeCSSAssetsPlugin({})],
    },

    module: {
        rules: [
            {
                enforce: 'pre',
                exclude: /node_modules/,
                loader: 'eslint-loader',
                test: /\.(jsx|js)$/
            },
            {
                exclude: /node_modules/,
                loader: 'babel-loader',
                test: /\.(jsx|js)$/
            },
            /* HACK: remove unwanted fonts from PatternFly's css */
            {
                test: /patternfly-4-cockpit.scss$/,
                use: [
                    extract.loader,
                    {
                        loader: 'css-loader',
                        options: {
                            sourceMap: true,
                            url: false,
                        },
                    },
                    {
                        loader: 'string-replace-loader',
                        options: {
                            multiple: [
                                {
                                    search: /src:url[(]"patternfly-fonts-fake-path\/PatternFlyIcons[^}]*/g,
                                    replace: 'src:url("../base1/fonts/patternfly.woff") format("woff");',
                                },
                                {
                                    search: /src:url[(]"patternfly-fonts-fake-path\/fontawesome[^}]*/,
                                    replace: 'font-display:block; src:url("../base1/fonts/fontawesome.woff?v=4.2.0") format("woff");',
                                },
                                {
                                    search: /src:url\("patternfly-icons-fake-path\/pficon[^}]*/g,
                                    replace: 'src:url("../base1/fonts/patternfly.woff") format("woff");',
                                },
                                {
                                    search: /@font-face[^}]*patternfly-fonts-fake-path[^}]*}/g,
                                    replace: '',
                                },
                            ]
                        },
                    },
                    {
                        loader: 'sass-loader',
                        options: {
                            sassOptions: {
                                outputStyle: 'compressed',
                            },
                            sourceMap: true,
                        },
                    },
                ]
            },
            {
                test: /\.s?css$/,
                exclude: /patternfly-4-cockpit.scss/,
                use: [
                    extract.loader,
                    {
                        loader: 'css-loader',
                        options: {
                            sourceMap: true,
                            url: false
                        }
                    },
                    {
                        loader: 'sass-loader',
                        options: {
                            sourceMap: true,
                            sassOptions: {
                                includePaths: [ path.resolve(nodedir) ],
                                outputStyle: 'compressed',
                            }
                        }
                    },
                ]
            },
        ]
    },
    plugins: plugins
}
