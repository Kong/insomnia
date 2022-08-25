import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react';
import React, { FC } from 'react';

import { globalBeforeEach } from '../../../../../__jest__/before-each';
import { createMockStoreWithRequest } from '../../../../../__jest__/create-mock-store-with-active-request';
import { withReduxStore } from '../../../../../__jest__/with-redux-store';
import { GRANT_TYPE_AUTHORIZATION_CODE, GRANT_TYPE_CLIENT_CREDENTIALS, GRANT_TYPE_IMPLICIT, GRANT_TYPE_PASSWORD } from '../../../../../network/o-auth-2/constants';
import { OAuth2Auth } from '../o-auth-2-auth';
import { MockedAuthSettingsProvider } from './mocked-auth-settings-provider';

const Wrapper: FC = ({ children }) => (<MockedAuthSettingsProvider>{children}</MockedAuthSettingsProvider>);

describe('<OAuth2Auth />', () => {
  beforeEach(globalBeforeEach);

  it.each([
    GRANT_TYPE_AUTHORIZATION_CODE,
    GRANT_TYPE_CLIENT_CREDENTIALS,
    GRANT_TYPE_PASSWORD,
    GRANT_TYPE_IMPLICIT,
  ])('should render with grant type %s without console errors', async grantType => {
    // Arrange
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { store, requestId } = await createMockStoreWithRequest({
      requestPatch: { authentication: { grantType } },
      requestMetaPatch: { expandedAccordionKeys: { 'OAuth2AdvancedOptions': true } },
    });

    // Act
    render(<OAuth2Auth requestId={requestId} />, { wrapper: withReduxStore(store, Wrapper) });

    // Assert
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
