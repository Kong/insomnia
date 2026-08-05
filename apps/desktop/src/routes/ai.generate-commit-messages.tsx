import { href } from 'react-router';

import { AnalyticsEvent } from '~/ui/analytics';
import { showToast } from '~/ui/components/toast-notification';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/ai.generate-commit-messages';

export async function clientAction(args: Route.ClientActionArgs) {
  const { projectId } = (await args.request.json()) as { projectId: string };

  try {
    const isFeatureEnabled = await window.main.llm.getAIFeatureEnabled('aiCommitMessages');
    const hasActiveLLM = (await window.main.llm.getCurrentConfig()) !== null;

    if (!isFeatureEnabled || !hasActiveLLM) {
      return {
        error: 'Enable generating commit messages with AI in Insomnia Preferences → AI Settings to use this feature.',
      };
    }

    const { changes } = await window.main.git.gitChangesLoader({ projectId });
    if (changes.staged.length > 0) {
      return {
        error: 'You have staged changes. Please commit or unstage them and try again.',
      };
    }
    const diff = await window.main.git.diff();

    const { log } = await window.main.git.gitLogLoader({ projectId });

    const startTime = performance.now();
    const { error, commits } = await window.main.generateCommitsFromDiff({
      diff,
      recent_commits: log
        .slice(0, 5)
        .map(({ commit }) => commit.message)
        .join('\n'),
    });

    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.recommendCommitsGenerated,
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
