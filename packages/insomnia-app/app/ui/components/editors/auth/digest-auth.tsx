import classnames from 'classnames';
import React, { FC, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { useActiveRequest } from '../../../hooks/use-active-request';
import { selectSettings } from '../../../redux/selectors';
import { OneLineEditor } from '../../codemirror/one-line-editor';
import { PasswordEditor } from '../password-editor';
import { AuthEnabledRow } from './components/auth-enabled-row';

interface Props {
  isVariableUncovered: boolean;
}

export const DigestAuth: FC<Props> = ({ isVariableUncovered }) => {
  const { showPasswords } = useSelector(selectSettings);
  const { activeRequest: { authentication }, patchAuth } = useActiveRequest();

  const handleUsername = useCallback((username: string) => patchAuth({ username }), [patchAuth]);
  const handlePassword = useCallback((password: string) => patchAuth({ password }), [patchAuth]);

  return (
    <div className="pad">
      <table>
        <tbody>
          <tr>
            <td className="pad-right no-wrap valign-middle">
              <label htmlFor="username" className="label--small no-pad">
                Username
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
                  id="username"
                  disabled={authentication.disabled}
                  onChange={handleUsername}
                  defaultValue={authentication.username || ''}
                  isVariableUncovered={isVariableUncovered}
                />
              </div>
            </td>
          </tr>
          <tr>
            <td className="pad-right no-wrap valign-middle">
              <label htmlFor="password" className="label--small no-pad">
                Password
              </label>
            </td>
            <td className="flex wide">
              <PasswordEditor
                showAllPasswords={showPasswords}
                disabled={authentication.disabled}
                password={authentication.password}
                onChange={handlePassword}
                isVariableUncovered={isVariableUncovered}
              />
            </td>
          </tr>
          <AuthEnabledRow />
        </tbody>
      </table>
    </div>
  );
};
