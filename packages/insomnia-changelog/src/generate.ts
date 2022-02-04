import { Octokit } from '@octokit/rest';
import { Command, createCommand } from 'commander';

import {
  compareCommits,
  fetchChanges,
  formattedDate,
  groupChanges,
  uniqueAuthors,
} from './utils';

export const generateCommand = createCommand('generate')
  .description('Creates a changelog')
  .option(
    '--githubToken <token>',
    'The personal access token to use for authenticating with GitHub. Needs public_repo permissions.'
  )
  .requiredOption(
    '--owner <owner username>',
    'The GitHub organization'
  )
  .requiredOption(
    '--repo <repo name>',
    'The GitHub Repo'
  )
  .requiredOption(
    '--base <git ref>',
    'The release to compare against, e.g. `core@2021.6.0`'
  )
  .option(
    '--head <git ref>',
    'Ref which we want to release',
    'HEAD',
  )
  .requiredOption(
    '--releaseName <name>',
    'Name of the release, e.g. `core@2021.7.0'
  )
  .action(async (_, command: Command) => {
    const {
      base,
      githubToken = process.env.GITHUB_TOKEN,
      head,
      owner,
      releaseName,
      repo,
    } = command.opts();

    if (!githubToken) {
      throw new TypeError('Unable to authenticate. Make sure you either call the script with `--githubToken $token` or set `process.env.GITHUB_TOKEN`. The token needs `public_repo` permissions.');
    }

    const octokit = new Octokit({ auth: githubToken });

    const responseCommits = await compareCommits({
      owner,
      repo,
      base,
      head,
      octokit,
    });

    const authors = uniqueAuthors(responseCommits);

    const changes = await fetchChanges({
      owner,
      repo,
      octokit,
      responseCommits,
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
  });
