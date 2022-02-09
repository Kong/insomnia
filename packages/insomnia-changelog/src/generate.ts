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
    'The personal access token to use for authenticating with GitHub. Needs the `public_repo` permission.',
  )
  .requiredOption(
    '--owner <owner username>',
    'the GitHub organization'
  )
  .requiredOption(
    '--repo <repo name>',
    'the GitHub repository'
  )
  .requiredOption(
    '--base <git ref>',
    'the release to compare against, e.g. `core@2021.6.0`'
  )
  .option(
    '--head <git ref>',
    'ref which we want to release',
    'HEAD',
  )
  .requiredOption(
    '--releaseName <name>',
    'name of the release, e.g. `core@2021.7.0'
  )
  .option(
    '--onlyShowMissing',
    'only show commits that are missing a changelog (useful for verifying we didn\'t miss one)'
  )
  .action(async (_, command: Command) => {
    const {
      base,
      githubToken = process.env.GITHUB_TOKEN,
      head,
      onlyShowMissing,
      owner,
      releaseName,
      repo,
    } = command.opts();

    if (!githubToken) {
      throw new TypeError('Unable to authenticate. Make sure you either call the script with `--githubToken $token` or set `process.env.GITHUB_TOKEN`. The token can be generated at https://github.com/settings/tokens, and needs `public_repo` permissions.');
    }

    const octokit = new Octokit({ auth: githubToken });

    const responseCommits = await compareCommits({
      owner,
      repo,
      base,
      head,
      octokit,
    });

    const { changelogLines, missingChanges } = await fetchChanges({
      owner,
      repo,
      octokit,
      responseCommits,
    });

    if (onlyShowMissing) {
      console.log(missingChanges.join('\n'));
      return;
    }

    const changeLines = groupChanges(changelogLines);
    const authors = uniqueAuthors(responseCommits);

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
