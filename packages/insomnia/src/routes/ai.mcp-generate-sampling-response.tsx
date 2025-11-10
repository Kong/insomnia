import { href } from 'react-router';

import type { MultiTurnMessage } from '~/plugins/types';
import { showToast } from '~/ui/components/toast-notification';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/ai.generate-commit-messages';

interface RequestData {
  messages: MultiTurnMessage[];
  maxTokens: number;
  temperature?: number;
  systemPrompt?: string;
}

export async function clientAction(args: Route.ClientActionArgs) {
  const { messages, maxTokens, temperature, systemPrompt } = (await args.request.json()) as RequestData;

  try {
    const isFeatureEnabled = await window.main.llm.getAIFeatureEnabled('aiCommitMessages');
    const hasActiveLLM = (await window.main.llm.getCurrentConfig()) !== null;

    if (!isFeatureEnabled || !hasActiveLLM) {
      return {
        error: 'Enable MCP integration with AI in Insomnia Preferences → AI Settings to use this feature.',
      };
    }

    const { response, error } = await window.main.generateMcpSamplingResponse({
      systemPrompt,
      messages,
      modelConfig: {
        maxTokens,
        temperature,
      },
    });

    if (!response) {
      showToast({
        title: 'Failed to generate sampling response',
        icon: 'star',
        status: 'error',
        description: `The AI service returned invalid data. Please try again. ${error}`,
      });
      return {
        error: `The AI service returned invalid data. Please try again. ${error}`,
      };
    }

    return { response };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    showToast({
      title: 'Failed to generate sampling response',
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
  submit => (data: RequestData) => {
    submit(JSON.stringify(data), {
      action: href('/ai/mcp-generate-sampling-response'),
      method: 'POST',
      encType: 'application/json',
    });
  },
  clientAction,
);
