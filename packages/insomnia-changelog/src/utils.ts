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
export const extractChangelog = (input: string | null | undefined) => {
  if (!input) {
    return null;
  }

  const regex = /^changelog(?:\((?<category>.+)?\))?:[ \t]*(?<change>.+)$/mi;
  const match = input.match(regex);
  if (!match) {
    return null;
  }
  const chanelogLine = match.groups as unknown as ChangelogLine;
  chanelogLine.change = chanelogLine.change.trim();
  if (!chanelogLine.change) {
    return null;
  }

  return chanelogLine;
};

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
  const changelogLine = prChangelog || commitChangelog;
  if (!changelogLine) {
    return null;
  }

  // if there's no PR changelog (such as a situation where there's no PR), then fall back to the commit
  const { change, category } = changelogLine;
  const pullRequestSection = pull?.number ? ` (#${pull.number})` : '';

  const author = getAuthorHandles(responseCommit)?.join(' ');
  const authorSection = author ? ` ${author}` : '';
  return {
    line: `- ${change}${pullRequestSection}${authorSection}`,
    category,
  };
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
    throw new Error(`found multiple PRs for a commit: ${JSON.stringify({ sha, pulls: pull.data.items })}`);
  }

  return (pull.data.items[0] ?? null) as PullsResponse | null;
};

export interface ChangelogLine {
  change: string;
  category?: string;
}
type MissingChanges = string;
interface FetchedChanges {
  changelogLines: ChangelogLine[];
  missingChanges: MissingChanges[];
}

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

  return reduce<ResponseCommit, FetchedChanges>(({ changelogLines, missingChanges }, responseCommit) => {
    const pull = pullsById[responseCommit.sha];
    const { line: changelogLine, category } = getChangelogLine(responseCommit, pull) || {};

    if (changelogLine !== null && changelogLine !== undefined) {
      // this commit associates to a valid changelog, so append it to the changes list
      return {
        changelogLines: [
          ...changelogLines,
          {
            change: changelogLine,
            category,
          },
        ],
        missingChanges,
      };
    }

    if (pull !== null) {
      // no changelog found, but there is a pull URL, so output that.
      return {
        changelogLines,
        missingChanges: [
          ...missingChanges,
          `- ${pull.html_url} ${pull.title}`,
        ],
      };
    }

    // no changelog or pull request found, so just append a link to the URL
    return {
      changelogLines,
      missingChanges: [
        ...missingChanges,
        `- ${responseCommit.html_url} ${responseCommit.commit.message}`,
      ],
    };
  }, { changelogLines: [], missingChanges: [] }, responseCommits);
};

const FALLBACK_CATEGORY = 'Other Changes';

export const groupChanges: (changelogLine: ChangelogLine[]) => string = pipe(
  groupBy(({ category }) => category || FALLBACK_CATEGORY),
  toPairs as <T>(t: T) => Entries<typeof t>,
  pairs => sortBy(head, pairs),
  map(([category, changelogLines]) => [
    `### ${category}`,
    '',
    ...changelogLines.map(item => item.change),
  ].join('\n')),
  join('\n\n'),
);
