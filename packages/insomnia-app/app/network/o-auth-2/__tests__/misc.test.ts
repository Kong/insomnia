import { globalBeforeEach } from '../../../__jest__/before-each';
import * as models from '../../../models';
import { authorizeUserInWindow, responseToObject } from '../misc';
import { certVerifyProcFn, createBWRedirectMock } from './helpers';

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
  beforeEach(async () => {
    await globalBeforeEach();
    await models.settings.all();
  });

  it('uses chromium result in setCertificateVerifyProc callback when validateAuthSSL is true', async () => {
    // Arrange
    let verificationFunction: certVerifyProcFn = jest.fn();
    const mockCallback = jest.fn();
    createBWRedirectMock({ certificateVerifyMock: fn => {
      verificationFunction = fn;
    } });

    await models.settings.patch({
      validateAuthSSL: true,
    });

    try {
      // We don't really care about the result here, since we're only testing an event handler.
      await authorizeUserInWindow(MOCK_AUTHORIZATION_URL, /.*/);
    } catch (e) {
      // no-op
    } finally {
      // Act
      if (verificationFunction) {
        verificationFunction(null, mockCallback);
      } else {
        throw new Error('setCertificateVerifyProc was never called, so cb is null');
      }

      // Assert
      expect(mockCallback).toHaveBeenCalledWith(-3);
    }
  });

  it('blindly trusts cert in setCertificateVerifyProc callback when validateSSL is false', async () => {
    // Arrange
    let verificationFunction: certVerifyProcFn = jest.fn();
    const mockCallback = jest.fn();
    createBWRedirectMock({ certificateVerifyMock: (fn: certVerifyProcFn) => {
      verificationFunction = fn;
    } });

    await models.settings.patch({
      validateAuthSSL: false,
    });

    try {
      // We don't really care about the result here, since we're only testing an event handler.
      await authorizeUserInWindow(MOCK_AUTHORIZATION_URL, /.*/);
    } catch (e) {
      // no-op
    } finally {
      // Act
      if (verificationFunction) {
        verificationFunction(null, mockCallback);
      } else {
        throw new Error('setCertificateVerifyProc was never called, so cb is null');
      }

      // Assert
      expect(mockCallback).toHaveBeenCalledWith(0);
    }
  });
});
