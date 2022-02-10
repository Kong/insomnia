import { Octokit } from '@octokit/rest';
import { map, path } from 'ramda';

import {
  ChangelogLine,
  compareCommits,
  extractChangelog,
  fetchChanges,
  formattedDate,
  getAuthorHandles,
  getChangelogLine,
  getPull,
  groupChanges,
  PullsResponse,
  ResponseCommit,
  shouldIgnoreCommit,
  uniqueAuthors,
} from './utils';

describe('shouldIgnoreCommit', () => {
  it('it will ignore release commits', () => {
    const commit = {
      commit: {
        message: 'Merge branch \'release/2021.7.2\' into develop',
      },
    } as ResponseCommit;

    expect(shouldIgnoreCommit(commit)).toEqual(true);
  });

  it('it will not ignore other commits commits', () => {
    const commit = {
      commit: {
        message: 'The same thing we do every night, Pinky.',
      },
    } as ResponseCommit;

    expect(shouldIgnoreCommit(commit)).toEqual(false);
  });
});

describe('extractChangelog', () => {
  const result = 'Fixed an issue with xyz.';

  it('will grab a changelog from a single line', () => {
    expect(extractChangelog(`changelog: ${result}`)).toEqual({
      change: result,
      category: undefined,
    });
  });

  it('is case insensitive', () => {
    expect(extractChangelog(`cHaNgElOg: ${result}`)).toEqual({
      change: result,
      category: undefined,
    });
  });

  it('requires the colon', () => {
    expect(extractChangelog(`changelog ${result}`)).toEqual(null);
  });

  it('allows zero whitespace after `changelog:`', () => {
    expect(extractChangelog(`changelog:${result}`)).toEqual({
      change: result,
      category: undefined,
    });
  });

  it('allows multiple spaces after `changelog:`', () => {
    expect(extractChangelog(`changelog:  ${result}`)).toEqual({
      change: result,
      category: undefined,
    });
  });

  it('allows one or more tabs after `changelog:`', () => {
    expect(extractChangelog(`changelog:\t${result}`)).toEqual({
      change: result,
      category: undefined,
    });

    expect(extractChangelog(`changelog:\t\t${result}`)).toEqual({
      change: result,
      category: undefined,
    });
  });

  it('does not allow newlines after `changelog:`', () => {
    expect(extractChangelog(`changelog:\n${result}`)).toEqual(null);
  });

  it('does not allow newlines after `changelog: `', () => {
    expect(extractChangelog(`changelog: \n${result}`)).toEqual(null);
  });

  it('does not allow empty string changelogs', () => {
    expect(extractChangelog('changelog: ')).toEqual(null);
  });

  it('trims trailing whitespace', () => {
    expect(extractChangelog(`changelog: ${result} `)).toEqual({
      change: result,
      category: undefined,
    });
  });

  it('requires that the line begins with `changelog:`', () => {
    expect(extractChangelog(` changelog:${result}`)).toEqual(null);
    expect(extractChangelog(`for the changelog:${result}`)).toEqual(null);
  });

  it('only returns the first match', () => {
    const description = [
      `changelog: ${result}`,
      'changelog: will not match',
    ].join('\n');
    expect(extractChangelog(description)).toEqual({
      change: result,
      category: undefined,
    });
  });

  it('does not require the match line to be the first line', () => {
    const description = [
      'first line of PR or commit',
      `changelog: ${result}`,
    ].join('\n');
    expect(extractChangelog(description)).toEqual({
      change: result,
      category: undefined,
    });
  });

  it("disregards the match text that doesn't start at the beginning of the line", () => {
    const description = [
      'check out the changelog: tomorrow',
      `changelog: ${result}`,
    ].join('\n');
    expect(extractChangelog(description)).toEqual({
      change: result,
      category: undefined,
    });
  });

  it('will extract a changelog group', () => {
    expect(extractChangelog(`changelog(Fixes): ${result}`)).toEqual<ChangelogLine>({
      change: result,
      category: 'Fixes',
    });
  });

  it('will not extract a missing changelog group', () => {
    expect(extractChangelog(`changelog(): ${result}`)).toEqual<ChangelogLine>({
      change: result,
      category: undefined,
    });
  });
});

describe('getAuthorHandles', () => {
  it('returns the handle if an author login exists', () => {
    const commit = { author: { login: 'a' } } as ResponseCommit;
    expect(getAuthorHandles(commit)).toEqual(['@a']);
  });

  it('returns null if no author exists', () => {
    const commit = {} as ResponseCommit;
    expect(getAuthorHandles(commit)).toEqual(null);
  });

  it('returns null if no author login exists', () => {
    const commit = { author: {} } as ResponseCommit;
    expect(getAuthorHandles(commit)).toEqual(null);
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

describe('getChangelogLine', () => {
  const changelog = 'If there were to omnisciences, Ziltoid would be both.';
  const author = { login: 'CaptainSpectacular' };
  const authorHandle = '@CaptainSpectacular';

  it('exits if the pull request number is not found', async () => {
    const commit = { commit: { message: '' } } as ResponseCommit;
    const result = getChangelogLine(commit, null);
    expect(result).toEqual(null);
  });

  it('exits if the pull request body is not found', async () => {
    const commit = { commit: { message: 'ziltoid (#9001)' } } as ResponseCommit;
    const result = getChangelogLine(commit, null);
    expect(result).toEqual(null);
  });

  it('exits if the pull request body is not found', async () => {
    const commit = { commit: { message: 'ziltoid (#9001)' } } as ResponseCommit;
    const pull = { body: 'a body with no changelog' } as PullsResponse;
    const result = getChangelogLine(commit, pull);
    expect(result).toEqual(null);
  });

  it('shows the changelog, even without an author found', async () => {
    const commit = { commit: { message: 'ziltoid (#9001)' } } as ResponseCommit;
    const pull = { body: `changelog: ${changelog}`, number: 9001 } as PullsResponse;
    const result = getChangelogLine(commit, pull)?.line;
    expect(result).toEqual(`- ${changelog} (#9001)`);
  });

  it('can a changelog from a commit', async () => {
    const commit = {
      author,
      commit: { message: `ziltoid\nchangelog: ${changelog}` },
    } as ResponseCommit;
    const result = getChangelogLine(commit, null)?.line;
    expect(result).toEqual(`- ${changelog} ${authorHandle}`);
  });

  it('will preference a PR changelog over a commit changelog', async () => {
    const commit = {
      author,
      commit: { message: `ziltoid\nchangelog: ${changelog}` },
    } as ResponseCommit;
    const pull = { body: `changelog: ${changelog}` } as PullsResponse;
    const result = getChangelogLine(commit, pull)?.line;
    expect(result).toEqual(`- ${changelog} ${authorHandle}`);
  });

  it('shows the changelog, with the author found', async () => {
    const commit = {
      author,
      commit: { message: 'ziltoid (#9001)' },
    } as ResponseCommit;
    const pull = { body: `changelog: ${changelog}`, number: 9001 } as PullsResponse;
    const result = getChangelogLine(commit, pull)?.line;
    expect(result).toEqual(`- ${changelog} (#9001) ${authorHandle}`);
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
    owner: '',
    repo: '',
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
            yield { data: { commits: [{ commit: { message: 'c' } }] } };
            yield { data: { commits: [{ commit: { message: 'd' } }] } };
          },
        }),
      },
    } as unknown as Octokit;

    const commits = await compareCommits({ octokit, ...commitInfo });
    const messages = map(path(['commit', 'message']), commits);
    expect(messages).toEqual(['c', 'd']);
  });
});

describe('groupChanges', () => {
  it('groups changes, case insensitively', () => {
    const changes = [
      {
        category: 'Fixes',
        change: '- fixed a thing',
      },
      {
        category: 'Additions',
        change: '- added some thing',
      },
      {
        category: 'Fixes',
        change: '- Fixed some other thing',
      },
      {
        category: undefined,
        change: '- did another thing',
      },
      {
        category: 'Improvements',
        change: '- improved all the things',
      },
    ];
    const result = groupChanges(changes);
    const expectedResult = [
      '### Additions',
      '',
      '- added some thing',
      '',
      '### Fixes',
      '',
      '- fixed a thing',
      '- Fixed some other thing',
      '',
      '### Improvements',
      '',
      '- improved all the things',
      '',
      '### Other Changes',
      '',
      '- did another thing',
    ].join('\n');
    expect(result).toEqual(expectedResult);
  });

  it('groups other changes into the "Other Changes" category', () => {
    const changes = [{
      category: undefined,
      change: '- fixed a thing',
    }];
    expect(groupChanges(changes)).toEqual([
      '### Other Changes',
      '',
      '- fixed a thing',
    ].join('\n'));
  });

  it('drops sections that are not present', () => {
    const changes = [
      {
        category: 'Notable Fixes',
        change: '- fixed a thing',
      },
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

describe('getPull', () => {
  it('errors if multiple commits are found', async () => {
    const octokit = {
      search: {
        issuesAndPullRequests: async () => ({
          data: { items: ['>', '1'] },
        }),
      },
    } as unknown as Octokit;

    const doPull = () => getPull({ octokit, owner: '', repo: '' })({
      sha: 'shank redemption',
    } as ResponseCommit);

    await expect(doPull).rejects.toThrow('found multiple PRs for a commit: {"sha":"shank redemption","pulls":[">","1"]}');
  });
});

describe('fetchChanges', () => {
  it('can handle commits without pull request numbers', async () => {
    const octokit = {
      search: {
        issuesAndPullRequests: async () => ({
          data: { items: [] },
        }),
      },
    } as unknown as Octokit;

    const responseCommits = [{
      // eslint-disable-next-line camelcase -- from the GitHub API
      html_url: 'http://example.com',
      commit: { message: 'a commit message without a PR number' },
      sha: 'shank redemption',
    }] as ResponseCommit[];

    const result = await fetchChanges({
      responseCommits,
      octokit,
      owner: '',
      repo: '',
    });

    expect(result.changelogLines).toEqual([]);
    expect(result.missingChanges).toEqual([
      '- http://example.com a commit message without a PR number',
    ]);
  });

  it('can handle no changelog or pull request found', async () => {
    const octokit = {
      search: {
        issuesAndPullRequests: async () => ({
          data: { items: [{
            number: 9001,
            body: 'some non-changelog',
            // eslint-disable-next-line camelcase -- from the GitHub API
            html_url: 'http://example.com',
            title: 'some PR',
          }] },
        }),
      },
    } as unknown as Octokit;

    const responseCommits = [{
      commit: { message: 'a commit message without a PR number' },
      sha: 'shank redemption',
    }] as ResponseCommit[];

    const result = await fetchChanges({
      responseCommits,
      octokit,
      owner: '',
      repo: '',
    });

    expect(result.changelogLines).toEqual([]);
    expect(result.missingChanges).toEqual(['- http://example.com some PR']);
  });

  it('will get pull request changes', async () => {
    const octokit = {
      search: {
        issuesAndPullRequests: async ({ q }: { q: string }) => ({
          data: {
            items: [
              q.includes('9001') ?
                { number: 9001, body: 'changelog: they hide their finest bean!' }
                : { number: 9002, body: 'changelog: prepare the attack!' },
            ] as PullsResponse[],
          },
        }),
      },
    } as unknown as Octokit;

    const responseCommits = [
      {
        author: { login: 'ziltoid' },
        commit: { message: 'a commit message (#9001)' },
        sha: '9001',
      },
      {
        author: { login: 'ziltoid' },
        commit: { message: 'a commit message (#9002)' },
        sha: '9002',
      },
    ] as ResponseCommit[];

    const result = await fetchChanges({
      responseCommits,
      octokit,
      owner: '',
      repo: '',
    });

    expect(result.changelogLines).toEqual([
      {
        category: undefined,
        change: '- they hide their finest bean! (#9001) @ziltoid',
      },
      {
        category: undefined,
        change: '- prepare the attack! (#9002) @ziltoid',
      },
    ]);
    expect(result.missingChanges).toEqual([]);
  });
});
