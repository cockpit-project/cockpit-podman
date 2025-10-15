#!/usr/bin/env node

import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import process from 'node:process';

import { sassPlugin } from 'esbuild-sass-plugin';

import { cockpitPoEsbuildPlugin } from './pkg/lib/cockpit-po-plugin.js';
import { cockpitRsyncEsbuildPlugin } from './pkg/lib/cockpit-rsync-plugin.js';
import { cleanPlugin } from './pkg/lib/esbuild-cleanup-plugin.js';
import { cockpitCompressPlugin } from './pkg/lib/esbuild-compress-plugin.js';

const useWasm = os.arch() !== 'x64';

const esbuild = await (async () => {
    try {
        // Try node_modules first for installs with devDependencies
        return (await import(useWasm ? 'esbuild-wasm' : 'esbuild')).default;
    } catch (e) {
        if (e.code !== 'ERR_MODULE_NOT_FOUND')
            throw e;

        // Fall back to distro package (e.g. Debian's /usr/lib/*/nodejs/esbuild)
        // Use createRequire to leverage Node's module resolution which searches system paths
        // Use require.resolve to find esbuild in system paths, then import it
        const require = createRequire(import.meta.url);
        return (await import(require.resolve('esbuild'))).default;
    }
})();

const production = process.env.NODE_ENV === 'production';
/* List of directories to use when resolving import statements */
const nodePaths = ['pkg/lib'];
const outdir = 'dist';

// Obtain package name from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json'));

const parser = (await import('argparse')).default.ArgumentParser();
parser.add_argument('-r', '--rsync', { help: "rsync bundles to ssh target after build", metavar: "HOST" });
parser.add_argument('-w', '--watch', { action: 'store_true', help: "Enable watch mode", default: process.env.ESBUILD_WATCH === "true" });
const args = parser.parse_args();

if (args.rsync)
    process.env.RSYNC = args.rsync;

function notifyEndPlugin() {
    return {
        name: 'notify-end',
        setup(build) {
            let startTime;

            build.onStart(() => {
                startTime = new Date();
            });

            build.onEnd(() => {
                const endTime = new Date();
                const timeStamp = endTime.toTimeString().split(' ')[0];
                console.log(`${timeStamp}: Build finished in ${endTime - startTime} ms`);
            });
        }
    };
}

const context = await esbuild.context({
    ...!production ? { sourcemap: "linked" } : {},
    bundle: true,
    entryPoints: ["./src/index.js"],
    external: ['*.woff', '*.woff2', '*.jpg', '*.svg', '../../assets*'], // Allow external font files which live in ../../static/fonts
    legalComments: 'external', // Move all legal comments to a .LEGAL.txt file
    loader: { ".js": "jsx", ".py": "text" },
    minify: production,
    nodePaths,
    outdir,
    metafile: true,
    target: ['es2020'],
    plugins: [
        cleanPlugin(),

        // Esbuild will only copy assets that are explicitly imported and used in the code.
        // Copy the other files here.
        {
            name: 'copy-assets',
            setup(build) {
                build.onEnd((output, _outputFiles) => {
                    if (output?.errors.length === 0) {
                        fs.copyFileSync('./src/manifest.json', './dist/manifest.json');
                        fs.copyFileSync('./src/index.html', './dist/index.html');
                    }
                });
            }
        },

        sassPlugin({
            loadPaths: [...nodePaths, 'node_modules'],
            filter: /\.scss/,
            quietDeps: true,
        }),

        cockpitPoEsbuildPlugin(),

        ...production ? [cockpitCompressPlugin()] : [],
        cockpitRsyncEsbuildPlugin({ dest: packageJson.name }),

        notifyEndPlugin(),
    ]
});

try {
    const result = await context.rebuild();

    // skip metafile and runtime module calculation in watch mode
    if (!args.watch) {
        fs.writeFileSync('metafile.json', JSON.stringify(result.metafile));

        // Extract bundled npm packages for dependency tracking
        const bundledPackages = new Set();
        for (const inputPath of Object.keys(result.metafile.inputs)) {
            // Match paths like node_modules/package-name/ or node_modules/@scope/package-name/
            const match = inputPath.match(/^node_modules\/(@[^/]+\/[^/]+|[^/]+)\//);
            if (match)
                bundledPackages.add(match[1]);
        }

        // Look up versions from package-lock.json and output simple format
        const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
        const deps = [];
        for (const pkgName of Array.from(bundledPackages).sort()) {
            const lockKey = `node_modules/${pkgName}`;
            const pkgInfo = packageLock.packages?.[lockKey];
            if (pkgInfo?.version)
                deps.push(`${pkgName} ${pkgInfo.version}`);
            else
                console.error(`Warning: Could not find version for ${pkgName}`);
        }
        fs.writeFileSync('runtime-npm-modules.txt', deps.join('\n') + '\n');
    }
} catch (e) {
    if (!args.watch)
        process.exit(1);
    // ignore errors in watch mode
}

if (args.watch) {
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
