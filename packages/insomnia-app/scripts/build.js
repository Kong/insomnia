const { appConfig } = require('../config');
const childProcess = require('child_process');
const webpack = require('webpack');
const licenseChecker = require('license-checker');
const rimraf = require('rimraf');
const ncp = require('ncp').ncp;
const path = require('path');
const mkdirp = require('mkdirp');
const fs = require('fs');
const { getBuildContext } = require('./getBuildContext');
const { APP_ID_INSOMNIA, APP_ID_DESIGNER } = require('../config');

// Start build if ran from CLI
if (require.main === module) {
  process.nextTick(async () => {
    await module.exports.start(false);
  });
}

module.exports.start = async function(forceFromGitRef) {
  const buildContext = getBuildContext(forceFromGitRef);
  if (!buildContext.smokeTest && !buildContext.version) {
    console.log(`[build] Skipping build for ref "${buildContext.gitRef}"`);
    process.exit(0);
  }

  if (process.env.APP_ID) {
    console.log('Should not set APP_ID for builds. Use Git tag instead');
    process.exit(1);
  }

  // Configure APP_ID env based on what we detected
  if (buildContext.app === 'designer') {
    process.env.APP_ID = APP_ID_DESIGNER;
  } else if (buildContext.app === 'core') {
    process.env.APP_ID = APP_ID_INSOMNIA;
  }

  if (!buildContext.smokeTest && appConfig().version !== buildContext.version) {
    console.log(
      `[build] App version mismatch with Git tag ${appConfig().version} != ${buildContext.version}`,
    );
    process.exit(1);
  }

  // These must be required after APP_ID environment variable is set above
  const configRenderer = require('../webpack/webpack.config.production.babel');
  const configMain = require('../webpack/webpack.config.electron.babel');
  const buildFolder = path.join('../build', appConfig().appId);

  if (buildContext.smokeTest) {
    console.log(`[build] Starting build to smoke test ${buildContext.app}`);
  } else {
    console.log(`[build] Starting build for ref "${buildContext.gitRef}"`);
  }
  console.log(`[build] npm: ${childProcess.spawnSync('npm', ['--version']).stdout}`.trim());
  console.log(`[build] node: ${childProcess.spawnSync('node', ['--version']).stdout}`.trim());

  if (process.version.indexOf('v12.') !== 0) {
    console.log('[build] Node v12.x.x is required to build');
    process.exit(1);
  }

  // Remove folders first
  console.log('[build] Removing existing directories');
  await emptyDir(buildFolder);

  // Build the things
  console.log('[build] Building license list');
  await buildLicenseList('../', path.join(buildFolder, 'opensource-licenses.txt'));
  console.log('[build] Building Webpack renderer');
  await buildWebpack(configRenderer);
  console.log('[build] Building Webpack main');
  await buildWebpack(configMain);

  // Copy necessary files
  console.log('[build] Copying files');
  await copyFiles('../bin', buildFolder);
  await copyFiles('../app/static', path.join(buildFolder, 'static'));
  await copyFiles(`../app/icons/${appConfig().appId}`, buildFolder);

  // Generate necessary files needed by `electron-builder`
  await generatePackageJson('../package.json', path.join(buildFolder, 'package.json'));

  // Install Node modules
  console.log('[build] Installing dependencies');
  await install(buildFolder);

  console.log('[build] Complete!');
  return buildContext;
};

async function buildWebpack(config) {
  return new Promise((resolve, reject) => {
    const compiler = webpack(config);
    compiler.run((err, stats) => {
      if (err) {
        reject(err);
      } else if (stats.hasErrors()) {
        reject(new Error('Failed to build webpack'));
        console.log(stats.toJson().errors);
      } else {
        resolve();
      }
    });
  });
}

async function emptyDir(relPath) {
  return new Promise((resolve, reject) => {
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
}

async function copyFiles(relSource, relDest) {
  return new Promise((resolve, reject) => {
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
}

async function buildLicenseList(relSource, relDest) {
  return new Promise((resolve, reject) => {
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

        const out = [];
        for (const pkgName of Object.keys(packages)) {
          const { licenses, repository, publisher, email, licenseFile: lf } = packages[pkgName];
          const licenseFile = (lf || '').includes('README') ? null : lf;
          const txt = licenseFile ? fs.readFileSync(licenseFile) : '[no license file]';
          const body = [
            '-------------------------------------------------------------------------',
            '',
            `PACKAGE: ${pkgName}`,
            licenses ? `LICENSES: ${licenses}` : null,
            repository ? `REPOSITORY: ${repository}` : null,
            publisher ? `PUBLISHER: ${publisher}` : null,
            email ? `EMAIL: ${email}` : null,
            '\n' + txt,
          ]
            .filter(v => v !== null)
            .join('\n');

          out.push(`${body}\n\n`);
        }

        const header = [
          'This application bundles the following third-party packages in ',
          'accordance with the following licenses:',
          '-------------------------------------------------------------------------',
          '',
          '',
        ].join('\n');

        fs.writeFileSync(dest, header + out.join('\n\n'));
        resolve();
      },
    );
  });
}

async function install(relDir) {
  return new Promise(resolve => {
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
      console.log('child process exited with code ' + code.toString());
      resolve();
    });
  });
}

function generatePackageJson(relBasePkg, relOutPkg) {
  // Read package.json's
  const basePath = path.resolve(__dirname, relBasePkg);
  const outPath = path.resolve(__dirname, relOutPkg);

  const basePkg = JSON.parse(fs.readFileSync(basePath));

  const app = appConfig();
  const appPkg = {
    name: app.name,
    version: app.version,
    productName: app.productName,
    longName: app.longName,
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

  fs.writeFileSync(outPath, JSON.stringify(appPkg, null, 2));
}
