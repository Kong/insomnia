import classnames from 'classnames';
import React, { FC, PropsWithChildren, ReactNode } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { RequestLoaderData } from '../../../../routes/request';
import { HelpTooltip } from '../../../help-tooltip';

interface Props {
  labelFor: string;
  label: string;
  help?: ReactNode;
  disabled?: boolean;
}

export const AuthRow: FC<PropsWithChildren<Props>> = ({ labelFor, label, help, disabled, children }) => {
  const { activeRequest: { authentication } } = useRouteLoaderData('request/:requestId') as RequestLoaderData;

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
