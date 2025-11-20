import { describe, expect, it } from 'vitest';

import appPackageJson from '../../../../package.json';
import * as plugin from '../app';

describe('init()', () => {
  it('initializes correctly', async () => {
    const result = plugin.init();
    expect(Object.keys(result)).toEqual(['app']);
    expect(Object.keys(result.app).toSorted()).toEqual(
      ['alert', 'clipboard', 'dialog', 'getPath', 'getInfo', 'prompt', 'showSaveDialog'].toSorted(),
    );
    expect(Object.keys(result.app.clipboard).toSorted()).toEqual(['clear', 'readText', 'writeText'].toSorted());
  });
});

describe('app.getInfo()', () => {
  it('provides app info', async () => {
    const result = plugin.init();
    expect(result.app.getInfo()).toEqual({
      version: appPackageJson.version,
      platform: process.platform,
    });
  });
});
