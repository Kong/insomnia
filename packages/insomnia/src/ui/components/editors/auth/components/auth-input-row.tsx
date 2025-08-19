import React, { type ComponentProps, type FC, type ReactNode, useCallback, useEffect, useRef } from 'react';
import * as reactUse from 'react-use';

import { useRootLoaderData } from '~/root';
import { OneLineEditor, type OneLineEditorHandle } from '~/ui/components/.client/codemirror/one-line-editor';

import { toKebabCase } from '../../../../../common/misc';
import {
  type RequestLoaderData,
  useRequestLoaderData,
} from '../../../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import {
  type RequestGroupLoaderData,
  useRequestGroupLoaderData,
} from '../../../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId';
import { useRequestGroupPatcher, useRequestPatcher } from '../../../../hooks/use-request';
import { AuthRow } from './auth-row';

interface Props extends Pick<ComponentProps<typeof OneLineEditor>, 'getAutocompleteConstants'> {
  label: string;
  property: string;
  help?: ReactNode;
  mask?: boolean;
  disabled?: boolean;
  overrideValueWhenDisabled?: string;
  copyBtn?: boolean; // Whether to show the copy button
}

export const AuthInputRow: FC<Props> = ({
  label,
  getAutocompleteConstants,
  property,
  mask,
  help,
  disabled = false,
  overrideValueWhenDisabled,
  copyBtn = false,
}) => {
  const { settings } = useRootLoaderData()!;
  const { showPasswords } = settings;
  const reqData = useRequestLoaderData() as RequestLoaderData;
  const groupData = useRequestGroupLoaderData() as RequestGroupLoaderData;
  const patchRequest = useRequestPatcher();
  const patchRequestGroup = useRequestGroupPatcher();
  const { authentication, _id } = reqData?.activeRequest || groupData?.activeRequestGroup || {};
  const patcher = reqData ? patchRequest : patchRequestGroup;
  const [masked, toggleMask] = reactUse.useToggle(true);
  const canBeMasked = !showPasswords && mask;
  const isMasked = canBeMasked && masked;

  // @ts-expect-error -- garbage abstraction
  const propVal = authentication[property] || '';

  // Use a ref to keep track of the original value, so we can restore it when the editor is enabled
  const propValRef = useRef(propVal);
  useEffect(() => {
    propValRef.current = propVal;
  }, [propVal]);

  const onChange = useCallback(
    (value: string) => {
      if (disabled) {
        // If the editor is disabled, we don't want to patch the value
        return;
      }
      patcher(_id, { authentication: { ...authentication, [property]: value } });
    },
    [patcher, _id, authentication, property, disabled],
  );

  const id = toKebabCase(label);

  const editorRef = useRef<OneLineEditorHandle>(null);

  useEffect(() => {
    if (overrideValueWhenDisabled) {
      if (disabled) {
        // If the editor is disabled, we want to set the value to the override value
        editorRef.current?.setValue(overrideValueWhenDisabled);
      } else {
        // If the editor is enabled, we want to restore the original value
        editorRef.current?.setValue(propValRef.current);
      }
    }
  }, [disabled, overrideValueWhenDisabled]);

  const onCopy = useCallback(
    async (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      let content = propVal;
      if (overrideValueWhenDisabled && disabled) {
        content = overrideValueWhenDisabled;
      }

      if (content) {
        window.clipboard.writeText(content);
      }
    },
    [overrideValueWhenDisabled, disabled, propVal],
  );

  return (
    <AuthRow labelFor={id} label={label} help={help} disabled={disabled}>
      <OneLineEditor
        ref={editorRef}
        id={id}
        type={isMasked ? 'password' : 'text'}
        onChange={onChange}
        readOnly={disabled}
        // @ts-expect-error -- garbage abstraction
        defaultValue={authentication[property] || ''}
        getAutocompleteConstants={getAutocompleteConstants}
      />
      {canBeMasked ? (
        <button className="btn btn--super-super-compact pointer" onClick={toggleMask} disabled={disabled}>
          {isMasked ? (
            <i className="fa fa-eye" data-testid="reveal-password-icon" />
          ) : (
            <i className="fa fa-eye-slash" data-testid="mask-password-icon" />
          )}
        </button>
      ) : null}
      {copyBtn && (
        <button className="btn btn--super-super-compact pointer btn--forever-enabled" onClick={onCopy}>
          <i className="fa fa-copy" data-testid="reveal-password-icon" />
        </button>
      )}
    </AuthRow>
  );
};
