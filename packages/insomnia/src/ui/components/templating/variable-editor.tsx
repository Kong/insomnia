import React, { type FC, useEffect, useMemo, useState } from 'react';

import type { RenderPurpose } from '../../../common/render';
import { vaultEnvironmentMaskValue, vaultEnvironmentRuntimePath } from '../../../models/environment';
import { NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME } from '../../../templating';
import { useNunjucks } from '../../context/nunjucks/use-nunjucks';

interface Props {
  defaultValue: string;
  onChange: Function;
}

export const VariableEditor: FC<Props> = ({ onChange, defaultValue }) => {
  const [purpose, setPurpose] = useState<RenderPurpose | ''>('');
  const useNunjuckOptions = useMemo(() => {
    const renderContext = purpose === '' ? {} : { purpose };
    return { renderContext };
  }, [purpose]);
  const { handleRender, handleGetRenderContext } = useNunjucks(useNunjuckOptions);
  const [selected, setSelected] = useState(defaultValue);
  const [options, setOptions] = useState<{ name: string; value: any }[]>([]);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const isVaultVariable = selected
    && selected.replace('{{', '').replace('}}', '').trim().startsWith(`${NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME}.${vaultEnvironmentRuntimePath}`)
    && preview === vaultEnvironmentMaskValue;

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
        {isVaultVariable &&
          <button
            type="button"
            style={{
              zIndex: 10,
              position: 'relative',
            }}
            className="txt-sm pull-right icon inline-block"
            onClick={() => setPurpose(prevPurpose => prevPurpose === '' ? 'preview' : '')}
          >
            {purpose === '' ?
              <i className="fa-regular fa-eye" /> :
              <i className="fa-regular fa-eye-slash" />
            }
          </button>
        }
        <label>
          Live Preview
          <textarea className={`${error ? 'danger' : ''}`} value={preview || error} readOnly />
        </label>
      </div>
    </div>
  );
};
