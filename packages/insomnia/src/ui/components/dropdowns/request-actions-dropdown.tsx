import classnames from 'classnames';
import { clipboard } from 'electron';
import HTTPSnippet from 'httpsnippet';
import React, { forwardRef, useCallback, useState } from 'react';
import { useSelector } from 'react-redux';

import { exportHarRequest } from '../../../common/har';
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
import { type DropdownHandle, type DropdownProps, Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { DropdownItem } from '../base/dropdown/dropdown-item';
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
  right,
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
    showModal(GenerateCodeModal, { request });
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
    <Dropdown right={right} ref={ref} onOpen={onOpen}>
      <DropdownButton>
        <i className="fa fa-caret-down" />
      </DropdownButton>

      <DropdownItem onClick={duplicate}>
        <i className="fa fa-copy" /> Duplicate
        <DropdownHint keyBindings={hotKeyRegistry.request_showDuplicate} />
      </DropdownItem>

      {canGenerateCode && (
        <DropdownItem onClick={generateCode}>
          <i className="fa fa-code" /> Generate Code
          <DropdownHint
            keyBindings={hotKeyRegistry.request_showGenerateCodeEditor}
          />
        </DropdownItem>
      )}

      <DropdownItem onClick={togglePin}>
        <i className="fa fa-thumb-tack" /> {isPinned ? 'Unpin' : 'Pin'}
        <DropdownHint keyBindings={hotKeyRegistry.request_togglePin} />
      </DropdownItem>

      {canGenerateCode && (
        <DropdownItem onClick={copyAsCurl}>
          <i className="fa fa-copy" /> Copy as Curl
        </DropdownItem>
      )}

      <DropdownItem
        onClick={handleRename}
      >
        <i className="fa fa-edit" /> Rename
      </DropdownItem>

      <DropdownItem
        buttonClass={PromptButton}
        onClick={deleteRequest}
      >
        <i className="fa fa-trash-o" /> Delete
        <DropdownHint keyBindings={hotKeyRegistry.request_showDelete} />
      </DropdownItem>

      {actionPlugins.length > 0 && <DropdownDivider>Plugins</DropdownDivider>}
      {actionPlugins.map((plugin: RequestAction) => (
        <DropdownItem
          key={`${plugin.plugin.name}::${plugin.label}`}
          onClick={() => handlePluginClick(plugin)}
          stayOpenAfterClick
        >
          {loadingActions[plugin.label] ? (
            <i className="fa fa-refresh fa-spin" />
          ) : (
            <i className={classnames('fa', plugin.icon || 'fa-code')} />
          )}
          {plugin.label}
        </DropdownItem>
      ))}

      <DropdownDivider />

      <DropdownItem onClick={handleShowSettings}>
        <i className="fa fa-wrench" /> Settings
        <DropdownHint keyBindings={hotKeyRegistry.request_showSettings} />
      </DropdownItem>
    </Dropdown>
  );
});

RequestActionsDropdown.displayName = 'RequestActionsDropdown';
