import { mocked } from 'ts-jest/utils';

import { globalBeforeEach } from '../../../__jest__/before-each';
import * as models from '../../../models';
import { authorizeUserInWindow, ChromiumVerificationResult, responseToObject } from '../misc';
import { createBWRedirectMock } from './helpers';

const MOCK_AUTHORIZATION_URL = 'https://foo.com';

describe('responseToObject()', () => {
  beforeEach(globalBeforeEach);

  it('works in the general case', () => {
    const body = JSON.stringify({
      str: 'hi',
      num: 10,
    });
    const keys = ['str', 'num'];
    expect(responseToObject(body, keys)).toEqual({
      str: 'hi',
      num: 10,
    });
  });

  it('skips things not in keys', () => {
    const body = JSON.stringify({
      str: 'hi',
      num: 10,
      other: 'thing',
    });
    const keys = ['str'];
    expect(responseToObject(body, keys)).toEqual({
      str: 'hi',
    });
  });

  it('works with things not found', () => {
    const body = JSON.stringify({});
    const keys = ['str'];
    expect(responseToObject(body, keys)).toEqual({
      str: null,
    });
  });

  it('works with default values', () => {
    const body = JSON.stringify({
      str: 'hi',
      num: 10,
    });
    const keys = ['str', 'missing'];
    const defaults = {
      missing: 'found it!',
      str: 'should not see this',
    };
    expect(responseToObject(body, keys, defaults)).toEqual({
      str: 'hi',
      missing: 'found it!',
    });
  });
});

describe('authorizeUserInWindow()', () => {
  beforeEach(globalBeforeEach);

  const getCertificateVerifyCallbackMock = () => {
    const mockCallback = mocked<(verificationResult: number) => void>(jest.fn());
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
    await authorizeUserInWindow(MOCK_AUTHORIZATION_URL, /.*/);

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
    await authorizeUserInWindow(MOCK_AUTHORIZATION_URL, /.*/);

    // Assert
    expect(mockCallback).toHaveBeenCalledWith(ChromiumVerificationResult.BLIND_TRUST);
  });
});
