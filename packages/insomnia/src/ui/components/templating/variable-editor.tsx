import React, { type FC, useEffect, useMemo, useState } from 'react';

import type { VariableSourceMeta } from '~/common/templating/types';

import { useNunjucks } from '../../context/nunjucks/use-nunjucks';

interface Props {
  defaultValue: string;
  onChange: (arg: string) => void;
  variableSource?: VariableSourceMeta;
  onOpenSource?: () => void;
}

export const VariableEditor: FC<Props> = ({ onChange, defaultValue, variableSource, onOpenSource }) => {
  // Always use 'preview' purpose; masking is controlled by the policy layer.
  // forceReveal lets the user bypass hideSecretValuesInPreviewAndConsole for this
  // session only — it is orthogonal to purpose and does not affect send/script paths.
  const [isRevealed, setIsRevealed] = useState(false);
  const nunjucksOptions = useMemo(
    () => ({ renderContext: { purpose: 'preview' as const, forceReveal: isRevealed } }),
    [isRevealed],
  );
  const { handleRender, handleGetRenderContext } = useNunjucks(nunjucksOptions);
  const [selected, setSelected] = useState(defaultValue);
  const [options, setOptions] = useState<{ name: string; value: any }[]>([]);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const syncInterpolation = async () => {
      try {
        const p = await handleRender(selected);
        isMounted && setPreview(p);
        isMounted && setError('');
      } catch (e) {
        isMounted && setPreview('');
        isMounted && setError(e.message);
      }
      const context = await handleGetRenderContext();
      isMounted && setOptions(context.keys.sort((a, b) => (a.name < b.name ? -1 : 1)));
    };
    syncInterpolation();
    return () => {
      isMounted = false;
    };
  }, [handleGetRenderContext, handleRender, selected]);

  const isCustomTemplateSelected = !options.find(v => selected === `{{ ${v.name} }}`);
  return (
    <div>
      <div className="form-control form-control--outlined">
        <label>
          Environment Variable
          <select
            value={selected}
            onChange={event => {
              setSelected(event.target.value);
              onChange(event.target.value);
            }}
          >
            <option value={"{{ 'my custom template logic' | urlencode }}"}>-- Custom --</option>
            {options.map(v => (
              <option key={v.name} value={`{{ ${v.name} }}`}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {isCustomTemplateSelected && (
        <div className="form-control form-control--outlined">
          <input
            type="text"
            defaultValue={selected}
            onChange={event => {
              setSelected(event.target.value);
              onChange(event.target.value);
            }}
          />
        </div>
      )}
      <div className="form-control form-control--outlined">
        <button
          type="button"
          style={{ zIndex: 10, position: 'relative' }}
          className="txt-sm pull-right icon inline-block"
          onClick={() => setIsRevealed(prev => !prev)}
        >
          {isRevealed ? <i className="fa-regular fa-eye-slash" /> : <i className="fa-regular fa-eye" />}
        </button>
        <label>
          Live Preview
          <textarea className={`${error ? 'danger' : ''}`} value={preview || error} readOnly />
        </label>
        {variableSource && (
          <div className="mt-1 flex items-center gap-2 text-xs" data-testid="variable-source-row">
            <span className="text-[0.7rem] tracking-wide uppercase opacity-60">Source</span>
            <span className="min-w-0 flex-1 truncate italic" title={variableSource.label}>
              {variableSource.label}
            </span>
            {variableSource.workspaceId && onOpenSource && (
              <button
                type="button"
                className="flex shrink-0 cursor-pointer items-center gap-1 font-medium underline-offset-2 hover:underline"
                data-testid="variable-source-open"
                onClick={onOpenSource}
              >
                Open <i className="fa fa-arrow-right text-[0.65rem]" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
