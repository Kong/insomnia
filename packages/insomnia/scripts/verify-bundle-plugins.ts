import { bundlePlugins } from '../config/config.json';

const isModuleInstalled = (moduleName: string) => {
  try {
    console.log(moduleName);
    require.resolve(moduleName);
    return true;
  } catch (e) {
    return false;
  }
};

export const verifyBundlePlugins = () => {
  const executeInGithubActions = process.env.GITHUB_ACTIONS === 'true';

  const missingBundlePlugin = bundlePlugins.find(p => !isModuleInstalled(p.name));
  if (missingBundlePlugin) {
    if (executeInGithubActions) {
      // execute in Github Actions
      console.log('[build] ERROR:', `Required bundle plugins ${missingBundlePlugin.name} is not installed.`);
      process.exit(1);
    }
    console.log('[build] Warning:', `Required bundle plugins ${missingBundlePlugin.name} is not installed.`);
  }
};
