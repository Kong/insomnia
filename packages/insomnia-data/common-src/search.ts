import fuzzysort from 'fuzzysort';

export interface FuzzyMatchOptions {
  splitSpace?: boolean;
  loose?: boolean;
}

export function fuzzyMatch(
  searchString: string,
  text: string,
  options: FuzzyMatchOptions = {},
): null | {
  score: number;
  indexes: number[];
} {
  return fuzzyMatchAll(searchString, [text], options);
}

export function fuzzyMatchAll(searchString: string, allText: string[], options: FuzzyMatchOptions = {}) {
  if (!searchString || !searchString.trim()) {
    return null;
  }

  const words = searchString.split(' ').filter(w => w.trim());
  const terms = options.splitSpace ? [...words, searchString] : [searchString];
  let maxScore: number | null = null;
  let indexes: number[] = [];
  let termsMatched = 0;

  for (const term of terms) {
    let matchedTerm = false;

    for (const text of allText.filter(t => !t || t.trim())) {
      const result = fuzzysort.single(term, text);

      if (!result) {
        continue;
      }

      // Don't match garbage
      if (result.score < -8000) {
        continue;
      }

      if (maxScore === null || result.score > maxScore) {
        maxScore = result.score;
      }

      indexes = [...indexes, ...result.indexes];
      matchedTerm = true;
    }

    if (matchedTerm) {
      termsMatched++;
    }
  }

  // Make sure we match all provided terms except the last (full) one
  if (!options.loose && termsMatched < terms.length - 1) {
    return null;
  }

  if (maxScore === null) {
    return null;
  }

  return {
    score: maxScore,
    indexes,
    target: allText.join(' '),
  };
}
