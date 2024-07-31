import { describe, expect, it } from 'vitest';

import appPackageJson from '../../../../package.json';
import * as plugin from '../app';

describe('init()', () => {

  it('initializes correctly', async () => {
    const result = plugin.init();
    expect(Object.keys(result)).toEqual(['app', '__private']);
    expect(Object.keys(result.app).sort()).toEqual([
      'alert',
      'clipboard',
      'dialog',
      'getPath',
      'getInfo',
      'prompt',
      'showGenericModalDialog',
      'showSaveDialog',
    ].sort());
    expect(Object.keys(result.app.clipboard).sort()).toEqual([
      'clear',
      'readText',
      'writeText',
    ].sort());
  });
});

describe('app.getInfo()', () => {

  it('provides app info', async () => {
    const result = plugin.init();
    expect(result.app.getInfo()).toEqual({
      'version': appPackageJson.version,
      'platform': process.platform,
    });
  });

});
