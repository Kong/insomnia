import { Octokit, RestEndpointMethodTypes } from '@octokit/rest';
import { any, flatten, groupBy, head, join, map, mergeAll, pipe, reduce, reject, sort, sortBy, take, toPairs, uniq } from 'ramda';
import { compact } from 'ramda-adjunct';
import { Entries } from 'type-fest';

type CompareCommitsRepoResponse = RestEndpointMethodTypes['repos']['compareCommitsWithBasehead']['response'];
export type ResponseCommit = CompareCommitsRepoResponse['data']['commits'][0];
export type PullsResponse = Pick<
  RestEndpointMethodTypes['pulls']['get']['response']['data'],
  | 'title'
  | 'number'
  | 'body'
  | 'html_url'
>;

/** look for the first occurance of `changelog:` at the beginning of a line, case insensitive */
export const extractChangelog = (pullRequestDescription: string | null | undefined) => pullRequestDescription ? (
  pullRequestDescription.match(/^changelog:[ \t]*(.*)/mi)?.[1] || undefined
) : null;

type AuthorHandle = `@${string}`;

export const getAuthorHandles = ({ author }: ResponseCommit) => (
  author && author.login ? [`@${author.login}`] as AuthorHandle[] : null
);

// TODO: make this configurable by the end user
const ignoreCommitMessagePatterns = [
  /Merge branch 'release/,
];

export const shouldIgnoreCommit = ({ commit }: ResponseCommit) => any(regex => (
  regex.test(commit.message)
), ignoreCommitMessagePatterns);

export const uniqueAuthors: (responseCommits: ResponseCommit[]) => AuthorHandle[] = pipe(
  map(getAuthorHandles),
  flatten,
  uniq,
  compact,
  sort((a, b) => a.localeCompare(b)),
);

export const getChangelogLine = (responseCommit: ResponseCommit, pull: PullsResponse | null | undefined) => {
  const prChangelog = extractChangelog(pull?.body);
  const commitChangelog = extractChangelog(responseCommit.commit.message);
  if (!prChangelog && !commitChangelog) {
    return null;
  }

  // if there's no PR changelog (such as a situation where there's no PR), then fall back to the commit
  const changelog = prChangelog || commitChangelog;
  const pullRequestSection = pull?.number ? ` (#${pull.number})` : '';

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
    return reject(shouldIgnoreCommit, commitsItems);
  } catch (error: unknown) {
    throw notFound;
  }
};

export const getPull = ({
  octokit,
  owner,
  repo,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
}) => async ({ sha }: ResponseCommit) => {
  /**
   * !BEWARE! GitHub has a strange API behavior whereby if you send the full hash it will return different results.
   *
   * If you don't believe me try for yourself:
   * > search `is:pr b2c94ebbdbcc72750d1cb415f058d49a57ca5676` on https://github.com/Kong/insomnia/pulls and then again but remove one character from the end of the hash.
   */
  const shortenedHash = take(10, sha);
  const q = `org:${owner} repo:${repo} is:pr ${shortenedHash}`;
  const pull = await octokit.search.issuesAndPullRequests({ q });

  if (pull.data.items.length > 1) {
    throw new Error(`found multiple PRs for a commit ${JSON.stringify({ sha, pulls: pull.data.items })}`);
  }

  return (pull.data.items[0] ?? null) as PullsResponse | null;
};

type ChangelogLine = string;
type MissingChanges = string;
type FetchedChanges = [ChangelogLine[], MissingChanges[]];

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
  const pullGetter = getPull({ octokit, owner, repo });
  const pullsById = mergeAll(await Promise.all(map(async responseCommit => ({
    [responseCommit.sha]: await pullGetter(responseCommit),
  }), responseCommits)));

  return reduce<ResponseCommit, FetchedChanges>(([changes, missingChanges], responseCommit) => {
    const pull = pullsById[responseCommit.sha];
    const changelogLine = getChangelogLine(responseCommit, pull);

    if (changelogLine !== null) {
      // this commit associates to a valid changelog, so append it to the changes list
      return [[...changes, changelogLine], missingChanges];
    }

    if (pull !== null) {
      // no changelog found, but there is a pull URL, so output that.
      return [changes, [...missingChanges, `- ${pull.html_url} ${pull.title}`]];
    }

    // no changelog or pull request found, so just append a link to the URL
    return [changes, [...missingChanges, `- ${responseCommit.html_url} ${responseCommit.commit.message}`]];
  }, [[], []], responseCommits);
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
