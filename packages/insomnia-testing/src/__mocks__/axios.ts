import type { AxiosStatic, Method, AxiosResponse, AxiosRequestConfig } from 'axios';

const mockResponses: { [key: string]: AxiosResponse } = {};

const key = (method?: Method, url?: string) => (
  `${method?.toLowerCase()}:${url?.toLowerCase()}`
);

type SetResponse = <T>(method?: Method, url?: string, response?: AxiosResponse<T>) => void;

const axios = jest.genMockFromModule<AxiosStatic & { __setResponse: SetResponse }>('axios');

const __setResponse: SetResponse = (method, url, response) => {
  if (!method) {
    return;
  }
  if (!url) {
    return;
  }
  if (!response) {
    return;
  }

  mockResponses[key(method, url)] = response;
};

axios.__setResponse = __setResponse;

const request = async <T, U = AxiosResponse<T>>({ method, url }: AxiosRequestConfig) => {
  const k = key(method, url);
  const resp = mockResponses[k] as unknown as U;
  if (!resp) {
    throw new Error(
      `Could not find mock axios response for ${k}. Options are [${Object.keys(mockResponses).join(
        ', ',
      )}]`,
    );
  }

  return Promise.resolve<U>(resp);
};

axios.request = request;

export type AxiosMock = typeof axios;

export default axios;
