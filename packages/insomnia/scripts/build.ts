import childProcess from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import fs from 'fs';
import { rm } from 'fs/promises';
import licenseChecker from 'license-checker';
import { ncp } from 'ncp';
import path from 'path';
import * as vite from 'vite';

import buildMainAndPreload from '../esbuild.main';

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
    fs.mkdirSync(path.dirname(dest), { recursive: true });

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

export const start = async () => {
  console.log('[build] Starting build');

  console.log(
    `[build] npm: ${childProcess.spawnSync('npm', ['--version']).stdout}`.trim()
  );
  console.log(
    `[build] node: ${childProcess.spawnSync('node', ['--version']).stdout}`.trim()
  );

  if (process.version.indexOf('v18.') !== 0) {
    console.log('[build] Node v18.x.x is required to build');
    process.exit(1);
  }

  const buildFolder = path.join('../build');

  // Remove folders first
  console.log('[build] Removing existing directories');
  await rm(path.resolve(__dirname, buildFolder), { recursive: true, force: true });

  // Build the things
  console.log('[build] Building license list');
  await buildLicenseList(
    '../',
    path.join(buildFolder, 'opensource-licenses.txt')
  );

  console.log('[build] Building main.min.js and preload');
  await buildMainAndPreload({
    mode: 'production',
  });

  console.log('[build] Building renderer');

  await vite.build({
    configFile: path.join(__dirname, '..', 'vite.config.ts'),
  });

  // Copy necessary files
  console.log('[build] Copying files');
  await copyFiles('../bin', buildFolder);
  await copyFiles('../src/static', path.join(buildFolder, 'static'));
  await copyFiles('../src/icons', buildFolder);

  console.log('[build] Complete!');
};
