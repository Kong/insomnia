import { faker } from "@faker-js/faker";
import { ENCRYPTED_VALUE, readRawDbText, readRawDocs } from "@package/misc/db";
import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createBearerRequest } from "./helpers";

// INS-2368 case 07: the Bearer token and the cookie stay intact across two restarts, with no "could not be
// decrypted" dialog, and are shown in the app (the request's database record and the Cookie Jar dialog).
test("Encrypted Bearer token and cookie survive two restarts without a decryption dialog", async ({
  user,
  dataPath,
}) => {
  const { cookieFlow, appFlow } = user.flowManager;
  const { collection, request, token } = await createBearerRequest(user);
  const cookieValue = `restart-cookie-value-${faker.string.alphanumeric(10)}`;
  await cookieFlow.link(collection, [{ key: "session", value: cookieValue, domain: "example.com", path: "/" }]);

  const expectIntact = async (when: string) => {
    const [doc] = await user.pageManager.findDocs("insomnia.Request.db", { name: request.name });
    expect(doc.authentication.token, `token ${when}`).toBe(token);

    const cookies = await cookieFlow.get(collection);
    expect(cookies, `cookie in the Cookie Jar ${when}`).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "session", value: cookieValue })]),
    );

    // Still ciphertext on disk
    const jarCookies = readRawDocs(dataPath, "CookieJar").flatMap((jar) => jar.cookies ?? []);
    const stored = jarCookies.find((cookie: any) => cookie.key === "session");
    expect(stored?.value, `cookie on disk ${when}`).toMatch(ENCRYPTED_VALUE);
    expect(readRawDbText(dataPath)).not.toContain(cookieValue);
    expect(readRawDbText(dataPath)).not.toContain(token);

    await expect(
      user.pageManager.window
        .getByRole("dialog")
        .filter({ hasText: /could not be decrypted|encryption key is not available/ }),
      `no decryption dialog ${when}`,
    ).toHaveCount(0);
  };

  await expectIntact("before any restart");
  for (const restart of [1, 2]) {
    await appFlow.restart();
    await expectIntact(`after restart #${restart}`);
  }
});
