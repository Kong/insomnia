// Regression tests for the exact templates users have pasted into the body editor while
// reporting parsing/rendering bugs. Each scenario asserts BOTH:
//   1. how the editor *interprets* the template (scanTemplateRegions / pairBlockTags /
//      outermostBlockAt / tokenizeTag / fieldTagLabel), and
//   2. how the engine *renders* it (render()),
// so that a future change which fixes one scenario cannot silently break another.
// Whitespace-control output is compared with whitespace normalised, since LiquidJS's
// `{%- -%}` trimming makes byte-exact assertions brittle.
import { describe, expect, it, vi } from 'vitest';

vi.mock('~/plugins');

import {
  outermostBlockAt,
  pairBlockTags,
  scanTemplateRegions,
} from '~/ui/components/.client/codemirror/extensions/liquid-block-tags';

import { render } from '../index';
import { fieldTagLabel, tokenizeTag } from '../utils';

const textOf = (template: string, region: { start: number; end: number }) => template.slice(region.start, region.end);
const noWhitespace = (s: string) => s.replace(/\s+/g, '');

describe('user scenario: multi-line {% liquid %} block with a blank line', () => {
  const template = `{% liquid
  assign product_name = "Coffee Mug"
  assign stock_count = 15

  if stock_count > 0
    echo product_name | append: " is available."
  else
    echo product_name | append: " is out of stock."
  endif
%}`;

  it('is interpreted as a single self-contained tag region (not split by the blank line)', () => {
    const regions = scanTemplateRegions(template);
    expect(regions).toHaveLength(1);
    expect(regions[0]).toEqual({ start: 0, end: template.length, kind: 'tag' });
    // `liquid` is not a paired block and is not a field tag.
    expect(pairBlockTags(template)).toHaveLength(0);
    expect(tokenizeTag(template).name).toBe('liquid');
    expect(fieldTagLabel(template)).toBeNull();
  });

  it('renders the in-stock branch', async () => {
    expect(await render(template, { context: {} })).toBe('Coffee Mug is available.');
  });
});

describe('user scenario: {% for %} with whitespace-control {%- if/continue/else -%} delimiters', () => {
  const template = `{% for i in (1..5) %}
  {%- if i == 4 -%}
    {%- continue -%}
  {%- else -%}
    {{ i }}
  {%- endif -%}
{% endfor %}`;

  it('is interpreted as per-delimiter regions all grouped under the outermost for block', () => {
    const regions = scanTemplateRegions(template);
    expect(regions.map(r => r.kind)).toEqual(['tag', 'tag', 'tag', 'tag', 'variable', 'tag', 'tag']);

    const blocks = pairBlockTags(template);
    // Two paired blocks: the outer for and the inner if.
    expect(blocks).toHaveLength(2);

    // Clicking any inner construct (the {{ i }} variable, or the continue) resolves to the
    // outermost (for) block — i.e. the whole statement is edited as one unit.
    const innerVarIdx = template.indexOf('{{ i }}');
    const continueIdx = template.indexOf('{%- continue');
    expect(outermostBlockAt(blocks, innerVarIdx)?.start).toBe(0);
    expect(outermostBlockAt(blocks, innerVarIdx)?.end).toBe(template.length);
    expect(outermostBlockAt(blocks, continueIdx)?.start).toBe(0);

    // The whitespace-control delimiters tokenize to their real keyword names.
    expect(tokenizeTag('{%- if i == 4 -%}').name).toBe('if');
    expect(tokenizeTag('{%- continue -%}').name).toBe('continue');
    expect(tokenizeTag('{%- endif -%}').name).toBe('endif');
  });

  it('renders 1,2,3,5 and skips 4', async () => {
    const out = (await render(template, { context: {} })) ?? '';
    expect(noWhitespace(out)).toBe('1235');
  });
});

describe('user scenario: {% assign %} then {% echo … | append | capitalize %}', () => {
  const template = `{% assign username = 'Bob' %}
{% echo username | append: ", welcome to LiquidJS!" | capitalize %}`;

  it('is interpreted as two single-line field tags labelled `name → variable`', () => {
    const regions = scanTemplateRegions(template);
    expect(regions.map(r => r.kind)).toEqual(['tag', 'tag']);
    expect(fieldTagLabel(textOf(template, regions[0]))).toBe('assign → username');
    expect(fieldTagLabel(textOf(template, regions[1]))).toBe('echo → username');
    // Neither single tag is part of a paired block.
    expect(pairBlockTags(template)).toHaveLength(0);
  });

  it('renders the appended, capitalized greeting', async () => {
    const out = (await render(template, { context: {} })) ?? '';
    // capitalize upper-cases the first char and lower-cases the rest.
    expect(out.trim()).toBe('Bob, welcome to liquidjs!');
  });
});

describe('user scenario: {% assign %} preceding {% case %} / {% when %} / {% endcase %}', () => {
  const assignTag = '{% assign handle = "cake" %}';
  const caseBlock = `{% case handle %}
  {% when "cake" %}
     This is a cake
  {% when "cookie", "biscuit" %}
     This is a cookie
  {% else %}
     This is neither a cake nor a cookie
{% endcase %}`;
  const template = `${assignTag}\n${caseBlock}`;

  it('interprets assign as a standalone field tag and case/when/endcase as one paired block', () => {
    const regions = scanTemplateRegions(template);
    // assign, case, when×2, else, endcase
    expect(regions.map(r => r.kind)).toEqual(['tag', 'tag', 'tag', 'tag', 'tag', 'tag']);
    expect(fieldTagLabel(textOf(template, regions[0]))).toBe('assign → handle');
    expect(fieldTagLabel(textOf(template, regions[1]))).toBe('case → handle');

    const blocks = pairBlockTags(template);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].members.size).toBe(5); // case, when, when, else, endcase

    // assign is NOT inside any block
    expect(outermostBlockAt(blocks, regions[0].start)).toBeUndefined();
    // case opener IS the outermost block
    expect(outermostBlockAt(blocks, regions[1].start)).toBe(blocks[0]);
  });

  it('renders the matching when branch', async () => {
    const out = (await render(template, { context: {} })) ?? '';
    expect(out.trim()).toContain('This is a cake');
  });
});

describe('user scenario: aggregate — assign + case/when and assign + if/else in one document', () => {
  const template = `{% assign handle = "cake" %}
{% case handle %}
  {% when "cake" %}
     This is a cake
  {% when "cookie", "biscuit" %}
     This is a cookie
  {% else %}
     This is neither a cake nor a cookie
{% endcase %}
{% assign product_name = "Coffee Mug" %}
{% assign stock_count = 15 %}
{% if stock_count > 0 %}
{{ product_name }} is available.
{% else %}
{{ product_name }} is out of stock.
{% endif %}`;

  it('parses all 13 regions (11 tags + 2 variables) without error', () => {
    const regions = scanTemplateRegions(template);
    expect(regions).toHaveLength(13);
    expect(regions.every(r => ['tag', 'variable', 'comment'].includes(r.kind))).toBe(true);
  });

  it('correctly pairs two independent blocks (case and if)', () => {
    const blocks = pairBlockTags(template);
    expect(blocks).toHaveLength(2);
    const names = blocks.map(b => template.slice(b.start, b.start + 10));
    expect(names.some(n => n.startsWith('{% case'))).toBe(true);
    expect(names.some(n => n.startsWith('{% if'))).toBe(true);
  });

  it('renders both branches correctly from their preceding assigns', async () => {
    const out = (await render(template, { context: {} })) ?? '';
    expect(out).toContain('This is a cake');
    expect(out).toContain('Coffee Mug is available.');
  });
});

describe('user scenario: simple {% if %}…{% endif %} block', () => {
  const template = '{% if x %}hello{% endif %}';

  it('is interpreted as two delimiter regions forming one block', () => {
    const regions = scanTemplateRegions(template);
    expect(regions.map(r => r.kind)).toEqual(['tag', 'tag']);
    const blocks = pairBlockTags(template);
    expect(blocks).toHaveLength(1);
    expect(outermostBlockAt(blocks, template.indexOf('{% endif'))?.start).toBe(0);
  });

  it('renders the body when the condition is truthy', async () => {
    expect(await render(template, { context: { x: true } })).toBe('hello');
  });
});
