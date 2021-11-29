import React, { createContext, FC, useContext } from 'react';

import { HandleGetRenderContext, HandleRender } from '../../../common/render';
import { useRenderFunctions } from './use-render-functions';

export interface NunjucksRenderFunctions {
  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
}

const NunjucksRenderFunctionContext = createContext<NunjucksRenderFunctions | undefined>(undefined);

export const NunjucksRenderFunctionProvider: FC = ({ children }) => {
  const value = useRenderFunctions();

  return <NunjucksRenderFunctionContext.Provider value={value}>
    {children}
  </NunjucksRenderFunctionContext.Provider>;
};

export const useNunjucksRenderFuncs = () => {
  const context = useContext(NunjucksRenderFunctionContext);

  if (context === undefined) {
    throw new Error('NunjucksRenderFunctionContext must be used within a NunjucksRenderFunctionProvider');
  }

  return context;
};
