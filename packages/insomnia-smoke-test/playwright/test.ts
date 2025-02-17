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

interface AESMessage {
  iv: string;
  t: string;
  d: string;
  ad: string;
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
      symmetricKey: JsonWebKey;
      publicKey: JsonWebKey;
      encPrivateKey: AESMessage;
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
        'publicKey': {
          'alg': 'RSA-OAEP-256',
          'e': 'AQAB',
          'ext': true,
          'key_ops': ['encrypt'],
          'kty': 'RSA',
          'n': 'pTQVaUaiqggIldSKm6ib6eFRLLoGj9W-2O4gTbiorR-2b8-ZmKUwQ0F-jgYX71AjYaFn5VjOHOHSP6byNAjN7WzJ6A_Z3tytNraLoZfwK8KdfflOCZiZzQeD3nO8BNgh_zEgCHStU61b6N6bSpCKjbyPkmZcOkJfsz0LJMAxrXvFB-I42WYA2vJKReTJKXeYx4d6L_XGNIoYtmGZit8FldT4AucfQUXgdlKvr4_OZmt6hgjwt_Pjcu-_jO7m589mMWMebfUhjte3Lp1jps0MqTOvgRb0FQf5eoBHnL01OZjvFPDKeqlvoz7II9wFNHIKzSvgAKnyemh6DiyPuIukyQ',
        },
        'encPrivateKey': {
          'iv': '3a1f2bdb8acbf15f469d57a2',
          't': '904d6b1bc0ece8e5df6fefb9efefda7c',
          'd': '2a7b0c4beb773fa3e3c2158f0bfa654a88c4041184c3b1e01b4ddd2da2c647244a0d66d258b6abb6a9385251bf5d79e6b03ef35bdfafcb400547f8f88adb8bceb7020f2d873d5a74fb5fc561e7bd67cea0a37c49107bf5c96631374dc44ddb1e4a8b5688dc6560fc6143294ed92c3ad8e1696395dfdf15975aa67b9212366dbfcb31191e4f4fe3559c89a92fb1f0f1cc6cbf90d8a062307fce6e7701f6f5169d9247c56dae79b55fba1e10fde562b971ca708c9a4d87e6e9d9e890b88fa0480360420e610c4e41459570e52ae72f349eadf84fc0a68153722de3280becf8a1762e7faebe964f0ad706991c521feda3440d3e1b22f2c221a80490359879bd47c0d059ace81213c74a1e192dbebd8a80cf58c9eb1fe461a971b88d3899baf4c4ef7141623c93fb4a54758f5e1cf9ee35cd00777fa89b24e4ded57219e770de2670619c6e971935c61ae72e3276cf8db49dfa0e91c68222f02d7e0c69b399af505de7e5a90852d83e0a30934b0362db986f3aaefaaf1a96fef3e8165287a3a7f0ee1e072d9dee3aefb86194e1d877d6b34529d45a70ec4573c35a7fe27833c77c3154b0ad02187e4fcecd408bcf4b29a85a5dc358cb479140f4983fcd936141f581764669651530af97d2b7d9416aea7de67e787f3e29ae3eba6672bcd934dc1e308783aa63a4ab46d48d213cf53ad6bd8828011f5bfa3aa5ee24551c694e829b54c93b1dda6c3ddda04756d68a28bec8d044c8af4147680dc5b972d0ca74299b0ab6306b9e7b99bf0557558df120455a272145b7aa792654730f3d670b76d72408f5ce1cf5fbd453d2903fa72cf26397437854ba8abbb731a8107f6a86a01fa98edc81bb42a4c1330f779e7a0fbd1820eaed78e03e40a996e03884b707556be06fd14ee8f4035469210d1d2bb8f58285fc2ab6de3d3cc0e4e1f40c6d9d24b50dc8e2e2374a0aff52031b3736c2982133bb19dd551ce1f953f4ba02b0cf53382c15752e202c138cb42b2322df103ff17fd886dfd5f992b711673cdf16048c4bff19038138b161c2e1783b85fc7b965a91ac4795fcbfebf827940cacdeae57946863aee027df43b36612f3cb8f34dc44396e87c564bf10f5b1a9dfbd6da3d7f4f65024b0b4f8ce51d01c230840941fc4523b17eb1c2522032f410e8328239a11a15ab755c32945ce52966d5bfb4666909ed2ca04d536e4bf92091563dd44d46cbb35e53c2481400058ab3b52a0280d262551073f61db125ee280e2cc1ec0bdf9c4817824261465011e34c2296411384f7f5e16742157c5520f137631edf498aa39c7c32b107e3634cbeb70feea19a233c8bd939d665135c9f7c1bb33cb47edc58bdbbcde9b0b9eb73a46642e4639289a62638fb7813e1eeaadd105c803de8357236f33c4bcf31a876b5867591af8f165eba0b35cf0b0886af17dab35a6a39f8f576387d6ffb9e677ee46fc0f11ff069a2a068fce441ff8f4125095fad228c2bf45c788d641941ed13c0a16fffcafd7c7eff11bb7550c0b7d54eebdbd2066e3bbdb47aaee2b5f1e499726324a40015458c7de1db0abe872594d8e6802deff7ea9518bdb3a3e46f07139267fd67dc570ba8ab04c2b37ce6a34ec73b802c7052a2eef0cae1b0979322ef86395535db80cf2a9a88aa7c2e5cc28a93612a8dafe1982f741d7cec28a866f6c09dba5b99ead24c3df0ca03c6c5afae41f3d39608a8f49b0d6a0b541a159409791c25ede103eb4f79cfbd0cc9c9aa6b591755c1e9fd07b5b9e38ed85b5939e65d127256f6a4c078f8c9d655c4f072f9cbcfb2e1e17eaa83dc62aaab2a6dc3735ee76ce7a215740f795f1fbe7136c7734ae3714438015e8fc383d63775a8abddb23cbc5f906c046bb0b5b31d492a7c151b40ea82c7c966e25820641c55b343b89d6378f90de5983fa76547e9d6c634effdf019a0fd9b6d3e488a5aa94f0710d517ba4f7c1ed82f9f3072612e953e036c0ec7f3c618368362f6da6f3af76056a66aef914805cc8b628f1c11695f760b535ded9ff66727273ae7e12d67a01243d75f22fec8ed1b043122a211c923aa92ecbbe01dd0d7195c3c0e09a2a6ab3eca354963122d5a0ec16e2b2b81b0ddce6ec0a312c492a96a4fd392f1deb6a1f3318541a3f87e5c9e73ee7edd3b855910f412789e25038108e1eaae04dcfb02b4d958c00c630dc8caa87a40798ce7156d2ade882e68832d39fe8f9bce6a995249a7383013a5093c4af55c3b7232de0f2593d82c30b8dabd0784455037f25f6bb66a6d0d8f72bc7be0dee2d0a8af44bb4e143257d873268d331722c3253ea5c004e72daf04c875e2054f2b4b2bca2979fd046a1e835600045edf2f159d851a540a91a1ab8fbcb64594d21942bbaa2160535d32496ba7ce4a76c6bdeb9bb4c5cab7bed1ae26564058d0be125803d7019b83b3953c4b0cc1f8299c4edcf6a5faa4765092412d368b277689900e71fb5d47581057adaa2dd494e0f66dc1aa16f3741973b0d9ffa1728aeafab84b777394a7afae0f8eabaa6b740f1c60ca26469f0c9356ec880ad6f4dc01b99bd14d7a4bb8afc97662a9e68b0155e4cdf3caa3402819ac6ce562c8fe06edb50a31cfd7a',
          'ad': '',
        },
        'symmetricKey': {
          'alg': 'A256GCM',
          'ext': true,
          'k': 'w62OJNWF4G8iWA8ZrTpModiY8dICyHI7ko1vMLb877g=',
          'key_ops': ['encrypt', 'decrypt'],
          'kty': 'oct',
        },
        'email': 'insomnia-user@konghq.com',
        'accountId': 'acct_64a477e6b59d43a5a607f84b4f73e3ce',
        'firstName': 'Rick',
        'lastName': 'Morty',
      },
    });
  },
});
