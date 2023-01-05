import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mocked } from 'jest-mock';

import { globalBeforeEach } from '../../../__jest__/before-each';
import * as models from '../../../models';
import { authorizeUserInWindow, ChromiumVerificationResult } from '../misc';
import { createBWRedirectMock } from './helpers';

const MOCK_AUTHORIZATION_URL = 'https://foo.com';

describe('authorizeUserInWindow()', () => {
  beforeEach(globalBeforeEach);

  const getCertificateVerifyCallbackMock = () => {
    const mockCallback = mocked<(verificationResult: number) => void>(jest.fn());
    window.main = { authorizeUserInWindow: () => Promise.resolve(MOCK_AUTHORIZATION_URL) };

    createBWRedirectMock({
      redirectTo: MOCK_AUTHORIZATION_URL,
      setCertificateVerifyProc: proc => {
        // Invoke the proc and send the mocked callback for us to validate the result
        // @ts-expect-error send a blank request as the first parameter because we don't use it
        proc?.({}, mockCallback);
      },
    });
    return mockCallback;
  };

  it('uses chromium result in setCertificateVerifyProc callback when validateAuthSSL is true', async () => {
    // Arrange
    const mockCallback = getCertificateVerifyCallbackMock();

    const settings = await models.settings.getOrCreate();
    await models.settings.update(settings, {
      validateAuthSSL: true,
    });

    // Act
    // We don't really care about the result here, since we're only testing an event handler.
    await authorizeUserInWindow({ url: MOCK_AUTHORIZATION_URL, urlSuccessRegex: /.*/ });

    // Assert
    expect(mockCallback).toHaveBeenCalledWith(ChromiumVerificationResult.USE_CHROMIUM_RESULT);
  });

  it('blindly trusts cert in setCertificateVerifyProc callback when validateSSL is false', async () => {
    // Arrange
    const mockCallback = getCertificateVerifyCallbackMock();

    const settings = await models.settings.getOrCreate();
    await models.settings.update(settings, {
      validateAuthSSL: false,
    });

    // Act
    // We don't really care about the result here, since we're only testing an event handler.
    await authorizeUserInWindow({ url: MOCK_AUTHORIZATION_URL, urlSuccessRegex: /.*/ });

    // Assert
    expect(mockCallback).toHaveBeenCalledWith(ChromiumVerificationResult.BLIND_TRUST);
  });
});
