import { href } from 'react-router';

import { SegmentEvent } from '~/ui/analytics';
import { showToast } from '~/ui/components/toast-notification';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/ai.generate-commit-messages';

export async function clientAction(args: Route.ClientActionArgs) {
  const { projectId } = (await args.request.json()) as { projectId: string };

  try {
    const isFeatureEnabled = await globalThis.main.llm.getAIFeatureEnabled('aiCommitMessages');
    const hasActiveLLM = (await globalThis.main.llm.getCurrentConfig()) !== null;

    if (!isFeatureEnabled || !hasActiveLLM) {
      return {
        error: 'Enable generating commit messages with AI in Insomnia Preferences → AI Settings to use this feature.',
      };
    }

    const { changes } = await globalThis.main.git.gitChangesLoader({ projectId });
    if (changes.staged.length > 0) {
      return {
        error: 'You have staged changes. Please commit or unstage them and try again.',
      };
    }
    const diff = await globalThis.main.git.diff();

    const { log } = await globalThis.main.git.gitLogLoader({ projectId });

    const startTime = performance.now();
    const { error, commits } = await globalThis.main.generateCommitsFromDiff({
      diff,
      recent_commits: log
        .slice(0, 5)
        .map(({ commit }) => commit.message)
        .join('\n'),
    });

    globalThis.main.trackSegmentEvent({
      event: SegmentEvent.recommendCommitsGenerated,
      properties: {
        file_count: commits?.map(commit => commit.files?.length || 0)?.reduce((a, b) => a + b, 0),
        group_count: commits?.length || 0,
        time_to_generate_in_seconds: (performance.now() - startTime) / 1000,
        has_error: Boolean(error),
      },
    });

    if (error || !commits) {
      showToast({
        title: 'Failed to generate commit messages',
        icon: 'star',
        status: 'error',
        description: `The AI service returned invalid data. Please try again. ${error}`,
      });
      return {
        error: `The AI service returned invalid data. Please try again. ${error}`,
      };
    }

    return {
      commits: commits.map((commit: any) => ({
        id: crypto.randomUUID(),
        ...commit,
      })),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    showToast({
      title: 'Failed to generate commit messages',
      icon: 'star',
      status: 'error',
      description: `There was an error communicating with the AI service. Please try again. ${errorMessage}`,
    });
    return {
      error: `There was an error communicating with the AI service. Please try again. ${errorMessage}`,
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
