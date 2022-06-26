import classnames from 'classnames';
import { HotKeyRegistry } from 'insomnia-common';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';

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
  handleCopyAsCurl: Function;
  handleDuplicateRequest: Function;
  handleGenerateCode: Function;
  handleSetRequestPinned: Function;
  handleShowSettings: Function;
  hotKeyRegistry: HotKeyRegistry;
  isPinned: Boolean;
  request: Request | GrpcRequest;
  requestGroup?: RequestGroup;
}

export const RequestActionsDropdown: React.FC<Props> = forwardRef<{show:()=>void; hide:()=>void}, Props>(({
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
  const dropdownRef = useRef<Dropdown>(null);
  const show = useCallback(() => {
    if (dropdownRef.current) {
      dropdownRef.current.show();
    }
  }, [dropdownRef]);
  const hide = useCallback(() => {
    if (dropdownRef.current) {
      dropdownRef.current.show();
    }
  }, [dropdownRef]);
  useImperativeHandle(ref, () => ({ show, hide }), [show, hide]);
  const [actionPlugins, setActionPlugins] = useState<RequestAction[]>([]);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const _onOpen = async () => {
    const actionPlugins = await getRequestActions();
    setActionPlugins(actionPlugins);
  };
  const _handlePluginClick = async (p: RequestAction) => {
    setLoadingActions({ ...loadingActions, [p.label]: true });

    try {
      const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : null;
      const context = {
        ...(pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER) as Record<string, any>),
        ...pluginContexts.data.init(activeProject._id),
        ...(pluginContexts.store.init(p.plugin) as Record<string, any>),
        ...(pluginContexts.network.init(activeEnvironmentId) as Record<string, any>),
      };
      await p.action(context, {
        request,
        requestGroup,
      });
    } catch (err) {
      showError({
        title: 'Plugin Action Failed',
        error: err,
      });
    }
    setLoadingActions({ ...loadingActions, [p.label]: false });
    hide();
  };
  // Can only generate code for regular requests, not gRPC requests
  const canGenerateCode = isRequest(request);
  return (
    <Dropdown ref={dropdownRef} onOpen={_onOpen}>
      <DropdownButton>
        <i className="fa fa-caret-down" />
      </DropdownButton>

      <DropdownItem onClick={() => handleDuplicateRequest(request)}>
        <i className="fa fa-copy" /> Duplicate
        <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_DUPLICATE.id]} />
      </DropdownItem>

      {canGenerateCode && (
        <DropdownItem onClick={() => handleGenerateCode(request)}>
          <i className="fa fa-code" /> Generate Code
          <DropdownHint
            keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_GENERATE_CODE_EDITOR.id]}
          />
        </DropdownItem>
      )}

      <DropdownItem onClick={() => handleSetRequestPinned(request, !isPinned)}>
        <i className="fa fa-thumb-tack" /> {isPinned ? 'Unpin' : 'Pin'}
        <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_TOGGLE_PIN.id]} />
      </DropdownItem>

      {canGenerateCode && (
        <DropdownItem onClick={() => handleCopyAsCurl(request)}>
          <i className="fa fa-copy" /> Copy as Curl
        </DropdownItem>
      )}

      <DropdownItem
        buttonClass={PromptButton}
        onClick={() => {
          incrementDeletedRequests();
          return requestOperations.remove(request);
        }}
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
          onClick={_handlePluginClick}
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
