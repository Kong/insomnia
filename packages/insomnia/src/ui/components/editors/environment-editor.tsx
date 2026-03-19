import orderedJSON from 'json-order';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';

import { CodeEditor, type CodeEditorHandle } from '~/ui/components/.client/codemirror/code-editor';
import { checkNestedKeys } from '~/utils/environment-utils';

import { isWindows, JSON_ORDER_PREFIX, JSON_ORDER_SEPARATOR } from '../../../common/constants';

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

export const EnvironmentEditor = forwardRef<EnvironmentEditorHandle, Props>(
  ({ environmentInfo, onBlur, onChange }, ref) => {
    const editorRef = useRef<CodeEditorHandle>(null);
    const editorErrorRef = useRef('');
    const [error, setError] = useState('');
    const getValue = useCallback(() => {
      // @ts-expect-error -- current can be null
      let value = editorRef.current.getValue();
      if (!editorRef.current || !value) {
        return null;
      }

      // On Windows, backslashes are used as directory separators.
      // The file tag inserted by Nunjucks in JSON uses double backslashes in its path parameter, but in the logic below, orderedJSON.parse unescapes those double backslashes into a single backslash. This causes the file tag to fail when the corresponding environment variable is referenced in a request.
      // Therefore, we replace the double backslashes in the file tag’s path parameter with four backslashes, ensuring that after orderedJSON.parse runs, the path parameter in the file tag still contains two backslashes.
      // See https://github.com/Kong/insomnia/issues/5754
      if (isWindows()) {
        value = escapeFileTag(value);
      }

      const json = orderedJSON.parse(value, JSON_ORDER_PREFIX, JSON_ORDER_SEPARATOR);
      const environmentInfo = {
        object: json.object,
        propertyOrder: json.map || null,
      };
      return environmentInfo;
    }, []);
    useImperativeHandle(
      ref,
      () => ({
        isValid: () => !editorErrorRef.current,
        getValue,
      }),
      [getValue],
    );

    const updateEditorError = (message: string) => {
      editorErrorRef.current = message;
      setError(message);
    };

    let defaultValue = orderedJSON.stringify(
      environmentInfo.object,
      environmentInfo.propertyOrder || null,
      JSON_ORDER_SEPARATOR,
    );

    // The reverse operation of the logic in getValue.
    if (isWindows()) {
      defaultValue = unescapeFileTag(defaultValue);
    }

    return (
      <div className="environment-editor">
        <CodeEditor
          id="environment-editor"
          ref={editorRef}
          autoPrettify
          enableNunjucks
          onChange={() => {
            updateEditorError('');
            try {
              const value = getValue();
              // Check for invalid key names
              if (value?.object) {
                // Check root and nested properties
                const err = checkNestedKeys(value.object);
                if (err) {
                  updateEditorError(err);
                } else {
                  onChange?.(value);
                }
              }
            } catch (err) {
              updateEditorError(err.message);
            }
          }}
          defaultValue={defaultValue}
          mode="application/json"
          onBlur={onBlur}
        />
        {error && <p className="notice error margin">{error}</p>}
      </div>
    );
  },
);
EnvironmentEditor.displayName = 'EnvironmentEditor';

function escapeFileTag(str: string) {
  const regex = /\{\% *file +'(.+?)' *\%\}/g;

  return str.replace(regex, (_match: any, oriFilePath: string) => {
    return `{% file '${oriFilePath.replace(/(?<!\\)\\\\(?!\\)/g, '\\\\\\\\')}' %}`;
  });
}

function unescapeFileTag(str: string) {
  const regex = /\{\% *file +'(.+?)' *\%\}/g;

  return str.replace(regex, (_match: any, oriFilePath: string) => {
    return `{% file '${oriFilePath.replace(/(?<!\\)\\\\\\\\(?!\\)/g, '\\\\')}' %}`;
  });
}
