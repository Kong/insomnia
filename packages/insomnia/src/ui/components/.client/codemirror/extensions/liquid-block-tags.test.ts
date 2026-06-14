import { describe, expect, it } from 'vitest';

import { isBlockKeyword, outermostBlockAt, pairBlockTags, scanTemplateRegions } from './liquid-block-tags';

describe('isBlockKeyword', () => {
  it('recognizes openers, closers and intermediates', () => {
    expect(isBlockKeyword('if')).toBe(true);
    expect(isBlockKeyword('endif')).toBe(true);
    expect(isBlockKeyword('elsif')).toBe(true);
    expect(isBlockKeyword('else')).toBe(true);
    expect(isBlockKeyword('for')).toBe(true);
    expect(isBlockKeyword('endfor')).toBe(true);
  });

  it('does not flag self-contained or unknown tags', () => {
    expect(isBlockKeyword('liquid')).toBe(false);
    expect(isBlockKeyword('assign')).toBe(false);
    expect(isBlockKeyword('now')).toBe(false);
  });
});

describe('pairBlockTags', () => {
  it('pairs a simple if/endif block and records every delimiter', () => {
    const text = '{% if x %}a{% endif %}';
    const blocks = pairBlockTags(text);
    expect(blocks).toHaveLength(1);
    const [block] = blocks;
    expect(block.start).toBe(0);
    expect(block.end).toBe(text.length);
    expect(block.members.has(text.indexOf('{% if'))).toBe(true);
    expect(block.members.has(text.indexOf('{% endif'))).toBe(true);
  });

  it('includes elsif/else delimiters as members of the block', () => {
    const text = '{% if x %}a{% elsif y %}b{% else %}c{% endif %}';
    const [block] = pairBlockTags(text);
    expect(block.members.has(text.indexOf('{% elsif'))).toBe(true);
    expect(block.members.has(text.indexOf('{% else'))).toBe(true);
    expect(block.members.size).toBe(4); // if, elsif, else, endif
  });

  it('handles multi-line blocks', () => {
    const text = '{% if x %}\n  hello\n{% endif %}';
    const blocks = pairBlockTags(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].end).toBe(text.length);
  });

  it('handles nested blocks of the same type', () => {
    const text = '{% for a in x %}{% for b in y %}{{ b }}{% endfor %}{% endfor %}';
    const blocks = pairBlockTags(text);
    expect(blocks).toHaveLength(2);
    // Inner block closes first, outer spans the whole string.
    const outer = blocks.find(b => b.start === 0);
    expect(outer?.end).toBe(text.length);
  });

  it('does not pair tags inside a {% raw %} block', () => {
    const text = '{% raw %}{% if x %}{% endif %}{% endraw %}';
    const blocks = pairBlockTags(text);
    // Only the raw/endraw pair; the inner if/endif are literal text.
    expect(blocks).toHaveLength(1);
    expect(blocks[0].start).toBe(0);
    expect(blocks[0].end).toBe(text.length);
  });

  it('ignores self-contained tags like {% liquid %} and {% now %}', () => {
    const text = "{% liquid assign x = 'hi' %}{% now 'iso-8601' %}";
    expect(pairBlockTags(text)).toHaveLength(0);
  });
});

describe('scanTemplateRegions', () => {
  it('captures a multi-line {% liquid %} block (with a blank line) as one region', () => {
    const text = `{% liquid
  assign x = "hello"

  echo x
%}`;
    const regions = scanTemplateRegions(text);
    expect(regions).toHaveLength(1);
    expect(regions[0]).toEqual({ start: 0, end: text.length, kind: 'tag' });
  });

  it('returns a separate region per delimiter of a block', () => {
    const text = '{% for i in (1..5) %}{%- if i == 4 -%}{{ i }}{%- endif -%}{% endfor %}';
    const regions = scanTemplateRegions(text);
    expect(regions.map(r => r.kind)).toEqual(['tag', 'tag', 'variable', 'tag', 'tag']);
    expect(regions[2]).toEqual({ start: text.indexOf('{{ i }}'), end: text.indexOf('{{ i }}') + '{{ i }}'.length, kind: 'variable' });
  });

  it('treats content inside a {% raw %} block as literal', () => {
    const text = '{% raw %}{% if x %}{{ y }}{% endif %}{% endraw %}';
    const regions = scanTemplateRegions(text);
    // Only the raw/endraw delimiters are real regions.
    expect(regions).toHaveLength(2);
    expect(regions[0].start).toBe(0);
    expect(regions[1].end).toBe(text.length);
  });

  it('distinguishes variables and comments', () => {
    const text = '{{ a }}{# c #}{% now %}';
    expect(scanTemplateRegions(text).map(r => r.kind)).toEqual(['variable', 'comment', 'tag']);
  });
});

describe('outermostBlockAt', () => {
  it('returns the outermost block containing a nested index', () => {
    const text = '{% for a in x %}{% if a %}{{ a }}{% endif %}{% endfor %}';
    const blocks = pairBlockTags(text);
    const innerVarIdx = text.indexOf('{{ a }}');
    const outer = outermostBlockAt(blocks, innerVarIdx);
    expect(outer?.start).toBe(0); // the `for` block, not the inner `if`
    expect(outer?.end).toBe(text.length);
  });

  it('returns undefined when no block contains the index', () => {
    const text = '{% assign x = 1 %}{{ x }}';
    const blocks = pairBlockTags(text);
    expect(outermostBlockAt(blocks, text.indexOf('{{ x }}'))).toBeUndefined();
  });
});
