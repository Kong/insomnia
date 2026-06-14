// Helpers for recognizing LiquidJS block tags in editor text.
//
// LiquidJS block tags pair an opening delimiter with a closing one and may wrap
// content (and other tags) across many lines, e.g.
//   {% if x %} … {% elsif y %} … {% else %} … {% endif %}
// These helpers let the editor associate any delimiter with the whole block it
// belongs to (for visual grouping and "edit the whole statement" behaviour).

export const BLOCK_OPENER_TO_CLOSER: Record<string, string> = {
  if: 'endif',
  unless: 'endunless',
  for: 'endfor',
  case: 'endcase',
  capture: 'endcapture',
  tablerow: 'endtablerow',
  raw: 'endraw',
  comment: 'endcomment',
};

export const BLOCK_CLOSERS = new Set(Object.values(BLOCK_OPENER_TO_CLOSER));

// Branch/intermediate delimiters that live inside a block but don't open/close it.
// `elif` is included so an (invalid in LiquidJS) Nunjucks-style branch is still
// grouped with its block rather than treated as a standalone tag.
export const BLOCK_INTERMEDIATES = new Set(['elsif', 'elif', 'else', 'when']);

export const isBlockKeyword = (name: string): boolean =>
  name in BLOCK_OPENER_TO_CLOSER || BLOCK_CLOSERS.has(name) || BLOCK_INTERMEDIATES.has(name);

export interface TagBlock {
  /** Index of the opening `{%`. */
  start: number;
  /** Index just past the closing `%}`. */
  end: number;
  /** Start indices of every delimiter (opener, intermediates, closer) in the block. */
  members: Set<number>;
}

/**
 * Return the outermost block whose `[start, end)` range contains `idx`, or undefined.
 * "Outermost" (smallest `start`) so that clicking any construct inside a nested
 * structure edits the whole top-level statement.
 */
export function outermostBlockAt(blocks: TagBlock[], idx: number): TagBlock | undefined {
  let found: TagBlock | undefined;
  for (const block of blocks) {
    if (block.start <= idx && idx < block.end && (!found || block.start < found.start)) {
      found = block;
    }
  }
  return found;
}

/** A single template construct found in the document text. */
export interface TemplateRegion {
  /** Index of the opening delimiter (`{{`, `{%`, `{#`). */
  start: number;
  /** Index just past the closing delimiter. */
  end: number;
  kind: 'tag' | 'variable' | 'comment';
}

// Matches one construct at a time. Each alternative is non-greedy so a construct
// stops at its own first closing delimiter; because `[\s\S]` includes newlines, a
// self-contained multi-line tag (e.g. the `{% liquid … %}` master tag, which has no
// internal `%}`) is captured as ONE region regardless of blank lines inside it.
const REGION_RE = /{{-?[\s\S]*?-?}}|{%-?[\s\S]*?-?%}|{#[\s\S]*?#}/g;
const TAG_NAME_RE = /^{%-?\s*(\w+)/;

/**
 * Scan the document for every template construct (`{{ … }}`, `{% … %}`, `{# … #}`),
 * returning one region per construct in document order. Each block delimiter is its
 * own region (so the editor can keep per-delimiter pills); whole-block grouping is
 * handled separately by {@link pairBlockTags}. Tags inside a `{% raw %}` block are
 * treated as literal text and not emitted.
 */
export function scanTemplateRegions(text: string): TemplateRegion[] {
  const regions: TemplateRegion[] = [];
  REGION_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  let inRaw = false;

  while ((match = REGION_RE.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index;
    const end = REGION_RE.lastIndex;
    const kind: TemplateRegion['kind'] = raw.startsWith('{{') ? 'variable' : raw.startsWith('{#') ? 'comment' : 'tag';
    const name = kind === 'tag' ? raw.match(TAG_NAME_RE)?.[1] : undefined;

    // Inside a {% raw %} block only {% endraw %} is meaningful; everything else is literal.
    if (inRaw) {
      if (name === 'endraw') {
        inRaw = false;
        regions.push({ start, end, kind });
      }
      continue;
    }
    if (name === 'raw') {
      inRaw = true;
    }
    regions.push({ start, end, kind });
  }

  return regions;
}

/**
 * Pair LiquidJS block tags (`{% if %}…{% endif %}`, `{% for %}…{% endfor %}`, …)
 * so that any delimiter can be associated with the whole block it belongs to.
 * Nesting-aware. `{% liquid %}` is self-contained and is intentionally not paired.
 */
export function pairBlockTags(text: string): TagBlock[] {
  const tagRe = /{%-?\s*(\w+)[\s\S]*?-?%}/g;
  const blocks: TagBlock[] = [];
  const stack: { name: string; start: number; members: number[] }[] = [];
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(text)) !== null) {
    const name = match[1];
    const start = match.index;
    const end = tagRe.lastIndex;
    const top = stack[stack.length - 1];

    // Inside a {% raw %} block everything except {% endraw %} is literal.
    if (top && top.name === 'raw' && name !== 'endraw') {
      continue;
    }
    if (name in BLOCK_OPENER_TO_CLOSER) {
      stack.push({ name, start, members: [start] });
      continue;
    }
    if (top && name === BLOCK_OPENER_TO_CLOSER[top.name]) {
      top.members.push(start);
      blocks.push({ start: top.start, end, members: new Set(top.members) });
      stack.pop();
      continue;
    }
    if (top && BLOCK_INTERMEDIATES.has(name)) {
      top.members.push(start);
    }
  }

  return blocks;
}
