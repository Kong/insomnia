import type { RequestBodyParameter } from 'insomnia-data';
import React, { type FC, useMemo } from 'react';

import { KeyValueEditor } from '../../key-value-editor/key-value-editor';
import { BulkPairsEditor } from './bulk-pairs-editor';

interface Props {
  bulk: boolean;
  requestId: string;
  onChange: (parameters: RequestBodyParameter[]) => void;
  parameters: RequestBodyParameter[];
}

export const UrlEncodedEditor: FC<Props> = ({ bulk, requestId, parameters, onChange }) => {
  // KeyValueEditor requires `value`, which is optional on a stored parameter.
  const pairs = useMemo(() => parameters.map(pair => ({ ...pair, value: pair.value || '' })), [parameters]);

  if (bulk) {
    return (
      <BulkPairsEditor
        editorId="request-url-encoded-editor"
        requestId={requestId}
        parameters={parameters}
        onChange={onChange}
      />
    );
  }

  return (
    <div className="scrollable-container tall wide">
      <div className="scrollable">
        <KeyValueEditor
          allowMultiline
          namePlaceholder="name"
          valuePlaceholder="value"
          descriptionPlaceholder="description"
          onChange={onChange}
          pairs={pairs}
        />
      </div>
    </div>
  );
};
