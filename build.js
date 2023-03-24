import fs from 'fs';

import copy from 'esbuild-plugin-copy';
import esbuild from "esbuild";
import { sassPlugin } from 'esbuild-sass-plugin';

import { cockpitCompressPlugin } from './pkg/lib/esbuild-compress-plugin.js';
import { cockpitPoEsbuildPlugin } from './pkg/lib/cockpit-po-plugin.js';
import { cockpitRsyncEsbuildPlugin } from './pkg/lib/cockpit-rsync-plugin.js';
import { cleanPlugin } from './pkg/lib/esbuild-cleanup-plugin.js';
import { eslintPlugin } from './pkg/lib/esbuild-eslint-plugin.js';
import { stylelintPlugin } from './pkg/lib/esbuild-stylelint-plugin.js';

const production = process.env.NODE_ENV === 'production';
const watchMode = process.env.ESBUILD_WATCH === "true" || false;
// linters dominate the build time, so disable them for production builds by default, but enable in watch mode
const lint = process.env.LINT ? (process.env.LINT !== '0') : (watchMode || !production);
/* List of directories to use when resolving import statements */
const nodePaths = ['pkg/lib'];
const outdir = 'dist';

// Obtain package name from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json'));

const getTime = () => new Date().toTimeString()
        .split(' ')[0];

const context = await esbuild.context({
    ...!production ? { sourcemap: "external" } : {},
    bundle: true,
    entryPoints: ["./src/index.js"],
    external: ['*.woff', '*.woff2', '*.jpg', '*.svg', '../../assets*'], // Allow external font files which live in ../../static/fonts
    legalComments: 'external', // Move all legal comments to a .LEGAL.txt file
    loader: { ".js": "jsx" },
    minify: production,
    nodePaths,
    outdir,
    target: ['es2020'],
    plugins: [
        cleanPlugin(),
        ...lint ? [stylelintPlugin(), eslintPlugin()] : [],
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

        ...production ? [cockpitCompressPlugin()] : [],
        cockpitRsyncEsbuildPlugin({ dest: packageJson.name }),

        {
            name: 'notify-end',
            setup(build) {
                build.onEnd(() => console.log(`${getTime()}: Build finished`));
            }
        },
    ]
});

try {
    await context.rebuild();
} catch (e) {
    if (!watchMode)
        process.exit(1);
    // ignore errors in watch mode
}

if (watchMode) {
    // Attention: this does not watch subdirectories -- if you ever introduce one, need to set up one watch per subdir
    fs.watch('src', {}, async (ev, path) => {
        // only listen for "change" events, as renames are noisy
        if (ev !== "change")
            return;
        console.log("change detected:", path);
        await context.cancel();
        try {
            await context.rebuild();
        } catch (e) {} // ignore in watch mode
    });
    // wait forever until Control-C
    await new Promise(() => {});
}

context.dispose();
