import { describe, expect, it } from 'vitest';

import { getResponsePreviewHtml, getResponsePreviewSandbox } from './response-web-view';

describe('response-web-view', () => {
  it('injects a base tag into the document head', () => {
    expect(getResponsePreviewHtml('<html><head></head><body>Hello</body></html>', 'https://example.com/path/')).toBe(
      '<html><head><base href="https://example.com/path/"></head><body>Hello</body></html>',
    );
  });

  it('escapes HTML-significant characters in the injected base href', () => {
    expect(getResponsePreviewHtml('<head></head>', 'https://example.com/"><script>alert(1)</script>')).toBe(
      '<head><base href="https://example.com/&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"></head>',
    );
  });

  it('keeps scripts disabled when HTML preview JS is turned off', () => {
    expect(getResponsePreviewSandbox(true)).toBe('');
  });

  it('allows scripts when HTML preview JS is enabled', () => {
    expect(getResponsePreviewSandbox(false)).toBe('allow-scripts');
  });

  it('never grants allow-same-origin in any sandbox state', () => {
    expect(getResponsePreviewSandbox(true)).not.toContain('allow-same-origin');
    expect(getResponsePreviewSandbox(false)).not.toContain('allow-same-origin');
  });
});
