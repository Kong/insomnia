import childProcess from 'child_process';
import { promises, readFileSync, writeFileSync } from 'fs';
import licenseChecker from 'license-checker';
import mkdirp from 'mkdirp';
import { ncp } from 'ncp';
import path from 'path';
import rimraf from 'rimraf';
import webpack from 'webpack';

import appConfig from '../config/config.json';
import electronWebpackConfig from '../webpack/webpack.config.electron';
import productionWebpackConfig from '../webpack/webpack.config.production';
import { getBuildContext } from './getBuildContext';

const { readFile, writeFile } = promises;

// Start build if ran from CLI
if (require.main === module) {
  process.nextTick(async () => {
    try {
      await module.exports.start(false);
    } catch (err) {
      console.log('[build] ERROR:', err);
      process.exit(1);
    }
  });
}

const buildWebpack = (config: webpack.Configuration) => new Promise<void>((resolve, reject) => {
  webpack(config).run((err, stats) => {
    if (err) {
      reject(err);
      return;
    }

    if (stats?.hasErrors()) {
      reject(new Error('Failed to build webpack'));
      console.log(stats.toJson().errors);
      return;
    }

    resolve();
  });
});

const emptyDir = (relPath: string) => new Promise<void>((resolve, reject) => {
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

const copyFiles = (relSource: string, relDest: string) => new Promise<void>((resolve, reject) => {
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

const buildLicenseList = (relSource: string, relDest: string) => new Promise<void>((resolve, reject) => {
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

      const out = Object.keys(packages).sort().map(packageName => {
        const { licenses, repository, publisher, email, licenseFile: lf } = packages[packageName];
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
        ].filter(v => v !== null).join('\n');
      }).join('\n');

      writeFileSync(dest, `${header}${out}`);
      resolve();
    },
  );
});

const install = (relDir: string) => new Promise<void>((resolve, reject) => {
  const prefix = path.resolve(__dirname, relDir);

  const p = childProcess.spawn('npm', ['install', '--production', '--no-optional'], {
    cwd: prefix,
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
  // Read package.json's
  const basePath = path.resolve(__dirname, relBasePkg);
  const outPath = path.resolve(__dirname, relOutPkg);

  const inputFile = String(await readFile(basePath));
  const basePkg = JSON.parse(inputFile);

  const appPkg = {
    name: appConfig.name,
    version: appConfig.version,
    productName: appConfig.productName,
    longName: appConfig.longName,
    description: basePkg.description,
    license: basePkg.license,
    homepage: basePkg.homepage,
    author: basePkg.author,
    copyright: `Copyright © ${new Date().getFullYear()} ${basePkg.author}`,
    main: 'main.min.js',
    dependencies: {},
  };

  console.log(`[build] Generated build config for ${appPkg.name} ${appPkg.version}`);

  for (const key of Object.keys(appPkg)) {
    if (key === undefined) {
      throw new Error(`[build] missing "app.${key}" from package.json`);
    }
  }

  // Figure out which dependencies to pack
  const allDependencies = Object.keys(basePkg.dependencies);
  const packedDependencies = basePkg.packedDependencies;
  const unpackedDependencies = allDependencies.filter(name => !packedDependencies.includes(name));

  // Add dependencies
  console.log(`[build] Adding ${unpackedDependencies.length} node dependencies`);
  for (const name of unpackedDependencies) {
    const version = basePkg.dependencies[name];
    if (!version) {
      throw new Error(`Failed to find packed dep "${name}" in dependencies`);
    }
    appPkg.dependencies[name] = version;
  }

  const outputFile = JSON.stringify(appPkg, null, 2);
  await writeFile(outPath, outputFile);
};

export const start = async ({ forceFromGitRef }: { forceFromGitRef: boolean }) => {
  const buildContext = getBuildContext(forceFromGitRef);
  const { gitRef, smokeTest, version } = buildContext;

  if (smokeTest) {
    console.log('[build] Starting build to smoke test');
  } else {
    if (!version) {
      if (!gitRef) {
        console.log('[build] No git ref found. Check for the presence of a `GIT_TAG`, `GITHUB_REF`, `TRAVIS_TAG`, or `TRAVIS_CURRENT_BRANCH` environment variable');
      } else {
        console.log(`[build] git ref \`${gitRef}\` found`);
      }
      console.log('[build] Skipping build because no version was found (the version is derived from the git ref)');
      process.exit(1);
    }

    if (appConfig.version !== version) {
      const tags = `${appConfig.version} != ${version}`;
      console.log(`[build] App version mismatch with Git tag ${tags}`);
      process.exit(1);
    }
    console.log(`[build] Starting build for ref "${gitRef}"`);
  }

  console.log(`[build] npm: ${childProcess.spawnSync('npm', ['--version']).stdout}`.trim());
  console.log(`[build] node: ${childProcess.spawnSync('node', ['--version']).stdout}`.trim());

  if (process.version.indexOf('v14.') !== 0) {
    console.log('[build] Node v14.x.x is required to build');
    process.exit(1);
  }

  const buildFolder = path.join('../build');

  // Remove folders first
  console.log('[build] Removing existing directories');
  await emptyDir(buildFolder);

  // Build the things
  console.log('[build] Building license list');
  await buildLicenseList('../', path.join(buildFolder, 'opensource-licenses.txt'));

  console.log('[build] Building Webpack renderer');
  await buildWebpack(productionWebpackConfig as webpack.Configuration);

  console.log('[build] Building Webpack main');
  await buildWebpack(electronWebpackConfig as webpack.Configuration);

  // Copy necessary files
  console.log('[build] Copying files');
  await copyFiles('../bin', buildFolder);
  await copyFiles('../app/static', path.join(buildFolder, 'static'));
  await copyFiles('../app/icons', buildFolder);

  // Generate necessary files needed by `electron-builder`
  await generatePackageJson('../package.json', path.join(buildFolder, 'package.json'));

  // Install Node modules
  console.log('[build] Installing dependencies');
  await install(buildFolder);

  console.log('[build] Complete!');
  return buildContext;
};
