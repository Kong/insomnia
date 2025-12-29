import { bundlePlugins } from '../config/config.json';

const isModuleInstalled = (moduleName: string) => {
  try {
    require.resolve(moduleName);
    return true;
  } catch {
    return false;
  }
};

export const verifyBundlePlugins = () => {
  const executeInGithubActions = process.env.GITHUB_ACTIONS === 'true';
  // ++
  const skipVerify = process.env.SKIP_BUNDLE_PLUGIN_VERIFY === 'true';

  if (!executeInGithubActions || skipVerify) {
    console.log('[NPM Install] Skipping bundle plugin verification');
    return;
  }

  console.log('[NPM Install] Verifying bundle plugins...');
  const missingBundlePlugin = bundlePlugins.find(p => !isModuleInstalled(p.name));
  if (missingBundlePlugin) {
    console.error(
      '[npm install] ERROR:',
      `Required bundle plugin module ${missingBundlePlugin.name} is not installed.`,
    );
    process.exit(1);
  }
};
  // ++


//   if (executeInGithubActions) {
//     console.log('[NPM Install] Verifying bundle plugins...');
//     const missingBundlePlugin = bundlePlugins.find(p => !isModuleInstalled(p.name));
//     if (missingBundlePlugin) {
//       // execute in Github Actions
//       console.error(
//         '[npm install] ERROR:',
//         `Required bundle plugin module ${missingBundlePlugin.name} is not installed.`,
//       );
//       process.exit(1);
//     }
//   }
// };

verifyBundlePlugins();

