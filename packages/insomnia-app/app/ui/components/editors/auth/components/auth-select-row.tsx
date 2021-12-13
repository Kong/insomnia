import React, { ChangeEvent, FC, ReactNode, useCallback } from 'react';

import { kebabCase } from '../../../../../common/misc';
import { useActiveRequest } from '../../../../hooks/use-active-request';
import { AuthRow } from './auth-row';

interface Props {
  label: string;
  property: string;
  options: {
    name: string;
    value: string;
  }[];
  help?: ReactNode;
}

export const AuthSelectRow: FC<Props> = ({ label, property, help, options }) => {
  const { activeRequest: { authentication }, patchAuth } = useActiveRequest();

  const selectedValue = authentication.hasOwnProperty(property) ? authentication[property] : options[0];

  const onChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => patchAuth({ [property]: event.currentTarget.value }), [patchAuth, property]);

  const id = kebabCase(label);

  return (
    <AuthRow labelFor={id} label={label} help={help}>
      <select id={id} onChange={onChange} value={selectedValue}>
        {options.map(({ name, value }) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </AuthRow>
  );
};
