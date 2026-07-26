import { describe, expect, it } from 'vitest';

import type { Plugin } from '~/common/plugins/types';
import { buildLiquidEngine } from '~/common/templating/liquid-engine';
import type { PluginTemplateTag, PluginTemplateTagContext } from '~/common/templating/types';

import { createLiquidTag } from '../liquid-extension';
import { describeLiquidParitySurface, findUnprotectedLiquidModelKeys } from '../liquid-extension-parity-surface';

const fakePlugin = { name: 'parity-surface-test-plugin', directory: '' } as unknown as Plugin;

// Drives the real createLiquidTag through a real Liquid engine + real render, capturing the actual
// `util.models` object it builds — never a reimplementation of that object's shape.
const captureLiquidModels = async (): Promise<Record<string, any>> => {
  let captured: Record<string, any> | undefined;
  const captureTag: PluginTemplateTag = {
    name: 'capture_models',
    displayName: 'capture_models',
    description: 'test-only: captures util.models for inspection',
    args: [],
    run: (context: PluginTemplateTagContext) => {
      captured = context.util.models;
      return '';
    },
  };
  const { engine } = buildLiquidEngine({
    tagFactory: (ext, plugin) => createLiquidTag(ext, plugin),
    tags: [{ templateTag: captureTag, plugin: fakePlugin }],
  });
  await engine.parseAndRender('{% capture_models %}', {});
  if (!captured) {
    throw new Error('capture_models tag never ran — util.models was not captured');
  }
  return captured;
};

describe('findUnprotectedLiquidModelKeys against the real createLiquidTag models object', () => {
  // Enforced gate: every models.* path this file tracks must carry its expected protection. See
  // CROSS-TENANT-DB-ACCESS-FINDINGS.md Finding 1.
  it('flags nothing in the real liquid-extension.ts models object', async () => {
    const models = await captureLiquidModels();
    expect(findUnprotectedLiquidModelKeys(models)).toEqual([]);
  });
});

describe('describeLiquidParitySurface / findUnprotectedLiquidModelKeys detector logic', () => {
  // Positive control: a fake models object with none of the expected protections applied must flag
  // every tracked key — this is the exact shape liquid-extension.ts had before this fix landed.
  it('flags every tracked key for an unprotected fake models object', () => {
    const fakeServices = {
      request: { getById: (id: string) => id },
      workspace: { getById: (id: string) => id },
      oAuth2Token: { getByParentId: (id: string) => id },
      cookieJar: { getOrCreateForParentId: (id: string) => id },
      cloudCredential: { getById: (id: string) => id, update: (a: unknown, b: unknown) => ({ a, b }) },
      response: { getLatestForRequestId: (a: string, b: string) => ({ a, b }), getBodyBuffer: (a: unknown) => a },
    };
    const unprotectedModels = {
      request: { getById: fakeServices.request.getById },
      workspace: { getById: fakeServices.workspace.getById },
      oAuth2Token: { getByRequestId: fakeServices.oAuth2Token.getByParentId },
      cookieJar: {
        getOrCreateForParentId: fakeServices.cookieJar.getOrCreateForParentId,
        getCookiesForUrl: fakeServices.cookieJar.getOrCreateForParentId,
      },
      response: {
        getLatestForRequestId: fakeServices.response.getLatestForRequestId,
        getBodyBuffer: fakeServices.response.getBodyBuffer,
      },
      cloudCredential: { getById: fakeServices.cloudCredential.getById, update: fakeServices.cloudCredential.update },
    };
    expect(findUnprotectedLiquidModelKeys(unprotectedModels)).toEqual([
      'request.getById',
      'workspace.getById',
      'oAuth2Token.getByRequestId',
      'cookieJar.getOrCreateForParentId',
      'cookieJar.getCookiesForUrl',
      'response.getLatestForRequestId',
      'cloudCredential.getById',
      'cloudCredential.update',
      'response.getBodyBuffer',
    ]);
  });

  // Negative control: a fake models object shaped like the fix must flag nothing.
  it('flags nothing for a fake models object shaped like the fix', () => {
    const protectedModels = {
      request: { getById: (id: string) => `services.request.getById(${String(id)})` },
      workspace: { getById: (id: string) => `services.workspace.getById(${String(id)})` },
      oAuth2Token: { getByRequestId: (id: string) => `services.oAuth2Token.getByParentId(${String(id)})` },
      cookieJar: {
        getOrCreateForParentId: (id: string) => `services.cookieJar.getOrCreateForParentId(${String(id)})`,
        getCookiesForUrl: (id: string) => `services.cookieJar.getOrCreateForParentId(${String(id)})`,
      },
      response: {
        getLatestForRequestId: (a: string, b: string) =>
          `services.response.getLatestForRequestId(${String(a)}, ${String(b)})`,
        getBodyBuffer: (_response: unknown, _readFailureValue?: string) =>
          'readResponseBodyBufferOwned(response, readFailureValue)',
      },
      cloudCredential: {
        getById: (id: string) => `services.cloudCredential.getById(${String(id)})`,
        update: (_originCredential: unknown, _patch: unknown) =>
          'reloadCloudCredentialForTrustedUpdate(originCredential, patch)',
      },
    };
    expect(describeLiquidParitySurface(protectedModels).every(e => e.protected)).toBe(true);
  });
});
