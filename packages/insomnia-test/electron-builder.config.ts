import type { Configuration } from 'electron-builder';

// E2E variant of packages/insomnia/electron-builder.config.js. Keeps sourcemaps
// in the packaged app so E2E coverage can be mapped back to the original source.
// Usage (from packages/insomnia): electron-builder build --config ../insomnia-test/electron-builder.config.ts
const baseConfig: Configuration = require('../insomnia/electron-builder.config.js');

const config: Configuration = {
  ...baseConfig,
  files: (baseConfig.files as any[]).map(entry =>
    typeof entry === 'object' && entry.from === './build' ? { ...entry, filter: ['**/*'] } : entry,
  ),
};

export default config;
