import orderedJSON from 'json-order';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';

import { JSON_ORDER_PREFIX, JSON_ORDER_SEPARATOR } from '../../../common/constants';
import { CodeEditor, type CodeEditorHandle } from '../codemirror/code-editor';
import { checkNestedKeys } from './environment-utils';

export interface EnvironmentInfo {
  object: Record<string, any>;
  propertyOrder: Record<string, any> | null;
}

interface Props {
  environmentInfo: EnvironmentInfo;
  onBlur?: () => void;
  onChange?: (value: EnvironmentInfo) => void;
}

export interface EnvironmentEditorHandle {
  isValid: () => boolean;
  getValue: () => EnvironmentInfo | null;
}

export const EnvironmentEditor = forwardRef<EnvironmentEditorHandle, Props>(({
  environmentInfo,
  onBlur,
  onChange,
}, ref) => {
  const editorRef = useRef<CodeEditorHandle>(null);
  const [error, setError] = useState('');
  const getValue = useCallback(() => {
    // @ts-expect-error -- current can be null
    const value = editorRef.current.getValue();
    if (!editorRef.current || !value) {
      return null;
    }
    const json = orderedJSON.parse(
      editorRef.current.getValue(),
      JSON_ORDER_PREFIX,
      JSON_ORDER_SEPARATOR,
    );
    const environmentInfo = {
      object: json.object,
      propertyOrder: json.map || null,
    };
    return environmentInfo;
  }, []);
  useImperativeHandle(ref, () => ({
    isValid: () => !error,
    getValue,
  }), [error, getValue]);

  const defaultValue = orderedJSON.stringify(
    environmentInfo.object,
    environmentInfo.propertyOrder || null,
    JSON_ORDER_SEPARATOR,
  );
  return (
    <div className="environment-editor">
      <CodeEditor
        id="environment-editor"
        ref={editorRef}
        autoPrettify
        enableNunjucks
        onChange={() => {
          setError('');
          try {
            const value = getValue();
            // Check for invalid key names
            if (value?.object) {
            // Check root and nested properties
              const err = checkNestedKeys(value.object);
              if (err) {
                setError(err);
              } else {
                onChange?.(value);
              }
            }
          } catch (err) {
            setError(err.message);
          }
        }}
        defaultValue={defaultValue}
        mode="application/json"
        onBlur={onBlur}
      />
      {error && <p className="notice error margin">{error}</p>}
    </div>
  );
});
EnvironmentEditor.displayName = 'EnvironmentEditor';
