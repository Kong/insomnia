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
import { type DropdownHandle, type DropdownProps, Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { showError, showModal, showPrompt } from '../modals';
import { AlertModal } from '../modals/alert-modal';
import { GenerateCodeModal } from '../modals/generate-code-modal';

interface Props extends Omit<DropdownProps, 'children'> {
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
      ref={ref}
      aria-label="Request Actions Dropdown"
      onOpen={onOpen}
      dataTestId={`Dropdown-${toKebabCase(request.name)}`}
      triggerButton={
        <DropdownButton>
          <i className="fa fa-caret-down" />
        </DropdownButton>
      }
    >
      <DropdownItem aria-label='Duplicate'>
        <ItemContent
          icon="copy"
          label="Duplicate"
          hint={hotKeyRegistry.request_showDuplicate}
          onClick={duplicate}
        />
      </DropdownItem>

      <DropdownItem aria-label='Generate Code'>
        {canGenerateCode && (
          <ItemContent
            icon="code"
            label="Generate Code"
            hint={hotKeyRegistry.request_showGenerateCodeEditor}
            onClick={generateCode}
          />
        )}
      </DropdownItem>

      <DropdownItem aria-label={isPinned ? 'Unpin' : 'Pin'}>
        <ItemContent
          icon="thumb-tack"
          label={isPinned ? 'Unpin' : 'Pin'}
          hint={hotKeyRegistry.request_togglePin}
          onClick={togglePin}
        />
      </DropdownItem>

      <DropdownItem aria-label='Copy as cURL'>
        {canGenerateCode && (
          <ItemContent
            icon="copy"
            label="Copy as cURL"
            onClick={copyAsCurl}
            withPrompt
          />
        )}
      </DropdownItem>

      <DropdownItem aria-label='Rename'>
        <ItemContent
          icon="edit"
          label="Rename"
          onClick={handleRename}
        />
      </DropdownItem>

      <DropdownItem aria-label='Delete'>
        <ItemContent
          icon="trash-o"
          label="Delete"
          hint={hotKeyRegistry.request_showDelete}
          withPrompt
          onClick={deleteRequest}
        />
      </DropdownItem>

      <DropdownSection
        aria-label='Plugins Section'
        title="Plugins"
      >
        {actionPlugins.map((plugin: RequestAction) => (
          <DropdownItem
            key={`${plugin.plugin.name}::${plugin.label}`}
            aria-label={plugin.label}
          >
            <ItemContent
              icon={loadingActions[plugin.label] ? 'refresh fa-spin' : plugin.icon || 'code'}
              label={plugin.label}
              stayOpenAfterClick
              onClick={() => handlePluginClick(plugin)}
            />
          </DropdownItem>
        ))}
      </DropdownSection>

      <DropdownSection aria-label='Settings Section'>
        <DropdownItem aria-label='Settings'>
          <ItemContent
            icon="wrench"
            label="Settings"
            hint={hotKeyRegistry.request_showSettings}
            onClick={handleShowSettings}
          />
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
});

RequestActionsDropdown.displayName = 'RequestActionsDropdown';
