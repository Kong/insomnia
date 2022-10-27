import React, { FC } from 'react';

import { KeyValueEditor } from '../../key-value-editor/key-value-editor';

interface Props {
  onChange: Function;
  parameters: any[];
}

export const UrlEncodedEditor: FC<Props> = ({ parameters, onChange }) => (
  <div className="scrollable-container tall wide">
    <div className="scrollable">
      <KeyValueEditor
        allowMultiline
        namePlaceholder="name"
        valuePlaceholder="value"
        descriptionPlaceholder="description"
        onChange={onChange}
        pairs={parameters}
      />
    </div>
  </div>
);
