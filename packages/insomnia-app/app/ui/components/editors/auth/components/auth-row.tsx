import classnames from 'classnames';
import React, { FC, ReactNode } from 'react';

import { useActiveRequest } from '../../../../hooks/use-active-request';
import { HelpTooltip } from '../../../help-tooltip';

interface Props {
  labelFor: string;
  label: string;
  help?: ReactNode;
}

export const AuthRow: FC<Props> = ({ labelFor, label, help, children }) => {
  const { activeRequest: { authentication: { disabled } } } = useActiveRequest();

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
            'form-control--inactive': disabled,
          })}
        >
          {children}
        </div>
      </td>
    </tr>
  );
};
