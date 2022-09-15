import React, { FC, useCallback } from 'react';

import { toKebabCase } from '../../../../../common/misc';
import { WorkspaceAuthentication } from '../../../../../models/workspace';
import { useActiveWorkspace } from '../../../../hooks/use-active-workspace';
import { OneLineEditor } from '../../../codemirror/one-line-editor';
import { AuthRow } from './auth-row';

interface AuthInputRowProps {
  label: string;
  property: keyof Omit<WorkspaceAuthentication, 'disabled' | 'type'>;
}

export const AuthInputRow: FC<AuthInputRowProps> = ({ label, property }) => {
  const { activeWorkspace: { authentication }, patchAuth } = useActiveWorkspace();

  const onChange = useCallback((value: string) => patchAuth({ [property]: value }), [patchAuth, property]);

  const id = toKebabCase(label);

  return (
    <AuthRow>
      <label htmlFor={id}>{label}</label>

      <OneLineEditor
        id={id}
        defaultValue={authentication[property] || ''}
        onChange={onChange}
      />
    </AuthRow>
  );
};
