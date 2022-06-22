import React, { FunctionComponent } from 'react';

import { Editable } from './base/editable';

interface Props {
  onSubmit: (value?: string) => void;
  value: string;
}

export const UnitTestEditable: FunctionComponent<Props> = ({ onSubmit, value }) => {
  return <Editable singleClick onSubmit={onSubmit} value={value} />;
};
