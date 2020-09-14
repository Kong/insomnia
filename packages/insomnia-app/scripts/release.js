const { appConfig } = require('../config');
const glob = require('fast-glob');
const fs = require('fs');
const path = require('path');
const packageTask = require('./package');
const buildTask = require('./build');
const { Octokit } = require('@octokit/rest');

// Configure Octokit
const octokit = new Octokit({
  auth: process.env.GH_TOKEN,
});

// Start package if ran from CLI
if (require.main === module) {
  process.nextTick(async () => {
    try {
      const buildContext = await buildTask.start(true);
      await packageTask.start();
      await start(buildContext.app, buildContext.version);
    } catch (err) {
      console.log('[release] ERROR:', err);
      process.exit(1);
    }
  });
}

async function start(app, version) {
  console.log(`[release] Creating release for ${app} ${version}`);
  const appId = appConfig().appId;

  // globs should only use forward slash, so force use of path.posix
  const distGlob = ext => path.posix.join('dist', appId, '**', `*${ext}`);
  const assetGlobs = {
    darwin: [distGlob('.zip'), distGlob('.dmg')],
    win32: [path.posix.join('dist', appId, 'squirrel-windows', '*')],
    linux: [
      distGlob('.snap'),
      distGlob('.rpm'),
      distGlob('.deb'),
      distGlob('.AppImage'),
      distGlob('.tar.gz'),
    ],
  };

  const paths = await glob(assetGlobs[process.platform]);

  const { data } = await getOrCreateRelease(app, version);

  for (const p of paths) {
    const name = path.basename(p);

    console.log(`[release] Uploading ${name}`);
    await octokit.request({
      method: 'POST',
      url: 'https://uploads.github.com/repos/:owner/:repo/releases/:id/assets{?name,label}"',
      id: data.id,
      name: name,
      owner: appConfig().githubOrg,
      repo: appConfig().githubRepo,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      data: fs.readFileSync(p),
    });
  }

  console.log(`[release] Release created ${data.url}`);
}

async function getOrCreateRelease(app, version) {
  const tag = `${app}@${version}`;
  const releaseName = `${appConfig().productName} ${version} 📦`;
  const changelogUrl = `https://insomnia.rest/changelog/${app}/${version}`;

  try {
    return await octokit.repos.getReleaseByTag({
      owner: appConfig().githubOrg,
      repo: appConfig().githubRepo,
      tag,
    });
  } catch (err) {
    // Doesn't exist
  }

  return octokit.repos.createRelease({
    owner: appConfig().githubOrg,
    repo: appConfig().githubRepo,
    tag_name: tag,
    name: releaseName,
    body: `Full changelog ⇒ ${changelogUrl}`,
    draft: false,
    prerelease: true,
  });
}
