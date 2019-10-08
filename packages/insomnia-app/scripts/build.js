const packageJson = require('../package.json');
const childProcess = require('child_process');
const webpack = require('webpack');
const rimraf = require('rimraf');
const ncp = require('ncp').ncp;
const path = require('path');
const mkdirp = require('mkdirp');
const fs = require('fs');
const configRenderer = require('../webpack/webpack.config.production.babel');
const configMain = require('../webpack/webpack.config.electron.babel');

// Start build if ran from CLI
if (require.main === module) {
  process.nextTick(async () => {
    await module.exports.start();
  });
}

module.exports.start = async function() {
  console.log('[build] Starting build');
  console.log('[build] npm: ' + childProcess.spawnSync('npm', ['--version']).stdout);
  console.log('[build] node: ' + childProcess.spawnSync('node', ['--version']).stdout);

  // Remove folders first
  console.log('[build] Removing existing directories');
  await emptyDir('../build');

  // Build the things
  console.log('[build] Building Webpack renderer');
  await buildWebpack(configRenderer);
  console.log('[build] Building Webpack main');
  await buildWebpack(configMain);

  // Copy necessary files
  console.log('[build] Copying files');
  await copyFiles('../bin', '../build/');
  await copyFiles('../app/static', '../build/static');
  await copyFiles('../app/icons/', '../build/');

  // Generate package.json
  await generatePackageJson('../package.json', '../build/package.json');

  // Install Node modules
  console.log('[build] Installing dependencies');
  await install('../build/');

  console.log('[build] Complete!');
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
    console.log(`[build] copy ${source} to ${dest}`);
    ncp(source, dest, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function install(relDir) {
  return new Promise(resolve => {
    const prefix = path.resolve(__dirname, relDir);

    // // Link all plugins
    // const plugins = path.resolve(__dirname, `../../../plugins`);
    // for (const dir of fs.readdirSync(plugins)) {
    //   if (dir.indexOf('.') === 0) {
    //     continue;
    //   }
    //
    //   console.log(`[build] Linking plugin ${dir}`);
    //   const p = path.join(plugins, dir);
    //   childProcess.spawnSync('npm', ['link', p], {
    //     cwd: prefix,
    //     shell: true,
    //   });
    // }

    // // Link all packages
    // const packages = path.resolve(__dirname, `../../../packages`);
    // for (const dir of fs.readdirSync(packages)) {
    //   // Don't like ourselves
    //   if (dir === packageJson.name) {
    //     continue;
    //   }
    //
    //   if (dir.indexOf('.') === 0) {
    //     continue;
    //   }
    //
    //   console.log(`[build] Linking local package ${dir}`);
    //   const p = path.join(packages, dir);
    //   childProcess.spawnSync('npm', ['link', p], { cwd: prefix, shell: true });
    // }

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

  const appPkg = {
    name: packageJson.app.name,
    version: basePkg.app.version,
    productName: basePkg.app.productName,
    longName: basePkg.app.longName,
    description: basePkg.description,
    license: basePkg.license,
    homepage: basePkg.homepage,
    author: basePkg.author,
    main: 'main.min.js',
    dependencies: {},
  };

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
  for (const name of unpackedDependencies) {
    const version = basePkg.dependencies[name];
    if (!version) {
      throw new Error(`Failed to find packed dep "${name}" in dependencies`);
    }
    appPkg.dependencies[name] = version;
    console.log(`[build] Adding native Node dep ${name}`);
  }

  fs.writeFileSync(outPath, JSON.stringify(appPkg, null, 2));
}
