import React, { createContext, FC, useContext, useEffect, useState } from 'react';

import { HandleGetRenderContext, HandleRender } from '../../common/render';
import { useRenderTemplate } from '../hooks/use-render-template';

interface Props {
  disableNunjucks?: boolean;
}

interface NunjucksState extends Props {
  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
}

const NunjucksStateContext = createContext<NunjucksState | undefined>(undefined);

export const NunjucksProvider: FC<Props> = ({ disableNunjucks: disableNunjucksProp, children }) => {
  const [disableNunjucksState, setDisableNunjucksState] = useState(disableNunjucksProp);
  const { handleRender, handleGetRenderContext } = useRenderTemplate();

  useEffect(() => {
    setDisableNunjucksState(disableNunjucksProp);
  }, [disableNunjucksProp]);

  return (
    <NunjucksStateContext.Provider
      value={{
        disableNunjucks: disableNunjucksState,
        handleRender,
        handleGetRenderContext,
      }}
    >
      {children}
    </NunjucksStateContext.Provider>
  );
};

export const useNunjucksState = () => {
  const context = useContext(NunjucksStateContext);

  if (context === undefined) {
    throw new Error('useNunjucksState must be used within a NunjucksProvider');
  }

  return context;
};
