import React, { createContext, FC, useContext, useEffect, useState } from 'react';

interface Props {
    disableNunjucks?: boolean;
}

type NunjucksState = Props;

const NunjucksStateContext = createContext<NunjucksState>({});

export const NunjucksProvider: FC<Props> = ({ disableNunjucks: disableNunjucksProp, children }) => {
  const [disableNunjucksState, setDisableNunjucksState] = useState(disableNunjucksProp);

  useEffect(() => {
    setDisableNunjucksState(disableNunjucksProp);
  }, [disableNunjucksProp]);

  return (
    <NunjucksStateContext.Provider value={{ disableNunjucks: disableNunjucksState }}>
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
