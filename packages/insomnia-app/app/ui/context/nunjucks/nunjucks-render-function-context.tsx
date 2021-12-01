import React, { createContext, FC, useContext } from 'react';

import { useRenderFunctions } from './use-render-functions';

export type NunjucksRenderFunctions = ReturnType<typeof useRenderFunctions>;

const NunjucksRenderFunctionContext = createContext<NunjucksRenderFunctions | undefined>(undefined);

export const NunjucksRenderFunctionProvider: FC = ({ children }) => {
  // The following function is deprecated because the following function should only be used here.
  const value = useRenderFunctions();

  return <NunjucksRenderFunctionContext.Provider value={value}>
    {children}
  </NunjucksRenderFunctionContext.Provider>;
};

/**
 * Access functions useful for Nunjucks rendering
 *
 * For gated access use `useGatedNunjucksRenderFunctions` instead
 */
export const useNunjucksRenderFunctions = () => {
  const context = useContext(NunjucksRenderFunctionContext);

  if (context === undefined) {
    throw new Error('NunjucksRenderFunctionContext must be used within a NunjucksRenderFunctionProvider or NunjucksProvider');
  }

  return context;
};
