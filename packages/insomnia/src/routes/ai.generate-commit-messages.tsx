import { href } from 'react-router';

import { showToast } from '~/ui/components/toast-notification';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/ai.generate-commit-messages';

export async function clientAction(args: Route.ClientActionArgs) {
  const { projectId } = (await args.request.json()) as { projectId: string };

  try {
    const { changes } = await window.main.git.gitChangesLoader({ projectId });
    if (changes.staged.length > 0) {
      return {
        error: 'You have staged changes. Please commit or unstage them and try again.',
      };
    }
    const diff = await window.main.git.diff();

    const { log } = await window.main.git.gitLogLoader({ projectId });

    const { error, commits } = await window.main.generateCommitsFromDiff({
      diff,
      recent_commits: log
        .slice(0, 5)
        .map(({ commit }) => commit.message)
        .join('\n'),
    });

    if (error || !commits) {
      showToast({
        title: 'Failed to generate commit messages',
        icon: 'star',
        status: 'error',
        description: 'The AI service returned invalid data. Please try again.',
      });
      return {
        error: 'The AI service returned invalid data. Please try again.',
      };
    }

    return {
      commits: commits.map(commit => ({
        id: crypto.randomUUID(),
        ...commit,
      })),
    };
  } catch (err) {
    showToast({
      title: 'Failed to generate commit messages',
      icon: 'star',
      status: 'error',
      description: 'There was an error communicating with the AI service. Please try again.',
    });
    return {
      error: 'There was an error communicating with the AI service. Please try again.',
    };
  }
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
