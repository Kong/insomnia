import React, { FC } from 'react';

import { KeyValueEditor } from '../../key-value-editor/key-value-editor';

interface Props {
  onChange: (c: {
    name: string;
    value: string;
    description?: string;
    disabled?: boolean;
  }[]) => void;
  parameters: any[];
}

export const FormEditor: FC<Props> = ({ parameters, onChange }) => (
  <div className="scrollable-container tall wide">
    <div className="scrollable">
      <KeyValueEditor
        allowFile
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
