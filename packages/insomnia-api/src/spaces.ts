import {
  Configuration,
  DefaultApi,
  type FetchAPI,
  type ListCurrentUserSpaces200Response,
  ResponseError,
  type Space,
} from '@getinsomnia/insomnia-v3-fetch';

import { ResponseFailError } from './fetch';

export type { Space } from '@getinsomnia/insomnia-v3-fetch';

interface V3ClientConfig {
  getBaseURL: () => string;
  getClientString: () => string;
  generateRequestId: () => string;
  // Proxy-aware `fetch` used for every SDK request. Without it the SDK falls back to the
  // global `fetch`, which in the Electron main/CLI processes is Node's fetch and ignores the
  // system proxy and OS certs.
  fetchApi: FetchAPI;
}

let v3Config: V3ClientConfig | null = null;

export function configureV3Client(config: V3ClientConfig) {
  if (v3Config) {
    throw new Error('V3 client has already been configured and cannot be re-configured.');
  }
  v3Config = config;
}

function buildClient(sessionId: string): DefaultApi {
  if (!v3Config) {
    throw new Error('V3 client has not been configured. Call configureV3Client() at application startup.');
  }
  const baseURL = v3Config.getBaseURL();
  const configuration = new Configuration({
    basePath: `${baseURL}/v3`,
    fetchApi: v3Config.fetchApi,
    apiKey: name => (name === 'X-Session-ID' ? sessionId : ''),
    headers: {
      'X-Insomnia-Client': v3Config.getClientString(),
      'X-Origin': baseURL,
      'insomnia-request-id': v3Config.generateRequestId(),
    },
  });
  return new DefaultApi(configuration);
}

function extractPageAfter(nextUri: string | null): string | undefined {
  if (!nextUri || !v3Config) {
    return undefined;
  }
  // `nextUri` is a path like `/v3/users/me/spaces?page[size]=20&page[after]=...`.
  // URL needs an absolute base to parse; resolve against the same backend the SDK is configured against.
  const url = new URL(nextUri, v3Config.getBaseURL());
  return url.searchParams.get('page[after]') ?? undefined;
}

async function readProblemJson(response: Response): Promise<{ title?: string; detail?: string }> {
  try {
    return await response.clone().json();
  } catch {
    return {};
  }
}

async function mapSdkError(error: unknown): Promise<never> {
  if (error instanceof ResponseError) {
    const { title, detail } = await readProblemJson(error.response);
    throw new ResponseFailError(title || `CODE-${error.response.status}`, detail || error.response.statusText, error.response);
  }
  throw error;
}

/**
 * Lists every space the current user is a member of, paginating through cursors.
 *
 * TODO: switch callers to true pagination — fetch the first page only and expose
 * the cursor so the UI can request more on demand instead of fetching everything
 * up front. Requires UI changes to handle progressive loading.
 */
export const getSpaces = async ({ sessionId }: { sessionId: string }): Promise<Space[]> => {
  const client = buildClient(sessionId);
  const all: Space[] = [];
  let pageAfter: string | undefined;
  try {
    do {
      const response: ListCurrentUserSpaces200Response = await client.listCurrentUserSpaces({
        pageSize: 200,
        pageAfter,
      });
      all.push(...response.data);
      pageAfter = extractPageAfter(response.meta.page.next);
    } while (pageAfter);
  } catch (error) {
    await mapSdkError(error);
  }
  return all;
};
