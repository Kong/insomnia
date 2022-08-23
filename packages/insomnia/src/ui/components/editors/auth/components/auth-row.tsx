import classnames from 'classnames';
import React, { FC, ReactNode } from 'react';

import { HelpTooltip } from '../../../help-tooltip';
import { useAuthSettings } from './auth-context';

interface Props {
  labelFor: string;
  label: string;
  help?: ReactNode;
  disabled?: boolean;
}

export const AuthRow: FC<Props> = ({ labelFor, label, help, disabled, children }) => {
  const { authentication } = useAuthSettings();

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
          className={classnames('form-control form-control--underlined no-margin flex wide', {
            'form-control--inactive': authentication.disabled || disabled,
          })}
        >
          {children}
        </div>
      </td>
    </tr>
  );
};
