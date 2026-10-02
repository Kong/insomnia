import { expect, test } from "../../misc/fixtures";

test("Verify the app's bundled plugins are reported by the plugin bridge and stay off the user-installed Plugins list", async ({
  user,
}) => {
  const { preferencesFlow } = user.flowManager;
  const { preferencesPage } = user.pageManager;

  const bundlePlugins = await preferencesPage.getBundlePlugins();
  const userPluginNames = await preferencesFlow.getInstalledPlugins();

  const bundlePluginNames = bundlePlugins.map((p) => p.name);

  expect(bundlePluginNames).toEqual(
    expect.arrayContaining([
      "@kong/insomnia-plugin-external-vault",
      "@kong/insomnia-plugin-ai",
    ]),
  );
  expect(bundlePlugins.every((p) => p.permissionsDeclared === false)).toBe(
    true,
  );
  expect(bundlePlugins.every((p) => p.config.disabled === false)).toBe(true);
  expect(userPluginNames).not.toEqual(
    expect.arrayContaining(bundlePluginNames),
  );
});
