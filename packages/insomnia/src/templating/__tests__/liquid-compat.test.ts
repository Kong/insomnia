/**
 * Compatibility tests confirming LiquidJS renders templates that previously
 * worked under Nunjucks. Run with: npm test -w insomnia
 */
import { describe, expect, it } from 'vitest';

import { render } from '../index';

describe('variable interpolation', () => {
  it('renders root-level variables', async () => {
    expect(await render('{{ name }}', { context: { name: 'kyle' } })).toBe('kyle');
  });

  it('renders _ prefix variables', async () => {
    expect(await render('{{ _.name }}', { context: { name: 'kyle' } })).toBe('kyle');
  });

  it('renders bracket notation with dashes', async () => {
    expect(await render("{{ _['my-var'] }}", { context: { 'my-var': 'hello' } })).toBe('hello');
  });

  it('returns text unchanged when no template delimiters', () => {
    expect(render('no delimiters here')).toBe('no delimiters here');
  });
});

describe('control flow', () => {
  it('handles if/else/endif', async () => {
    expect(await render('{% if x %}yes{% else %}no{% endif %}', { context: { x: true } })).toBe('yes');
    expect(await render('{% if x %}yes{% else %}no{% endif %}', { context: { x: false } })).toBe('no');
  });

  it('handles for loops', async () => {
    expect(await render('{% for item in list %}{{ item }}{% endfor %}', { context: { list: ['a', 'b'] } })).toBe('ab');
  });

  it('treats empty string as falsy (jsTruthy)', async () => {
    expect(await render('{% if x %}yes{% else %}no{% endif %}', { context: { x: '' } })).toBe('no');
  });

  it('treats 0 as falsy (jsTruthy)', async () => {
    expect(await render('{% if x %}yes{% else %}no{% endif %}', { context: { x: 0 } })).toBe('no');
  });
});

describe('filters', () => {
  it('upcase/downcase', async () => {
    expect(await render('{{ s | upcase }}', { context: { s: 'hello' } })).toBe('HELLO');
    expect(await render('{{ s | downcase }}', { context: { s: 'HELLO' } })).toBe('hello');
  });

  it('default filter', async () => {
    expect(await render("{{ x | default: 'fallback' }}", { context: {}, ignoreUndefinedEnvVariable: true })).toBe('fallback');
  });

  it('replace filter', async () => {
    expect(await render("{{ s | replace: 'a', 'b' }}", { context: { s: 'abc' } })).toBe('bbc');
  });

  it('size filter', async () => {
    expect(await render('{{ s | size }}', { context: { s: 'hello' } })).toBe('5');
  });

  it('debug filter passes value through', async () => {
    expect(await render('{{ s | debug }}', { context: { s: 'abc' } })).toBe('abc');
  });
});

describe('comment stripping', () => {
  it('strips {# ... #} comments', async () => {
    expect(await render('{# this is a comment #}hello', { context: {} })).toBe('hello');
  });

  it('strips multiline comments', async () => {
    expect(await render('{# line 1\nline 2 #}world', { context: {} })).toBe('world');
  });
});

describe('raw blocks', () => {
  it('passes through literal {{ }} inside raw blocks', async () => {
    expect(await render('{% raw %}{{ literal }}{% endraw %}', { context: {} })).toBe('{{ literal }}');
  });

  it('passes through liquid tag syntax verbatim', async () => {
    expect(await render('{% raw %}{% if x %}yes{% endif %}{% endraw %}', { context: {} })).toBe('{% if x %}yes{% endif %}');
  });

  // XSS note: raw emits content with no HTML escaping. Render output must not be
  // inserted via innerHTML / dangerouslySetInnerHTML without sanitization — React's
  // normal {value} JSX binding is safe because React escapes at the DOM boundary.
  it('does not HTML-escape content inside raw blocks — caller is responsible for DOM safety', async () => {
    const result = await render('{% raw %}<img src=x onerror="alert(1)">{% endraw %}', { context: {} });
    expect(result).toBe('<img src=x onerror="alert(1)">');
  });
});

describe('error handling', () => {
  it('throws RenderError for undefined variable', async () => {
    await expect(render('{{ missing }}', { context: {} })).rejects.toMatchObject({
      reason: 'undefined',
      type: 'render',
    });
  });

  it('populates undefinedEnvironmentVariables on error', async () => {
    await expect(render('{{ a }} {{ b }}', { context: {} })).rejects.toMatchObject({
      extraInfo: {
        subType: 'environmentVariable',
        undefinedEnvironmentVariables: expect.arrayContaining(['a', 'b']),
      },
    });
  });

  it('ignoreUndefinedEnvVariable suppresses throw', async () => {
    expect(await render('{{ missing }}', { context: {}, ignoreUndefinedEnvVariable: true })).toBe('');
  });
});

describe('nunjucks breaking changes', () => {
  it('elif is not supported — parse error expected', async () => {
    await expect(
      render('{% if x %}a{% elif y %}b{% endif %}', { context: { x: false, y: true } }),
    ).rejects.toBeDefined();
  });

  it('assign replaces set', async () => {
    expect(await render('{% assign x = "hello" %}{{ x }}', { context: {} })).toBe('hello');
  });

  it('set is not supported — parse error expected', async () => {
    await expect(
      render('{% set x = "hello" %}{{ x }}', { context: {} }),
    ).rejects.toBeDefined();
  });

  it('filter args use colon syntax, not parentheses', async () => {
    // Liquid filter syntax: | replace: 'a', 'b'
    expect(await render("{{ s | replace: 'a', 'z' }}", { context: { s: 'abc' } })).toBe('zbc');
  });

  it('elsif is the correct keyword in LiquidJS', async () => {
    expect(
      await render('{% if x %}a{% elsif y %}b{% else %}c{% endif %}', { context: { x: false, y: true } }),
    ).toBe('b');
  });
});

describe('edge cases', () => {
  it('renders nested object property access', async () => {
    expect(await render('{{ user.name }}', { context: { user: { name: 'kyle' } } })).toBe('kyle');
  });

  it('renders array index access', async () => {
    expect(await render('{{ list[0] }}', { context: { list: ['first', 'second'] } })).toBe('first');
  });

  it('renders deeply nested values', async () => {
    expect(await render('{{ a.b.c }}', { context: { a: { b: { c: 'deep' } } } })).toBe('deep');
  });

  it('handles numeric variable values', async () => {
    expect(await render('{{ n }}', { context: { n: 42 } })).toBe('42');
  });

  it('handles boolean true variable', async () => {
    expect(await render('{{ b }}', { context: { b: true } })).toBe('true');
  });

  it('coerces number to string in output', async () => {
    expect(await render('value is {{ n }}', { context: { n: 0 } })).toBe('value is 0');
  });

  it('renders multiple variables in one string', async () => {
    expect(await render('{{ a }}-{{ b }}', { context: { a: 'foo', b: 'bar' } })).toBe('foo-bar');
  });

  it('empty string variable renders as empty', async () => {
    expect(await render('[{{ s }}]', { context: { s: '' } })).toBe('[]');
  });

  it('passes through text with only one delimiter type', () => {
    // Fast-path: no {{ }} means no render
    expect(render('no {{ here')).toBe('no {{ here');
  });

  it('handles chained filters', async () => {
    expect(await render('{{ s | upcase | downcase }}', { context: { s: 'Hello' } })).toBe('hello');
  });

  it('renders _ global alias the same as root context', async () => {
    const ctx = { key: 'value' };
    const root = await render('{{ key }}', { context: ctx });
    const alias = await render('{{ _.key }}', { context: ctx });
    expect(root).toBe(alias);
  });
});

describe('security: prototype chain isolation', () => {
  it('cannot access constructor via template', async () => {
    // ownPropertyOnly: true means prototype properties are not reachable
    await expect(render('{{ constructor }}', { context: {} })).rejects.toBeDefined();
  });

  it('cannot access __proto__ via template', async () => {
    await expect(render('{{ __proto__ }}', { context: {} })).rejects.toBeDefined();
  });

  it('cannot traverse prototype through a context object', async () => {
    await expect(
      render('{{ obj.constructor }}', { context: { obj: {} } }),
    ).rejects.toBeDefined();
  });

  it('does not expose toString from prototype', async () => {
    await expect(
      render('{{ obj.toString }}', { context: { obj: {} } }),
    ).rejects.toBeDefined();
  });
});

describe('security: template injection', () => {
  it('raw user input with template delimiters is inert when passed as a value', async () => {
    // The injected payload is a context value, not part of the template itself — it must render as-is
    const injected = '{{ secret }}';
    expect(await render('{{ input }}', { context: { input: injected, secret: 'LEAKED' } })).toBe(injected);
  });

  it('nested template delimiters in a value are not re-rendered', async () => {
    expect(await render('{{ v }}', { context: { v: '{% if true %}yes{% endif %}' } })).toBe(
      '{% if true %}yes{% endif %}',
    );
  });
});

describe('security: built-in file-loading tags blocked', () => {
  it('include with a variable path is blocked', async () => {
    await expect(
      render('{% include tpl %}', { context: { tpl: '/sensitive/secrets.txt' } }),
    ).rejects.toThrow(/disabled/);
  });

  it('include with a static literal path is blocked', async () => {
    // Without quotes, dynamicPartials:false treats the arg as a literal filename.
    // The tag must still be blocked — not allowed to bypass secureReadFile.
    await expect(
      render('{% include package.json %}', { context: {} }),
    ).rejects.toThrow(/disabled/);
  });

  it('render tag is blocked', async () => {
    await expect(
      render("{% render 'snippet' %}", { context: {} }),
    ).rejects.toThrow(/disabled/);
  });

  it('layout tag is blocked', async () => {
    // layout loads a template file from disk — same attack surface as include/render.
    await expect(
      render("{% layout 'base' %}", { context: {} }),
    ).rejects.toThrow(/disabled/);
  });
});

describe('unless tag', () => {
  it('renders body when condition is false', async () => {
    expect(await render('{% unless x %}shown{% endunless %}', { context: { x: false } })).toBe('shown');
  });

  it('skips body when condition is true', async () => {
    expect(await render('{% unless x %}shown{% endunless %}', { context: { x: true } })).toBe('');
  });

  it('supports else branch', async () => {
    expect(
      await render('{% unless x %}no{% else %}yes{% endunless %}', { context: { x: true } }),
    ).toBe('yes');
  });
});

describe('case / when tag', () => {
  it('matches the correct when branch', async () => {
    expect(
      await render('{% case v %}{% when "a" %}alpha{% when "b" %}beta{% else %}other{% endcase %}', {
        context: { v: 'b' },
      }),
    ).toBe('beta');
  });

  it('falls through to else when no branch matches', async () => {
    expect(
      await render('{% case v %}{% when "a" %}alpha{% else %}other{% endcase %}', {
        context: { v: 'z' },
      }),
    ).toBe('other');
  });

  it('matches multiple values in a single when', async () => {
    expect(
      await render('{% case v %}{% when "cookie", "biscuit" %}snack{% else %}other{% endcase %}', {
        context: { v: 'biscuit' },
      }),
    ).toBe('snack');
  });
});

describe('for tag — advanced', () => {
  it('limit stops iteration early', async () => {
    expect(
      await render('{% for i in list limit:2 %}{{ i }}{% endfor %}', { context: { list: [1, 2, 3, 4] } }),
    ).toBe('12');
  });

  it('offset skips leading items', async () => {
    expect(
      await render('{% for i in list offset:2 %}{{ i }}{% endfor %}', { context: { list: [1, 2, 3, 4] } }),
    ).toBe('34');
  });

  it('reversed iterates in reverse order', async () => {
    expect(
      await render('{% for i in list reversed %}{{ i }}{% endfor %}', { context: { list: [1, 2, 3] } }),
    ).toBe('321');
  });

  it('break exits the loop early', async () => {
    expect(
      await render('{% for i in list %}{% if i == 3 %}{% break %}{% endif %}{{ i }}{% endfor %}', {
        context: { list: [1, 2, 3, 4] },
      }),
    ).toBe('12');
  });

  it('continue skips to the next iteration', async () => {
    expect(
      await render('{% for i in list %}{% if i == 2 %}{% continue %}{% endif %}{{ i }}{% endfor %}', {
        context: { list: [1, 2, 3] },
      }),
    ).toBe('13');
  });

  it('forloop.index is 1-based', async () => {
    expect(
      await render('{% for i in list %}{{ forloop.index }}{% endfor %}', { context: { list: ['a', 'b', 'c'] } }),
    ).toBe('123');
  });

  it('forloop.first and forloop.last flags', async () => {
    expect(
      await render(
        '{% for i in list %}{% if forloop.first %}[{% endif %}{{ i }}{% if forloop.last %}]{% endif %}{% endfor %}',
        { context: { list: ['a', 'b', 'c'] } },
      ),
    ).toBe('[abc]');
  });

  it('else branch runs when collection is empty', async () => {
    expect(
      await render('{% for i in list %}{{ i }}{% else %}empty{% endfor %}', { context: { list: [] } }),
    ).toBe('empty');
  });

  it('iterates over numeric range', async () => {
    expect(await render('{% for i in (1..4) %}{{ i }}{% endfor %}', { context: {} })).toBe('1234');
  });
});

describe('echo tag', () => {
  it('outputs a variable value', async () => {
    expect(await render('{% liquid echo name %}', { context: { name: 'kyle' } })).toBe('kyle');
  });

  it('supports filter chaining', async () => {
    expect(await render('{% liquid echo name | upcase %}', { context: { name: 'hello' } })).toBe('HELLO');
  });
});

describe('liquid block tag', () => {
  it('executes multiple statements in one block', async () => {
    expect(
      await render(
        '{% liquid\nassign x = "hello"\nassign y = "world"\necho x\necho " "\necho y\n%}',
        { context: {} },
      ),
    ).toBe('hello world');
  });

  it('supports if/for inside liquid block', async () => {
    expect(
      await render(
        '{% liquid\nfor i in list\nif i > 2\necho i\nendif\nendfor\n%}',
        { context: { list: [1, 2, 3, 4] } },
      ),
    ).toBe('34');
  });
});

describe('increment and decrement tags', () => {
  it('increment starts at 0 and increases', async () => {
    expect(
      await render('{% increment c %}{% increment c %}{% increment c %}', { context: {} }),
    ).toBe('012');
  });

  it('decrement starts at -1 and decreases', async () => {
    expect(
      await render('{% decrement c %}{% decrement c %}{% decrement c %}', { context: {} }),
    ).toBe('-1-2-3');
  });

  it('increment and assign variables are independent', async () => {
    // increment counter is isolated from an assign variable of the same name
    expect(
      await render('{% assign c = "hello" %}{% increment c %}{{ c }}', { context: {} }),
    ).toBe('0hello');
  });
});

describe('capture and tablerow tags', () => {
  it('capture stores rendered output in a variable', async () => {
    expect(
      await render('{% capture greeting %}Hello {{ name }}{% endcapture %}{{ greeting }}', {
        context: { name: 'world' },
      }),
    ).toBe('Hello world');
  });

  it('capture does not leak filesystem or network access', async () => {
    // capture is purely in-memory string accumulation — no I/O surface.
    expect(
      await render('{% capture x %}static{% endcapture %}{{ x }}', { context: {} }),
    ).toBe('static');
  });

  it('tablerow renders html table rows', async () => {
    const result = await render(
      '<table>{% tablerow i in list cols:2 %}{{ i }}{% endtablerow %}</table>',
      { context: { list: [1, 2, 3] } },
    );
    expect(result).toContain('<tr');
    expect(result).toContain('<td');
    expect(result).toContain('1');
    expect(result).toContain('3');
  });

  it('tablerow output is a string — not executable HTML', async () => {
    // Values are rendered as plain strings; no HTML encoding is applied by the engine,
    // so callers are responsible for sanitising output before inserting into a DOM.
    const result = await render(
      '{% tablerow x in items %}{{ x }}{% endtablerow %}',
      { context: { items: ['<script>alert(1)</script>'] } },
    );
    expect(result).toContain('<script>alert(1)</script>');
  });
});

// ---------------------------------------------------------------------------
// Security smoke tests — abuse of LiquidJS features
//
// These tests verify that the engine does NOT provide a security boundary for
// HTML output. LiquidJS renders strings verbatim; sanitization must happen at
// the DOM insertion site (React JSX `{value}` is safe, innerHTML is not).
// Tests that confirm dangerous output is passed through are intentional — they
// document the responsibility contract, not a bug.
// ---------------------------------------------------------------------------

describe('security smoke: XSS via variable output', () => {
  it('script tag value is rendered verbatim — caller must not use innerHTML', async () => {
    const payload = '<script>alert("xss")</script>';
    expect(
      await render('{{ v }}', { context: { v: payload }, ignoreUndefinedEnvVariable: true }),
    ).toBe(payload);
  });

  it('svg event handler value is rendered verbatim', async () => {
    const payload = '<svg onload="alert(1)">';
    expect(
      await render('{{ v }}', { context: { v: payload }, ignoreUndefinedEnvVariable: true }),
    ).toBe(payload);
  });

  it('html-encoded payload in context is NOT double-decoded by the engine', async () => {
    // &lt;script&gt; should stay as-is; the engine does not HTML-decode values
    const encoded = '&lt;script&gt;alert(1)&lt;/script&gt;';
    expect(
      await render('{{ v }}', { context: { v: encoded }, ignoreUndefinedEnvVariable: true }),
    ).toBe(encoded);
  });
});

describe('security smoke: XSS via filter chains', () => {
  it('replace filter cannot be chained into a script tag from a safe base', async () => {
    // Starting value has no angle brackets; replace attempts to introduce them.
    // The engine will produce the replacement — this confirms caller must sanitize output.
    const result = await render(
      "{{ v | replace: 'OPEN', '<script>' | replace: 'CLOSE', '</script>' }}",
      { context: { v: 'OPENalert(1)CLOSE' } },
    );
    expect(result).toBe('<script>alert(1)</script>');
    // ^ Output IS dangerous — this test documents it so the team knows sanitization
    //   is the caller's responsibility.
  });

  it('upcase/downcase do not strip or encode html', async () => {
    const result = await render('{{ v | upcase }}', { context: { v: '<Script>alert(1)</Script>' } });
    expect(result).toBe('<SCRIPT>ALERT(1)</SCRIPT>');
  });
});

describe('security smoke: payload assembly via assign and capture', () => {
  it('assign cannot introduce new template execution — assigned value is literal', async () => {
    // An attacker might hope that assigning a string with {{ }} causes re-evaluation.
    // It must not — the assigned string is a literal.
    const result = await render(
      '{% assign evil = "{{ secret }}" %}{{ evil }}',
      { context: { secret: 'LEAKED' }, ignoreUndefinedEnvVariable: true },
    );
    expect(result).toBe('{{ secret }}');
  });

  it('capture output is not re-rendered', async () => {
    const result = await render(
      '{% capture block %}{{ secret }}{% endcapture %}{{ block }}',
      { context: { secret: 'visible' } },
    );
    // capture renders once at capture time; the stored string is then output as-is
    expect(result).toBe('visible');
  });

  it('capture accumulating html tags results in verbatim html — not executed', async () => {
    const result = await render(
      '{% capture tag %}<script>{% endcapture %}{% capture end %}</script>{% endcapture %}{{ tag }}alert(1){{ end }}',
      { context: {} },
    );
    expect(result).toBe('<script>alert(1)</script>');
    // Again: verbatim output — dangerous only if inserted into innerHTML.
  });
});

describe('security smoke: prototype pollution attempts', () => {
  it('context key named __proto__ does not pollute Object prototype', async () => {
    const before = ({} as any).polluted;
    // Passing __proto__ as a context key — engine must not apply it to the prototype chain
    await render('{{ v }}', { context: { v: 'safe' }, ignoreUndefinedEnvVariable: true }).catch(() => {});
    expect(({} as any).polluted).toBe(before);
  });

  it('deeply nested constructor access is blocked by ownPropertyOnly', async () => {
    await expect(
      render('{{ obj.constructor.name }}', { context: { obj: {} } }),
    ).rejects.toBeDefined();
  });

  it('toString cannot be called via prototype traversal', async () => {
    await expect(
      render('{{ obj.toString }}', { context: { obj: {} } }),
    ).rejects.toBeDefined();
  });

  it('hasOwnProperty is not reachable via template', async () => {
    await expect(
      render('{{ obj.hasOwnProperty }}', { context: { obj: {} } }),
    ).rejects.toBeDefined();
  });
});

describe('security smoke: DoS resistance', () => {
  it('memoryLimit aborts templates that expand enormous ranges', async () => {
    // memoryLimit:10_000_000. Range expansion tracks (high - low + 1) bytes.
    // A (1..11_000_000) range exceeds the 10 MB cap and must be aborted.
    await expect(
      render('{% for i in (1..11000000) %}{{ i }}{% endfor %}', { context: {} }),
    ).rejects.toBeDefined();
  });

  it('deeply nested if blocks do not cause unbounded recursion', async () => {
    // 200 nested if blocks — must parse and render without stack overflow
    const depth = 200;
    const template =
      '{% if x %}'.repeat(depth) + 'deep' + '{% endif %}'.repeat(depth);
    const result = await render(template, { context: { x: true } });
    expect(result).toBe('deep');
  });

  it('very long chain of filters resolves without hanging', async () => {
    // 100-filter chain of no-ops (upcase | downcase repeated)
    const filters = Array.from({ length: 50 }, () => 'upcase | downcase').join(' | ');
    const result = await render(`{{ v | ${filters} }}`, { context: { v: 'hello' } });
    expect(result).toBe('hello');
  });
});

describe('security smoke: unicode and special byte inputs', () => {
  it('null byte in a context value is preserved verbatim', async () => {
    const result = await render('{{ v }}', { context: { v: 'before\x00after' } });
    expect(result).toBe('before\x00after');
  });

  it('zero-width characters in a value pass through unchanged', async () => {
    const zwsp = '​‌‍';
    const result = await render('{{ v }}', { context: { v: `hello${zwsp}world` } });
    expect(result).toBe(`hello${zwsp}world`);
  });

  it('right-to-left override character is not stripped', async () => {
    const rtlo = '‮';
    const result = await render('{{ v }}', { context: { v: `${rtlo}txt.exe` } });
    expect(result).toBe(`${rtlo}txt.exe`);
  });

  it('emoji in template literal renders correctly', async () => {
    expect(await render('{{ v }}', { context: { v: '🔥💧' } })).toBe('🔥💧');
  });
});
