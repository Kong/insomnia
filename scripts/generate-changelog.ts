/*

example usage:

```console
npm run generate:changelog -- --base="fc4f32" --head="064898" --releaseName="core@2021.7.0"
```

*/

import { Octokit, RestEndpointMethodTypes } from '@octokit/rest';
import childProcess from 'child_process';
import { promisify } from 'util';
import yargs from 'yargs';

type CompareCommitsRepoResponse = RestEndpointMethodTypes['repos']['compareCommitsWithBasehead']['response'];
type ResponseCommit = CompareCommitsRepoResponse['data']['commits'][0];

const compareCommits = async ({
  auth,
  base,
  head,
}: {
  auth: string;
  base: string;
  head?: string;
}) => {
  const { repos: { compareCommitsWithBasehead }, paginate } = new Octokit({ auth });

  const timeline = paginate.iterator(compareCommitsWithBasehead, {
    owner: 'Kong',
    repo: 'insomnia',
    basehead: `${base}...${head}`,
  });

  const commitsItems: ResponseCommit[] = [];
  for await (const { data: { commits } } of timeline) {
    commitsItems.push(...(commits));
  }
  return commitsItems;
};

const parseTags = (commitMessage: string) => {
  const tagMatch = commitMessage.match(/^(\[[\w-]+\])+/);
  if (tagMatch === null) {
    return '';
  }

  const [tagsWithBracketDelimiter] = tagMatch;
  const delimiterMatch = tagsWithBracketDelimiter?.match(/([\w-]+)/g);
  if (delimiterMatch === null) {
    return '';
  }

  return delimiterMatch.map(tag => tag.toLocaleLowerCase())
    .sort((a, b) => a.localeCompare(b))
    .join(',');
};

const findLatestTaggedVersion = async (base?: string, release?: string) => {
  const { stdout } = await promisify(childProcess.exec)(
    [
      'git',
      'describe',
      // Earlier tags used lightweight tags + commit.
      // We switched to annotated tags later.
      '--tags',
      '--abbrev=0',
      // only include "version-tags"
      '--match "core@202*"',
    ].join(' '),
  );

  const latestTaggedVersion = stdout.trim();

  if (base) {
    if (base !== latestTaggedVersion) {
      console.warn(`Requestion a changelog for '${base}...${release}' although the latest tagged version is '${latestTaggedVersion}'.`,);
    }
    return base;
  }

  return latestTaggedVersion;
};

const handler = async ({
  githubToken,
  base: baseArg,
  head,
  releaseName,
}: {
  githubToken?: string;
  base?: string;
  head?: string;
  releaseName: string;
}) => {
  if (!githubToken) {
    throw new TypeError('Unable to authenticate. Make sure you either call the script with `--githubToken $token` or set `process.env.GITHUB_TOKEN`. The token needs `public_repo` permissions.');
  }
  const base = await findLatestTaggedVersion(baseArg, head);

  const commits = await compareCommits({
    base,
    head,
    auth: githubToken,
  });

  if (commits === null) {
    throw new Error(`no commits found for ${base}...${head}`);
  }

  const authors = Array.from(
    new Set(commits.map(({ author }) => author.login)),
  );

  const contributorHandles = authors
    .sort((a, b) => a.localeCompare(b))
    .map(author => `@${author}`)
    .join(', ');

  // We don't know when a particular commit was made from the API.
  // Only that the commits are ordered by date ASC
  const commitsByDateDesc = commits.slice().reverse();

  // Sort by tags ASC, date desc
  // Will only consider exact matches of tags so `[Slider]` will not be grouped with `[Slider][Modal]`
  commits.sort((a, b) => {
    const aTags = parseTags(a.commit.message);
    const bTags = parseTags(b.commit.message);
    if (aTags === bTags) {
      return commitsByDateDesc.indexOf(a) - commitsByDateDesc.indexOf(b);
    }
    return aTags.localeCompare(bTags);
  });

  const changes = commits.map(commit => {
    /** &#8203; is a zero-width-space that ensures that the content of the listitem is formatted properly */
    const zeroWidthSpace = '&#8203;';

    // Helps changelog author keeping track of order when grouping commits under headings.
    const dateSortMarker = `${zeroWidthSpace}<!-- ${(commits.length - commits.indexOf(commit))
      .toString()
      // Padding them with a zero means we can sort the lines alphanumerically
      .padStart(Math.ceil(Math.log10(commitsByDateDesc.length + 1)), '0')} -->`;

    const shortMessage = commit.commit.message.split('\n')[0];
    return `- ${dateSortMarker}${shortMessage} @${commit.author.login}`;
  });

  const nowFormated = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const changelog = [
    `## ${releaseName}`,
    `<!-- generated comparing ${base}..${head} -->`,
    `_${nowFormated}_`,
    '',
    `A big thanks to the ${authors.length} contributors who made this release possible. Here are some highlights ✨:`,
    '',
    'TODO INSERT HIGHLIGHTS',
    '',
    changes.join('\n'),
    '',
    `All contributors of this release in alphabetical order: ${contributorHandles}`,
    '',
  ].join('\n');

  console.log('\n'.repeat(2));
  console.log(changelog);
};

yargs
  .command({
    command: '$0',
    describe: 'Creates a changelog',
    builder: command => (
      command
        .option('base', {
          describe: 'The release to compare gainst e.g. `core@2021.6.0`. Default: The latest tag on the current branch.',
          type: 'string',
        })
        .option('githubToken', {
          default: process.env.GITHUB_TOKEN,
          describe: 'The personal access token to use for authenticating with GitHub. Needs public_repo permissions.',
          type: 'string',
        })
        .option('head', {
          default: 'develop',
          describe: 'Ref which we want to release',
          type: 'string',
        })
        .option('releaseName', {
          default: 'develop',
          describe: 'Name of the release, e.g. `core@2021.7.0',
          type: 'string',
        })
    ),
    handler,
  })
  .help()
  .strict(true)
  .version(false)
  .parse();
