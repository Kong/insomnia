import { faker } from "@faker-js/faker";

import { expect, test } from "../../misc/fixtures";

test("Verify plugin name validation rejects invalid names and accepts a valid one", async ({
  user,
}) => {
  const { preferencesFlow } = user.flowManager;

  const validName = faker.lorem.slug(2);

  await expect(preferencesFlow.createPlugin("../../evil")).rejects.toThrow(
    /path traversal/i,
  );
  await expect(preferencesFlow.createPlugin("plugin-😀")).rejects.toThrow(
    /lowercase, alphanumeric, and dash-separated/i,
  );
  await expect(preferencesFlow.createPlugin("my plugin")).rejects.toThrow(
    /lowercase, alphanumeric, and dash-separated/i,
  );
  await preferencesFlow.createPlugin(validName);
  await expect(preferencesFlow.createPlugin(validName)).rejects.toThrow();
});
