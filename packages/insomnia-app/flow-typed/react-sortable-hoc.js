// @flow

import * as React from 'react';

declare module 'react-sortable-hoc' {
  declare module.exports: {
    SortableContainer: ((Object) => React.Node) => React.Component,
    SortableElement: ((Object) => React.Node) => React.Component,
    arrayMove: <T>(Array<T>, oldIndex: number, newIndex: number) => Array<T>
  };
}
