import { fetch } from './fetch';

export interface StainlessSdk {
  id: string;
  languages: string[];
}

export interface StainlessSdkSnippet {
  code: string;
}

export const getStainlessSdkByEndpoint = (params: { endpoint: string }): Promise<StainlessSdk | null> => {
  return fetch<StainlessSdk | null>({
    method: 'GET',
    path: `/integrations/stainless/sdk?endpoint=${encodeURIComponent(params.endpoint)}`,
    sessionId: null,
  });
};

export interface StainlessSdkSnippetParameter {
  in: 'query' | 'header' | 'cookie';
  name: string;
  value: string;
}

export const generateStainlessSdkSnippet = ({
  id,
  language,
  method,
  path,
  parameters,
  body,
}: {
  id: string;
  language: string;
  method: string;
  path: string;
  parameters?: StainlessSdkSnippetParameter[];
  body?: Record<string, unknown>;
}) => {
  return fetch<StainlessSdkSnippet>({
    method: 'POST',
    path: `/integrations/stainless/sdk/${id}/snippet`,
    data: { language, method, path, parameters, body },
    sessionId: null,
  });
};
