import React, { type FC, type ReactNode, useCallback } from 'react';

import { toKebabCase } from '~/common/misc';
import {
  type RequestLoaderData,
  useRequestLoaderData,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import {
  type RequestGroupLoaderData,
  useRequestGroupLoaderData,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId';
import { showModal } from '~/ui/components/modals';
import { CodePromptModal } from '~/ui/components/modals/code-prompt-modal';
import { useRequestGroupPatcher, useRequestPatcher } from '~/ui/hooks/use-request';

import { AuthRow } from './auth-row';

interface Props {
  label: string;
  property: string;
  title?: string;
  help?: ReactNode;
  placeholder?: string;
  mode: string;
  hideMode?: boolean;
  disabled?: boolean;
}

export const AuthCodeRow: FC<Props> = ({
  label,
  property,
  title,
  help,
  placeholder,
  mode,
  hideMode = true,
  disabled = false,
}) => {
  const reqData = useRequestLoaderData() as RequestLoaderData;
  const groupData = useRequestGroupLoaderData() as RequestGroupLoaderData;
  const patchRequest = useRequestPatcher();
  const patchRequestGroup = useRequestGroupPatcher();
  const patcher = reqData ? patchRequest : patchRequestGroup;

  const { authentication, _id } = reqData?.activeRequest || groupData.activeRequestGroup;
  const authRecord = authentication as Record<string, unknown>;
  const value = (typeof authRecord[property] === 'string' ? authRecord[property] : '') || '';

  const onChange = useCallback(
    (value: string) => patcher(_id, { authentication: { ...authentication, [property]: value } }),
    [_id, authentication, patcher, property],
  );

  const editValue = () => {
    showModal(CodePromptModal, {
      submitName: 'Done',
      title: title || `Edit ${label}`,
      defaultValue: value,
      onChange,
      placeholder: placeholder || '',
      mode,
      hideMode,
    });
  };

  const id = toKebabCase(label);

  return (
    <AuthRow labelFor={id} label={label} help={help} disabled={disabled}>
      <button id={id} className="btn btn--clicky wide" onClick={editValue} disabled={disabled}>
        <i className="fa fa-edit space-right" />
        {value ? 'Click to Edit' : 'Click to Add'}
      </button>
    </AuthRow>
  );
};
