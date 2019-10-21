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

// Start package if ran from CLI
if (require.main === module) {
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

  await uploadToGitHub(tagName, paths);
  await uploadToBintray(tagName, paths);
}

async function uploadToGitHub(tagName, paths) {
  const { data } = await getOrCreateRelease(tagName);

  for (const p of paths) {
    const name = path.basename(p);
    console.log(`[release] Uploading ${name} (${tagName}) to GitHub`);
    await octokit.request({
      method: 'POST',
      url: 'https://uploads.github.com/repos/:owner/:repo/releases/:id/assets{?name,label}"',
      id: data.id,
      name: name,
      owner: 'kong',
      repo: 'studio',
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
    const pkg = 'package';
    const repo = 'studio';
    const org = 'kong';
    const user = process.env.BINTRAY_USER;
    const apiKey = process.env.BINTRAY_API_KEY;
    const name = path.basename(p);

    console.log(`[release] Uploading ${name} (${tagName}) to Bintray`);

    const options = {
      host: 'api.bintray.com',
      path: `/content/${org}/${repo}/${pkg}/${tagName}/${name}?publish=1`,
      method: 'PUT',
      headers: {
        Authorization: getBasicAuthHeader(user, apiKey),
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
      owner: 'kong',
      repo: 'studio',
      tag: tagName,
    });
  } catch (err) {
    // Doesn't exist
  }

  return octokit.repos.createRelease({
    owner: 'kong',
    repo: 'studio',
    tag_name: tagName,
    name: tagName,
    body: `${packageJson.app.productName} ${tagName}`,
    draft: false,
    preRelease: true,
  });
}

function getBasicAuthHeader(username, password) {
  const header = `${username || ''}:${password || ''}`;
  const authString = Buffer.from(header, 'utf8').toString('base64');
  return `Basic ${authString}`;
}
