import React, { ChangeEvent, FC, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { makeNewAuth } from '../../../../common/authentication';
import { AuthType, getAuthTypeName } from '../../../../common/constants';
import { update } from '../../../../models/helpers/workspace-operations';
import { selectActiveWorkspace } from '../../../redux/selectors';
import { showModal } from '..';
import { AlertModal } from '../alert-modal';
import { AuthRow } from './components/auth-row';

interface Props {
  changeType?: (type: string) => void;
}

const defaultTypes: AuthType[] = [
  'basic',
  'digest',
  'oauth1',
  'ntlm',
  'iam',
  'bearer',
  'hawk',
  'asap',
  'netrc',
  'none',
];

export const AuthSelectType: FC<Props> = ({ changeType = () => {} }) => {
  const activeWorkspace = useSelector(selectActiveWorkspace);

  const onChange = useCallback(async (event: ChangeEvent<HTMLSelectElement>) => {
    const type = event.currentTarget.value;

    if (!activeWorkspace || !('authentication' in activeWorkspace)) {
      return;
    }

    const { authentication } = activeWorkspace;

    if (type === authentication.type) {
      return;
    }

    const newAuthentication = makeNewAuth(type, authentication);
    const defaultAuthentication = makeNewAuth(authentication.type);

    for (const key of Object.keys(authentication)) {
      if (key === 'type') {
        continue;
      }

      const value = authentication[key];
      const changedSinceDefault = defaultAuthentication[key] !== value;
      const willChange = newAuthentication[key] !== value;

      if (changedSinceDefault && willChange) {
        await showModal(AlertModal, {
          title: 'Switch Authentication?',
          message: 'Current authentication settings will be lost',
          addCancel: true,
        });

        break;
      }
    }

    update(activeWorkspace, { authentication: newAuthentication });
    changeType(type);
  }, [activeWorkspace, changeType]);

  if (!activeWorkspace) {
    return null;
  }

  const currentType = activeWorkspace.authentication.type || 'none';

  return (
    <AuthRow>
      <label>
        Type
        <select value={currentType} onChange={onChange}>
          {defaultTypes.map(authType => (
            <option key={authType} value={authType}>
              {getAuthTypeName(authType, true) || 'No Authentication'}
            </option>
          ))}
        </select>
      </label>
    </AuthRow>
  );
};
