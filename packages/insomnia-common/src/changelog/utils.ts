import { Octokit, RestEndpointMethodTypes } from '@octokit/rest';
import { map, pipe, sort, uniq } from 'ramda';
import { compact } from 'ramda-adjunct';

type CompareCommitsRepoResponse = RestEndpointMethodTypes['repos']['compareCommitsWithBasehead']['response'];
export type ResponseCommit = CompareCommitsRepoResponse['data']['commits'][0];

/** look for the first occurance of `changelog:` at the beginning of a line, case insensitive */
export const extractChangelog = (pullRequestDescription: string) => (
  pullRequestDescription.match(/^changelog:[ \t]*(.*)/mi)?.[1] || undefined
);

export const getAuthorHandleFromCommit = ({ author }: ResponseCommit) => (
  author && author.login ? `@${author.login}` : null
);

export const uniqueAuthors: (commits: ResponseCommit[]) => string[] = pipe(
  map(getAuthorHandleFromCommit),
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

export const getPullRequest = (getPullBody: (prNumber: number) => Promise<string | null>) => async (commit: ResponseCommit) => {
  const pullRequestNumber = getPullRequestNumber(commit);
  if (!pullRequestNumber) {
    return;
  }

  const prBody = await getPullBody(pullRequestNumber);
  if (!prBody) {
    return;
  }

  const changelog = extractChangelog(prBody);
  if (!changelog) {
    return;
  }

  const author = getAuthorHandleFromCommit(commit);
  const authorship = author ? ` ${author}` : '';
  return `- ${changelog} (#${pullRequestNumber})${authorship}`;
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

export const getChanges = async ({
  commits,
  octokit,
  owner,
  repo,
}: {
  commits: ResponseCommit[];
  octokit: Octokit;
  owner: string;
  repo: string;
}) => {
  const getPullBody = async (pullNumber: number) => (await octokit.pulls.get({
    owner,
    repo,
    // eslint-disable-next-line camelcase -- this defined by the GitHub API
    pull_number: pullNumber,
  })).data.body;

  const getPR = getPullRequest(getPullBody);
  const changes = await Promise.all(map(getPR, commits));
  return compact(changes);
};
