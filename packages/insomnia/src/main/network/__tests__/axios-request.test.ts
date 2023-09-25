import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import axios from 'axios';

import { globalBeforeEach } from '../../../__jest__/before-each';
import * as models from '../../../models';
import { axiosRequest } from '../axios-request';

interface AxiosRequestMockUserSettings {
  // mocking only what we need to run axiosRequest
  proxyEnabled: boolean;
  httpProxy: string;
  httpsProxy: string;
  noProxy: string;
  validateSSL: boolean;
}

jest.mock('axios');
jest.spyOn(models.settings, 'get');

describe('axiosRequest used for git-sync', () => {
  beforeEach(globalBeforeEach);

  describe('proxy behavior should match the same UX from rest client behavior', () => {
    beforeEach(() => {
      globalBeforeEach();
      // we want to test that the values that are passed to axios are returned in the config key
      (axios as unknown as jest.Mock).mockImplementation(ajaxConfig => Promise.resolve({
        config: ajaxConfig,
        data: {},
        headers: {},
        request: {},
        status: 200,
        statusText: 'OK',
      }));
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should set axios proxy key to false.', async () => {
      const mockInsomniaConfigPanelUserSettings: AxiosRequestMockUserSettings = {
        proxyEnabled: false,
        httpsProxy: 'https://some.proxy.com:8080',
        httpProxy: 'https://some.proxy.com:8080',
        noProxy: '',
        validateSSL: false,
      };
      (models.settings.get as unknown as jest.Mock).mockImplementation(() => mockInsomniaConfigPanelUserSettings);
      const response = await axiosRequest({ url: 'https://git.acme.com/username/repo-name.git/git-upload-pack' });
      expect(response.config.proxy).toBe(false);
    });

    it('should set axios proxy key if the user has the insomnia proxy enabled, proxy http url filled in, and there is not a match in the no proxy settings', async () => {
      const mockInsomniaConfigPanelUserSettings: AxiosRequestMockUserSettings = {
        proxyEnabled: true,
        httpsProxy: '',
        httpProxy: 'https://some.proxy.com:8080',
        noProxy: 'localhost,127.0.0.1',
        validateSSL: false,
      };
      (models.settings.get as unknown as jest.Mock).mockImplementation(() => mockInsomniaConfigPanelUserSettings);
      const response = await axiosRequest({ url: 'http://git.acme.com/username/repo-name.git/git-upload-pack' });
      expect(response.config.proxy).toEqual({ host: 'some.proxy.com', port: 8080 });
    });

    it('should set axios proxy key to false if the user has the insomnia proxy enabled, and the proxy http url empty, and there is not a match in the no proxy settings', async () => {
      const mockInsomniaConfigPanelUserSettings: AxiosRequestMockUserSettings = {
        proxyEnabled: true,
        httpsProxy: 'https://some.proxy.com:8080',
        httpProxy: '',
        noProxy: 'localhost,127.0.0.1',
        validateSSL: false,
      };
      (models.settings.get as unknown as jest.Mock).mockImplementation(() => mockInsomniaConfigPanelUserSettings);
      const response = await axiosRequest({ url: 'http://git.acme.com/username/repo-name.git/git-upload-pack' });
      expect(response.config.proxy).toBe(false);
    });

    it('should set axios proxy key if the user has the insomnia proxy enabled, only proxy http url filled in, and there is not a match in the no proxy settings', async () => {
      const mockInsomniaConfigPanelUserSettings: AxiosRequestMockUserSettings = {
        proxyEnabled: true,
        httpsProxy: '',
        httpProxy: 'https://some.proxy.com:8080',
        noProxy: 'localhost,127.0.0.1',
        validateSSL: false,
      };
      (models.settings.get as unknown as jest.Mock).mockImplementation(() => mockInsomniaConfigPanelUserSettings);
      const response = await axiosRequest({ url: 'https://git.acme.com/username/repo-name.git/git-upload-pack' });
      expect(response.config.proxy).toEqual({ host: 'some.proxy.com', port: 8080 });
    });

    it('should set axios proxy key to prefer https if the user has the insomnia proxy enabled, both proxy urls populated, and there is not a match in the no proxy settings', async () => {
      const mockInsomniaConfigPanelUserSettings: AxiosRequestMockUserSettings = {
        proxyEnabled: true,
        httpsProxy: 'https://some.proxy.com:8080',
        httpProxy: 'https://some.proxy.com:8081',
        noProxy: 'localhost,127.0.0.1',
        validateSSL: false,
      };
      (models.settings.get as unknown as jest.Mock).mockImplementation(() => mockInsomniaConfigPanelUserSettings);
      const response = await axiosRequest({ url: 'http://git.acme.com/username/repo-name.git/git-upload-pack' });
      expect(response.config.proxy).toEqual({ host: 'some.proxy.com', port: 8081 });
    });

    it('should set axios proxy key if the user has the insomnia proxy enabled, only proxy https url filled in, and there is not a match in the no proxy settings', async () => {
      const mockInsomniaConfigPanelUserSettings: AxiosRequestMockUserSettings = {
        proxyEnabled: true,
        httpsProxy: 'https://some.proxy.com:8080',
        httpProxy: '',
        noProxy: 'localhost,127.0.0.1',
        validateSSL: false,
      };
      (models.settings.get as unknown as jest.Mock).mockImplementation(() => mockInsomniaConfigPanelUserSettings);
      const response = await axiosRequest({ url: 'https://git.acme.com/username/repo-name.git/git-upload-pack' });
      expect(response.config.proxy).toEqual({ host: 'some.proxy.com', port: 8080 });
    });

  });
});
