import classnames from 'classnames';
import React, { FC, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { useActiveRequest } from '../../../hooks/use-active-request';
import { selectSettings } from '../../../redux/selectors';
import { Button } from '../../base/button';
import { OneLineEditor } from '../../codemirror/one-line-editor';
import { HelpTooltip } from '../../help-tooltip';
import { PasswordEditor } from '../password-editor';

interface Props {
  isVariableUncovered: boolean;
}

export const BasicAuth: FC<Props> = ({ isVariableUncovered }) => {
  const { showPasswords } = useSelector(selectSettings);
  const { activeRequest: { authentication }, updateAuthentication } = useActiveRequest();

  const toggleISO88591 = useCallback(() => updateAuthentication({ ...authentication, useISO88591: !authentication.useISO88591 }), [authentication, updateAuthentication]);
  const toggleEnabled = useCallback(() => updateAuthentication({ ...authentication, disable: !authentication.disabled }), [authentication, updateAuthentication]);
  const handleUsersname = useCallback((username: string) => updateAuthentication({ ...authentication, username }), [authentication, updateAuthentication]);
  const handlePassword = useCallback((password: string) => updateAuthentication({ ...authentication, password }), [authentication, updateAuthentication]);

  return <div className="pad">
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
                onChange={handleUsersname}
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
        <tr>
          <td className="pad-right no-wrap valign-middle">
            <label htmlFor="enabled" className="label--small no-pad">
              Enabled
            </label>
          </td>
          <td className="wide">
            <div className="form-control form-control--underlined">
              <Button
                className="btn btn--super-duper-compact"
                id="enabled"
                onClick={toggleEnabled}
                value={!authentication.disabled}
                title={authentication.disabled ? 'Enable item' : 'Disable item'}
              >
                {authentication.disabled ? (
                  <i className="fa fa-square-o" />
                ) : (
                  <i className="fa fa-check-square-o" />
                )}
              </Button>
            </div>
          </td>
        </tr>
        <tr>
          <td className="pad-right no-wrap valign-middle">
            <label htmlFor="use-iso-8859-1" className="label--small no-pad">
              Use ISO 8859-1
              <HelpTooltip>
                Check this to use ISO-8859-1 encoding instead of default UTF-8
              </HelpTooltip>
            </label>
          </td>
          <td className="wide">
            <div className="form-control form-control--underlined">
              <Button
                className="btn btn--super-duper-compact"
                id="use-iso-8859-1"
                onClick={toggleISO88591}
                value={authentication.useISO88591}
                title={authentication.useISO88591 ? 'Enable item' : 'Disable item'}
              >
                {authentication.useISO88591 ? (
                  <i className="fa fa-check-square-o" />
                ) : (
                  <i className="fa fa-square-o" />
                )}
              </Button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>;
};
