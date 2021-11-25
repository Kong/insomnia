import React, { FC } from 'react';

import { NunjucksEnabledProvider } from './nunjucks-enabled-context';
import { NunjucksRenderFunctionProvider } from './nunjucks-render-function-context';

export const NunjucksProvider: FC = ({ children }) => (
  <NunjucksEnabledProvider>
    <NunjucksRenderFunctionProvider>
      {children}
    </NunjucksRenderFunctionProvider>
  </NunjucksEnabledProvider>
);

export const DisableNunjucks = ({ children }) => <NunjucksEnabledProvider disable>{children}</NunjucksEnabledProvider>;
