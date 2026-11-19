import { test } from "@package/misc/fixtures";
import { createBearerRequest } from "@package/tests/workspace/field-encryption/helpers";
import { expect } from "@playwright/test";

test("Request with Bearer auth sends the original token, not the stored ciphertext", async ({
  user,
}) => {
  const { request, token } = await createBearerRequest(user);

  const response = await user.flowManager.httpRequestFlow.send(request);

  expect(response.statusBar.code).toBe(200);
  expect(response.preview).toMatchObject({
    headers: expect.objectContaining({ authorization: `Bearer ${token}` }),
  });
});
