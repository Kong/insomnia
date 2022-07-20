import React, { FC, useCallback, useEffect, useRef, useState } from 'react';

import { useNunjucks } from '../../context/nunjucks/use-nunjucks';

interface Props {
  defaultValue: string;
  onChange: Function;
}

interface State {
  variables: any[];
  value: string;
  preview: string;
  error: string;
  variableSource: string;
}

export const VariableEditor: FC<Props> = ({ onChange, defaultValue }) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const { handleRender, handleGetRenderContext } = useNunjucks();
  const [state, setState] = useState<State>({
    variables: [],
    value: `{{ ${defaultValue.replace(/\s*}}$/, '').replace(/^{{\s*/, '')} }}`,
    preview: '',
    error: '',
    variableSource: '',
  });

  const _update = useCallback(async (value: string, noCallback = false) => {
    const cleanedValue = value
      .replace(/^{%/, '')
      .replace(/%}$/, '')
      .replace(/^{{/, '')
      .replace(/}}$/, '')
      .trim();
    let preview = '';
    let error = '';

    try {
      preview = await handleRender(value);
    } catch (err) {
      error = err.message;
    }

    const context = await handleGetRenderContext();
    const variables = context.keys.sort((a, b) => (a.name < b.name ? -1 : 1));
    const variableSource = context.context.getKeysContext().keyContext[cleanedValue] || '';

    // Hack to skip updating if we unmounted for some reason
    if (selectRef.current) {
      setState({
        preview,
        error,
        variables,
        value,
        variableSource,
      });
    }

    // Call the callback except in the useEffect
    if (!noCallback) {
      onChange(value);
    }
  }, [handleGetRenderContext, handleRender, onChange]);

  useEffect(() => {
    _update(state.value, true);
    const _resize = () => {
      setTimeout(() => {
        if (textAreaRef.current) {
          textAreaRef.current.style.cssText = 'height:auto';
          textAreaRef.current.style.cssText = `height:${textAreaRef.current.scrollHeight}px;overflow:hidden`;
        }
      }, 200);
    };
    _resize();
  }, [_update, state.value]);

  const { error, value, preview, variables, variableSource } = state;
  const isOther = !variables.find(v => value === `{{ ${v.name} }}`);
  return (
    <div>
      <div className="form-control form-control--outlined">
        <label>
          Environment Variable
          <select ref={selectRef} value={value} onChange={event => _update(event.target.value)}>
            <option value={"{{ 'my custom template logic' | urlencode }}"}>-- Custom --</option>
            {variables.map((v, i) => (
              <option key={`${i}::${v.name}`} value={`{{ ${v.name} }}`}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {isOther && (
        <div className="form-control form-control--outlined">
          <input type="text" defaultValue={value} onChange={event => _update(event.target.value)} />
        </div>
      )}
      <div className="form-control form-control--outlined">
        <label>
          Live Preview {variableSource && ` - {source: ${variableSource} }`}
          {error ? (
            <textarea className="danger" value={error || 'Error'} readOnly />
          ) : (
            <textarea ref={textAreaRef} value={preview || ''} readOnly />
          )}
        </label>
      </div>
    </div>
  );
};
