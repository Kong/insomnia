import React, { createContext, FC, useContext, useEffect, useState } from 'react';

interface Props {
  disable?: boolean;
}

interface NunjucksEnabledState {
  enabled: boolean;
}

const NunjucksEnabledContext = createContext<NunjucksEnabledState | undefined>(undefined);

export const NunjucksEnabledProvider: FC<Props> = ({ disable, children }) => {
  const [enabled, setEnabled] = useState(!Boolean(disable));

  useEffect(() => {
    setEnabled(!Boolean(disable));
  }, [disable]);

  return (
    <NunjucksEnabledContext.Provider value={{ enabled }}>
      {children}
    </NunjucksEnabledContext.Provider>
  );
};

export const useNunjucksEnabled = () => {
  const context = useContext(NunjucksEnabledContext);

  if (context === undefined) {
    throw new Error('useNunjucksState must be used within a NunjucksEnabledProvider or NunjucksProvider');
  }

  return context;
};
