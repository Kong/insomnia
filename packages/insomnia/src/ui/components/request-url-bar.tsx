import type { SaveDialogOptions } from 'electron';
import fs from 'fs';
import { extension as mimeExtension } from 'mime-types';
import path from 'path';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useInterval } from 'react-use';
import styled from 'styled-components';

import { database } from '../../common/database';
import { getContentDispositionHeader } from '../../common/misc';
import * as models from '../../models';
import { update } from '../../models/helpers/request-operations';
import { isRequest, Request } from '../../models/request';
import * as network from '../../network/network';
import { convert } from '../../utils/importers/convert';
import { SegmentEvent, trackSegmentEvent } from '../analytics';
import { updateRequestMetaByParentId } from '../hooks/create-request';
import { useTimeoutWhen } from '../hooks/useTimeoutWhen';
import { selectActiveEnvironment, selectActiveRequest, selectHotKeyRegistry, selectResponseDownloadPath, selectSettings } from '../redux/selectors';
import { type DropdownHandle, Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from './base/dropdown';
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
  onUrlChange: (r: Request, url: string) => Promise<Request>;
  request: Request;
  uniquenessKey: string;
  setLoading: (l: boolean) => void;
}

export interface RequestUrlBarHandle {
  focusInput: () => void;
}

export const RequestUrlBar = forwardRef<RequestUrlBarHandle, Props>(({
  handleAutocompleteUrls,
  onUrlChange,
  request,
  uniquenessKey,
  setLoading,
}, ref) => {
  const downloadPath = useSelector(selectResponseDownloadPath);
  const hotKeyRegistry = useSelector(selectHotKeyRegistry);
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const activeRequest = useSelector(selectActiveRequest);
  const settings = useSelector(selectSettings);
  const methodDropdownRef = useRef<DropdownHandle>(null);
  const dropdownRef = useRef<DropdownHandle>(null);
  const inputRef = useRef<OneLineEditorHandle>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleGenerateCode = () => {
    showModal(GenerateCodeModal, { request });
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
    if (!request) {
      return;
    }

    // Update request stats
    models.stats.incrementExecutedRequests();
    trackSegmentEvent(SegmentEvent.requestExecute, {
      preferredHttpVersion: settings.preferredHttpVersion,
      authenticationType: request.authentication?.type,
      mimeType: request.body.mimeType,
    });
    setLoading(true);
    try {
      const responsePatch = await network.send(request._id, activeEnvironment?._id);
      const headers = responsePatch.headers || [];
      const header = getContentDispositionHeader(headers);
      const nameFromHeader = header ? header.value : null;

      if (
        responsePatch.bodyPath &&
        responsePatch.statusCode &&
        responsePatch.statusCode >= 200 &&
        responsePatch.statusCode < 300
      ) {
        const sanitizedExtension = responsePatch.contentType && mimeExtension(responsePatch.contentType);
        const extension = sanitizedExtension || 'unknown';
        const name =
          nameFromHeader || `${request.name.replace(/\s/g, '-').toLowerCase()}.${extension}`;
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
      // Unset active response because we just made a new one
      await updateRequestMetaByParentId(request._id, { activeResponseId: null });
      setLoading(false);
    }
  }, [activeEnvironment?._id, request, setLoading, settings.maxHistoryResponses, settings.preferredHttpVersion]);

  const handleSend = useCallback(async () => {
    if (!request) {
      return;
    }
    // Update request stats
    models.stats.incrementExecutedRequests();
    trackSegmentEvent(SegmentEvent.requestExecute, {
      preferredHttpVersion: settings.preferredHttpVersion,
      authenticationType: request.authentication?.type,
      mimeType: request.body.mimeType,
    });
    setLoading(true);
    try {
      const responsePatch = await network.send(request._id, activeEnvironment?._id);
      await models.response.create(responsePatch, settings.maxHistoryResponses);
    } catch (err) {
      if (err.type === 'render') {
        showModal(RequestRenderErrorModal, {
          request,
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
    await updateRequestMetaByParentId(request._id, { activeResponseId: null });
    setLoading(false);
  }, [activeEnvironment?._id, request, setLoading, settings.maxHistoryResponses, settings.preferredHttpVersion]);

  const send = useCallback(() => {
    setCurrentTimeout(undefined);
    if (downloadPath) {
      sendThenSetFilePath(downloadPath);
    } else {
      handleSend();
    }
  }, [downloadPath, handleSend, sendThenSetFilePath]);

  useInterval(send, currentInterval ? currentInterval : null);
  useTimeoutWhen(send, currentTimeout, !!currentTimeout);
  const handleStop = () => {
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
    updateRequestMetaByParentId(request._id, { downloadPath: filePaths[0] });
  }, [request._id]);
  const handleClearDownloadLocation = () => updateRequestMetaByParentId(request._id, { downloadPath: null });

  useDocBodyKeyboardShortcuts({
    request_focusUrl: () => {
      inputRef.current?.selectAll();
    },
    request_send: () => {
      if (request.url) {
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
        },
        // Pass true to indicate that this is an import
        true
        );
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
      onUrlChange(request, url);
      return;
    }
    // Reset pasted text cache
    lastPastedTextRef.current = '';
    // Attempt to import the pasted text
    const importedRequest = await handleImport(pastedText);
    // Update depending on whether something was imported
    if (!importedRequest) {
      onUrlChange(request, url);
    }
  }, [handleImport, onUrlChange, request]);

  const handleUrlPaste = useCallback((event: ClipboardEvent) => {
    // NOTE: We're not actually doing the import here to avoid races with onChange
    lastPastedTextRef.current = event.clipboardData?.getData('text/plain') || '';
  }, []);

  const onMethodChange = useCallback((method: string) => update(request, { method }), [request]);

  const handleSendDropdownHide = useCallback(() => {
    buttonRef.current?.blur();
  }, []);

  const { url, method } = request;
  const isCancellable = currentInterval || currentTimeout;
  return (
    <div className="urlbar">
      <MethodDropdown
        ref={methodDropdownRef}
        onChange={methodValue => onMethodChange(methodValue)}
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
            className="urlbar__send-btn danger"
            onClick={handleStop}
          >
            Cancel
          </button>
        ) : (
          <>
            <button
              type="button"
              className="urlbar__send-btn"
              onClick={send}
            >
              {downloadPath ? 'Download' : 'Send'}
            </button>
            <Dropdown
              key="dropdown"
              className="tall"
              ref={dropdownRef}
              aria-label="Request Options"
              onClose={handleSendDropdownHide}
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
            </Dropdown>
          </>
        )}
      </div>
    </div>
  );
});

RequestUrlBar.displayName = 'RequestUrlBar';
