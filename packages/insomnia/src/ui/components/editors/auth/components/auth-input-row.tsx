import React, { ComponentProps, FC, ReactNode, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useToggle } from 'react-use';

import { toKebabCase } from '../../../../../common/misc';
import { selectSettings } from '../../../../redux/selectors';
import { Button } from '../../../base/button';
import { OneLineEditor } from '../../../codemirror/one-line-editor';
import { useAuthSettings } from './auth-context';
import { AuthRow } from './auth-row';

interface Props extends Pick<ComponentProps<typeof OneLineEditor>, 'getAutocompleteConstants' | 'mode'> {
  label: string;
  property: string;
  help?: ReactNode;
  mask?: boolean;
}

export const AuthInputRow: FC<Props> = ({ label, getAutocompleteConstants, property, mask, mode, help }) => {
  const { showPasswords } = useSelector(selectSettings);
  const { authentication, patchAuth } = useAuthSettings();

  const [masked, toggleMask] = useToggle(true);
  const canBeMasked = !showPasswords && mask;
  const isMasked = canBeMasked && masked;

  // this handler is needed to ignore the parameters sent by button into onClick...
  const onClick = useCallback(() => toggleMask(), [toggleMask]);

  const onChange = useCallback((value: string) => patchAuth({ [property]: value }), [patchAuth, property]);

  const id = toKebabCase(label);

  return (
    <AuthRow labelFor={id} label={label} help={help}>
      <OneLineEditor
        id={id}
        type={isMasked ? 'password' : 'text'}
        mode={mode}
        onChange={onChange}
        disabled={authentication.disabled}
        defaultValue={authentication[property] || ''}
        getAutocompleteConstants={getAutocompleteConstants}
      />
      {canBeMasked ? (
        <Button
          className="btn btn--super-duper-compact pointer"
          onClick={onClick}
          value={isMasked}
        >
          {isMasked ? <i className="fa fa-eye" data-testid="reveal-password-icon" /> : <i className="fa fa-eye-slash" data-testid="mask-password-icon" />}
        </Button>
      ) : null}
    </AuthRow>
  );
};
