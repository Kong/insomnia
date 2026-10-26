import { describe, expect, it } from 'vitest';

import { slugify } from './misc';

describe('slugify', () => {
  it('lowercases and joins words with hyphens', () => {
    expect(slugify('Cams Project!')).toBe('cams-project');
  });

  it('strips accents', () => {
    expect(slugify('Café México')).toBe('cafe-mexico');
  });

  it('collapses runs of non-alphanumeric characters', () => {
    expect(slugify('  --Weird__Name--  ')).toBe('weird-name');
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(slugify('🚀🚀🚀')).toBe('');
  });

  it('truncates to maxLength without leaving a trailing hyphen', () => {
    const longName = 'a-very-long-project-name-that-goes-on-and-on-and-on';
    const slug = slugify(longName, 20);

    expect(slug.length).toBeLessThanOrEqual(20);
    expect(slug.endsWith('-')).toBe(false);
  });
});
