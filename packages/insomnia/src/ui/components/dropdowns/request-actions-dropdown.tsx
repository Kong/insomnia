import classnames from 'classnames';
import { HotKeyRegistry } from 'insomnia-common';
import React, { forwardRef, useCallback, useState } from 'react';

import { hotKeyRefs } from '../../../common/hotkeys';
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
import { Dropdown, DropdownProps } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { PromptButton } from '../base/prompt-button';
import { showError } from '../modals';

interface Props extends Pick<DropdownProps, 'right'> {
  activeEnvironment?: Environment | null;
  activeProject: Project;
  handleSetRequestPinned: Function;
  handleDuplicateRequest: Function;
  handleGenerateCode: Function;
  handleCopyAsCurl: Function;
  handleShowSettings: () => void;
  hotKeyRegistry: HotKeyRegistry;
  isPinned: Boolean;
  request: Request | GrpcRequest;
  requestGroup?: RequestGroup;
}

export const RequestActionsDropdown = forwardRef<Dropdown, Props>(({
  activeEnvironment,
  activeProject,
  handleCopyAsCurl,
  handleDuplicateRequest,
  handleGenerateCode,
  handleSetRequestPinned,
  handleShowSettings,
  hotKeyRegistry,
  isPinned,
  request,
  requestGroup,
}, ref) => {
  const [actionPlugins, setActionPlugins] = useState<RequestAction[]>([]);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});

  const onOpen = useCallback(() => {
    const fn = async () => {
      const actionPlugins = await getRequestActions();
      setActionPlugins(actionPlugins);
    };
    fn();
  }, []);

  const handlePluginClick = useCallback(({ plugin, action, label }: RequestAction) => {
    const fn = async () => {
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
    };
    fn();
  }, [request, activeEnvironment, requestGroup, loadingActions, activeProject._id, ref]);

  const duplicate = useCallback(() => {
    handleDuplicateRequest(request);
  }, [handleDuplicateRequest, request]);

  const generateCode = useCallback(() => {
    handleGenerateCode(request);
  }, [handleGenerateCode, request]);

  const copyAsCurl = useCallback(() => {
    handleCopyAsCurl(request);
  }, [handleCopyAsCurl, request]);

  const togglePin = useCallback(() => {
    handleSetRequestPinned(request, !isPinned);
  }, [handleSetRequestPinned, isPinned, request]);

  const deleteRequest = useCallback(() => {
    incrementDeletedRequests();
    requestOperations.remove(request);
  }, [request]);

  // Can only generate code for regular requests, not gRPC requests
  const canGenerateCode = isRequest(request);
  return (
    <Dropdown ref={ref} onOpen={onOpen}>
      <DropdownButton>
        <i className="fa fa-caret-down" />
      </DropdownButton>

      <DropdownItem onClick={duplicate}>
        <i className="fa fa-copy" /> Duplicate
        <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_DUPLICATE.id]} />
      </DropdownItem>

      {canGenerateCode && (
        <DropdownItem onClick={generateCode}>
          <i className="fa fa-code" /> Generate Code
          <DropdownHint
            keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_GENERATE_CODE_EDITOR.id]}
          />
        </DropdownItem>
      )}

      <DropdownItem onClick={togglePin}>
        <i className="fa fa-thumb-tack" /> {isPinned ? 'Unpin' : 'Pin'}
        <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_TOGGLE_PIN.id]} />
      </DropdownItem>

      {canGenerateCode && (
        <DropdownItem onClick={copyAsCurl}>
          <i className="fa fa-copy" /> Copy as Curl
        </DropdownItem>
      )}

      <DropdownItem
        buttonClass={PromptButton}
        onClick={deleteRequest}
        addIcon
      >
        <i className="fa fa-trash-o" /> Delete
        <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_DELETE.id]} />
      </DropdownItem>

      {actionPlugins.length > 0 && <DropdownDivider>Plugins</DropdownDivider>}
      {actionPlugins.map((plugin: RequestAction) => (
        <DropdownItem
          key={`${plugin.plugin.name}::${plugin.label}`}
          value={plugin}
          onClick={handlePluginClick}
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
        <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_SETTINGS.id]} />
      </DropdownItem>
    </Dropdown>
  );
});

RequestActionsDropdown.displayName = 'RequestActionsDropdown';
