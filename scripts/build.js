const npm = require('npm');
const webpack = require('webpack');
const rimraf = require('rimraf');
const ncp = require('ncp').ncp;
const path = require('path');
const mkdirp = require('mkdirp');
const configRenderer = require('../webpack/webpack.config.production.babel');
const configMain = require('../webpack/webpack.config.electron.babel');

async function run () {
  // Remove folders first
  console.log('[build] Removing existing directories');
  await emptyDir('../build');

  // Build the things
  console.log('[build] Building Webpack');
  await buildWebpack(configRenderer);
  await buildWebpack(configMain);

  // Copy necessary files
  console.log('[build] Copying files');
  await copyFiles('../app/package.json', '../build/package.json');
  await copyFiles('../app/package-lock.json', '../build/package-lock.json');
  await copyFiles('../bin', '../build/');
  await copyFiles('../app/static', '../build/static');
  await copyFiles('../app/icons/', '../build/');

  // Install Node modules
  console.log('[build] Installing dependencies');
  await install('../build/');

  console.log('[build] Complete!');
}

async function buildWebpack (config) {
  return new Promise((resolve, reject) => {
    webpack(config, (err, stats) => {
      if (err || stats.hasErrors()) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function emptyDir (relPath) {
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

async function copyFiles (relSource, relDest) {
  return new Promise((resolve, reject) => {
    const source = path.resolve(__dirname, relSource);
    const dest = path.resolve(__dirname, relDest);
    ncp(source, dest, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function install (relDir) {
  return new Promise((resolve, reject) => {
    const prefix = path.resolve(__dirname, relDir);
    npm.load({prefix}, err => {
      if (err) {
        return reject(err);
      }

      npm.commands.install([prefix], err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

run();
