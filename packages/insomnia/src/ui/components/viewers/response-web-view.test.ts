import { describe, expect, it } from 'vitest';

import { getResponsePreviewHtml, getResponsePreviewSandbox } from './response-web-view';

describe('response-web-view', () => {
  it('injects a base tag into the document head', () => {
    expect(getResponsePreviewHtml('<html><head></head><body>Hello</body></html>', 'https://example.com/path/')).toBe(
      '<html><head><base href="https://example.com/path/"></head><body>Hello</body></html>',
    );
  });

  it('keeps scripts disabled when HTML preview JS is turned off', () => {
    expect(getResponsePreviewSandbox(true)).toBe('');
  });

  it('allows scripts when HTML preview JS is enabled', () => {
    expect(getResponsePreviewSandbox(false)).toBe('allow-scripts');
  });
});
