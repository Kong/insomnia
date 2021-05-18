import appConfig from '../config/config.json';
import glob from 'fast-glob';
import { promises } from 'fs';
import { basename, posix } from 'path';
import { start as packageApp } from './package';
import { start as build } from './build';
import { Octokit } from '@octokit/rest';
const { readFile } = promises;

// Configure Octokit
const octokit = new Octokit({
  auth: process.env.GH_TOKEN,
});

const getOrCreateRelease = async (app: string, version: string) => {
  const tag = `${app}@${version}`;
  const releaseName = `${appConfig.productName} ${version} 📦`;

  // Try get a release by the tag; if we can't create one
  try {
    return await octokit.repos.getReleaseByTag({
      owner: appConfig.githubOrg,
      repo: appConfig.githubRepo,
      tag,
    });
  } catch (err) {
    // Doesn't exist
  }

  return await octokit.repos.createRelease({
    owner: appConfig.githubOrg,
    repo: appConfig.githubRepo,
    // eslint-disable-next-line camelcase -- part of the octokit API
    tag_name: tag,
    name: releaseName,
    body: `Full changelog ⇒ ${appConfig.changelogUrl}`,
    draft: false,
    prerelease: true,
  });
};

const start = async (app?: string | null, version?: string | null) => {
  if (app === null || app === undefined || app === '') {
    console.log('[release] app not found. Cannot create a release.');
    process.exit(0);
  }
  if (version === null || version === undefined || version === '') {
    console.log('[release] version not found. Cannot create a release.');
    process.exit(0);
  }

  console.log(`[release] Creating release for ${app} ${version}`);

  // globs should only use forward slash, so force use of posix
  const distGlob = (ext: string) => posix.join('dist', '**', `*${ext}`);
  const assetGlobs = {
    darwin: [distGlob('.zip'), distGlob('.dmg')],
    win32: [posix.join('dist', 'squirrel-windows', '*'), posix.join('dist', '*.exe')],
    linux: [
      distGlob('.snap'),
      distGlob('.rpm'),
      distGlob('.deb'),
      distGlob('.AppImage'),
      distGlob('.tar.gz'),
    ],
  };

  const { data } = await getOrCreateRelease(app, version);

  const paths = await glob(assetGlobs[process.platform]);
  for (const path of paths) {
    const name = basename(path);

    console.log(`[release] Uploading ${name}`);
    await octokit.request({
      method: 'POST',
      url: 'https://uploads.github.com/repos/:owner/:repo/releases/:id/assets{?name,label}"',
      id: data.id,
      name,
      owner: appConfig.githubOrg,
      repo: appConfig.githubRepo,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      data: await readFile(path),
    });
  }

  console.log(`[release] Release created ${data.url}`);
};

// Start package if run from CLI
if (require.main === module) {
  process.nextTick(async () => {
    try {
      const { app, version } = await build({ forceFromGitRef: true });
      await packageApp();
      await start(app, version);
    } catch (err) {
      console.log('[release] ERROR:', err);
      process.exit(1);
    }
  });
}
