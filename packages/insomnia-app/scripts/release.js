const packageJson = require('../package.json');
const glob = require('fast-glob');
const fs = require('fs');
const path = require('path');
const packageTask = require('./package');
const buildTask = require('./build');
const Octokit = require('@octokit/rest');

// Configure Octokit
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const OWNER = 'getinsomnia';
const REPO = 'insomnia';

// Start package if ran from CLI
if (require.main === module) {
  if (!process.env.GITHUB_REF.match(/v\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
    console.log(`[release] Not running release for ref ${process.env.GITHUB_REF}`);
    process.exit(0);
  }

  process.nextTick(async () => {
    try {
      await buildTask.start();
      await packageTask.start();
      await start();
    } catch (err) {
      console.log('[package] ERROR:', err);
      process.exit(1);
    }
  });
}

async function start() {
  const tagName = `v${packageJson.app.version}`;
  console.log(`[release] Creating release ${tagName}`);

  const globs = {
    darwin: ['dist/**/*.zip', 'dist/**/*.dmg'],
    win32: ['dist/squirrel-windows/*'],
    linux: [
      'dist/**/*.snap',
      'dist/**/*.rpm',
      'dist/**/*.deb',
      'dist/**/*.AppImage',
      'dist/**/*.tar.gz',
    ],
  };

  const paths = await glob(globs[process.platform]);

  const { data } = await getOrCreateRelease(tagName);

  for (const p of paths) {
    const name = path.basename(p);
    console.log(`[release] Uploading ${p}`);
    await octokit.request({
      method: 'POST',
      url: 'https://uploads.github.com/repos/:owner/:repo/releases/:id/assets{?name,label}"',
      id: data.id,
      name: name,
      owner: OWNER,
      repo: REPO,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      data: fs.readFileSync(p),
    });
  }

  console.log(`[release] Release created ${data.url}`);
}

async function getOrCreateRelease(tagName) {
  try {
    return await octokit.repos.getReleaseByTag({
      owner: OWNER,
      repo: REPO,
      tag: tagName,
    });
  } catch (err) {
    // Doesn't exist
  }

  return octokit.repos.createRelease({
    owner: OWNER,
    repo: REPO,
    tag_name: tagName,
    name: tagName,
    body: `${packageJson.app.productName} ${tagName}`,
    draft: false,
    preRelease: true,
  });
}
