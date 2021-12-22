import { Octokit } from '@octokit/rest';

import { compareCommits, extractChangelog, fetchChanges, formattedDate, getAuthorHandleFromCommit, getPullRequest, getPullRequestNumber, groupChanges, ResponseCommit, uniqueAuthors } from './utils';

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

  it('allows zero whitespace after `changelog:`', () => {
    expect(extractChangelog(`changelog:${result}`)).toEqual(result);
  });

  it('allows one or more spaces after `changelog:`', () => {
    expect(extractChangelog(`changelog: ${result}`)).toEqual(result);
    expect(extractChangelog(`changelog:  ${result}`)).toEqual(result);
  });

  it('allows one or more tabs after `changelog:`', () => {
    expect(extractChangelog(`changelog:\t${result}`)).toEqual(result);
    expect(extractChangelog(`changelog:\t\t${result}`)).toEqual(result);
  });

  it('does not allow newlines after `changelog:`', () => {
    expect(extractChangelog(`changelog:\n${result}`)).toEqual(undefined);
  });

  it('requires that the line begins with `changelog:`', () => {
    expect(extractChangelog(` changelog:${result}`)).toEqual(undefined);
    expect(extractChangelog(`for the changelog:${result}`)).toEqual(undefined);
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

describe('getPullRequest', () => {
  it('exits if the pull request number is not found', async () => {
    const commit = { commit: { message: '' } } as ResponseCommit;
    const result = await getPullRequest(async () => '')(commit);
    expect(result).toEqual(undefined);
  });

  it('exits if the pull request body is not found', async () => {
    const commit = { commit: { message: 'ziltoid (#9001)' } } as ResponseCommit;
    const result = await getPullRequest(async () => '')(commit);
    expect(result).toEqual(undefined);
  });

  it('exits if the pull request body is not found', async () => {
    const commit = { commit: { message: 'ziltoid (#9001)' } } as ResponseCommit;
    const result = await getPullRequest(async () => 'a body with no changelog')(commit);
    expect(result).toEqual(undefined);
  });

  it('shows the changelog, even without an author found', async () => {
    const commit = { commit: { message: 'ziltoid (#9001)' } } as ResponseCommit;
    const changelog = 'If there were to omnisciences, Ziltoid would be both.';
    const result = await getPullRequest(async () => `changelog: ${changelog}`)(commit);
    expect(result).toEqual(`- ${changelog} (#9001)`);
  });

  it('shows the changelog, with the author found', async () => {
    const commit = {
      author: { login: 'CaptainSpectacular' },
      commit: { message: 'ziltoid (#9001)' },
    } as ResponseCommit;
    const changelog = 'If there were to omnisciences, Ziltoid would be both.';
    const result = await getPullRequest(async () => `changelog: ${changelog}`)(commit);
    expect(result).toEqual(`- ${changelog} (#9001) @CaptainSpectacular`);
  });
});

describe('formattedDate', () => {
  it('returns the date in the proper format', () => {
    jest.useFakeTimers('modern');
    jest.setSystemTime(1414419757000);
    const result = formattedDate();
    expect(result).toEqual('Oct 27, 2014');
  });
});

describe('compareCommits', () => {
  const commitInfo = {
    base: 'a',
    head: 'b',
    owner: 'HevyDevy',
    repo: 'ziltoid',
  };

  it('throws an error if the commits are not found', async () => {
    const octokit = {
      repos: { compareCommitsWithBasehead: {} },
      paginate: {
        iterator: async () => [],
      },
    } as unknown as Octokit;

    expect.assertions(1);
    try {
      await compareCommits({ octokit, ...commitInfo });
    } catch (error: unknown) {
      expect(error).toEqual(new Error('no commits found for a...b'));
    }
  });

  it('throws an error if the result is empty', async () => {
    const octokit = {
      repos: { compareCommitsWithBasehead: {} },
      paginate: {
        iterator: () => ({
          async* [Symbol.asyncIterator]() {
            yield { data: { commits: [] } };
          },
        }),
      },
    } as unknown as Octokit;

    expect.assertions(1);
    try {
      await compareCommits({ octokit, ...commitInfo });
    } catch (error: unknown) {
      expect(error).toEqual(new Error('no commits found for a...b'));
    }
  });

  it('combines paginated data', async () => {
    const octokit = {
      repos: { compareCommitsWithBasehead: {} },
      paginate: {
        iterator: () => ({
          async* [Symbol.asyncIterator]() {
            yield { data: { commits: ['c'] } };
            yield { data: { commits: ['d'] } };
          },
        }),
      },
    } as unknown as Octokit;

    const commits = await compareCommits({ octokit, ...commitInfo });
    expect(commits).toEqual(['c', 'd']);
  });
});

describe('groupChanges', () => {
  it('groups changes, case insensitively', () => {
    const changes = [
      '- fixed a thing',
      '- added some thing',
      '- Fixed some other thing',
      '- did another thing',
      '- improved all the things',
    ];
    const result = groupChanges(changes);
    const expectedResult = [
      '### Additions and Improvements',
      '',
      '- added some thing',
      '- improved all the things',
      '',
      '### Notable Fixes',
      '',
      '- fixed a thing',
      '- Fixed some other thing',
      '',
      '### Other Changes',
      '',
      '- did another thing',
    ].join('\n');
    expect(result).toEqual(expectedResult);
  });

  it('drops sections that are not present', () => {
    const changes = [
      '- fixed a thing',
    ];
    const result = groupChanges(changes);
    const expectedResult = [
      '### Notable Fixes',
      '',
      '- fixed a thing',
    ].join('\n');
    expect(result).toEqual(expectedResult);
  });
});

describe('fetchChanges', () => {
  it('will get pull request changes', async () => {
    const octokit = {
      pulls: {
        // eslint-disable-next-line camelcase -- this defined by the GitHub API
        get: async ({ pull_number: pullNumber }: { pull_number: number }) => ({
          data: {
            body: pullNumber === 9001 ? 'changelog: they hide their finest bean!' : 'changelog: prepare the attack!',
          },
        }),
      },
    } as unknown as Octokit;

    const commits = [
      {
        author: { login: 'ziltoid' },
        commit: { message: 'a commit message (#9001)' },
      },
      {
        author: { login: 'ziltoid' },
        commit: { message: 'a commit message (#9002)' },
      },
    ] as ResponseCommit[];

    const result = await fetchChanges({
      commits,
      octokit,
      owner: 'HevyDevy',
      repo: 'ziltoid',
    });

    expect(result).toEqual([
      '- they hide their finest bean! (#9001) @ziltoid',
      '- prepare the attack! (#9002) @ziltoid',
    ]);
  });
});
