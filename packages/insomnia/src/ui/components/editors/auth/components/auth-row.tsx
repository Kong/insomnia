import classnames from 'classnames';
import React, { type FC, type PropsWithChildren, type ReactNode } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import type { RequestLoaderData } from '../../../../routes/request';
import type { RequestGroupLoaderData } from '../../../../routes/request-group';
import { HelpTooltip } from '../../../help-tooltip';

interface Props {
  labelFor: string;
  label: string;
  help?: ReactNode;
  disabled?: boolean;
}

export const AuthRow: FC<PropsWithChildren<Props>> = ({ labelFor, label, help, disabled, children }) => {
  const reqData = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const groupData = useRouteLoaderData('request-group/:requestGroupId') as RequestGroupLoaderData;
  const { authentication } = reqData?.activeRequest || groupData.activeRequestGroup;
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
          className={classnames('form-control form-control--underlined no-margin flex wide', {
            'form-control--inactive': isDisabled,
          })}
        >
          {children}
        </div>
      </td>
    </tr>
  );
};
