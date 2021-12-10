import classnames from 'classnames';
import React, { FC, useCallback } from 'react';

import { useActiveRequest } from '../../../hooks/use-active-request';
import { OneLineEditor } from '../../codemirror/one-line-editor';
import { HelpTooltip } from '../../help-tooltip';
import { AuthEnabledRow } from './auth-enabled-row';

interface Props {
  isVariableUncovered: boolean;
}

export const BearerAuth: FC<Props> = ({ isVariableUncovered }) => {
  const { activeRequest: { authentication }, patchAuth } = useActiveRequest();

  const handleToken = useCallback((token: string) => patchAuth({ token }), [patchAuth]);
  const handlePrefix = useCallback((prefix: string) => patchAuth({ prefix }), [patchAuth]);

  return (
    <div className="pad">
      <table>
        <tbody>
          <tr>
            <td className="pad-right no-wrap valign-middle">
              <label htmlFor="token" className="label--small no-pad">
                Token
              </label>
            </td>
            <td className="wide">
              <div
                className={classnames('form-control form-control--underlined no-margin', {
                  'form-control--inactive': authentication.disabled,
                })}
              >
                <OneLineEditor
                  type="text"
                  id="token"
                  disabled={authentication.disabled}
                  onChange={handleToken}
                  defaultValue={authentication.token || ''}
                  isVariableUncovered={isVariableUncovered}
                />
              </div>
            </td>
          </tr>
          <tr>
            <td className="pad-right no-wrap valign-middle">
              <label htmlFor="prefix" className="label--small no-pad">
                Prefix{' '}
                <HelpTooltip>
                  Prefix to use when sending the Authorization header. Defaults to Bearer.
                </HelpTooltip>
              </label>
            </td>
            <td className="wide">
              <div
                className={classnames('form-control form-control--underlined no-margin', {
                  'form-control--inactive': authentication.disabled,
                })}
              >
                <OneLineEditor
                  type="text"
                  id="prefix"
                  disabled={authentication.disabled}
                  onChange={handlePrefix}
                  defaultValue={authentication.prefix || ''}
                  isVariableUncovered={isVariableUncovered}
                />
              </div>
            </td>
          </tr>
          <AuthEnabledRow />
        </tbody>
      </table>
    </div>
  );
};
