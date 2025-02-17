// Read more about creating fixtures https://playwright.dev/docs/test-fixtures
import { ElectronApplication, test as baseTest, TraceMode } from '@playwright/test';
import path from 'path';

import {
  bundleType,
  cwd,
  executablePath,
  mainPath,
  randomDataPath,
} from './paths';

// Throw an error if the condition fails
// > Not providing an inline default argument for message as the result is smaller
export function invariant(
  condition: any,
  // Can provide a string, or a function that returns a string for cases where
  // the message takes a fair amount of effort to compute
  message?: string | (() => string),
): asserts condition {
  if (condition) {
    return;
  }
  // Condition not passed

  throw new Error(typeof message === 'function' ? message() : message);
}

interface EnvOptions {
  INSOMNIA_DATA_PATH: string;
  INSOMNIA_API_URL: string;
  INSOMNIA_APP_WEBSITE_URL: string;
  INSOMNIA_AI_URL: string;
  INSOMNIA_MOCK_API_URL: string;
  INSOMNIA_GITHUB_REST_API_URL: string;
  INSOMNIA_GITHUB_API_URL: string;
  INSOMNIA_GITLAB_API_URL: string;
  INSOMNIA_UPDATES_URL: string;
  INSOMNIA_SKIP_ONBOARDING: string;
  INSOMNIA_PUBLIC_KEY: string;
  INSOMNIA_SECRET_KEY: string;
  INSOMNIA_SESSION?: string;
  INSOMNIA_VAULT_KEY: string;
  INSOMNIA_VAULT_SALT: string;
}

export const test = baseTest.extend<{
  app: ElectronApplication;
  dataPath: string;
  fixturesPath: string;
  userConfig: {
    skipOnboarding: boolean;
    publicKey: string;
    secretKey: string;
    code: string;
    vaultKey?: string;
    vaultSalt?: string;
    session?: {
      accountId: string;
      id: string;
      sessionExpiry: Date;
      email: string;
      firstName: string;
      lastName: string;
      symmetricKey: string;
      publicKey: string;
      encPrivateKey: string;
    };
  };
}>({
  app: async ({ playwright, trace, dataPath, userConfig }, use, testInfo) => {
    invariant(testInfo.config.webServer?.url, 'Requires web server config');
    const webServerUrl = testInfo.config.webServer.url;

    const options: EnvOptions = {
      INSOMNIA_DATA_PATH: dataPath,
      INSOMNIA_API_URL: webServerUrl,
      INSOMNIA_APP_WEBSITE_URL: webServerUrl + '/website',
      INSOMNIA_AI_URL: webServerUrl + '/ai',
      INSOMNIA_GITHUB_REST_API_URL: webServerUrl + '/github-api/rest',
      INSOMNIA_GITHUB_API_URL: webServerUrl + '/github-api/graphql',
      INSOMNIA_GITLAB_API_URL: webServerUrl + '/gitlab-api',
      INSOMNIA_UPDATES_URL: webServerUrl || 'https://updates.insomnia.rest',
      INSOMNIA_MOCK_API_URL: 'https://mock.insomnia.moe',
      INSOMNIA_SKIP_ONBOARDING: String(userConfig.skipOnboarding),
      INSOMNIA_PUBLIC_KEY: userConfig.publicKey,
      INSOMNIA_SECRET_KEY: userConfig.secretKey,
      INSOMNIA_VAULT_KEY: userConfig.vaultKey || '',
      INSOMNIA_VAULT_SALT: userConfig.vaultSalt || '',
      ...userConfig.session ? { INSOMNIA_SESSION: JSON.stringify(userConfig.session) } : {},
    };

    const electronApp = await playwright._electron.launch({
      cwd,
      executablePath,
      args: bundleType() === 'package' ? [] : [mainPath],
      env: {
        ...process.env,
        ...options,
        PLAYWRIGHT: 'true',
      },
    });

    const appContext = electronApp.context();

    const traceMode: TraceMode = typeof trace === 'string' ? trace as TraceMode : trace.mode;

    const defaultTraceOptions = { screenshots: true, snapshots: true, sources: true };
    const traceOptions = typeof trace === 'string' ? defaultTraceOptions : { ...defaultTraceOptions, ...trace, mode: undefined };
    const captureTrace = (traceMode === 'on' || traceMode === 'retain-on-failure' || (traceMode === 'on-first-retry' && testInfo.retry === 1));

    if (captureTrace) {
      await appContext.tracing.start(traceOptions);
    }

    await use(electronApp);

    if (captureTrace) {
      await appContext.tracing.stop({
        path: path.join(testInfo.outputDir, 'trace.zip'),
      });
    }

    await electronApp.close();
  },
  page: async ({ app }, use) => {
    const page = await app.firstWindow();

    await page.waitForLoadState();

    await use(page);
  },
  dataPath: async ({ }, use) => {
    const insomniaDataPath = randomDataPath();

    await use(insomniaDataPath);
  },
  userConfig: async ({ }, use) => {
    await use({
      skipOnboarding: true,
      publicKey: 'txb/w8DASTpPQqeHE/hpI3ABKzit+pv5n2We5dbtYRo=',
      secretKey: 'Tb1QKsI3wVZxhS8TuQESHB2x7f68PzeTzTMmLpnnFVU=',
      code: 'BTxpIfgXY1VgUpoPpqA25RkCPGQ2MAkZsaY6IZ0bamd0WsYQlJM6iy8PV9hEHS1Gk96SBC6%2BM%2FGhv8IaVl1N6V5wdghHwU2sGKGkW%2Fevx1HiqAUsAqIry8aWRqAkc0n3KmW%2B%2F8lyeHCpy5jhsXqMMqXMbZh8dN1q%2ByRe2C6MJS1A706KbPUhI7PRi%2FsmK0TcNT7lgBKKHRVzPTvjpLcjgzSJFL4K%2BEzgY9Ue4gh0gPw89sM9dV%2F2sAlpw0LA7rF06NyoPhA%3D',
      vaultKey: 'eyJhbGciOiJBMjU2R0NNIiwiZXh0Ijp0cnVlLCJrIjoiaEoxaW03cjcwV3ltZ3puT3hXcDNTb0ZQS3RBaGMwcmFfd2VQb2Z2b2xRNCIsImtleV9vcHMiOlsiZW5jcnlwdCIsImRlY3J5cHQiXSwia3R5Ijoib2N0In0=',
      vaultSalt: 'e619272433fc739d52ff1ba1b45debedfe55cb42685af10a46e2b1285acb7120',
      session: {
        'id': 'sess_64a477e6b59d43a5a607f84b4f73e3ce',
        // Expire in 2077
        'sessionExpiry': new Date(2147483647000),
        'publicKey': "{ 'alg': 'RSA-OAEP-256', 'e': 'AQAB', 'ext': true, 'key_ops': ['encrypt'], 'kty': 'RSA', 'n': 'pTQVaUaiqggIldSKm6ib6eFRLLoGj9W-2O4gTbiorR-2b8-ZmKUwQ0F-jgYX71AjYaFn5VjOHOHSP6byNAjN7WzJ6A_Z3tytNraLoZfwK8KdfflOCZiZzQeD3nO8BNgh_zEgCHStU61b6N6bSpCKjbyPkmZcOkJfsz0LJMAxrXvFB-I42WYA2vJKReTJKXeYx4d6L_XGNIoYtmGZit8FldT4AucfQUXgdlKvr4_OZmt6hgjwt_Pjcu-_jO7m589mMWMebfUhjte3Lp1jps0MqTOvgRb0FQf5eoBHnL01OZjvFPDKeqlvoz7II9wFNHIKzSvgAKnyemh6DiyPuIukyQ' }",
        'encPrivateKey': "{ 'iv': '4a09fba2c412d7ea205b6168', 't': 'a4fa1a524e89e668444de654f1bd1ba8', 'd': 'b695b6ec7d41327b723e395b3788cc08c89dcf7b4db0811c3e91af4aa9ed1c9cb8132b591fe24498ffcc48c0055c1c0985a48d9e96962961c049cea508b6c38e83dfc831a4b1a82ad3e79a26d6ed3c1c9b73043a0e266cfe6eac661a75f4b9862afe2a81362d640bb2fdb6d0015204d04c322f1cb7f33faa593b538b58bda75b0c5e56583d5a55eea89e74d96ce29d862614414ee298f56105ea3dbc479aea9330618ba3e94efe874b33cd99954b12f27d7ff9e7f981310381fa0b3f1a05fbac71862ecc67ddbf7062f718d1d8bbf03f35afc3a8b1b36b177f278ab8dd12c14c862bca52a2c63bca05c7fc9bd8f1000ddc328ad1b5a72b96f110c3443294129db416bd385d19c73a1b342b4887feffa17639cc96b7b7154903c2de183f73d3116d98c8d32ea8b9627d0a5200da98d28c89c34008d4e6fa4cfbd7e1b7e1f36cfec6d0020b306c7def8d24c6091252764bde2eef74f35bdaa605dc27fcd302d179fcf65d6c7d18d3dd36cf6380bd40a29198a0398a6cb1ab79a71be00f7783b6559a146f1f825d25a990162e923e2dbfdd1ee868c8b63844f9394415ebab9f397c8d78608de00369728744b8344724e5c2f1e4ba95522406bd7042fc271793af32bfa1c2724defc8a88185cc5c2825c0453fcb39dc5ac9147d3ba60006fccca855678521da06b426dfd04333511b7d8184a8960dadefb1ef89f5fa648304adcd79734fea763f7dbd0c2788c64ea302f8e33602ab041aec619661167b2f167a4b2cadc6b7cf0c22867fcdd73528fb5585b9d13f6d90ab36c5ef231bd4f2464650e541e6dead1753487b45a8ade3fe46e2327fd0e32d8adafd4e1d2ffcb2df1ed50718d0d29829f8bf4bc33da524640388b0cb9f640b70f9ef0a1d073bc80abdf975fe77b35f07aee5135e2924661d26e5d299a432c563a3bbc5ff21d1fde07ff2336b32b17067c01adc6697568aabf3ff4882530763f77d96cef2fcc7336e3f8e4a2b8de5df42aaeaeccd9e3681604e677fad555148ced6057d99cab03389bb566b27cc4ea3946a640f05593e5944c74adf5d0649941b8032dc6959bdef917fd7d2da3139b1d3770d411b52752c9299f789ce5de64e802740a8210e1c70e0ffb8aa45a3647b837e2c5d1a7dd676b238268ac7c060bcc771285f21a283c2f0eefb54254086770a4f09140f7b6a118a7df1e06445379080c2cb6a8840b9d70411521107b47751634e3ff6437974ac2e5897e7e15ac8bdbb5325bb1dd09c20f8ac37fa1eaf2765671fd1434460cbf3cc97bf67b19f88b2bfbde99836c27c338b7f19fc20aad90b91e268c87b81aa17026ac5ac74f47c3525fd2d0d584d3b1d75dd360f105f78b2831481802b6a40e88938660d1598947ffb4e7cf75cd67308d6f910be2fb9beafb68d5ea7c3d2f79c3b66223d610a70a6f9ce3c3447bc0acf74e84687c2da5a137b6c14631971e19133a61bfa94c247ae99d771d8efc11d983e2ea904dab4ca479fa00be3b0372e100225311ffb5b95faed4c32b5794cc618ded1027e6f2a54328a5cd322da6c6ef91151cacfa456680547adf18cde5323869bc03b2c7edd731f5e5c9b9eaa7b2f57d4246d324047482a48d7472650b8d0614a0e133e849a09d37bc9f7921d05397b98e398cd3411dde80d9bd6be4384289a2d1a0416cd914e7520cae962493d31b652a520a9fca7d7e6e9e5df53d719e518125b73ea49af30b720a6d0a71089dcaf04da9ee05c4ede6d0ba376c86282293248a4b36a2ac07a3297d569ad4e958c918317a4d526dae47b07f8c6615a77f5831d146c063b88246e2b3ce7b8f4b75291c339c317e3fbc84563694cd749f021b1e0c076521d685f87497831f19cba89601a344c5d1d08f12b2de9d5d068daf760bf87993e89a2912ab29e3fc79af39db18e982bfe0ee0374c84487cabc1f59bc216d71c38654805cddbc338fc8c14413849ea3ef79444ac6078fb2403ecd84de5b678538be0b2580ecb1926e03643ff29464f943cd729ad386daf1f81ea385e79260cdf78d579281adb72946692d54e94a2fd8530dfb8e5923ce642ec92ccee28f6b21efdff24ec820b4eff26f493278acb485af055881e077cdf3017bc6104b2394fee39343b7c71c20cbf7a3ea96b0c7b603a2ff998d27b16833b028bf30ab668041c8d82225d58bd95f9246de742815067046adbf55eddfddfbc30fea3b8c6659d2756c702f2012395245035bf5338427051b4eb392225aa10179d8b042ba77bc1a37cd66a655ec03aa3aa3c75e05aad4ad38240ee0e6c5af85bc7813f2c0de6eccf5cfba2f6295daf448c042c50c6eba6127f170848cc2034bd61698747a3bee155146d2ab73ba79d969cffcba737bd85b20123a5e3080edba483d831c38c9a4aee9a2fdeb0819665cf28aab91f2317f77d22b29f49d6dbd4ae5b82f9529fb208824f22fdd48666dfc0abe4a9d00dd7d552f4bf6fade29b63ad080614bfe04d9fdca7cff96378e201f6e71cc665e6ae8abd64d125a8c222b03f9153824251db960b4eae41280b681a9fa6c1ec76e94bcd9656aa3df3b57f2da9', 'ad': '' }",
        'symmetricKey': "{ 'iv': '0146bfcc7b89a3aa055bedae', 't': '7559a4ef7ca495c9605516cc846007a3', 'd': '4de3ab37e73dd6fc294257fe4cb1af26229434297ecdd309e93a941bd1f9913b5916dfe55d62f0d4015c46f66d8fdf4c84ab88c22e4d24428d5fe6c1affce1e14b33760a382b67b4a37262f9ca5a44cb9760b151bbd0748fc18f8f438545df356d99a66c74ff22b623b2b67d9765f80ac6f18af01684e6e3efbce947832ac0bea010c1cde00390e1f3d2187286ff00a43aef8ddc13a98d8f4f771bba1694712623b115f0b2c0e891eccd074ade0b551737b915d0f1242ffcbc1c65555ff7', 'ad': '' }",
        'email': 'insomnia-user@konghq.com',
        'accountId': 'acct_64a477e6b59d43a5a607f84b4f73e3ce',
        'firstName': 'Rick',
        'lastName': 'Morty',
      },
    });
  },
});
