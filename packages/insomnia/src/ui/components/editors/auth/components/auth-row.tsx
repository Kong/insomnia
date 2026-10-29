import classnames from 'classnames';
import React, { type FC, type PropsWithChildren, type ReactNode } from 'react';

import { HelpTooltip } from '~/ui/components/help-tooltip';

import { useAuthEditor } from '../use-auth-editor';

interface Props {
  labelFor: string;
  label: string;
  help?: ReactNode;
  disabled?: boolean;
}

export const AuthRow: FC<PropsWithChildren<Props>> = ({ labelFor, label, help, disabled, children }) => {
  const { authentication } = useAuthEditor();
  const isDisabled = (authentication && 'disabled' in authentication && authentication.disabled) || disabled;
  return (
    <tr key={labelFor}>
      <td className="pad-right no-wrap valign-middle">
        <label htmlFor={labelFor} className="label--small no-pad">
          {label}
          {help ? <HelpTooltip>{help}</HelpTooltip> : null}
        </label>
      </td>
      <td className="wide">
        <div
          className={classnames('form-control form-control--underlined no-margin wide flex', {
            'form-control--inactive': isDisabled,
          })}
        >
          {children}
        </div>
      </td>
    </tr>
  );
};
