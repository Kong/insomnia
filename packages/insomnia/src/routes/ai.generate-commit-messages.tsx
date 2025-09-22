import { href } from 'react-router';
import { z } from 'zod/v4';

import { showToast } from '~/ui/components/toast-notification';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/ai.generate-commit-messages';

const GeneratedCommitsSchema = z.object({
  commits: z.array(
    z.object({
      message: z.string(),
      files: z.array(z.string()),
    }),
  ),
});

export async function clientAction(args: Route.ClientActionArgs) {
  const { projectId } = (await args.request.json()) as { projectId: string };

  try {
    const diff = await window.main.git.diff();

    console.log('Diff for AI:\n', diff);

    const { log } = await window.main.git.gitLogLoader({ projectId });
    const generatedCommitsResponse = await fetch('http://localhost:3000/generate-commit-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        diff,
        recent_commits: log
          .slice(0, 5)
          .map(({ commit }) => commit.message)
          .join('\n'),
      }),
    });

    const result = await generatedCommitsResponse.json();

    const parsedResult = GeneratedCommitsSchema.safeParse(result);
    if (!parsedResult.success) {
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
      commits: parsedResult.data.commits.map(commit => ({
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
