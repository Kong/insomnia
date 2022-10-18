import React, { createContext, FC, PropsWithChildren, useContext } from 'react';

interface Props {
  disable?: boolean;
}

interface NunjucksEnabledState {
  enabled: boolean;
}

const NunjucksEnabledContext = createContext<NunjucksEnabledState | undefined>(undefined);

export const NunjucksEnabledProvider: FC<PropsWithChildren<Props>> = ({ disable, children }) => {
  return (
    <NunjucksEnabledContext.Provider value={{ enabled: !disable }}>
      {children}
    </NunjucksEnabledContext.Provider>
  );
};

export const useNunjucksEnabled = () => {
  const context = useContext(NunjucksEnabledContext);

  if (context === undefined) {
    throw new Error('useNunjucksEnabled must be used within a NunjucksEnabledProvider or NunjucksProvider');
  }

  return context;
};
