// @flow
import React from 'react';
import Editable from './base/editable';

type Props = {
  onSubmit: () => void,
  value: string,
};

export default function UnitTestEditable({ onSubmit, value }: Props) {
  return <Editable singleClick onSubmit={onSubmit} value={value} />;
}
