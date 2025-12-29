import { href } from 'react-router';

import type { MultiTurnMessage } from '~/plugins/types';
import { showToast } from '~/ui/components/toast-notification';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/ai.mcp-generate-sampling-response';

interface RequestData {
  messages: MultiTurnMessage[];
  maxTokens: number;
  requestId: string;
  serverRequestId: string;
  temperature?: number;
  systemPrompt?: string;
}

export async function clientAction(args: Route.ClientActionArgs) {
  const { messages, maxTokens, temperature, systemPrompt, requestId, serverRequestId } =
    (await args.request.json()) as RequestData;

  try {
    const isFeatureEnabled = await window.main.llm.getAIFeatureEnabled('aiMcpClient');
    const hasActiveLLM = (await window.main.llm.getCurrentConfig()) !== null;

    if (!isFeatureEnabled || !hasActiveLLM) {
      return {
        error: 'Enable MCP LLM integration with AI in Insomnia Preferences → AI Settings to use this feature.',
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

    // Response sampling request with AI-generated response
    window.main.mcp.client.responseSamplingRequest({
      requestId,
      serverRequestId,
      type: 'approve',
      result: {
        content: {
          type: 'text',
          text: response.content,
        },
        model: response.modelConfig.model,
        role: 'assistant',
      },
    });

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
