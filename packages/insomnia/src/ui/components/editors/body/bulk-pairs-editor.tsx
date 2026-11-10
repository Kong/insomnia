import type { RequestBodyParameter } from 'insomnia-data';
import React, { type FC, useCallback } from 'react';

import { CodeEditor } from '~/ui/components/.client/codemirror/code-editor';

import { BULK_EDIT_PLACEHOLDER, parsePairs, serializePairs } from './bulk-pairs';

interface Props {
  editorId: string;
  requestId: string;
  parameters: RequestBodyParameter[];
  onChange: (parameters: RequestBodyParameter[]) => void;
}

export const BulkPairsEditor: FC<Props> = ({ editorId, requestId, parameters, onChange }) => {
  const handleChange = useCallback(
    (text: string) => onChange(parsePairs(text, parameters)),
    [onChange, parameters],
  );

  return (
    <CodeEditor
      id={editorId}
      historyKey={`${editorId}::${requestId}`}
      className="flex-1"
      onChange={handleChange}
      defaultValue={serializePairs(parameters)}
      placeholder={BULK_EDIT_PLACEHOLDER}
      enableNunjucks
    />
  );
};
