/*
example usage:

```console
npm run generate:changelog -- --base="core@2021.7.2" --head="21ab3dd" --releaseName="core@2021.7.3"
```

*/

import { Octokit } from '@octokit/rest';
import yargs from 'yargs';

import {
  compareCommits,
  fetchChanges,
  formattedDate,
  groupChanges,
  uniqueAuthors,
} from './utils';

const handler = async ({
  base,
  githubToken,
  head,
  owner,
  releaseName,
  repo,
}: {
  base: string;
  githubToken?: string;
  head: string;
  owner: string;
  releaseName: string;
  repo: string;
}) => {
  if (!githubToken) {
    throw new TypeError('Unable to authenticate. Make sure you either call the script with `--githubToken $token` or set `process.env.GITHUB_TOKEN`. The token needs `public_repo` permissions.');
  }

  const octokit = new Octokit({ auth: githubToken });

  const commits = await compareCommits({
    owner,
    repo,
    base,
    head,
    octokit,
  });

  const authors = uniqueAuthors(commits);

  const changes = await fetchChanges({
    owner,
    repo,
    octokit,
    commits,
  });
  const changeLines = groupChanges(changes);

  const changelog = [
    `## ${releaseName}`,
    `<!-- generated comparing ${base}..${head} -->`,
    `_${formattedDate()}_`,
    '',
    `A big thanks to the ${authors.length} contributors who made this release possible. Here are some highlights ✨:`,
    '',
    changeLines,
    '',
    `All contributors of this release in alphabetical order: ${authors.join(', ')}`,
    '',
  ].join('\n');

  console.log(changelog);
  return changelog;
};

yargs
  .command({
    command: '$0',
    describe: 'Creates a changelog',
    builder: command => (
      command
        .option('githubToken', {
          default: process.env.GITHUB_TOKEN,
          describe: 'The personal access token to use for authenticating with GitHub. Needs public_repo permissions.',
          type: 'string',
        })
        .option('owner', {
          demandOption: true,
          describe: 'The GitHub organization',
          type: 'string',
        })
        .option('repo', {
          demandOption: true,
          describe: 'The GitHub Repo',
          type: 'string',
        })
        .option('base', {
          demandOption: true,
          describe: 'The release to compare gainst e.g. `core@2021.6.0`. Default: The latest tag on the current branch.',
          type: 'string',
        })
        .option('head', {
          demandOption: true,
          default: 'HEAD',
          describe: 'Ref which we want to release',
          type: 'string',
        })
        .option('releaseName', {
          demandOption: true,
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
