import React, { FC } from 'react';

import { KeyValueEditor } from '../../key-value-editor/key-value-editor';

interface Props {
  onChange: Function;
  parameters: any[];
}

export const UrlEncodedEditor: FC<Props> = props => {
  const {
    parameters,
    onChange,
  } = props;
  return <div className="scrollable-container tall wide">
    <div className="scrollable">
      <KeyValueEditor sortable allowMultiline namePlaceholder="name" valuePlaceholder="value" descriptionPlaceholder="description" onChange={onChange} pairs={parameters} />
    </div>
  </div>;
};
