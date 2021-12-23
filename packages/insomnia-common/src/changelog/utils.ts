import { Octokit, RestEndpointMethodTypes } from '@octokit/rest';
import { flatten, groupBy, head, join, map, pipe, sort, sortBy, toPairs, uniq } from 'ramda';
import { compact } from 'ramda-adjunct';
import { Entries } from 'type-fest';

type CompareCommitsRepoResponse = RestEndpointMethodTypes['repos']['compareCommitsWithBasehead']['response'];
export type ResponseCommit = CompareCommitsRepoResponse['data']['commits'][0];

/** look for the first occurance of `changelog:` at the beginning of a line, case insensitive */
export const extractChangelog = (pullRequestDescription: string | null) => pullRequestDescription ? (
  pullRequestDescription.match(/^changelog:[ \t]*(.*)/mi)?.[1] || undefined
) : null;

type AuthorHandle = `@${string}`;

export const getAuthorHandles = ({ author }: ResponseCommit) => (
  author && author.login ? [`@${author.login}`] as AuthorHandle[] : null
);

export const uniqueAuthors: (responseCommits: ResponseCommit[]) => AuthorHandle[] = pipe(
  map(getAuthorHandles),
  flatten,
  uniq,
  compact,
  sort((a, b) => a.localeCompare(b)),
);

export const getPullRequestNumber = ({ commit }: ResponseCommit) => {
  const firstLine = commit.message.split('\n')[0];
  const stringPRNumber = firstLine.match(/\(#([0-9]+)\)$/)?.[1];
  if (!stringPRNumber) {
    return undefined;
  }
  return parseInt(stringPRNumber);
};

export const getChangelogLine = (getPullBody: (prNumber?: number) => Promise<string | null>) => async (responseCommit: ResponseCommit) => {
  const pullRequestNumber = getPullRequestNumber(responseCommit);
  const prBody = await getPullBody(pullRequestNumber);
  const prChangelog = extractChangelog(prBody);
  const pullRequestSection = pullRequestNumber ? ` (#${pullRequestNumber})` : '';

  const commitChangelog = extractChangelog(responseCommit.commit.message);
  if (!prChangelog && !commitChangelog) {
    return;
  }

  // if there's no PR changelog (such as a situation where there's no PR), then fall back to the commit
  const changelog = prChangelog || commitChangelog;

  const author = getAuthorHandles(responseCommit)?.join(' ');
  const authorSection = author ? ` ${author}` : '';
  return `- ${changelog}${pullRequestSection}${authorSection}`;
};

export const formattedDate = () => new Date().toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export const compareCommits = async ({
  octokit,
  base,
  head,
  owner,
  repo,
}: {
  octokit: Octokit;
  base: string;
  head: string;
  owner: string;
  repo: string;
}) => {
  const { repos: { compareCommitsWithBasehead }, paginate } = octokit;
  const pages = paginate.iterator(compareCommitsWithBasehead, {
    owner,
    repo,
    basehead: `${base}...${head}`,
  });
  const notFound = new Error(`no commits found for ${base}...${head}`);

  try {
    const commitsItems: ResponseCommit[] = [];
    for await (const { data: { commits } } of pages) {
      commitsItems.push(...commits);
    }
    if (commitsItems.length === 0) {
      throw notFound;
    }
    return commitsItems;
  } catch (error: unknown) {
    throw notFound;
  }
};

export const fetchChanges = async ({
  responseCommits,
  octokit,
  owner,
  repo,
}: {
  responseCommits: ResponseCommit[];
  octokit: Octokit;
  owner: string;
  repo: string;
}) => {
  const getPullBody = async (pullNumber?: number) => pullNumber ? (await octokit.pulls.get({
    owner,
    repo,
    // eslint-disable-next-line camelcase -- this defined by the GitHub API
    pull_number: pullNumber,
  })).data.body : null;

  const getLine = getChangelogLine(getPullBody);
  const changes = await Promise.all(map(getLine, responseCommits));
  return compact(changes);
};

export const groupChanges: (changes: string[]) => string = pipe(
  groupBy(change => {
    if (/\- fixed/i.exec(change)) {
      return 'Notable Fixes';
    }

    if (/\- improved/i.exec(change) || /\- added/i.exec(change)) {
      return 'Additions and Improvements';
    }

    return 'Other Changes';
  }),
  toPairs as <T>(t: T) => Entries<typeof t>,
  pairs => sortBy(head, pairs),
  map(([group, items]) => join('\n', [
    `### ${group}`,
    '',
    ...items,
  ])),
  join('\n\n'),
);
