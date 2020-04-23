/**
 * This module combines the functionality of several Kong plugins into one.
 * NOTE: You should not need to update this file, as it plugins from the package.json dependencies
 */
const { dependencies } = require('./package.json');
const bundledPlugins = Object.keys(dependencies)
  .filter(name => name.indexOf('insomnia-plugin-') === 0)
  .map(name => require(name));

// Iterate over all plugins
for (const plugin of bundledPlugins) {
  // Combine exports from each plugin
  for (const exportName of Object.keys(plugin)) {
    const moduleExport = plugin[exportName];

    // Safety check (all plugin API exports are Arrays)
    if (!Array.isArray(moduleExport)) {
      continue;
    }

    // Initialize export if doesn't exist yet
    if (!module.exports[exportName]) {
      module.exports[exportName] = [];
    }

    // Add exports to this module
    module.exports[exportName].push(...moduleExport);
  }
}
