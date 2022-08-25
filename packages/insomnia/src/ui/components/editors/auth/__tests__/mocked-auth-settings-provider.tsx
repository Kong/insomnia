import React, { FC, ReactNode } from 'react';
import { useSelector } from 'react-redux';

import * as models from '../../../../../models';
import { Request, RequestAuthentication } from '../../../../../models/request';
import { selectActiveRequest } from '../../../../redux/selectors';
import { AuthSettingsProvider } from '../components/auth-context';

export const MockedAuthSettingsProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // Unfortunately we need to cast here due to union type as an object. The RequestPane component takes a prop as request and somewhere it gets casted.
  const activeRequest = useSelector(selectActiveRequest) as Request;

  // This is inevitable as we are testing this in the unit test. Ideally we should mock it and just confirm if it was called. This is becoming an integration test, and it shouldn't be.
  const handleAuthUpdate = (authentication: RequestAuthentication) => {
    models.request.update(activeRequest, { authentication });
  };

  return (
    <AuthSettingsProvider
      authentication={activeRequest.authentication}
      onAuthUpdate={handleAuthUpdate}
    >
      {children}
    </AuthSettingsProvider>
  );
};
