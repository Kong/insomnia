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
