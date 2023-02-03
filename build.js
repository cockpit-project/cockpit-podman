import fs from 'fs';

import copy from 'esbuild-plugin-copy';
import esbuild from "esbuild";
import { sassPlugin } from 'esbuild-sass-plugin';

import { cockpitCompressPlugin } from './pkg/lib/esbuild-compress-plugin.js';
import { cockpitPoEsbuildPlugin } from './pkg/lib/cockpit-po-plugin.js';
import { cockpitRsyncEsbuildPlugin } from './pkg/lib/cockpit-rsync-plugin.js';
import { eslintPlugin } from './pkg/lib/esbuild-eslint-plugin.js';
import { stylelintPlugin } from './pkg/lib/esbuild-stylelint-plugin.js';

const production = process.env.NODE_ENV === 'production';
const watchMode = process.env.ESBUILD_WATCH === "true" || false;
// linters dominate the build time, so disable them for production builds by default, but enable in watch mode
const lint = process.env.LINT ? (process.env.LINT !== '0') : (watchMode || !production);
/* List of directories to use when resolving import statements */
const nodePaths = ['pkg/lib'];
const outdir = 'dist';

// always start with a fresh dist/ directory, to change between development and production, or clean up gzipped files
const cleanPlugin = {
    name: 'clean-dist',
    setup(build) {
        build.onStart(() => {
            try {
                fs.rmSync(outdir, { recursive: true });
            } catch (e) {
                if (e.code !== 'ENOENT')
                    throw e;
            }
        });
    }
};

// Obtain package name from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json'));

const context = await esbuild.context({
    ...!production ? { sourcemap: "external" } : {},
    bundle: true,
    entryPoints: ["./src/index.js"],
    external: ['*.woff', '*.woff2', '*.jpg', '*.svg', '../../assets*'], // Allow external font files which live in ../../static/fonts
    legalComments: 'external', // Move all legal comments to a .LEGAL.txt file
    loader: { ".js": "jsx" },
    // show "build started/finished" messages in watch mode
    logLevel: 'info',
    minify: production,
    nodePaths,
    outdir,
    target: ['es2020'],
    plugins: [
        cleanPlugin,
        ...lint ? [stylelintPlugin(), eslintPlugin] : [],
        // Esbuild will only copy assets that are explicitly imported and used
        // in the code. This is a problem for index.html and manifest.json which are not imported
        copy({
            assets: [
                { from: ['./src/manifest.json'], to: ['./manifest.json'] },
                { from: ['./src/index.html'], to: ['./index.html'] },
            ]
        }),
        sassPlugin({
            loadPaths: [...nodePaths, 'node_modules'],
            quietDeps: true,
            async transform(source, resolveDir, path) {
                if (path.includes('patternfly-4-cockpit.scss')) {
                    return source
                            .replace(/url.*patternfly-icons-fake-path.*;/g, 'url("../base1/fonts/patternfly.woff") format("woff");')
                            .replace(/@font-face[^}]*patternfly-fonts-fake-path[^}]*}/g, '');
                }
                return source;
            }
        }),
        cockpitPoEsbuildPlugin(),

        ...production ? [cockpitCompressPlugin] : [],
        cockpitRsyncEsbuildPlugin({ dest: packageJson.name }),
    ]
});

if (watchMode)
    await context.watch();
else {
    await context.rebuild();
    context.dispose();
}
