import fs from 'node:fs';
import path from 'node:path';

import { expect } from '@playwright/test';

import { copyFixtureDatabase, getFixturePath } from '../../playwright/paths';
import { test } from '../../playwright/test';

const bearerToken = 'plaintext-bearer-token-from-before-the-upgrade';
const cookieJarId = 'jar_477c547643674a53b75ec94371a59119';
const cookieValue = 'plaintext-cookie-value-from-before-the-upgrade';
const encrypted = /^enc:insomnia:v1:/;

const databaseFile = (dataPath: string, type: string) => path.join(dataPath, `insomnia.${type}.db`);
const readLines = (dataPath: string, type: string) =>
  fs
    .readFileSync(databaseFile(dataPath, type), 'utf8')
    .split('\n')
    .filter(line => line !== '')
    .map(line => JSON.parse(line));
const databaseText = (dataPath: string) =>
  fs
    .readdirSync(dataPath)
    .filter(file => /^insomnia\..+\.db$/.test(file))
    .map(file => fs.readFileSync(path.join(dataPath, file), 'utf8'))
    .join('\n');
const documentIds = (dataPath: string) =>
  Object.fromEntries(
    fs
      .readdirSync(dataPath)
      .filter(file => /^insomnia\..+\.db$/.test(file))
      .map(file => [file, readLines(dataPath, file.slice('insomnia.'.length, -'.db'.length)).map(doc => doc._id)]),
  );

// The legacy fixture was written by a version that stored everything in plaintext, and holds almost no secrets of its
// own: a request with a bearer token and a cookie are added to the copy before the app starts.
const testWithPlaintextDatabase = test.extend<{ plaintextSecrets: string[]; plaintextIds: Record<string, string[]> }>({
  dataPath: async ({ dataPath }, use) => {
    await copyFixtureDatabase('insomnia-legacy-db', dataPath);
    fs.appendFileSync(
      databaseFile(dataPath, 'Request'),
      `${JSON.stringify({ _id: 'req_plaintext_secret', type: 'Request', parentId: 'wrk_1b49626a0a9442b7b9474a1f3493bb5d', name: 'Has a secret', url: 'https://example.com', authentication: { type: 'bearer', token: bearerToken } })}\n`,
    );
    // The app merges several cookie jars of one workspace into one, so the cookie goes into the existing jar
    const jars = readLines(dataPath, 'CookieJar').map(jar =>
      jar._id === cookieJarId
        ? { ...jar, cookies: [{ id: '1', key: 'session', value: cookieValue, domain: 'example.com', path: '/' }] }
        : jar,
    );
    fs.writeFileSync(databaseFile(dataPath, 'CookieJar'), `${jars.map(jar => JSON.stringify(jar)).join('\n')}\n`);
    await use(dataPath);
  },
  // Worked out from the fixture itself: by the time a test body runs, the app has started and migrated its copy
  plaintextSecrets: async ({}, use) => {
    const fromFixture = readLines(getFixturePath('insomnia-legacy-db'), 'RequestVersion').map(
      doc => doc.compressedRequest,
    );
    expect.soft(fromFixture.every(value => !encrypted.test(value))).toBe(true);
    await use([bearerToken, cookieValue, ...fromFixture]);
  },
  plaintextIds: async ({}, use) => {
    const ids = documentIds(getFixturePath('insomnia-legacy-db'));
    await use({
      ...ids,
      'insomnia.Request.db': [...ids['insomnia.Request.db'], 'req_plaintext_secret'],
    });
  },
});

testWithPlaintextDatabase(
  'encrypts the sensitive fields of a plaintext database on the first launch, and keeps working after a restart',
  async ({ insomnia, dataPath, plaintextSecrets, plaintextIds }) => {
    expect.soft(plaintextSecrets).toHaveLength(4);

    const keyFile = path.join(dataPath, 'localStorage', 'fieldEncryptionKey');
    const expectEncryptedAndWorking = async () => {
      // The migration runs before the first window exists, so once the page is up, it is finished
      await insomnia.page.waitForLoadState();
      expect.soft(fs.existsSync(keyFile), 'the key is saved').toBe(true);
      expect.soft(fs.readFileSync(keyFile, 'utf8')).not.toContain('"kty"');
      for (const secret of plaintextSecrets) {
        expect.soft(databaseText(dataPath), 'no secret is left in plaintext').not.toContain(secret);
      }
      expect.soft(
        readLines(dataPath, 'Request').find(doc => doc._id === 'req_plaintext_secret').authentication.token,
      ).toMatch(encrypted);
      expect.soft(readLines(dataPath, 'CookieJar').find(doc => doc._id === cookieJarId).cookies[0].value).toMatch(encrypted);
      expect.soft(readLines(dataPath, 'RequestVersion').every(doc => encrypted.test(doc.compressedRequest))).toBe(true);
      // The app adds documents of its own when it opens an old database, so only check that none was lost
      const idsNow = documentIds(dataPath);
      for (const [file, ids] of Object.entries(plaintextIds)) {
        expect.soft(idsNow[file], `${file} keeps its documents`).toEqual(expect.arrayContaining(ids));
      }

      // What the app holds is the plaintext again
      const request: any = await insomnia.page.evaluate(() =>
        window.database.invoke('findOne', 'Request', { _id: 'req_plaintext_secret' }),
      );
      expect.soft(request.authentication.token).toBe(bearerToken);
      const jar: any = await insomnia.page.evaluate(
        id => window.database.invoke('findOne', 'CookieJar', { _id: id }),
        cookieJarId,
      );
      expect.soft(jar.cookies[0].value).toBe(cookieValue);
      // Nothing was reported as failed, so the user is not shown the dialog about unreadable fields
      await expect.soft(insomnia.page.getByText('Reset local encryption key')).toHaveCount(0);
    };

    await expectEncryptedAndWorking();
    await insomnia.relaunch();
    await expectEncryptedAndWorking();
  },
);
