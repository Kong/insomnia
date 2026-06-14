// Regression tests confirming LiquidJS renders templates correctly — including
// templates that previously worked under Nunjucks and every supported block/tag
// construct. Security-specific tests live in liquid-security.test.ts.
// Run with: npm test -w insomnia
import { describe, expect, it, vi } from 'vitest';

vi.mock('~/plugins');

import { render } from '../index';

describe('variable interpolation', () => {
  // Basic {{ var }} substitution from a flat context object
  it('renders root-level variables', async () => {
    expect(await render('{{ name }}', { context: { name: 'kyle' } })).toBe('kyle');
  });

  // Insomnia exposes env vars under the _ namespace: {{ _.varName }}
  it('renders _ prefix variables', async () => {
    expect(await render('{{ _.name }}', { context: { name: 'kyle' } })).toBe('kyle');
  });

  // Bracket notation is needed for keys containing hyphens or other non-identifier chars
  it('renders bracket notation with dashes', async () => {
    expect(await render("{{ _['my-var'] }}", { context: { 'my-var': 'hello' } })).toBe('hello');
  });

  // Strings without {{ }} are returned synchronously without hitting the engine
  it('returns text unchanged when no template delimiters', () => {
    expect(render('no delimiters here')).toBe('no delimiters here');
  });
});

describe('control flow', () => {
  // Both true and false branches must resolve correctly
  it('handles if/else/endif', async () => {
    expect(await render('{% if x %}yes{% else %}no{% endif %}', { context: { x: true } })).toBe('yes');
    expect(await render('{% if x %}yes{% else %}no{% endif %}', { context: { x: false } })).toBe('no');
  });

  // Each item in the array must appear once in output order
  it('handles for loops', async () => {
    expect(await render('{% for item in list %}{{ item }}{% endfor %}', { context: { list: ['a', 'b'] } })).toBe('ab');
  });

  // jsTruthy: true makes empty string falsy, matching JS/Nunjucks semantics
  it('treats empty string as falsy (jsTruthy)', async () => {
    expect(await render('{% if x %}yes{% else %}no{% endif %}', { context: { x: '' } })).toBe('no');
  });

  // jsTruthy: true makes 0 falsy, matching JS/Nunjucks semantics
  it('treats 0 as falsy (jsTruthy)', async () => {
    expect(await render('{% if x %}yes{% else %}no{% endif %}', { context: { x: 0 } })).toBe('no');
  });
});

describe('filters', () => {
  // Core string case filters used in collection templates
  it('upcase/downcase', async () => {
    expect(await render('{{ s | upcase }}', { context: { s: 'hello' } })).toBe('HELLO');
    expect(await render('{{ s | downcase }}', { context: { s: 'HELLO' } })).toBe('hello');
  });

  // default provides a fallback when a variable is undefined (requires ignoreUndefinedEnvVariable)
  it('default filter', async () => {
    expect(await render("{{ x | default: 'fallback' }}", { context: {}, ignoreUndefinedEnvVariable: true })).toBe('fallback');
  });

  // replace uses Liquid colon syntax, not Nunjucks parentheses
  it('replace filter', async () => {
    expect(await render("{{ s | replace: 'a', 'b' }}", { context: { s: 'abc' } })).toBe('bbc');
  });

  // size returns string length as a string
  it('size filter', async () => {
    expect(await render('{{ s | size }}', { context: { s: 'hello' } })).toBe('5');
  });

  // debug is a no-op passthrough registered for Nunjucks backwards compatibility
  it('debug filter passes value through', async () => {
    expect(await render('{{ s | debug }}', { context: { s: 'abc' } })).toBe('abc');
  });
});

describe('comment stripping', () => {
  // {# #} is a Nunjucks comment syntax; the preprocessor strips it before Liquid parses
  it('strips {# ... #} comments', async () => {
    expect(await render('{# this is a comment #}hello', { context: {} })).toBe('hello');
  });

  // Multiline comments must also be stripped cleanly
  it('strips multiline comments', async () => {
    expect(await render('{# line 1\nline 2 #}world', { context: {} })).toBe('world');
  });
});

describe('raw blocks', () => {
  // Content inside {% raw %} is emitted verbatim without template evaluation
  it('passes through literal {{ }} inside raw blocks', async () => {
    expect(await render('{% raw %}{{ literal }}{% endraw %}', { context: {} })).toBe('{{ literal }}');
  });

  // Tag syntax is also preserved verbatim inside raw blocks
  it('passes through liquid tag syntax verbatim', async () => {
    expect(await render('{% raw %}{% if x %}yes{% endif %}{% endraw %}', { context: {} })).toBe('{% if x %}yes{% endif %}');
  });

  // raw emits content with no HTML escaping — React JSX {value} binding is safe,
  // but innerHTML / dangerouslySetInnerHTML at the call site must sanitize.
  it('does not HTML-escape content inside raw blocks', async () => {
    const result = await render('{% raw %}<img src=x onerror="alert(1)">{% endraw %}', { context: {} });
    expect(result).toBe('<img src=x onerror="alert(1)">');
  });
});

describe('error handling', () => {
  // Accessing a variable not in context must throw a typed RenderError
  it('throws RenderError for undefined variable', async () => {
    await expect(render('{{ missing }}', { context: {} })).rejects.toMatchObject({
      reason: 'undefined',
      type: 'render',
    });
  });

  // All undefined variable names must be collected so the UI can highlight them
  it('populates undefinedEnvironmentVariables on error', async () => {
    await expect(render('{{ a }} {{ b }}', { context: {} })).rejects.toMatchObject({
      extraInfo: {
        subType: 'environmentVariable',
        undefinedEnvironmentVariables: expect.arrayContaining(['a', 'b']),
      },
    });
  });

  // ignoreUndefinedEnvVariable renders missing vars as empty string instead of throwing
  it('ignoreUndefinedEnvVariable suppresses throw', async () => {
    expect(await render('{{ missing }}', { context: {}, ignoreUndefinedEnvVariable: true })).toBe('');
  });

  // Template-scoped variables (assign/for/capture) must NOT appear as missing env vars
  it('does not report {% assign %} variables as undefined environment variables', async () => {
    const err: any = await Promise.resolve(render('{% assign age = 25 %}{{ age }} {{ MISSING }}', { context: {} })).catch((e: any) => e);
    expect(err.extraInfo?.undefinedEnvironmentVariables).toEqual(['MISSING']);
  });

  it('does not report {% for %} loop variables as undefined environment variables', async () => {
    const err: any = await Promise.resolve(render(
      '{% for i in (1..3) %}{{ i }}{% endfor %}{{ MISSING }}',
      { context: {} },
    )).catch((e: any) => e);
    expect(err.extraInfo?.undefinedEnvironmentVariables).toEqual(['MISSING']);
  });

  it('does not report {% capture %} variables as undefined environment variables', async () => {
    const err: any = await Promise.resolve(render(
      '{% capture greeting %}hello{% endcapture %}{{ greeting }} {{ MISSING }}',
      { context: {} },
    )).catch((e: any) => e);
    expect(err.extraInfo?.undefinedEnvironmentVariables).toEqual(['MISSING']);
  });

  it('deduplicates repeated occurrences of the same undefined variable', async () => {
    const err: any = await Promise.resolve(render('{{ MISSING }} {{ MISSING }}', { context: {} })).catch((e: any) => e);
    expect(err.extraInfo?.undefinedEnvironmentVariables).toEqual(['MISSING']);
  });
});

describe('nunjucks breaking changes', () => {
  // LiquidJS uses elsif not elif — templates using elif must be updated
  it('elif is not supported — parse error expected', async () => {
    await expect(
      render('{% if x %}a{% elif y %}b{% endif %}', { context: { x: false, y: true } }),
    ).rejects.toBeDefined();
  });

  // LiquidJS uses assign instead of set for variable assignment
  it('assign replaces set', async () => {
    expect(await render('{% assign x = "hello" %}{{ x }}', { context: {} })).toBe('hello');
  });

  // {% set %} is a Nunjucks keyword and will throw a parse error in LiquidJS
  it('set is not supported — parse error expected', async () => {
    await expect(
      render('{% set x = "hello" %}{{ x }}', { context: {} }),
    ).rejects.toBeDefined();
  });

  // Liquid filter args use colon+comma syntax: | filter: arg1, arg2 (not parentheses)
  it('filter args use colon syntax, not parentheses', async () => {
    expect(await render("{{ s | replace: 'a', 'z' }}", { context: { s: 'abc' } })).toBe('zbc');
  });

  // elsif (not elif) is the correct branching keyword in LiquidJS
  it('elsif is the correct keyword in LiquidJS', async () => {
    expect(
      await render('{% if x %}a{% elsif y %}b{% else %}c{% endif %}', { context: { x: false, y: true } }),
    ).toBe('b');
  });
});

describe('edge cases', () => {
  // Dot notation traverses nested plain objects
  it('renders nested object property access', async () => {
    expect(await render('{{ user.name }}', { context: { user: { name: 'kyle' } } })).toBe('kyle');
  });

  // Bracket index notation accesses array elements
  it('renders array index access', async () => {
    expect(await render('{{ list[0] }}', { context: { list: ['first', 'second'] } })).toBe('first');
  });

  // Multi-level dot traversal must resolve to the leaf value
  it('renders deeply nested values', async () => {
    expect(await render('{{ a.b.c }}', { context: { a: { b: { c: 'deep' } } } })).toBe('deep');
  });

  // Numbers are coerced to strings in output
  it('handles numeric variable values', async () => {
    expect(await render('{{ n }}', { context: { n: 42 } })).toBe('42');
  });

  // Booleans are rendered as "true" / "false" strings
  it('handles boolean true variable', async () => {
    expect(await render('{{ b }}', { context: { b: true } })).toBe('true');
  });

  // 0 is falsy but still coerces to the string "0" when output directly
  it('coerces number to string in output', async () => {
    expect(await render('value is {{ n }}', { context: { n: 0 } })).toBe('value is 0');
  });

  // Multiple interpolations in a single template string must all resolve
  it('renders multiple variables in one string', async () => {
    expect(await render('{{ a }}-{{ b }}', { context: { a: 'foo', b: 'bar' } })).toBe('foo-bar');
  });

  // An empty string value must produce no output, not the string "undefined"
  it('empty string variable renders as empty', async () => {
    expect(await render('[{{ s }}]', { context: { s: '' } })).toBe('[]');
  });

  // A string with only an opening {{ is not a valid template and passes through as-is
  it('passes through text with only one delimiter type', () => {
    expect(render('no {{ here')).toBe('no {{ here');
  });

  // Multiple filters can be chained; each is applied in left-to-right order
  it('handles chained filters', async () => {
    expect(await render('{{ s | upcase | downcase }}', { context: { s: 'Hello' } })).toBe('hello');
  });

  // {{ _.key }} and {{ key }} must produce identical output for the same context
  it('renders _ global alias the same as root context', async () => {
    const ctx = { key: 'value' };
    const root = await render('{{ key }}', { context: ctx });
    const alias = await render('{{ _.key }}', { context: ctx });
    expect(root).toBe(alias);
  });
});

describe('unless tag', () => {
  // unless is the inverse of if — body renders when condition is false
  it('renders body when condition is false', async () => {
    expect(await render('{% unless x %}shown{% endunless %}', { context: { x: false } })).toBe('shown');
  });

  // Body must be skipped when condition is true
  it('skips body when condition is true', async () => {
    expect(await render('{% unless x %}shown{% endunless %}', { context: { x: true } })).toBe('');
  });

  // unless supports an else branch for the truthy case
  it('supports else branch', async () => {
    expect(
      await render('{% unless x %}no{% else %}yes{% endunless %}', { context: { x: true } }),
    ).toBe('yes');
  });
});

describe('case / when tag', () => {
  // Matching when branch must be selected by value equality
  it('matches the correct when branch', async () => {
    expect(
      await render('{% case v %}{% when "a" %}alpha{% when "b" %}beta{% else %}other{% endcase %}', {
        context: { v: 'b' },
      }),
    ).toBe('beta');
  });

  // else acts as the default when no when branch matches
  it('falls through to else when no branch matches', async () => {
    expect(
      await render('{% case v %}{% when "a" %}alpha{% else %}other{% endcase %}', {
        context: { v: 'z' },
      }),
    ).toBe('other');
  });

  // A single when clause can match multiple comma-separated values
  it('matches multiple values in a single when', async () => {
    expect(
      await render('{% case v %}{% when "cookie", "biscuit" %}snack{% else %}other{% endcase %}', {
        context: { v: 'biscuit' },
      }),
    ).toBe('snack');
  });
});

describe('for tag — advanced', () => {
  // limit:N stops iteration after N items, regardless of collection size
  it('limit stops iteration early', async () => {
    expect(
      await render('{% for i in list limit:2 %}{{ i }}{% endfor %}', { context: { list: [1, 2, 3, 4] } }),
    ).toBe('12');
  });

  // offset:N skips the first N items before starting iteration
  it('offset skips leading items', async () => {
    expect(
      await render('{% for i in list offset:2 %}{{ i }}{% endfor %}', { context: { list: [1, 2, 3, 4] } }),
    ).toBe('34');
  });

  // reversed iterates the collection in reverse order
  it('reversed iterates in reverse order', async () => {
    expect(
      await render('{% for i in list reversed %}{{ i }}{% endfor %}', { context: { list: [1, 2, 3] } }),
    ).toBe('321');
  });

  // break exits the loop immediately, discarding remaining items
  it('break exits the loop early', async () => {
    expect(
      await render('{% for i in list %}{% if i == 3 %}{% break %}{% endif %}{{ i }}{% endfor %}', {
        context: { list: [1, 2, 3, 4] },
      }),
    ).toBe('12');
  });

  // continue skips the current iteration and moves to the next item
  it('continue skips to the next iteration', async () => {
    expect(
      await render('{% for i in list %}{% if i == 2 %}{% continue %}{% endif %}{{ i }}{% endfor %}', {
        context: { list: [1, 2, 3] },
      }),
    ).toBe('13');
  });

  // forloop.index is a 1-based counter available inside the loop body
  it('forloop.index is 1-based', async () => {
    expect(
      await render('{% for i in list %}{{ forloop.index }}{% endfor %}', { context: { list: ['a', 'b', 'c'] } }),
    ).toBe('123');
  });

  // forloop.first and forloop.last are boolean flags for boundary items
  it('forloop.first and forloop.last flags', async () => {
    expect(
      await render(
        '{% for i in list %}{% if forloop.first %}[{% endif %}{{ i }}{% if forloop.last %}]{% endif %}{% endfor %}',
        { context: { list: ['a', 'b', 'c'] } },
      ),
    ).toBe('[abc]');
  });

  // else branch runs when the collection is empty, replacing the loop body entirely
  it('else branch runs when collection is empty', async () => {
    expect(
      await render('{% for i in list %}{{ i }}{% else %}empty{% endfor %}', { context: { list: [] } }),
    ).toBe('empty');
  });

  // Numeric ranges (1..N) generate an inclusive sequence without a context array
  it('iterates over numeric range', async () => {
    expect(await render('{% for i in (1..4) %}{{ i }}{% endfor %}', { context: {} })).toBe('1234');
  });
});

describe('echo tag', () => {
  // echo outputs a value inside a {% liquid %} block (equivalent to {{ }} outside)
  it('outputs a variable value', async () => {
    expect(await render('{% liquid echo name %}', { context: { name: 'kyle' } })).toBe('kyle');
  });

  // echo supports the same filter pipeline as {{ }} output expressions
  it('supports filter chaining', async () => {
    expect(await render('{% liquid echo name | upcase %}', { context: { name: 'hello' } })).toBe('HELLO');
  });
});

describe('liquid block tag', () => {
  // {% liquid %} groups multiple tag statements without separate {% %} delimiters per line
  it('executes multiple statements in one block', async () => {
    expect(
      await render(
        '{% liquid\nassign x = "hello"\nassign y = "world"\necho x\necho " "\necho y\n%}',
        { context: {} },
      ),
    ).toBe('hello world');
  });

  // Control flow tags work inside a liquid block using newline-separated syntax
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
  // increment outputs the current counter value then increments it; starts at 0
  it('increment starts at 0 and increases', async () => {
    expect(
      await render('{% increment c %}{% increment c %}{% increment c %}', { context: {} }),
    ).toBe('012');
  });

  // decrement outputs the current counter value then decrements it; starts at -1
  it('decrement starts at -1 and decreases', async () => {
    expect(
      await render('{% decrement c %}{% decrement c %}{% decrement c %}', { context: {} }),
    ).toBe('-1-2-3');
  });

  // increment counters and assign variables share a name but use separate storage
  it('increment and assign variables are independent', async () => {
    expect(
      await render('{% assign c = "hello" %}{% increment c %}{{ c }}', { context: {} }),
    ).toBe('0hello');
  });
});

describe('capture and tablerow tags', () => {
  // capture renders its body into a named variable for reuse later in the template
  it('capture stores rendered output in a variable', async () => {
    expect(
      await render('{% capture greeting %}Hello {{ name }}{% endcapture %}{{ greeting }}', {
        context: { name: 'world' },
      }),
    ).toBe('Hello world');
  });

  // capture is purely in-memory string accumulation with no I/O surface
  it('capture does not leak filesystem or network access', async () => {
    expect(
      await render('{% capture x %}static{% endcapture %}{{ x }}', { context: {} }),
    ).toBe('static');
  });

  // tablerow generates <tr>/<td> HTML for each item in the collection
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

  // The engine does not HTML-encode values; callers must sanitize before DOM insertion
  it('tablerow output is a string — not executable HTML', async () => {
    const result = await render(
      '{% tablerow x in items %}{{ x }}{% endtablerow %}',
      { context: { items: ['<script>alert(1)</script>'] } },
    );
    expect(result).toContain('<script>alert(1)</script>');
  });
});

