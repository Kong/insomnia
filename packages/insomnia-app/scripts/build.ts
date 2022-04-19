import childProcess from 'child_process';
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import licenseChecker from 'license-checker';
import mkdirp from 'mkdirp';
import { ncp } from 'ncp';
import path from 'path';
import rimraf from 'rimraf';
import * as vite from 'vite';

import appConfig from '../config/config.json';
import buildMain from '../esbuild.main';
import pkg from '../package.json';

// Start build if ran from CLI
if (require.main === module) {
  process.nextTick(async () => {
    try {
      await module.exports.start();
    } catch (err) {
      console.log('[build] ERROR:', err);
      process.exit(1);
    }
  });
}

const emptyDir = (relPath: string) =>
  new Promise<void>((resolve, reject) => {
    const dir = path.resolve(__dirname, relPath);
    rimraf(dir, err => {
      if (err) {
        reject(err);
      } else {
        mkdirp.sync(dir);
        resolve();
      }
    });
  });

const copyFiles = (relSource: string, relDest: string) =>
  new Promise<void>((resolve, reject) => {
    const source = path.resolve(__dirname, relSource);
    const dest = path.resolve(__dirname, relDest);
    console.log(`[build] copy "${relSource}" to "${relDest}"`);
    ncp(source, dest, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

const buildLicenseList = (relSource: string, relDest: string) =>
  new Promise<void>((resolve, reject) => {
    const source = path.resolve(__dirname, relSource);
    const dest = path.resolve(__dirname, relDest);
    mkdirp.sync(path.dirname(dest));

    licenseChecker.init(
      {
        start: source,
        production: true,
      },
      (err, packages) => {
        if (err) {
          return reject(err);
        }

        const header = [
          'This application bundles the following third-party packages in ',
          'accordance with the following licenses:',
          '-------------------------------------------------------------------------',
          '',
          '',
        ].join('\n');

        const out = Object.keys(packages)
          .sort()
          .map(packageName => {
            const {
              licenses,
              repository,
              publisher,
              email,
              licenseFile: lf,
            } = packages[packageName];
            const licenseFile = (lf || '').includes('README') ? null : lf;
            return [
              '-------------------------------------------------------------------------',
              '',
              `PACKAGE: ${packageName}`,
              licenses ? `LICENSES: ${licenses}` : null,
              repository ? `REPOSITORY: ${repository}` : null,
              publisher ? `PUBLISHER: ${publisher}` : null,
              email ? `EMAIL: ${email}` : null,
              '',
              licenseFile ? readFileSync(licenseFile) : '[no license file]',
              '',
              '',
            ]
              .filter(v => v !== null)
              .join('\n');
          })
          .join('\n');

        writeFileSync(dest, `${header}${out}`);
        resolve();
      }
    );
  });

const install = () =>
  new Promise<void>((resolve, reject) => {
    const root = path.resolve(__dirname, '../../../');

    const p = childProcess.spawn('npm', ['run', 'bootstrap:electron-builder'], {
      cwd: root,
      shell: true,
    });

    p.stdout.on('data', data => {
      console.log(data.toString());
    });

    p.stderr.on('data', data => {
      console.log(data.toString());
    });

    p.on('exit', code => {
      console.log(`child process exited with code ${code}`);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('[build] failed to install dependencies'));
      }
    });
  });

const generatePackageJson = async (relBasePkg: string, relOutPkg: string) => {
  // Figure out which dependencies to pack
  const allDependencies = Object.keys(pkg.dependencies);
  const packedDependencies = pkg.packedDependencies;
  const unpackedDependencies = allDependencies.filter(
    name => !packedDependencies.includes(name)
  );
  const outPath = path.resolve(__dirname, relOutPkg);

  const appPkg = {
    name: appConfig.name,
    version: appConfig.version,
    productName: appConfig.productName,
    description: pkg.description,
    license: pkg.license,
    homepage: pkg.homepage,
    author: pkg.author,
    copyright: `Copyright © ${new Date().getFullYear()} ${pkg.author}`,
    main: 'main.min.js',
    dependencies: {},
  };

  console.log(
    `[build] Generated build config for ${appPkg.name} ${appPkg.version}`
  );

  for (const key of Object.keys(appPkg)) {
    if (key === undefined) {
      throw new Error(`[build] missing "app.${key}" from package.json`);
    }
  }

  // Add dependencies
  console.log(
    `[build] Adding ${unpackedDependencies.length} node dependencies`
  );
  for (const name of unpackedDependencies) {
    const version = pkg.dependencies[name];
    if (!version) {
      throw new Error(`Failed to find packed dep "${name}" in dependencies`);
    }
    appPkg.dependencies[name] = version;
  }

  const outputFile = JSON.stringify(appPkg, null, 2);
  await writeFile(outPath, outputFile);
};

export const start = async () => {
  console.log('[build] Starting build');

  console.log(
    `[build] npm: ${childProcess.spawnSync('npm', ['--version']).stdout}`.trim()
  );
  console.log(
    `[build] node: ${
      childProcess.spawnSync('node', ['--version']).stdout
    }`.trim()
  );

  if (process.version.indexOf('v16.') !== 0) {
    console.log('[build] Node v16.x.x is required to build');
    process.exit(1);
  }

  const buildFolder = path.join('../build');

  // Remove folders first
  console.log('[build] Removing existing directories');
  await emptyDir(buildFolder);

  // Build the things
  console.log('[build] Building license list');
  await buildLicenseList(
    '../',
    path.join(buildFolder, 'opensource-licenses.txt')
  );

  console.log('[build] Building main.min.js');
  await buildMain({
    mode: 'production',
  });

  console.log('[build] Building preload');
  await build({
    entryPoints: [path.join(__dirname, '../app/preload.js')],
    outfile: path.join(__dirname, '../build/preload.js'),
    platform: 'node',
    bundle: true,
    target: 'esnext',
    sourcemap: false,
    format: 'esm',
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    minify: true,
    external: ['electron'],
  });

  console.log('[build] Building renderer');

  await vite.build({
    configFile: path.join(__dirname, '..', 'vite.config.ts'),
  });

  // Copy necessary files
  console.log('[build] Copying files');
  await copyFiles('../bin', buildFolder);
  await copyFiles('../app/static', path.join(buildFolder, 'static'));
  await copyFiles('../app/icons', buildFolder);

  // Generate necessary files needed by `electron-builder`
  await generatePackageJson(
    '../package.json',
    path.join(buildFolder, 'package.json')
  );

  // Install Node modules
  console.log('[build] Installing dependencies');
  await install();

  console.log('[build] Complete!');
};
