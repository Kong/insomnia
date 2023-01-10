import { clipboard } from 'electron';
import HTTPSnippet from 'httpsnippet';
import React, { forwardRef, useCallback, useState } from 'react';
import { useSelector } from 'react-redux';

import { exportHarRequest } from '../../../common/har';
import { toKebabCase } from '../../../common/misc';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import type { Environment } from '../../../models/environment';
import { GrpcRequest } from '../../../models/grpc-request';
import * as requestOperations from '../../../models/helpers/request-operations';
import { Project } from '../../../models/project';
import { isRequest, Request } from '../../../models/request';
import type { RequestGroup } from '../../../models/request-group';
import { incrementDeletedRequests } from '../../../models/stats';
// Plugin action related imports
import type { RequestAction } from '../../../plugins';
import { getRequestActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context/index';
import { updateRequestMetaByParentId } from '../../hooks/create-request';
import { selectHotKeyRegistry } from '../../redux/selectors';
import { type DropdownHandle, type DropdownProps } from '../base/dropdown/dropdown';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown-aria/dropdown';
import { PromptButton } from '../base/prompt-button';
import { showError, showModal, showPrompt } from '../modals';
import { AlertModal } from '../modals/alert-modal';
import { GenerateCodeModal } from '../modals/generate-code-modal';

interface Props extends Pick<DropdownProps, 'right'> {
  activeEnvironment?: Environment | null;
  activeProject: Project;
  handleDuplicateRequest: Function;
  handleShowSettings: () => void;
  isPinned: Boolean;
  request: Request | GrpcRequest;
  requestGroup?: RequestGroup;
}

export const RequestActionsDropdown = forwardRef<DropdownHandle, Props>(({
  activeEnvironment,
  activeProject,
  handleDuplicateRequest,
  handleShowSettings,
  isPinned,
  request,
  requestGroup,
}, ref) => {
  const hotKeyRegistry = useSelector(selectHotKeyRegistry);
  const [actionPlugins, setActionPlugins] = useState<RequestAction[]>([]);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});

  const onOpen = useCallback(async () => {
    const actionPlugins = await getRequestActions();
    setActionPlugins(actionPlugins);
  }, []);

  const handlePluginClick = useCallback(async ({ plugin, action, label }: RequestAction) => {
    setLoadingActions({ ...loadingActions, [label]: true });

    try {
      const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : null;
      const context = {
        ...(pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER)),
        ...pluginContexts.data.init(activeProject._id),
        ...(pluginContexts.store.init(plugin)),
        ...(pluginContexts.network.init(activeEnvironmentId)),
      };
      await action(context, {
        request,
        requestGroup,
      });
    } catch (error) {
      showError({
        title: 'Plugin Action Failed',
        error,
      });
    }
    setLoadingActions({ ...loadingActions, [label]: false });
    if (ref && 'current' in ref) { // this `in` operator statement type-narrows to `MutableRefObject`
      ref.current?.hide();
    }
  }, [request, activeEnvironment, requestGroup, loadingActions, activeProject._id, ref]);

  const duplicate = useCallback(() => {
    handleDuplicateRequest(request);
  }, [handleDuplicateRequest, request]);

  const generateCode = useCallback(() => {
    if (isRequest(request)) {
      showModal(GenerateCodeModal, { request });
    }
  }, [request]);

  const copyAsCurl = useCallback(async () => {
    try {
      const environmentId = activeEnvironment ? activeEnvironment._id : 'n/a';
      const har = await exportHarRequest(request._id, environmentId);
      const snippet = new HTTPSnippet(har);
      const cmd = snippet.convert('shell', 'curl');

      if (cmd) {
        clipboard.writeText(cmd);
      }
    } catch (err) {
      showModal(AlertModal, {
        title: 'Could not generate cURL',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [activeEnvironment, request._id]);

  const handleRename = useCallback(() => {
    showPrompt({
      title: 'Rename Request',
      defaultValue: request.name,
      submitName: 'Rename',
      selectText: true,
      label: 'Name',
      onComplete: name => {
        requestOperations.update(request, { name });
      },
    });
  }, [request]);

  const togglePin = useCallback(() => {
    updateRequestMetaByParentId(request._id, { pinned: !isPinned });
  }, [isPinned, request]);

  const deleteRequest = useCallback(() => {
    incrementDeletedRequests();
    requestOperations.remove(request);
  }, [request]);

  // Can only generate code for regular requests, not gRPC requests
  const canGenerateCode = isRequest(request);
  return (
    <Dropdown
      // ref={ref}
      onOpen={onOpen}
      dataTestId={`Dropdown-${toKebabCase(request.name)}`}
      triggerButton={
        <DropdownButton variant='text' style={{ height: '100%', padding: 0 }}>
          <i className="fa fa-caret-down" />
        </DropdownButton>
      }
    >
      <DropdownItem>
        <ItemContent icon="copy" label="Duplicate" hint={hotKeyRegistry.request_showDuplicate} onClick={duplicate} />
      </DropdownItem>

      {canGenerateCode && (
        // dataTestId={`DropdownItemGenerateCode-${toKebabCase(request.name)}`}
        <DropdownItem>
          <ItemContent
            icon="code"
            label="Generate Code"
            hint={hotKeyRegistry.request_showGenerateCodeEditor}
            onClick={generateCode}
          />
        </DropdownItem>
      )}

      <DropdownItem> {/* dataTestId={`DropdownItemPinRequest-${toKebabCase(request.name)}`} */}
        <ItemContent
          icon="thumb-tack"
          label={isPinned ? 'Unpin' : 'Pin'}
          hint={hotKeyRegistry.request_togglePin}
          onClick={togglePin}
        />
      </DropdownItem>

      {canGenerateCode && (
        // dataTestId={`DropdownItemCopyAsCurl-${toKebabCase(request.name)}`}
        <DropdownItem>
          <ItemContent icon="copy" label="Copy as cURL" onClick={copyAsCurl} />
        </DropdownItem>
      )}
      {/* dataTestId={`DropdownItemRename-${toKebabCase(request.name)}`} */}
      <DropdownItem>
        <ItemContent icon="edit" label="Rename" onClick={handleRename} />
      </DropdownItem>

      {/* dataTestId={`DropdownItemDelete-${toKebabCase(request.name)}`} */}
      <DropdownItem>
        <PromptButton fullWidth onClick={deleteRequest}>
          <ItemContent icon="trash-o" label="Delete" hint={hotKeyRegistry.request_showDelete} />
        </PromptButton>
      </DropdownItem>

      {actionPlugins.length > 0 &&
        <DropdownSection title="Plugins">
          {actionPlugins.map((plugin: RequestAction) => (
            <DropdownItem key={`${plugin.plugin.name}::${plugin.label}`}>
              <ItemContent
                icon={loadingActions[plugin.label] ? 'refresh fa-spin' : plugin.icon || 'code'}
                label={plugin.label}
                onClick={() => handlePluginClick(plugin)}
              />
            </DropdownItem>
          ))}
        </DropdownSection>
      }

      <DropdownSection>
        <DropdownItem> {/* dataTestId={`DropdownItemSettings-${toKebabCase(request.name)}`}> */}
          <ItemContent icon="wrench" label="Settings" hint={hotKeyRegistry.request_showSettings} onClick={handleShowSettings} />
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
});

RequestActionsDropdown.displayName = 'RequestActionsDropdown';
