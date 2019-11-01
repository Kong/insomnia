const packageJson = require('../package.json');
const https = require('https');
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
const GITHUB_REPO = 'studio';

const BINTRAY_PKG = 'release';
const BINTRAY_REPO = 'studio';
const BINTRAY_ORG = 'kong';

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

  await uploadToGitHub(tagName, paths);
  await uploadToBintray(tagName, paths);
}

async function uploadToGitHub(tagName, paths) {
  const { data } = await getOrCreateRelease(tagName);

  for (const p of paths) {
    const name = path.basename(p).replace(' ', '.');
    console.log(`[release] Uploading ${name} (${tagName}) to GitHub`);
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

async function uploadToBintray(tagName, paths) {
  for (const p of paths) {
    await uploadFileToBintray(tagName, p);
  }
}

async function uploadFileToBintray(tagName, p) {
  return new Promise((resolve, reject) => {
    const name = path.basename(p);

    console.log(`[release] Uploading ${name} (${tagName}) to Bintray`);

    const options = {
      host: 'api.bintray.com',
      path: `/content/${BINTRAY_ORG}/${BINTRAY_REPO}/${BINTRAY_PKG}/${tagName}/${name}?publish=1`,
      method: 'PUT',
      headers: {
        Authorization: getBasicAuthHeader(process.env.BINTRAY_USER, process.env.BINTRAY_API_KEY),
      },
    };

    const req = https.request(options, res => {
      let data = '';

      res.setEncoding('utf8');
      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        resolve(JSON.parse(data));
      });
    });

    req.on('error', e => {
      reject(e);
    });

    req.write(fs.readFileSync(p));
    req.end();
  });
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

function getBasicAuthHeader(username, password) {
  const header = `${username || ''}:${password || ''}`;
  const authString = Buffer.from(header, 'utf8').toString('base64');
  return `Basic ${authString}`;
}
