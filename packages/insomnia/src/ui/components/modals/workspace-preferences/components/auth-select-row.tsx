import React, { ChangeEvent, FC, useCallback } from 'react';

import { toKebabCase } from '../../../../../common/misc';
import { useActiveWorkspace } from '../../../../hooks/use-active-workspace';
import { HelpTooltip } from '../../../help-tooltip';
import { AuthRow } from './auth-row';

interface AuthSelectRowProps {
  label: string;
  property: string;
  options: {
    name: string;
    value: string;
  }[];
  help?: string;
  disabled?: boolean;
}

export const AuthSelectRow: FC<AuthSelectRowProps> = ({ label, property, options, help, disabled }) => {
  const { activeWorkspace: { authentication }, patchAuth } = useActiveWorkspace();

  const selectedValue = authentication.hasOwnProperty(property) ? authentication[property] : options[0].value;

  const onChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => patchAuth({ [property]: event.currentTarget.value }), [patchAuth, property]);

  const id = toKebabCase(label);

  return (
    <AuthRow>
      <div className="row" style={{ gap: 'var(--padding-sm)' }}>
        <label className="no-margin-top" htmlFor={id}>{label}</label>
        {help ? <HelpTooltip>{help}</HelpTooltip> : null}
      </div>

      <select id={id} onChange={onChange} value={selectedValue} disabled={disabled}>
        {options.map(({ name, value }) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </AuthRow>
  );
};
