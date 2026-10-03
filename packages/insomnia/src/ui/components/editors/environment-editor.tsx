import { isWindows } from 'insomnia-data/common';
import orderedJSON from 'json-order';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { checkNestedKeys } from '~/common/utils/environment-utils';
import { CodeEditor, type CodeEditorHandle } from '~/ui/components/.client/codemirror/code-editor';

import { JSON_ORDER_PREFIX, JSON_ORDER_SEPARATOR } from '../../../common/constants';

export interface EnvironmentInfo {
  object: Record<string, any>;
  propertyOrder: Record<string, any> | null;
}

interface Props {
  environmentInfo: EnvironmentInfo;
  onBlur?: () => void;
  onChange?: (value: EnvironmentInfo) => void;
  // Stable per-environment key so undo/redo history survives editor remounts.
  historyKey?: string;
}

export interface EnvironmentEditorHandle {
  isValid: () => boolean;
  /** Throws on invalid content (empty included) - guard with isValid(). */
  getValue: () => EnvironmentInfo | null;
}

export const EnvironmentEditor = forwardRef<EnvironmentEditorHandle, Props>(
  ({ environmentInfo, onBlur, onChange, historyKey }, ref) => {
    const editorRef = useRef<CodeEditorHandle>(null);
    const [error, setError] = useState('');
    const getValue = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) {
        return null;
      }
      /* Empty content is invalid JSON, not "no value": let orderedJSON.parse throw so it follows
      the same error path as any other malformed input. */
      let value = editor.getValue();

      // On Windows, backslashes are used as directory separators.
      // The file tag inserted by Nunjucks in JSON uses double backslashes in its path parameter, but in the logic below, orderedJSON.parse unescapes those double backslashes into a single backslash. This causes the file tag to fail when the corresponding environment variable is referenced in a request.
      // Therefore, we replace the double backslashes in the file tag’s path parameter with four backslashes, ensuring that after orderedJSON.parse runs, the path parameter in the file tag still contains two backslashes.
      // See https://github.com/Kong/insomnia/issues/5754
      if (isWindows) {
        value = escapeFileTag(value);
      }

      const json = orderedJSON.parse(value, JSON_ORDER_PREFIX, JSON_ORDER_SEPARATOR);
      const environmentInfo = {
        object: json.object,
        propertyOrder: json.map || null,
      };
      return environmentInfo;
    }, []);

    /** Parses the current document: the value to commit, or the error to show. */
    const validate = useCallback(() => {
      try {
        const value = getValue();
        if (!value?.object) {
          return { value: null, error: '' };
        }
        // Check root and nested properties
        const err = checkNestedKeys(value.object);
        return err ? { value: null, error: err } : { value, error: '' };
      } catch (err) {
        return { value: null, error: err.message };
      }
    }, [getValue]);

    useImperativeHandle(
      ref,
      () => ({
        /* Derived from the document, not from the last edit event: onChange is debounced and the
        cached content is restored on mount without firing it. */
        isValid: () => !validate().error,
        getValue,
      }),
      [getValue, validate],
    );

    let defaultValue = orderedJSON.stringify(
      environmentInfo.object,
      environmentInfo.propertyOrder || null,
      JSON_ORDER_SEPARATOR,
    );

    // The reverse operation of the logic in getValue.
    if (isWindows) {
      defaultValue = unescapeFileTag(defaultValue);
    }

    /* The editor can hold content that never passed through onChange (the cached document is
    restored on mount), so re-validate to keep the notice and isValid() in sync with it. */
    useEffect(() => {
      setError(validate().error);
    }, [validate, defaultValue, historyKey]);

    return (
      <div className="environment-editor">
        <CodeEditor
          id="environment-editor"
          historyKey={historyKey}
          ref={editorRef}
          autoPrettify
          enableNunjucks
          onChange={() => {
            const { value, error: validationError } = validate();
            setError(validationError);
            if (value) {
              onChange?.(value);
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
