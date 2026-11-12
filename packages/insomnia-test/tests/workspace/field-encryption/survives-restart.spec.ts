import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createBearerRequest } from "./helpers";

// INS-2368 case 07 (Bearer token part): encrypted data stays readable across two restarts
// and no "could not be decrypted" dialog appears. The Cookie Jar half is not covered: the
// framework has no cookie Flow yet.
test("Encrypted Bearer token survives two restarts without a decryption dialog", async ({
  user,
}) => {
  const { request, token } = await createBearerRequest(user);

  for (let restart = 1; restart <= 2; restart++) {
    await user.flowManager.appFlow.restart();

    const [doc] = await user.pageManager.findDocs("insomnia.Request.db", {
      name: request.name,
    });
    expect(doc.authentication.token, `after restart #${restart}`).toBe(token);
    await expect(
      user.pageManager.window.getByRole("dialog").filter({ hasText: /could not be decrypted|encryption key is not available/ }),
    ).toHaveCount(0);
  }
});
