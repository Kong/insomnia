import React, { FC, ReactNode, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useToggle } from 'react-use';

import { kebabCase } from '../../../../../common/misc';
import { useActiveRequest } from '../../../../hooks/use-active-request';
import { selectSettings } from '../../../../redux/selectors';
import { Button } from '../../../base/button';
import { OneLineEditor } from '../../../codemirror/one-line-editor';
import { AuthRow } from './auth-row';

interface Props {
  label: string;
  property: string;
  help?: ReactNode;
  mask?: boolean;
}

export const AuthInputRow: FC<Props> = ({ label, property, mask, help }) => {
  const { isVariableUncovered, showPasswords } = useSelector(selectSettings);
  const { activeRequest: { authentication }, patchAuth } = useActiveRequest();

  const [masked, toggleMask] = useToggle(true);
  const canBeMasked = !showPasswords && mask;
  const isMasked = canBeMasked && masked;

  const onChange = useCallback((value: string) => patchAuth({ [property]: value }), [patchAuth, property]);

  const id = kebabCase(label);

  return (
    <AuthRow labelFor={id} label={label} help={help}>
      <OneLineEditor
        id={id}
        type={isMasked ? 'password' : 'text'}
        onChange={onChange}
        disabled={authentication.disabled}
        defaultValue={authentication[property] || ''}
        isVariableUncovered={isVariableUncovered}
      />
      {canBeMasked ? (
        <Button
          className="btn btn--super-duper-compact pointer"
          // inline function needed to ignore the parameters sent by button into onClick...
          onClick={() => toggleMask()}
          value={isMasked}
        >
          {isMasked ? <i className="fa fa-eye" /> : <i className="fa fa-eye-slash" />}
        </Button>
      ) : null}
    </AuthRow>

  );
};
