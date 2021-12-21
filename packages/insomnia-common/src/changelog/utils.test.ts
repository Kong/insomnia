import { extractChangelog, getAuthorHandleFromCommit, getPullRequestNumber, ResponseCommit, uniqueAuthors } from './utils';

describe('extractChangelog', () => {
  const result = 'Fixed an issue with xyz.';

  it('will grab a changelog from a single line', () => {
    expect(extractChangelog(`changelog: ${result}`)).toEqual(result);
  });

  it('is case insensitive', () => {
    expect(extractChangelog(`cHaNgElOg: ${result}`)).toEqual(result);
  });

  it('requires the colon', () => {
    expect(extractChangelog(`changelog ${result}`)).toEqual(undefined);
  });

  it('allows zero or more whitespace after `changelog:`', () => {
    expect(extractChangelog(`changelog:${result}`)).toEqual(result);
    expect(extractChangelog(`changelog: ${result}`)).toEqual(result);
    expect(extractChangelog(`changelog:\t${result}`)).toEqual(result);
    expect(extractChangelog(`changelog:  ${result}`)).toEqual(result);
  });

  it('does not allow whitespace before `changelog:`', () => {
    expect(extractChangelog(` changelog:${result}`)).toEqual(undefined);
  });

  it('only returns the first match', () => {
    const description = [
      `changelog: ${result}`,
      'changelog: will not match',
    ].join('\n');
    expect(extractChangelog(description)).toEqual(result);
  });

  it("disregards the match text that doesn't start at the beginning of the line", () => {
    const description = [
      'check out the changelog: tomorrow',
      `changelog: ${result}`,
    ].join('\n');
    expect(extractChangelog(description)).toEqual(result);
  });
});

describe('getAuthorHandleFromCommit', () => {
  it('returns the handle if an author login exists', () => {
    const commit = { author: { login: 'a' } } as ResponseCommit;
    expect(getAuthorHandleFromCommit(commit)).toEqual('@a');
  });

  it('returns null if no author exists', () => {
    const commit = {} as ResponseCommit;
    expect(getAuthorHandleFromCommit(commit)).toEqual(null);
  });

  it('returns null if no author login exists', () => {
    const commit = { author: {} } as ResponseCommit;
    expect(getAuthorHandleFromCommit(commit)).toEqual(null);
  });
});

describe('uniqueAuthors', () => {
  it('gets unique authors', () => {
    const commits = [
      { author: { login:'b' } },
      { author: { login:'a' } },
      { author: { login:'a' } },
    ] as ResponseCommit[];
    expect(uniqueAuthors(commits)).toEqual(['@a', '@b']);
  });

  it('sorts the result', () => {
    const commits = [
      { author: { login:'b' } },
      { author: { login:'c' } },
      { author: { login:'a' } },
    ] as ResponseCommit[];
    expect(uniqueAuthors(commits)).toEqual(['@a', '@b', '@c']);
  });
});

describe('getPullRequestNumber', () => {
  it('extracts PR number when one is present', () => {
    const message = 'ensures Ziltoid\'s omniscience (and fixes type error) (#9001)';
    const commit = { commit: { message } } as ResponseCommit;
    const result = getPullRequestNumber(commit);
    expect(result).toEqual(9001);
  });

  it('handles missing number', () => {
    const message = 'ensures Ziltoid\'s omniscience (and fixes type error) (#)';
    const commit = { commit: { message } } as ResponseCommit;
    const result = getPullRequestNumber(commit);
    expect(result).toEqual(undefined);
  });

  it('only looks for a match at the end of a line', () => {
    const message = '(#1234) (#9001)';
    const commit = { commit: { message } } as ResponseCommit;
    const result = getPullRequestNumber(commit);
    expect(result).toEqual(9001);
  });

  it('returns undefined when no match is found', () => {
    const message = 'adds more documentation to codemirror addon (and fixes type error)';
    const commit = { commit: { message } } as ResponseCommit;
    const result = getPullRequestNumber(commit);
    expect(result).toEqual(undefined);
  });

  it('handles co-authorship', () => {
    const message = 'fixes a thing (#9001)\n\nCo-authored-by: Dimitri Mitropoulos <dimitrimitropoulos@gmail.com>';
    const commit = { commit: { message } } as ResponseCommit;
    const result = getPullRequestNumber(commit);
    expect(result).toEqual(9001);
  });
});
