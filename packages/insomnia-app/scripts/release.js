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

const GITHUB_ORG = 'kong';
const GITHUB_REPO = 'insomnia';

// Start package if ran from CLI
if (require.main === module) {
  process.nextTick(async () => {
    // First check if we need to publish (uses Git tags)
    const gitRefStr = process.env.GITHUB_REF || process.env.TRAVIS_TAG;
    const skipPublish = !gitRefStr || !gitRefStr.match(/v\d+\.\d+\.\d+(-(beta|alpha)\.\d+)?$/);
    if (skipPublish) {
      console.log(`[package] Not packaging for ref=${gitRefStr}`);
      process.exit(0);
    }

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
      owner: GITHUB_ORG,
      repo: GITHUB_REPO,
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
      owner: GITHUB_ORG,
      repo: GITHUB_REPO,
      tag: tagName,
    });
  } catch (err) {
    // Doesn't exist
  }

  return octokit.repos.createRelease({
    owner: GITHUB_ORG,
    repo: GITHUB_REPO,
    tag_name: tagName,
    name: tagName,
    body: `Full changelog ⇒ https://insomnia.rest/changelog/${packageJson.app.version}`,
    draft: false,
    preRelease: true,
  });
}
