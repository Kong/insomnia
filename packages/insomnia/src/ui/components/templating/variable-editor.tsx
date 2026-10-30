import React, { type FC, useEffect, useMemo, useState } from 'react';

import { shouldShowRevealToggle } from '~/common/templating/confidential-value-policy';
import type { VariableSourceMeta } from '~/common/templating/types';
import { normalizeToDotAndBracketNotation } from '~/common/templating/utils';

import { useNunjucks } from '../../context/nunjucks/use-nunjucks';

interface Props {
  defaultValue: string;
  onChange: (arg: string) => void;
  onOpenSource?: (source: VariableSourceMeta) => void;
}

// The Source row must describe the variable that backs the preview right now, so
// it is re-derived from the template. Only a template that is exactly one
// variable reference has a single source.
const getTemplateSource = (
  template: string,
  keyContextMeta?: Record<string, VariableSourceMeta>,
): VariableSourceMeta | undefined => {
  const match = /^\{\{\s*([^{}]+?)\s*\}\}$/.exec(template.trim());
  if (!match) {
    return undefined;
  }
  const key = normalizeToDotAndBracketNotation(match[1].replace(/\\/g, ''));
  // keyContextMeta is a plain object, so keys such as `constructor` or `__proto__`
  // would otherwise resolve through Object.prototype.
  return keyContextMeta && Object.prototype.hasOwnProperty.call(keyContextMeta, key) ? keyContextMeta[key] : undefined;
};

export const VariableEditor: FC<Props> = ({ onChange, defaultValue, onOpenSource }) => {
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
  const [options, setOptions] = useState<{ name: string; value: unknown }[]>([]);
  const [source, setSource] = useState<VariableSourceMeta>();
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [hasMaskedValue, setHasMaskedValue] = useState(false);

  useEffect(() => {
    // Ignore results from superseded runs (e.g. fast switching) so the preview and
    // source always describe the same template.
    let cancelled = false;
    const syncInterpolation = async () => {
      try {
        const p = await handleRender(selected);
        if (cancelled) {
          return;
        }
        setHasMaskedValue(prev => shouldShowRevealToggle(prev, { isRevealed, preview: p }));
        setPreview(p);
        setError('');
      } catch (e) {
        if (cancelled) {
          return;
        }
        setHasMaskedValue(prev => shouldShowRevealToggle(prev, { isRevealed }));
        setPreview('');
        setError(e.message);
      }
      const { context, keys } = await handleGetRenderContext();
      if (cancelled) {
        return;
      }
      setOptions(keys.sort((a, b) => (a.name < b.name ? -1 : 1)));
      setSource(getTemplateSource(selected, context.getKeysContext().keyContextMeta));
    };
    syncInterpolation();
    return () => {
      cancelled = true;
    };
  }, [handleGetRenderContext, handleRender, isRevealed, selected]);

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
        {hasMaskedValue && (
          <button
            type="button"
            style={{ zIndex: 10, position: 'relative' }}
            className="txt-sm pull-right icon inline-block"
            onClick={() => setIsRevealed(prev => !prev)}
          >
            {isRevealed ? <i className="fa-regular fa-eye-slash" /> : <i className="fa-regular fa-eye" />}
          </button>
        )}
        <label>
          Live Preview
          <textarea className={`${error ? 'danger' : ''}`} value={preview || error} readOnly />
        </label>
        {source && (
          <div className="mt-1 flex items-center gap-2 text-xs" data-testid="variable-source-row">
            <span className="text-[0.7rem] tracking-wide uppercase opacity-60">Source</span>
            <span className="min-w-0 flex-1 truncate italic" title={source.label}>
              {source.label}
            </span>
            {source.workspaceId && onOpenSource && (
              <button
                type="button"
                className="flex shrink-0 cursor-pointer items-center gap-1 font-medium underline-offset-2 hover:underline"
                data-testid="variable-source-open"
                onClick={() => onOpenSource(source)}
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
