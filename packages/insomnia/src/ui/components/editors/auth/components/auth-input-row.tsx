import React, { type ComponentProps, type FC, type ReactNode, useCallback } from 'react';
import { useRouteLoaderData } from 'react-router-dom';
import { useToggle } from 'react-use';

import { toKebabCase } from '../../../../../common/misc';
import { useRequestGroupPatcher, useRequestPatcher } from '../../../../hooks/use-request';
import type { RequestLoaderData } from '../../../../routes/request';
import type { RequestGroupLoaderData } from '../../../../routes/request-group';
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
  const reqData = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const groupData = useRouteLoaderData('request-group/:requestGroupId') as RequestGroupLoaderData;
  const patchRequest = useRequestPatcher();
  const patchRequestGroup = useRequestGroupPatcher();
  const { authentication, _id } = reqData?.activeRequest || groupData.activeRequestGroup;
  const patcher = Boolean(reqData) ? patchRequest : patchRequestGroup;
  const [masked, toggleMask] = useToggle(true);
  const canBeMasked = !showPasswords && mask;
  const isMasked = canBeMasked && masked;

  const onChange = useCallback((value: string) => patcher(_id, { authentication: { ...authentication, [property]: value } }),
    [patcher, _id, authentication, property]);

  const id = toKebabCase(label);

  return (
    <AuthRow labelFor={id} label={label} help={help} disabled={disabled}>
      <OneLineEditor
        id={id}
        type={isMasked ? 'password' : 'text'}
        onChange={onChange}
        readOnly={disabled}
        // @ts-expect-error -- garbage abstraction
        defaultValue={authentication[property] || ''}
        getAutocompleteConstants={getAutocompleteConstants}
      />
      {canBeMasked ? (
        <button
          className="btn btn--super-super-compact pointer"
          onClick={toggleMask}
          disabled={disabled}
        >
          {isMasked ? <i className="fa fa-eye" data-testid="reveal-password-icon" /> : <i className="fa fa-eye-slash" data-testid="mask-password-icon" />}
        </button>
      ) : null}
    </AuthRow>
  );
};
