import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/ai.generate-commit-messages';

export async function clientAction(args: Route.ClientActionArgs) {
  const { projectId } = (await args.request.json()) as { projectId: string };

  // @TODO pass more detailed changes for better results
  const changes = await window.main.git.gitChangesLoader({ projectId });
  const { log } = await window.main.git.gitLogLoader({ projectId });

  const generatedCommitsResponse = await fetch('http://localhost:3000/generate-commit-message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      diff: `
      Staged Changes:
        ${changes.changes.staged
          .map(
            c => `
          - ${c.path} (${c.status}) | ${c.name}
        `,
          )
          .join('\n')}

      Unstaged Changes:
        ${changes.changes.unstaged
          .map(
            c => `
          - ${c.path} (${c.status}) | ${c.name}
        `,
          )
          .join('\n')}
      `,
      recent_commits: log
        .slice(0, 5)
        .map(({ commit }) => commit.message)
        .join('\n'),
    }),
  });

  const result = (await generatedCommitsResponse.json()) as { commits: { message: string; files: string[] }[] };

  return result;
}

export const useAIGenerateActionFetcher = createFetcherSubmitHook(
  submit => (data: { projectId: string }) => {
    submit(data, {
      action: href('/ai/generate-commit-messages'),
      method: 'POST',
      encType: 'application/json',
    });
  },
  clientAction,
);
