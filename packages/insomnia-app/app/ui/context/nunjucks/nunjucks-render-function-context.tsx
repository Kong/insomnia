import React, { createContext, FC, useContext } from 'react';

import { HandleGetRenderContext, HandleRender } from '../../../common/render';
import { useRenderTemplate } from '../../hooks/use-render-template';

interface NunjucksRenderFunctions {
  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
}

const NunjucksRenderFunctionContext = createContext<NunjucksRenderFunctions | undefined>(undefined);

export const NunjucksRenderFunctionProvider: FC = ({ children }) => {
  const value = useRenderTemplate();

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
