import React, { createContext, FC, ReactNode, useCallback, useContext } from 'react';

import { RequestAuthentication } from '../../../../../models/request';

interface UseAuthSettings {
  authentication: RequestAuthentication;
  patchAuth: (newAuth: RequestAuthentication) => void;
}

const AuthSettingsContext = createContext<UseAuthSettings | undefined>(undefined);
interface Props {
  children: ReactNode;
  authentication: RequestAuthentication;
  onAuthUpdate: (auth: RequestAuthentication) => void;
}

export const AuthSettingsProvider: FC<Props> = ({
  authentication,
  onAuthUpdate,
  children,
}) => {
  const patchAuth = useCallback((newAuth: RequestAuthentication) => {
    const patch = { ...authentication, ...newAuth };
    onAuthUpdate(patch);
  }, [authentication, onAuthUpdate]);

  return (
    <AuthSettingsContext.Provider value={{ authentication, patchAuth }}>
      {children}
    </AuthSettingsContext.Provider>
  );
};
export function useAuthSettings(): UseAuthSettings {
  const context = useContext(AuthSettingsContext);
  if (!context) {
    throw new Error('Use useAuthSettings hook with <AuthSettingsProvider /> ');
  }

  return context;
}
