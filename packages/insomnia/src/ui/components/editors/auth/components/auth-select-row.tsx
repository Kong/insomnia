import type { RequestAuthentication } from 'insomnia-data';
import React, { type ChangeEvent, type FC, type ReactNode, useCallback } from 'react';

import { toKebabCase } from '~/common/misc';
import { getAuthObjectOrNull } from '~/network/authentication';

import { useAuthEditor } from '../use-auth-editor';
import { AuthRow } from './auth-row';

interface Props {
  label: string;
  property: string;
  options: {
    name: string;
    value: string;
  }[];
  help?: ReactNode;
  disabled?: boolean;
}

export const AuthSelectRow: FC<Props> = ({ label, property, help, options, disabled }) => {
  const { authentication, patchAuthentication } = useAuthEditor();
  const authOrNull = getAuthObjectOrNull(authentication);
  const selectedValue = authOrNull ? authOrNull[property as keyof RequestAuthentication] + '' : options[0].value;

  const onChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      let updatedValue = event.currentTarget.value;
      // Convert boolean strings to boolean values for further processing.
      if (updatedValue === 'true' || updatedValue === 'false') {
        updatedValue = JSON.parse(updatedValue);
      }
      patchAuthentication({ [property]: updatedValue });
    },
    [patchAuthentication, property],
  );

  return (
    <AuthRow labelFor={toKebabCase(label)} label={label} help={help} disabled={disabled}>
      <select id={toKebabCase(label)} onChange={onChange} value={selectedValue} disabled={disabled}>
        {options.map(({ name, value }) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </AuthRow>
  );
};
