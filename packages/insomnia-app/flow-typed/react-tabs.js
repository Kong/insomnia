// @flow

import * as React from 'react';

declare module 'react-tabs' {
  declare module.exports: {
    Tab: React.Element<*>,
    TabList: React.Element<*>,
    TabPanel: React.Element<*>,
    Tabs: React.Element<*>
  };
}
