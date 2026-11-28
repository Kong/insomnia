// @vitest-environment jsdom
/* eslint-disable no-restricted-globals -- this suite runs in the jsdom environment */
import { describe, expect, it } from 'vitest';

import { buildDialogRequest, DIALOG_BODY_RENDER_WAIT_MS, serializeDialogBody } from '../dialog-payload';

describe('buildDialogRequest', () => {
  it('forwards a string body and the layout flags', async () => {
    await expect(
      buildDialogRequest({ title: 'Batch Requests', body: '<p>hello</p>', tall: true, wide: false }),
    ).resolves.toEqual({ title: 'Batch Requests', body: '<p>hello</p>', tall: true, wide: false });
  });

  it('serializes a DOM body to HTML so the request survives Electron IPC', async () => {
    const container = document.createElement('div');
    container.innerHTML = '<button>Run</button>';

    const request = await buildDialogRequest({ title: 'Batch Requests', body: container });

    expect(request).toEqual({ title: 'Batch Requests', body: '<div><button>Run</button></div>' });
    expect(() => structuredClone(request)).not.toThrow();
  });

  it('waits for a plugin that renders into the container asynchronously', async () => {
    const container = document.createElement('div');
    const request = buildDialogRequest({ title: 'Batch Requests', body: container });

    // Matches `createRoot(container).render(...)`: the plugin calls dialog() before it has painted.
    await new Promise(resolve => setTimeout(resolve, 0));
    container.innerHTML = '<span>rendered</span>';

    await expect(request).resolves.toEqual({ title: 'Batch Requests', body: '<div><span>rendered</span></div>' });
  });

  it('gives up waiting after the render window without a body', async () => {
    const container = document.createElement('div');

    await expect(buildDialogRequest({ title: 'Empty', body: container })).resolves.toEqual({
      title: 'Empty',
      body: '<div></div>',
    });
  }, DIALOG_BODY_RENDER_WAIT_MS + 1000);

  it('drops callbacks and unknown options so the request stays cloneable', async () => {
    const request = await buildDialogRequest({ title: 'Batch Requests', body: 'x', onHide: () => {}, extra: 1 });

    expect(request).toEqual({ title: 'Batch Requests', body: 'x' });
    expect(() => structuredClone(request)).not.toThrow();
  });

  it('omits an unsupported body instead of throwing at the IPC boundary', async () => {
    await expect(buildDialogRequest({ title: 'Unsupported', body: 42 })).resolves.toEqual({ title: 'Unsupported' });
  });
});

describe('serializeDialogBody', () => {
  it('ignores a missing body', async () => {
    await expect(serializeDialogBody()).resolves.toBeUndefined();
    await expect(serializeDialogBody(null)).resolves.toBeUndefined();
  });
});
