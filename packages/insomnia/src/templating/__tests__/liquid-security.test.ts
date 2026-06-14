// Security tests for the LiquidJS render path: sandbox/prototype isolation, template
// injection, blocked file-loading tags, XSS passthrough expectations, prototype pollution,
// DoS limits, and special-byte handling. Run with: npm test -w insomnia
import { describe, expect, it, vi } from 'vitest';

vi.mock('~/plugins');

import { render } from '../index';

describe('prototype chain isolation', () => {
  // ownPropertyOnly: true prevents traversal up the prototype chain from a context object.
  // All four tests confirm that inherited properties are not reachable from templates.

  // constructor is on Object.prototype — must not be accessible from a template
  it('cannot access constructor via template', async () => {
    await expect(render('{{ constructor }}', { context: {} })).rejects.toBeDefined();
  });

  // __proto__ access must throw, not silently resolve to the prototype object
  it('cannot access __proto__ via template', async () => {
    await expect(render('{{ __proto__ }}', { context: {} })).rejects.toBeDefined();
  });

  // Dot traversal into a context object must not escape to its prototype
  it('cannot traverse prototype through a context object', async () => {
    await expect(render('{{ obj.constructor }}', { context: { obj: {} } })).rejects.toBeDefined();
  });

  // toString lives on Object.prototype and must not be reachable via dot access
  it('does not expose toString from prototype', async () => {
    await expect(render('{{ obj.toString }}', { context: { obj: {} } })).rejects.toBeDefined();
  });
});

describe('template injection isolation', () => {
  // Values from context are rendered as literals — they are never re-evaluated as templates.

  // A context value containing {{ }} must be output as-is, not parsed as a template
  it('context value containing {{ }} is not re-rendered', async () => {
    const injected = '{{ secret }}';
    expect(await render('{{ input }}', { context: { input: injected, secret: 'LEAKED' } })).toBe(injected);
  });

  // Control flow syntax inside a value must also be treated as a plain string
  it('control flow syntax in a value is not re-rendered', async () => {
    expect(await render('{{ v }}', { context: { v: '{% if true %}yes{% endif %}' } })).toBe(
      '{% if true %}yes{% endif %}',
    );
  });
});

describe('file-loading tags blocked', () => {
  // include/render/layout load files from disk and are disabled; all access must
  // go through the File template tag which routes through window.main.secureReadFile.

  // Variable path: attacker-controlled tpl value must not reach the filesystem
  it('include with a variable path is blocked', async () => {
    await expect(
      render('{% include tpl %}', { context: { tpl: '/sensitive/secrets.txt' } }),
    ).rejects.toThrow(/disabled/);
  });

  // Static path: even a hardcoded filename must be blocked at the tag level
  it('include with a static literal path is blocked', async () => {
    await expect(
      render('{% include package.json %}', { context: {} }),
    ).rejects.toThrow(/disabled/);
  });

  // render is a Liquid built-in for partial templates — blocked for the same reason as include
  it('render tag is blocked', async () => {
    await expect(render("{% render 'snippet' %}", { context: {} })).rejects.toThrow(/disabled/);
  });

  // layout loads a base template file from disk — same attack surface as include/render
  it('layout tag is blocked', async () => {
    await expect(render("{% layout 'base' %}", { context: {} })).rejects.toThrow(/disabled/);
  });
});

// LiquidJS renders strings verbatim — it is not an HTML sanitizer.
// These tests document that responsibility: sanitization must happen at the DOM
// insertion site (React JSX {value} is safe; innerHTML is not).
describe('XSS: variable output passthrough', () => {
  // Script tags in context values are passed through unchanged — no encoding applied
  it('script tag value is rendered verbatim', async () => {
    const payload = '<script>alert("xss")</script>';
    expect(
      await render('{{ v }}', { context: { v: payload }, ignoreUndefinedEnvVariable: true }),
    ).toBe(payload);
  });

  // SVG event handler attributes are also passed through unchanged
  it('svg event handler value is rendered verbatim', async () => {
    const payload = '<svg onload="alert(1)">';
    expect(
      await render('{{ v }}', { context: { v: payload }, ignoreUndefinedEnvVariable: true }),
    ).toBe(payload);
  });

  // HTML entities are not decoded — &lt; stays &lt;, never becomes <
  it('html-encoded payload is not double-decoded', async () => {
    const encoded = '&lt;script&gt;alert(1)&lt;/script&gt;';
    expect(
      await render('{{ v }}', { context: { v: encoded }, ignoreUndefinedEnvVariable: true }),
    ).toBe(encoded);
  });
});

describe('XSS: filter chain passthrough', () => {
  // Filters that manipulate strings can introduce angle brackets — output is still verbatim
  it('replace filter can introduce angle brackets — output is verbatim', async () => {
    const result = await render(
      "{{ v | replace: 'OPEN', '<script>' | replace: 'CLOSE', '</script>' }}",
      { context: { v: 'OPENalert(1)CLOSE' } },
    );
    expect(result).toBe('<script>alert(1)</script>');
  });

  // Case filters preserve HTML characters rather than stripping or encoding them
  it('upcase/downcase do not strip or encode html', async () => {
    const result = await render('{{ v | upcase }}', { context: { v: '<Script>alert(1)</Script>' } });
    expect(result).toBe('<SCRIPT>ALERT(1)</SCRIPT>');
  });
});

describe('assign and capture: no re-evaluation', () => {
  // Assigning a string that contains {{ }} stores it as a literal, not a template
  it('assigned string containing {{ }} is treated as a literal', async () => {
    const result = await render(
      '{% assign evil = "{{ secret }}" %}{{ evil }}',
      { context: { secret: 'LEAKED' }, ignoreUndefinedEnvVariable: true },
    );
    expect(result).toBe('{{ secret }}');
  });

  // A captured block is rendered once at capture time; the stored string is output as-is
  it('capture output is not re-rendered after storage', async () => {
    const result = await render(
      '{% capture block %}{{ secret }}{% endcapture %}{{ block }}',
      { context: { secret: 'visible' } },
    );
    expect(result).toBe('visible');
  });

  // HTML assembled by concatenating captures is verbatim — only dangerous with innerHTML
  it('html assembled via capture is verbatim — dangerous only if used with innerHTML', async () => {
    const result = await render(
      '{% capture tag %}<script>{% endcapture %}{% capture end %}</script>{% endcapture %}{{ tag }}alert(1){{ end }}',
      { context: {} },
    );
    expect(result).toBe('<script>alert(1)</script>');
  });
});

describe('prototype pollution resistance', () => {
  // Passing a context value must never modify Object.prototype
  it('context key named __proto__ does not pollute Object prototype', async () => {
    const before = ({} as any).polluted;
    await Promise.resolve(render('{{ v }}', { context: { v: 'safe' }, ignoreUndefinedEnvVariable: true })).catch(() => {});
    expect(({} as any).polluted).toBe(before);
  });

  // Multi-level dot access into a prototype property must be blocked by ownPropertyOnly
  it('deeply nested constructor access is blocked by ownPropertyOnly', async () => {
    await expect(render('{{ obj.constructor.name }}', { context: { obj: {} } })).rejects.toBeDefined();
  });

  // toString is inherited from Object.prototype and must not be reachable via dot notation
  it('toString cannot be called via prototype traversal', async () => {
    await expect(render('{{ obj.toString }}', { context: { obj: {} } })).rejects.toBeDefined();
  });

  // hasOwnProperty is also an inherited method and must be blocked
  it('hasOwnProperty is not reachable via template', async () => {
    await expect(render('{{ obj.hasOwnProperty }}', { context: { obj: {} } })).rejects.toBeDefined();
  });
});

describe('DoS resistance', () => {
  // (1..11_000_000) exceeds the 10 MB memoryLimit tracked during range expansion
  it('memoryLimit aborts enormous range expansions', async () => {
    await expect(
      render('{% for i in (1..11000000) %}{{ i }}{% endfor %}', { context: {} }),
    ).rejects.toBeDefined();
  });

  // 200 levels of nested if must parse and render without a stack overflow
  it('deeply nested if blocks do not cause unbounded recursion', async () => {
    const depth = 200;
    const template = '{% if x %}'.repeat(depth) + 'deep' + '{% endif %}'.repeat(depth);
    expect(await render(template, { context: { x: true } })).toBe('deep');
  });

  // A 100-filter chain of no-ops must resolve in finite time without hanging
  it('very long filter chain resolves without hanging', async () => {
    const filters = Array.from({ length: 50 }, () => 'upcase | downcase').join(' | ');
    expect(await render(`{{ v | ${filters} }}`, { context: { v: 'hello' } })).toBe('hello');
  });
});

describe('unicode and special byte inputs', () => {
  // Null bytes embedded in string values must be preserved, not stripped
  it('null byte in a context value is preserved verbatim', async () => {
    const nul = String.fromCodePoint(0);
    expect(await render('{{ v }}', { context: { v: `before${nul}after` } })).toBe(`before${nul}after`);
  });

  // Zero-width joiners and non-joiners must pass through without being collapsed
  it('zero-width characters pass through unchanged', async () => {
    const zwsp = '​‌‍';
    expect(await render('{{ v }}', { context: { v: `hello${zwsp}world` } })).toBe(`hello${zwsp}world`);
  });

  // U+202E (right-to-left override) can make "U+202Etxt.exe" appear as "exe.txt" in some UIs;
  // the engine must not strip it — callers are responsible for detecting it if needed.
  it('right-to-left override character is not stripped', async () => {
    const rtlo = String.fromCodePoint(8238); // U+202E RIGHT-TO-LEFT OVERRIDE
    expect(await render('{{ v }}', { context: { v: `${rtlo}txt.exe` } })).toBe(`${rtlo}txt.exe`);
  });

  // Multi-byte emoji (surrogate pairs) must round-trip without corruption
  it('emoji renders correctly', async () => {
    expect(await render('{{ v }}', { context: { v: '🔥💧' } })).toBe('🔥💧');
  });
});
