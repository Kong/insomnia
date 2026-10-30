// E2E variant of packages/insomnia/electron-builder.config.cjs. Keeps sourcemaps
// in the packaged app so E2E coverage can be mapped back to the original source.
// Usage (from packages/insomnia): electron-builder build --config ../insomnia-test/electron-builder.config.cjs
const baseConfig = require('../insomnia/electron-builder.config.cjs');

module.exports = {
  ...baseConfig,
  files: baseConfig.files.map(entry =>
    typeof entry === 'object' && entry.from === './build' ? { ...entry, filter: ['**/*'] } : entry,
  ),
};
