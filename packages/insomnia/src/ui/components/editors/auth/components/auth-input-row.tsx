import React, { ComponentProps, FC, ReactNode, useCallback } from 'react';
import { useRouteLoaderData } from 'react-router-dom';
import { useToggle } from 'react-use';

import { toKebabCase } from '../../../../../common/misc';
import { useRequestPatcher } from '../../../../hooks/use-request';
import { RequestLoaderData } from '../../../../routes/request';
import { useRootLoaderData } from '../../../../routes/root';
import { OneLineEditor } from '../../../codemirror/one-line-editor';
import { AuthRow } from './auth-row';

interface Props extends Pick<ComponentProps<typeof OneLineEditor>, 'getAutocompleteConstants'> {
  label: string;
  property: string;
  help?: ReactNode;
  mask?: boolean;
  disabled?: boolean;
}

export const AuthInputRow: FC<Props> = ({ label, getAutocompleteConstants, property, mask, help, disabled = false }) => {
  const {
    settings,
  } = useRootLoaderData();
  const { showPasswords } = settings;
  const { activeRequest: { authentication, _id: requestId } } = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const patchRequest = useRequestPatcher();
  const [masked, toggleMask] = useToggle(true);
  const canBeMasked = !showPasswords && mask;
  const isMasked = canBeMasked && masked;

  const onChange = useCallback((value: string) => patchRequest(requestId, { authentication: { ...authentication, [property]: value } }),
    [authentication, patchRequest, property, requestId]);

  const id = toKebabCase(label);

  return (
    <AuthRow labelFor={id} label={label} help={help} disabled={disabled}>
      <OneLineEditor
        id={id}
        type={isMasked ? 'password' : 'text'}
        onChange={onChange}
        readOnly={disabled}
        defaultValue={authentication[property] || ''}
        getAutocompleteConstants={getAutocompleteConstants}
      />
      {canBeMasked ? (
        <button
          className="btn btn--super-duper-compact pointer"
          onClick={toggleMask}
          disabled={disabled}
        >
          {isMasked ? <i className="fa fa-eye" data-testid="reveal-password-icon" /> : <i className="fa fa-eye-slash" data-testid="mask-password-icon" />}
        </button>
      ) : null}
    </AuthRow>
  );
};
