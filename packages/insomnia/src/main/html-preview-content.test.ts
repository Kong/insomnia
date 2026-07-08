import { describe, expect, it } from 'vitest';

import { buildPreviewHtml } from './html-preview-content';

describe('buildPreviewHtml', () => {
  it('injects a base tag into the document head', () => {
    expect(buildPreviewHtml('<html><head></head><body>Hello</body></html>', 'https://example.com/path/')).toBe(
      '<html><head><base href="https://example.com/path/"></head><body>Hello</body></html>',
    );
  });

  it('escapes HTML-significant characters in the injected base href', () => {
    expect(buildPreviewHtml('<head></head>', 'https://example.com/"><script>alert(1)</script>')).toBe(
      '<head><base href="https://example.com/&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"></head>',
    );
  });

  it('leaves the body untouched when there is no head to inject into', () => {
    expect(buildPreviewHtml('<body>no head here</body>', 'https://example.com/')).toBe('<body>no head here</body>');
  });
});
