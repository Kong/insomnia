import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import YAML from 'yaml';

import playwrightConfig from '../../playwright.config';
import type { InsomniaApp } from '../../playwright/pages';
import { getFixturePath, randomDataPath } from '../../playwright/paths';
import { test } from '../../playwright/test';

const webServerEntry = Array.isArray(playwrightConfig.webServer)
  ? playwrightConfig.webServer[0]
  : playwrightConfig.webServer;
const devServerUrl: string = webServerEntry?.url ?? 'http://127.0.0.1:4010';

const RULESET_FIXTURE = getFixturePath('files/custom.spectral.yaml');
const INVALID_RULESET_FIXTURE = getFixturePath('files/invalid.spectral.yaml');
const RULESET_RULE_NAME = 'require-x-smoke-test-marker';
const GIT_LINT_PROJECT_NAME = 'Git Lint Rules Test';

/**
 * User B session: different identity (accountId / email / sessionId) but the
 * same RSA key pair and symmetric key as user A so the shared
 * `encryptedSymmetricKey` in the mock is still decryptable.  This lets us test
 * a two-user collaboration scenario without generating a second key pair.
 */
const USER_B_SESSION = {
  id: 'sess_74b577e6b59d43a5a607f84b4f73e3df',
  sessionExpiry: new Date(2_147_483_647_000),
  publicKey: {
    alg: 'RSA-OAEP-256',
    e: 'AQAB',
    ext: true,
    key_ops: ['encrypt'],
    kty: 'RSA',
    n: 'pTQVaUaiqggIldSKm6ib6eFRLLoGj9W-2O4gTbiorR-2b8-ZmKUwQ0F-jgYX71AjYaFn5VjOHOHSP6byNAjN7WzJ6A_Z3tytNraLoZfwK8KdfflOCZiZzQeD3nO8BNgh_zEgCHStU61b6N6bSpCKjbyPkmZcOkJfsz0LJMAxrXvFB-I42WYA2vJKReTJKXeYx4d6L_XGNIoYtmGZit8FldT4AucfQUXgdlKvr4_OZmt6hgjwt_Pjcu-_jO7m589mMWMebfUhjte3Lp1jps0MqTOvgRb0FQf5eoBHnL01OZjvFPDKeqlvoz7II9wFNHIKzSvgAKnyemh6DiyPuIukyQ',
  },
  encPrivateKey: {
    iv: '3a1f2bdb8acbf15f469d57a2',
    t: '904d6b1bc0ece8e5df6fefb9efefda7c',
    d: '2a7b0c4beb773fa3e3c2158f0bfa654a88c4041184c3b1e01b4ddd2da2c647244a0d66d258b6abb6a9385251bf5d79e6b03ef35bdfafcb400547f8f88adb8bceb7020f2d873d5a74fb5fc561e7bd67cea0a37c49107bf5c96631374dc44ddb1e4a8b5688dc6560fc6143294ed92c3ad8e1696395dfdf15975aa67b9212366dbfcb31191e4f4fe3559c89a92fb1f0f1cc6cbf90d8a062307fce6e7701f6f5169d9247c56dae79b55fba1e10fde562b971ca708c9a4d87e6e9d9e890b88fa0480360420e610c4e41459570e52ae72f349eadf84fc0a68153722de3280becf8a1762e7faebe964f0ad706991c521feda3440d3e1b22f2c221a80490359879bd47c0d059ace81213c74a1e192dbebd8a80cf58c9eb1fe461a971b88d3899baf4c4ef7141623c93fb4a54758f5e1cf9ee35cd00777fa89b24e4ded57219e770de2670619c6e971935c61ae72e3276cf8db49dfa0e91c68222f02d7e0c69b399af505de7e5a90852d83e0a30934b0362db986f3aaefaaf1a96fef3e8165287a3a7f0ee1e072d9dee3aefb86194e1d877d6b34529d45a70ec4573c35a7fe27833c77c3154b0ad02187e4fcecd408bcf4b29a85a5dc358cb479140f4983fcd936141f581764669651530af97d2b7d9416aea7de67e787f3e29ae3eba6672bcd934dc1e308783aa63a4ab46d48d213cf53ad6bd8828011f5bfa3aa5ee24551c694e829b54c93b1dda6c3ddda04756d68a28bec8d044c8af4147680dc5b972d0ca74299b0ab6306b9e7b99bf0557558df120455a272145b7aa792654730f3d670b76d72408f5ce1cf5fbd453d2903fa72cf26397437854ba8abbb731a8107f6a86a01fa98edc81bb42a4c1330f779e7a0fbd1820eaed78e03e40a996e03884b707556be06fd14ee8f4035469210d1d2bb8f58285fc2ab6de3d3cc0e4e1f40c6d9d24b50dc8e2e2374a0aff52031b3736c2982133bb19dd551ce1f953f4ba02b0cf53382c15752e202c138cb42b2322df103ff17fd886dfd5f992b711673cdf16048c4bff19038138b161c2e1783b85fc7b965a91ac4795fcbfebf827940cacdeae57946863aee027df43b36612f3cb8f34dc44396e87c564bf10f5b1a9dfbd6da3d7f4f65024b0b4f8ce51d01c230840941fc4523b17eb1c2522032f410e8328239a11a15ab755c32945ce52966d5bfb4666909ed2ca04d536e4bf92091563dd44d46cbb35e53c2481400058ab3b52a0280d262551073f61db125ee280e2cc1ec0bdf9c4817824261465011e34c2296411384f7f5e16742157c5520f137631edf498aa39c7c32b107e3634cbeb70feea19a233c8bd939d665135c9f7c1bb33cb47edc58bdbbcde9b0b9eb73a46642e4639289a62638fb7813e1eeaadd105c803de8357236f33c4bcf31a876b5867591af8f165eba0b35cf0b0886af17dab35a6a39f8f576387d6ffb9e677ee46fc0f11ff069a2a068fce441ff8f4125095fad228c2bf45c788d641941ed13c0a16fffcafd7c7eff11bb7550c0b7d54eebdbd2066e3bbdb47aaee2b5f1e499726324a40015458c7de1db0abe872594d8e6802deff7ea9518bdb3a3e46f07139267fd67dc570ba8ab04c2b37ce6a34ec73b802c7052a2eef0cae1b0979322ef86395535db80cf2a9a88aa7c2e5cc28a93612a8dafe1982f741d7cec28a866f6c09dba5b99ead24c3df0ca03c6c5afae41f3d39608a8f49b0d6a0b541a159409791c25ede103eb4f79cfbd0cc9c9aa6b591755c1e9fd07b5b9e38ed85b5939e65d127256f6a4c078f8c9d655c4f072f9cbcfb2e1e17eaa83dc62aaab2a6dc3735ee76ce7a215740f795f1fbe7136c7734ae3714438015e8fc383d63775a8abddb23cbc5f906c046bb0b5b31d492a7c151b40ea82c7c966e25820641c55b343b89d6378f90de5983fa76547e9d6c634effdf019a0fd9b6d3e488a5aa94f0710d517ba4f7c1ed82f9f3072612e953e036c0ec7f3c618368362f6da6f3af76056a66aef914805cc8b628f1c11695f760b535ded9ff66727273ae7e12d67a01243d75f22fec8ed1b043122a211c923aa92ecbbe01dd0d7195c3c0e09a2a6ab3eca354963122d5a0ec16e2b2b81b0ddce6ec0a312c492a96a4fd392f1deb6a1f3318541a3f87e5c9e73ee7edd3b855910f412789e25038108e1eaae04dcfb02b4d958c00c630dc8caa87a40798ce7156d2ade882e68832d39fe8f9bce6a995249a7383013a5093c4af55c3b7232de0f2593d82c30b8dabd0784455037f25f6bb66a6d0d8f72bc7be0dee2d0a8af44bb4e143257d873268d331722c3253ea5c004e72daf04c875e2054f2b4b2bca2979fd046a1e835600045edf2f159d851a540a91a1ab8fbcb64594d21942bbaa2160535d32496ba7ce4a76c6bdeb9bb4c5cab7bed1ae26564058d0be125803d7019b83b3953c4b0cc1f8299c4edcf6a5faa4765092412d368b277689900e71fb5d47581057adaa2dd494e0f66dc1aa16f3741973b0d9ffa1728aeafab84b777394a7afae0f8eabaa6b740f1c60ca26469f0c9356ec880ad6f4dc01b99bd14d7a4bb8afc97662a9e68b0155e4cdf3caa3402819ac6ce562c8fe06edb50a31cfd7a',
    ad: '',
  },
  symmetricKey: {
    alg: 'A256GCM',
    ext: true,
    k: 'w62OJNWF4G8iWA8ZrTpModiY8dICyHI7ko1vMLb877g=',
    key_ops: ['encrypt', 'decrypt'],
    kty: 'oct',
  },
  email: 'insomnia-user-b@konghq.com',
  accountId: 'acct_74b577e6b59d43a5a607f84b4f73e3df',
  firstName: 'User',
  lastName: 'B',
};

/**
 * Open a fresh design document seeded with the Pet Store example. The Pet Store
 * does not include `info.x-smoke-test-marker`, so once our custom ruleset is
 * uploaded the rule defined in fixtures/files/custom.spectral.yaml will fire.
 */
async function openPetStoreDesignDoc(page: Page) {
  await page.getByRole('button', { name: 'Create document' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
  await page.getByText('Use example').click();
  await page.getByText('Pet Store').click();
  await expect.soft(page.locator('.pane-one').getByTestId('CodeEditor')).toContainText('openapi: 3.0');
}

async function uploadRuleset(insomnia: InsomniaApp, page: Page) {
  await insomnia.queueOpenDialogResponse([RULESET_FIXTURE]);
  await page.getByLabel('Upload custom ruleset').click();
  // Soft assert per ESLint rule; a failure here will surface downstream as well.
  await expect.soft(page.getByRole('button', { name: 'View selected ruleset content' })).toBeVisible({ timeout: 10_000 });
}

async function removeRuleset(page: Page) {
  await page.getByLabel('Remove custom ruleset').click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect.soft(page.getByText('Default OAS Ruleset')).toBeVisible({ timeout: 10_000 });
}

async function commitAndPush(page: Page, message: string) {
  await page.getByLabel('Git Sync').click();
  await page.getByLabel('Commit').click({ delay: 500 });
  // Stage all unstaged rows in the commit dialog (bounded to avoid an infinite loop).
  const plusIcons = page.getByRole('dialog').locator('[data-icon="plus"]');
  for (let i = 0; i < 50 && (await plusIcons.count()) > 0; i++) {
    await plusIcons.first().click();
  }
  await page.getByRole('textbox', { name: 'Message' }).fill(message);
  await page.getByRole('button', { name: 'Commit and push' }).click();
  // The dialog closes on a successful push; fail the test if it stays open.
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 15_000 });
}

async function addAccessTokenGitCredential(insomnia: InsomniaApp) {
  await insomnia.statusbar.openPreferences();
  await insomnia.preferencesPage.switchToPreferenceTab('Credentials');
  await insomnia.preferencesPage.credentialsTab.addAccessTokenGitCredential();
  await expect.soft(insomnia.page.getByRole('row', { name: 'Custom Git Credential' })).toBeVisible();
  await insomnia.preferencesPage.closePreferences();
}

async function createGitDesignDocument(insomnia: InsomniaApp, page: Page, projectName: string) {
  await insomnia.navigationSidebar.selectProjectDropdownOption({
    actionName: 'Document',
    projectName,
  });
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Lint Test Spec');
  await page.getByRole('textbox', { name: /File name/ }).fill('lint_test_spec');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
  // Populate with Pet Store example so the lint panel renders (requires non-empty apiSpec.contents).
  await page.getByText('Use example').click();
  await page.getByText('Pet Store').click();
  await expect.soft(page.locator('.pane-one').getByTestId('CodeEditor')).toContainText('openapi: 3.0');
}

/**
 * Find the RepoFileWatcher mirror directory for the first GitRepository in
 * `dataPath`.  Polls for up to 6 seconds because NeDB flushes to disk
 * asynchronously after the project is created.
 */
async function gitRepoMirrorPath(dataPath: string): Promise<string> {
  const dbPath = path.join(dataPath, 'insomnia.GitRepository.db');
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const content = await fs.promises.readFile(dbPath, 'utf8');
      const repos = content
        .split('\n')
        .filter(Boolean)
        .map((l: string) => JSON.parse(l))
        .filter((r: any) => !r.$$deleted);
      if (repos.length > 0) {
        return path.join(dataPath, 'version-control', 'git', repos[0]._id);
      }
    } catch {
      // file not yet written
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`No GitRepository found in ${dbPath} after waiting`);
}

test.describe('Custom Spectral Lint Rules', () => {
  // ---------------------------------------------------------------------------
  // 1. Upload + lint + reopen (full process relaunch)
  // ---------------------------------------------------------------------------
  test('upload custom ruleset, lint reflects it, persists after app relaunch', async ({ insomnia }) => {
    await openPetStoreDesignDoc(insomnia.page);

    // Baseline: Pet Store should produce no lint problems under default OAS ruleset.
    await expect.soft(insomnia.page.getByText('Default OAS Ruleset')).toBeVisible();
    await expect.soft(insomnia.page.getByText('No lint problems')).toBeVisible({ timeout: 15_000 });

    await uploadRuleset(insomnia, insomnia.page);

    // Our custom rule should now fire on Pet Store.
    await expect.soft(insomnia.page.getByText(new RegExp(RULESET_RULE_NAME))).toBeVisible({
      timeout: 15_000,
    });

    // Close the Electron process and relaunch it against the same data path.
    // This exercises the full persistence boundary: NeDB on disk, main-process
    // startup, renderer init, clientLoader.
    await insomnia.relaunch();

    // Re-navigate to the same design document after relaunch. The workspace is
    // created with the default name 'My Design Document'.
    await insomnia.page.getByLabel('My Design Document').first().click();

    await expect
      .soft(insomnia.page.getByRole('button', { name: 'View selected ruleset content' }))
      .toBeVisible({ timeout: 15_000 });
    await expect.soft(insomnia.page.getByText(new RegExp(RULESET_RULE_NAME))).toBeVisible({
      timeout: 15_000,
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Remove + reopen (full process relaunch)
  // ---------------------------------------------------------------------------
  test('remove custom ruleset reverts to default OAS, persists after app relaunch', async ({ insomnia }) => {
    await openPetStoreDesignDoc(insomnia.page);
    await uploadRuleset(insomnia, insomnia.page);
    await expect.soft(insomnia.page.getByText(new RegExp(RULESET_RULE_NAME))).toBeVisible({
      timeout: 15_000,
    });

    await removeRuleset(insomnia.page);
    await expect.soft(insomnia.page.getByText(new RegExp(RULESET_RULE_NAME))).toBeHidden();
    await expect.soft(insomnia.page.getByText('No lint problems')).toBeVisible({ timeout: 15_000 });

    await insomnia.relaunch();
    await insomnia.page.getByLabel('My Design Document').first().click();

    await expect.soft(insomnia.page.getByText('Default OAS Ruleset')).toBeVisible({ timeout: 15_000 });
    await expect.soft(insomnia.page.getByText(new RegExp(RULESET_RULE_NAME))).toBeHidden();
  });

  // ---------------------------------------------------------------------------
  // 3. Invalid ruleset — error modal appears, ruleset is not applied
  // ---------------------------------------------------------------------------
  test('uploading a ruleset with disallowed keys shows an error and leaves default ruleset active', async ({ insomnia }) => {
    await openPetStoreDesignDoc(insomnia.page);
    await expect.soft(insomnia.page.getByText('Default OAS Ruleset')).toBeVisible();

    await insomnia.queueOpenDialogResponse([INVALID_RULESET_FIXTURE]);
    await insomnia.page.getByLabel('Upload custom ruleset').click();

    await expect.soft(insomnia.page.getByText('Invalid Spectral Ruleset', { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await insomnia.page.getByRole('button', { name: 'Ok' }).click();

    // Default ruleset should still be active; no custom upload button state change.
    await expect.soft(insomnia.page.getByText('Default OAS Ruleset')).toBeVisible();
    await expect
      .soft(insomnia.page.getByRole('button', { name: 'View selected ruleset content' }))
      .toBeHidden();
  });

  // ---------------------------------------------------------------------------
  // 4. Cloud sync — upload, reload, and three sync round-trips
  //
  // The custom ruleset is stored as a `ProjectLintRuleset` doc (canSync = true)
  // parented to the project, so it rides cloud-sync push/pull with the rest of
  // the project's resources.
  // ---------------------------------------------------------------------------
  test.describe('within a cloud-sync project', () => {
    test.beforeAll(async () => {
      await fetch(`${devServerUrl}/__test-config/cloud-sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });
    });

    test.afterAll(async () => {
      await fetch(`${devServerUrl}/__test-config/cloud-sync/reset`, { method: 'POST' });
      await fetch(`${devServerUrl}/__test-config/cloud-sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      });
    });

    test('upload custom ruleset in a synced design project', async ({ page, insomnia }) => {
      await page.getByTestId('workspace-grid').getByLabel('Design Project').click();
      await page.waitForURL(/\/workspace\/.+\/spec/, { timeout: 30_000 });

      await uploadRuleset(insomnia, page);

      await page.reload();
      await expect.soft(page.getByRole('button', { name: 'View selected ruleset content' })).toBeVisible({
        timeout: 15_000,
      });

      // Open the modal and verify the stored content matches the uploaded fixture.
      await page.getByRole('button', { name: 'View selected ruleset content' }).click();
      await expect.soft(page.getByRole('dialog').getByText('Existing Ruleset Contents')).toBeVisible();
      await expect
        .soft(page.getByRole('dialog').getByTestId('CodeEditor'))
        .toContainText(RULESET_RULE_NAME, { timeout: 5000 });
      await page.getByRole('button', { name: 'Close ruleset content viewer' }).click();
    });

    // -------------------------------------------------------------------------
    // Same user, different machine — push/pull round-trip
    //
    // Machine A uploads the ruleset, commits, and pushes.  Machine B starts
    // fresh (separate dataPath, same user session) and pulls the project; the
    // mock now stores pushed blobs and serves them back after decrypting the
    // incoming AES-GCM payload, so machine B should receive the
    // ProjectLintRuleset in its sync pull.
    // -------------------------------------------------------------------------
    test('same user, different machine: ruleset survives push → pull round-trip', async ({ page, insomnia }) => {
      await fetch(`${devServerUrl}/__test-config/cloud-sync/reset`, { method: 'POST' });

      // Machine A: upload and push.
      await page.getByTestId('workspace-grid').getByLabel('Design Project').click();
      await page.waitForURL(/\/workspace\/.+\/spec/, { timeout: 30_000 });
      await uploadRuleset(insomnia, page);
      await commitAndPush(page, 'Add custom lint ruleset');

      // Machine B: fresh data path (simulates a different machine), pull, and verify.
      const machineB = await insomnia.launchClone(randomDataPath());
      await machineB.page.getByTestId('workspace-grid').getByLabel('Design Project').click();
      await machineB.page.waitForURL(/\/workspace\/.+\/spec/, { timeout: 30_000 });
      await expect
        .soft(machineB.page.getByRole('button', { name: 'View selected ruleset content' }))
        .toBeVisible({ timeout: 15_000 });
      await expect
        .soft(machineB.page.getByText(new RegExp(RULESET_RULE_NAME)))
        .toBeVisible({ timeout: 15_000 });

      await fetch(`${devServerUrl}/__test-config/cloud-sync/reset`, { method: 'POST' });
    });

    // -------------------------------------------------------------------------
    // Different users, same project
    //
    // User A uploads the ruleset and pushes.  User B (different accountId,
    // same symmetric key so the project blobs are decryptable) starts on a
    // fresh machine, pulls the project, and verifies the ruleset survived the
    // sync handoff.
    // -------------------------------------------------------------------------
    test('different users: ruleset uploaded by user A is visible to user B after pull', async ({ page, insomnia }) => {
      test.slow();
      await fetch(`${devServerUrl}/__test-config/cloud-sync/reset`, { method: 'POST' });
      await fetch(`${devServerUrl}/__test-config/cloud-sync/team-members`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ multi: true }),
      });

      // User A: upload and push.
      await page.getByTestId('workspace-grid').getByLabel('Design Project').click();
      await page.waitForURL(/\/workspace\/.+\/spec/, { timeout: 30_000 });
      await uploadRuleset(insomnia, page);
      await commitAndPush(page, 'User A: add custom lint ruleset');

      // User B: fresh data path, different session.
      const userB = await insomnia.launchClone(randomDataPath(), {
        INSOMNIA_SESSION: JSON.stringify(USER_B_SESSION),
      });

      await userB.page.getByTestId('workspace-grid').getByLabel('Design Project').click();
      await userB.page.waitForURL(/\/workspace\/.+\/spec/, { timeout: 30_000 });

      await expect
        .soft(userB.page.getByRole('button', { name: 'View selected ruleset content' }))
        .toBeVisible({ timeout: 15_000 });
      await expect
        .soft(userB.page.getByText(new RegExp(RULESET_RULE_NAME)))
        .toBeVisible({ timeout: 15_000 });

      await fetch(`${devServerUrl}/__test-config/cloud-sync/reset`, { method: 'POST' });
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Git project parity — bidirectional RepoFileWatcher sync
  //
  // The RepoFileWatcher mirrors NeDB ↔ .spectral.yaml in the workspace's
  // checkout directory at ${userData}/version-control/git/${repoId}/.
  //
  // 4a. DB→FS: upload via UI; file should appear on disk.
  // 4b. FS→DB: write .spectral.yaml directly; badge should appear.
  // 4c. Removal: remove via UI; file should be deleted from disk.
  // ---------------------------------------------------------------------------
  test.describe('within a git-sync project', () => {
    test.slow();

    test.beforeEach(async ({ insomnia, request }) => {
      await request.post('http://127.0.0.1:4010/v1/test-utils/git/setup');
      await addAccessTokenGitCredential(insomnia);
      await insomnia.projectPage.createGitSyncProject(GIT_LINT_PROJECT_NAME);
      await createGitDesignDocument(insomnia, insomnia.page, GIT_LINT_PROJECT_NAME);
    });

    test.afterEach(async ({ request }) => {
      await request.delete('http://127.0.0.1:4010/v1/test-utils/git/setup');
    });

    test('4a. upload ruleset via UI mirrors to .spectral.yaml on disk', async ({ insomnia, dataPath }) => {
      const mirrorDir = await gitRepoMirrorPath(dataPath);
      await uploadRuleset(insomnia, insomnia.page);

      const spectralPath = path.join(mirrorDir, '.spectral.yaml');
      await expect.poll(() => fs.existsSync(spectralPath), { timeout: 10_000 }).toBe(true);

      const onDisk = await fs.promises.readFile(spectralPath, 'utf8');
      const fixture = await fs.promises.readFile(RULESET_FIXTURE, 'utf8');
      expect.soft(YAML.parse(onDisk)).toEqual(YAML.parse(fixture));
    });

    test('4b. .spectral.yaml on disk syncs to UI badge', async ({ insomnia, dataPath }) => {
      await expect.soft(insomnia.page.getByText('Default OAS Ruleset')).toBeVisible({ timeout: 10_000 });

      const mirrorDir = await gitRepoMirrorPath(dataPath);
      const fixture = await fs.promises.readFile(RULESET_FIXTURE, 'utf8');
      await fs.promises.writeFile(path.join(mirrorDir, '.spectral.yaml'), fixture, 'utf8');

      // The RepoFileWatcher debounces at 300 ms then writes to NeDB; the renderer
      // picks up the db.changes IPC event and re-renders.
      await expect
        .soft(insomnia.page.getByRole('button', { name: 'View selected ruleset content' }))
        .toBeVisible({ timeout: 15_000 });
    });

    test('4c. remove ruleset via UI deletes .spectral.yaml from disk', async ({ insomnia, dataPath }) => {
      const mirrorDir = await gitRepoMirrorPath(dataPath);
      await uploadRuleset(insomnia, insomnia.page);

      const spectralPath = path.join(mirrorDir, '.spectral.yaml');
      await expect.poll(() => fs.existsSync(spectralPath), { timeout: 10_000 }).toBe(true);

      await removeRuleset(insomnia.page);
      await expect.poll(() => !fs.existsSync(spectralPath), { timeout: 10_000 }).toBe(true);
    });
  });
});
