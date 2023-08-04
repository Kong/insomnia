import * as contentDisposition from 'content-disposition';
import type { SaveDialogOptions } from 'electron';
import fs from 'fs';
import { extension as mimeExtension } from 'mime-types';
import path from 'path';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';
import { useInterval } from 'react-use';
import styled from 'styled-components';

import { database } from '../../common/database';
import { getContentDispositionHeader } from '../../common/misc';
import { getRenderContext, render, RENDER_PURPOSE_SEND } from '../../common/render';
import * as models from '../../models';
import { isEventStreamRequest, isRequest } from '../../models/request';
import * as network from '../../network/network';
import { convert } from '../../utils/importers/convert';
import { buildQueryStringFromParams, joinUrlAndQueryString } from '../../utils/url/querystring';
import { SegmentEvent } from '../analytics';
import { useReadyState } from '../hooks/use-ready-state';
import { useRequestPatcher } from '../hooks/use-request';
import { useRequestMetaPatcher } from '../hooks/use-request';
import { useTimeoutWhen } from '../hooks/useTimeoutWhen';
import { ConnectActionParams, RequestLoaderData } from '../routes/request';
import { RootLoaderData } from '../routes/root';
import { WorkspaceLoaderData } from '../routes/workspace';
import { Dropdown, DropdownButton, type DropdownHandle, DropdownItem, DropdownSection, ItemContent } from './base/dropdown';
import { OneLineEditor, OneLineEditorHandle } from './codemirror/one-line-editor';
import { MethodDropdown } from './dropdowns/method-dropdown';
import { createKeybindingsHandler, useDocBodyKeyboardShortcuts } from './keydown-binder';
import { GenerateCodeModal } from './modals/generate-code-modal';
import { showAlert, showModal, showPrompt } from './modals/index';
import { RequestRenderErrorModal } from './modals/request-render-error-modal';

const StyledDropdownButton = styled(DropdownButton)({
  '&:hover:not(:disabled)': {
    backgroundColor: 'var(--color-surprise)',
  },

  '&:focus:not(:disabled)': {
    backgroundColor: 'var(--color-surprise)',
  },
});

interface Props {
  handleAutocompleteUrls: () => Promise<string[]>;
  nunjucksPowerUserMode: boolean;
  onUrlChange: (url: string) => void;
  uniquenessKey: string;
  setLoading: (l: boolean) => void;
}

export interface RequestUrlBarHandle {
  focusInput: () => void;
}

export const RequestUrlBar = forwardRef<RequestUrlBarHandle, Props>(({
  handleAutocompleteUrls,
  onUrlChange,
  uniquenessKey,
  setLoading,
}, ref) => {
  const {
    activeWorkspace,
    activeEnvironment,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const {
    settings,
  } = useRouteLoaderData('root') as RootLoaderData;
  const { hotKeyRegistry } = settings;
  const { activeRequest, activeRequestMeta } = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const downloadPath = activeRequestMeta.downloadPath;
  const patchRequestMeta = useRequestMetaPatcher();
  const methodDropdownRef = useRef<DropdownHandle>(null);
  const dropdownRef = useRef<DropdownHandle>(null);
  const inputRef = useRef<OneLineEditorHandle>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleGenerateCode = () => {
    showModal(GenerateCodeModal, { request: activeRequest });
  };
  const focusInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focusEnd();
    }
  }, [inputRef]);

  useImperativeHandle(ref, () => ({ focusInput }), [focusInput]);

  const [currentInterval, setCurrentInterval] = useState<number | null>(null);
  const [currentTimeout, setCurrentTimeout] = useState<number | undefined>(undefined);

  async function setFilePathAndStoreInLocalStorage() {
    const options: SaveDialogOptions = {
      title: 'Select Download Location',
      buttonLabel: 'Save',
    };
    const defaultPath = window.localStorage.getItem('insomnia.sendAndDownloadLocation');

    if (defaultPath) {
      // NOTE: An error will be thrown if defaultPath is supplied but not a String
      options.defaultPath = defaultPath;
    }

    const { filePath } = await window.dialog.showSaveDialog(options);
    if (!filePath) {
      return null;
    }
    window.localStorage.setItem('insomnia.sendAndDownloadLocation', filePath);
    return filePath;
  }

  const sendThenSetFilePath = useCallback(async (filePath?: string) => {
    if (!activeRequest) {
      return;
    }

    // Update request stats
    models.stats.incrementExecutedRequests();
    window.main.trackSegmentEvent({
      event: SegmentEvent.requestExecute,
      properties: {
        preferredHttpVersion: settings.preferredHttpVersion,
        authenticationType: activeRequest.authentication?.type,
        mimeType: activeRequest.body.mimeType,
      },
    });
    setLoading(true);
    try {
      const responsePatch = await network.send(activeRequest._id, activeEnvironment._id);
      const headers = responsePatch.headers || [];
      const header = getContentDispositionHeader(headers);
      const nameFromHeader = header ? contentDisposition.parse(header.value).parameters.filename : null;

      if (
        responsePatch.bodyPath &&
        responsePatch.statusCode &&
        responsePatch.statusCode >= 200 &&
        responsePatch.statusCode < 300
      ) {
        const sanitizedExtension = responsePatch.contentType && mimeExtension(responsePatch.contentType);
        const extension = sanitizedExtension || 'unknown';
        const name =
          nameFromHeader || `${activeRequest.name.replace(/\s/g, '-').toLowerCase()}.${extension}`;
        let filename: string | null;

        if (filePath) {
          filename = path.join(filePath, name);
        } else {
          filename = await setFilePathAndStoreInLocalStorage();
        }

        if (!filename) {
          return;
        }

        const to = fs.createWriteStream(filename);
        const readStream = models.response.getBodyStream(responsePatch);

        if (!readStream || typeof readStream === 'string') {
          return;
        }

        readStream.pipe(to);

        readStream.on('end', async () => {
          responsePatch.error = `Saved to ${filename}`;
          await models.response.create(responsePatch, settings.maxHistoryResponses);
        });

        readStream.on('error', async err => {
          console.warn('Failed to download request after sending', responsePatch.bodyPath, err);
          await models.response.create(responsePatch, settings.maxHistoryResponses);
        });
      } else {
        // Save the bad responses so failures are shown still
        await models.response.create(responsePatch, settings.maxHistoryResponses);
      }
    } catch (err) {
      showAlert({
        title: 'Unexpected Request Failure',
        message: (
          <div>
            <p>The request failed due to an unhandled error:</p>
            <code className="wide selectable">
              <pre>{err.message}</pre>
            </code>
          </div>
        ),
      });
    } finally {
      setLoading(false);
    }
  }, [activeEnvironment._id, activeRequest, setLoading, settings.maxHistoryResponses, settings.preferredHttpVersion]);

  const handleSend = useCallback(async () => {
    if (!activeRequest) {
      return;
    }
    // Update request stats
    models.stats.incrementExecutedRequests();
    window.main.trackSegmentEvent({
      event: SegmentEvent.requestExecute,
      properties: {
        preferredHttpVersion: settings.preferredHttpVersion,
        authenticationType: activeRequest.authentication?.type,
        mimeType: activeRequest.body.mimeType,
      },
    });
    setLoading(true);
    try {
      const responsePatch = await network.send(activeRequest._id, activeEnvironment._id);
      const response = await models.response.create(responsePatch, settings.maxHistoryResponses);
      await patchRequestMeta(activeRequest._id, { activeResponseId: response._id });
    } catch (err) {
      if (err.type === 'render') {
        showModal(RequestRenderErrorModal, {
          request: activeRequest,
          error: err,
        });
      } else {
        showAlert({
          title: 'Unexpected Request Failure',
          message: (
            <div>
              <p>The request failed due to an unhandled error:</p>
              <code className="wide selectable">
                <pre>{err.message}</pre>
              </code>
            </div>
          ),
        });
      }
    }
    // Unset active response because we just made a new one
    await patchRequestMeta(activeRequest._id, { activeResponseId: null });
    setLoading(false);
  }, [activeEnvironment._id, activeRequest, setLoading, settings.maxHistoryResponses, settings.preferredHttpVersion, patchRequestMeta]);
  const fetcher = useFetcher();
  const { organizationId, projectId, workspaceId, requestId } = useParams() as { organizationId: string; projectId: string; workspaceId: string; requestId: string };
  const connect = (connectParams: ConnectActionParams) => {
    fetcher.submit(JSON.stringify(connectParams),
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/connect`,
        method: 'post',
        encType: 'application/json',
      });
  };
  const send = () => {
    setCurrentTimeout(undefined);
    if (downloadPath) {
      sendThenSetFilePath(downloadPath);
      return;
    }
    if (isEventStreamRequest(activeRequest)) {
      const startListening = async () => {
        const environmentId = activeEnvironment._id;
        const workspaceId = activeWorkspace._id;
        const renderContext = await getRenderContext({ request: activeRequest, environmentId, purpose: RENDER_PURPOSE_SEND });
        // Render any nunjucks tags in the url/headers/authentication settings/cookies
        const workspaceCookieJar = await models.cookieJar.getOrCreateForParentId(workspaceId);
        const rendered = await render({
          url: activeRequest.url,
          headers: activeRequest.headers,
          authentication: activeRequest.authentication,
          parameters: activeRequest.parameters.filter(p => !p.disabled),
          workspaceCookieJar,
        }, renderContext);
        connect({
          url: joinUrlAndQueryString(rendered.url, buildQueryStringFromParams(rendered.parameters)),
          headers: rendered.headers,
          authentication: rendered.authentication,
          cookieJar: rendered.workspaceCookieJar,
        });
      };
      startListening();
      return;
    }
    handleSend();
  };

  useInterval(send, currentInterval ? currentInterval : null);
  useTimeoutWhen(send, currentTimeout, !!currentTimeout);
  const patchRequest = useRequestPatcher();
  const handleStop = () => {
    if (isEventStreamRequest(activeRequest)) {
      window.main.curl.close({ requestId: activeRequest._id });
      return;
    }
    setCurrentInterval(null);
    setCurrentTimeout(undefined);
  };

  const handleSendOnInterval = useCallback(() => {
    showPrompt({
      inputType: 'decimal',
      title: 'Send on Interval',
      label: 'Interval in seconds',
      defaultValue: '3',
      submitName: 'Start',
      onComplete: seconds => {
        setCurrentInterval(+seconds * 1000);
      },
    });
  }, []);

  const handleSendAfterDelay = () => {
    showPrompt({
      inputType: 'decimal',
      title: 'Send After Delay',
      label: 'Delay in seconds',
      defaultValue: '3',
      onComplete: seconds => {
        setCurrentTimeout(+seconds * 1000);
      },
    });
  };

  const downloadAfterSend = useCallback(async () => {
    const { canceled, filePaths } = await window.dialog.showOpenDialog({
      title: 'Select Download Location',
      buttonLabel: 'Select',
      properties: ['openDirectory'],
    });
    if (canceled) {
      return;
    }
    patchRequestMeta(activeRequest._id, { downloadPath: filePaths[0] });
  }, [activeRequest._id, patchRequestMeta]);
  const handleClearDownloadLocation = () => patchRequestMeta(activeRequest._id, { downloadPath: null });

  useDocBodyKeyboardShortcuts({
    request_focusUrl: () => {
      inputRef.current?.selectAll();
    },
    request_send: () => {
      if (activeRequest.url) {
        send();
      }
    },
    request_toggleHttpMethodMenu: () => {
      methodDropdownRef.current?.toggle();
    },
    request_showOptions: () => {
      dropdownRef.current?.toggle(true);
    },
  });

  const lastPastedTextRef = useRef('');
  const handleImport = useCallback(async (text: string) => {
    // Allow user to paste any import file into the url. If it results in
    // only one item, it will overwrite the current request.
    try {
      const { data } = await convert(text);
      const { resources } = data;
      const r = resources[0];
      if (r && r._type === 'request' && activeRequest && isRequest(activeRequest)) {
        // Only pull fields that we want to update
        return database.update({
          ...activeRequest,
          modified: Date.now(),
          url: r.url,
          method: r.method,
          headers: r.headers,
          body: r.body,
          authentication: r.authentication,
          parameters: r.parameters,
        }, true); // Pass true to indicate that this is an import
      }
    } catch (error) {
      // Import failed, that's alright
      console.error(error);
    }
    return null;
  }, [activeRequest]);

  const handleUrlChange = useCallback(async (url: string) => {
    const pastedText = lastPastedTextRef.current;
    // If no pasted text in the queue, just fire the regular change handler
    if (!pastedText) {
      onUrlChange(url);
      return;
    }
    // Reset pasted text cache
    lastPastedTextRef.current = '';
    // Attempt to import the pasted text
    const importedRequest = await handleImport(pastedText);
    // Update depending on whether something was imported
    if (!importedRequest) {
      onUrlChange(url);
    }
  }, [handleImport, onUrlChange]);

  const handleUrlPaste = useCallback((event: ClipboardEvent) => {
    // NOTE: We're not actually doing the import here to avoid races with onChange
    lastPastedTextRef.current = event.clipboardData?.getData('text/plain') || '';
  }, []);

  const handleSendDropdownHide = useCallback(() => {
    buttonRef.current?.blur();
  }, []);
  const buttonText = isEventStreamRequest(activeRequest) ? 'Connect' : (downloadPath ? 'Download' : 'Send');
  const { url, method } = activeRequest;
  const isEventStreamOpen = useReadyState({ requestId: activeRequest._id, protocol: 'curl' });
  const isCancellable = currentInterval || currentTimeout || isEventStreamOpen;
  return (
    <div className="urlbar">
      <MethodDropdown
        ref={methodDropdownRef}
        onChange={method => patchRequest(requestId, { method })}
        method={method}
      />
      <div className="urlbar__flex__right">
        <OneLineEditor
          id="request-url-bar"
          key={uniquenessKey}
          ref={inputRef}
          onPaste={handleUrlPaste}
          type="text"
          getAutocompleteConstants={handleAutocompleteUrls}
          placeholder="https://api.myproduct.com/v1/users"
          defaultValue={url}
          onChange={handleUrlChange}
          onKeyDown={createKeybindingsHandler({
            'Enter': () => send(),
          })}
        />
        {isCancellable ? (
          <button
            type="button"
            className="urlbar__send-btn"
            onClick={handleStop}
          >
            {isEventStreamRequest(activeRequest) ? 'Disconnect' : 'Cancel'}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="urlbar__send-btn"
              onClick={send}
            >
                {buttonText}</button>
              {isEventStreamRequest(activeRequest) ? null : (<Dropdown
                key="dropdown"
                className="tall"
                ref={dropdownRef}
                aria-label="Request Options"
                onClose={handleSendDropdownHide}
                closeOnSelect={false}
                triggerButton={
                  <StyledDropdownButton
                    className="urlbar__send-context"
                    removeBorderRadius={true}
                  >
                    <i className="fa fa-caret-down" />
                  </StyledDropdownButton>
                }
              >
                <DropdownSection
                  aria-label="Basic Section"
                  title="Basic"
                >
                  <DropdownItem aria-label="send-now">
                    <ItemContent
                      icon="arrow-circle-o-right"
                      label="Send Now"
                      hint={hotKeyRegistry.request_send}
                      onClick={send}
                    />
                  </DropdownItem>
                  <DropdownItem aria-label='Generate Client Code'>
                    <ItemContent
                      icon="code"
                      label="Generate Client Code"
                      onClick={handleGenerateCode}
                    />
                  </DropdownItem>
                </DropdownSection>
                <DropdownSection
                  aria-label="Advanced Section"
                  title="Advanced"
                >
                  <DropdownItem aria-label='Send After Delay'>
                    <ItemContent
                      icon="clock-o"
                      label="Send After Delay"
                      onClick={handleSendAfterDelay}
                    />
                  </DropdownItem>
                  <DropdownItem aria-label='Repeat on Interval'>
                    <ItemContent
                      icon="repeat"
                      label="Repeat on Interval"
                      onClick={handleSendOnInterval}
                    />
                  </DropdownItem>
                  {downloadPath ? (
                    <DropdownItem aria-label='Stop Auto-Download'>
                      <ItemContent
                        icon="stop-circle"
                        label="Stop Auto-Download"
                        withPrompt
                        onClick={handleClearDownloadLocation}
                      />
                    </DropdownItem>) :
                    (<DropdownItem aria-label='Download After Send'>
                      <ItemContent
                        icon="download"
                        label="Download After Send"
                        onClick={downloadAfterSend}
                      />
                    </DropdownItem>
                    )}
                  <DropdownItem aria-label='Send And Download'>
                    <ItemContent
                      icon="download"
                      label="Send And Download"
                      onClick={sendThenSetFilePath}
                    />
                  </DropdownItem>
                </DropdownSection>
              </Dropdown>)}
          </>
        )}
      </div>
    </div>
  );
});

RequestUrlBar.displayName = 'RequestUrlBar';
