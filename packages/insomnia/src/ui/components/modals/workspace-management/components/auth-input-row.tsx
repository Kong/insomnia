import React, { ComponentProps, FC, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useToggle } from 'react-use';

import { toKebabCase } from '../../../../../common/misc';
import { useActiveWorkspace } from '../../../../hooks/use-active-workspace';
import { selectSettings } from '../../../../redux/selectors';
import { Button } from '../../../base/button';
import { OneLineEditor } from '../../../codemirror/one-line-editor';
import { HelpTooltip } from '../../../help-tooltip';
import { AuthRow } from './auth-row';

type OneLineEditorProps = Pick<ComponentProps<typeof OneLineEditor>, 'getAutocompleteConstants'>;

interface AuthInputRowProps extends OneLineEditorProps {
  label: string;
  property: string;
  mode?: string;
  mask?: boolean;
  help?: string;
}

export const AuthInputRow: FC<AuthInputRowProps> = ({ label, property, mode, mask, help, getAutocompleteConstants }) => {
  const { showPasswords } = useSelector(selectSettings);
  const { activeWorkspace: { authentication }, patchAuth } = useActiveWorkspace();

  const [masked, toggleMask] = useToggle(true);
  const canBeMasked = !showPasswords && mask;
  const isMasked = canBeMasked && masked;

  const onClick = useCallback(() => toggleMask(), [toggleMask]);

  const onChange = useCallback((value: string) => patchAuth({ [property]: value }), [patchAuth, property]);

  const id = toKebabCase(label);

  return (
    <AuthRow>
      <div className="row" style={{ gap: 'var(--padding-sm)' }}>
        <label className="no-margin-top" htmlFor={id}>{label}</label>
        {help ? <HelpTooltip>{help}</HelpTooltip> : null}
      </div>

      <div className="flex">
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
      </div>
    </AuthRow>
  );
};
