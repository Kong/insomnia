import type {Component} from 'react-flow-types';

declare module 'react-tabs' {
  declare module.exports: {
    Tab: Component,
    TabList: Component,
    TabPanel: Component,
    Tabs: Component
  }
}
