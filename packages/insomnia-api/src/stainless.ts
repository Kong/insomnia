import { fetch } from './fetch';

export interface Sdk {
  id: string;
  languages: string[];
}

export interface SdkSnippet {
  code: string;
}

export const getSdkByEndpoint = (params: { endpoint: string }): Promise<Sdk | null> => {
  return fetch<Sdk | null>({
    method: 'GET',
    path: `/integrations/stainless/sdk?endpoint=${encodeURIComponent(params.endpoint)}`,
    sessionId: null,
  });
};

export interface SnippetParameter {
  in: 'query' | 'header';
  name: string;
  value: string;
}

export const generateSdkSnippet = ({
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
  parameters?: SnippetParameter[];
  body?: Record<string, unknown>;
}) => {
  return fetch<SdkSnippet>({
    method: 'POST',
    path: `/integrations/stainless/sdk/${id}/snippet`,
    data: { language, method, path, parameters, body },
    sessionId: null,
  });
};
