import type { SaveDialogOptions } from 'electron';
import fs from 'fs';
import { extension as mimeExtension } from 'mime-types';
import path from 'path';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useInterval } from 'react-use';

import { SegmentEvent, trackSegmentEvent } from '../../common/analytics';
import { hotKeyRefs } from '../../common/hotkeys';
import { executeHotKey } from '../../common/hotkeys-listener';
import { getContentDispositionHeader } from '../../common/misc';
import * as models from '../../models';
import { update } from '../../models/helpers/request-operations';
import type { Request } from '../../models/request';
import * as network from '../../network/network';
import { updateRequestMetaByParentId } from '../hooks/create-request';
import { useTimeoutWhen } from '../hooks/useTimeoutWhen';
import { loadRequestStart, loadRequestStop } from '../redux/modules/global';
import { selectActiveEnvironment, selectHotKeyRegistry, selectResponseDownloadPath, selectSettings } from '../redux/selectors';
import { type DropdownHandle, Dropdown } from './base/dropdown/dropdown';
import { DropdownButton } from './base/dropdown/dropdown-button';
import { DropdownDivider } from './base/dropdown/dropdown-divider';
import { DropdownHint } from './base/dropdown/dropdown-hint';
import { DropdownItem } from './base/dropdown/dropdown-item';
import { PromptButton } from './base/prompt-button';
import { OneLineEditor } from './codemirror/one-line-editor';
import { MethodDropdown } from './dropdowns/method-dropdown';
import { KeydownBinder } from './keydown-binder';
import { GenerateCodeModal } from './modals/generate-code-modal';
import { showAlert, showModal, showPrompt } from './modals/index';
import { RequestRenderErrorModal } from './modals/request-render-error-modal';

interface Props {
  handleAutocompleteUrls: () => Promise<string[]>;
  handleImport: Function;
  nunjucksPowerUserMode: boolean;
  onUrlChange: (r: Request, url: string) => Promise<Request>;
  request: Request;
  uniquenessKey: string;
}

export interface RequestUrlBarHandle {
  focusInput: () => void;
}
export const RequestUrlBar = forwardRef<RequestUrlBarHandle, Props>(({
  handleAutocompleteUrls,
  handleImport,
  onUrlChange,
  request,
  uniquenessKey,
}, ref) => {
  const downloadPath = useSelector(selectResponseDownloadPath);
  const hotKeyRegistry = useSelector(selectHotKeyRegistry);
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const settings = useSelector(selectSettings);
  const dispatch = useDispatch();
  const methodDropdownRef = useRef<DropdownHandle>(null);
  const dropdownRef = useRef<DropdownHandle>(null);
  const inputRef = useRef<OneLineEditor>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleGenerateCode = () => {
    showModal(GenerateCodeModal, request);
  };
  const focusInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus(true);
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
    if (!request || !activeEnvironment) {
      return;
    }

    // Update request stats
    models.stats.incrementExecutedRequests();
    trackSegmentEvent(SegmentEvent.requestExecute, {
      preferredHttpVersion: settings.preferredHttpVersion,
      authenticationType: request.authentication?.type,
      mimeType: request.body.mimeType,
    });
    // Start loading
    dispatch(loadRequestStart(request._id));

    try {
      const responsePatch = await network.send(request._id, activeEnvironment._id);
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
        // @ts-expect-error -- TSCONVERSION
        const readStream = models.response.getBodyStream(responsePatch);

        if (!readStream) {
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
      // Stop loading
      dispatch(loadRequestStop(request._id));
    }
  }, [activeEnvironment, dispatch, request, settings.maxHistoryResponses, settings.preferredHttpVersion]);

  const handleSend = useCallback(async () => {
    if (!request || !activeEnvironment) {
      return;
    }
    // Update request stats
    models.stats.incrementExecutedRequests();
    trackSegmentEvent(SegmentEvent.requestExecute, {
      preferredHttpVersion: settings.preferredHttpVersion,
      authenticationType: request.authentication?.type,
      mimeType: request.body.mimeType,
    });
    dispatch(loadRequestStart(request._id));
    try {
      const responsePatch = await network.send(request._id, activeEnvironment._id);
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
    // Stop loading
    dispatch(loadRequestStop(request._id));
  }, [activeEnvironment, dispatch, request, settings.maxHistoryResponses, settings.preferredHttpVersion]);

  const send = useCallback(() => {
    setCurrentTimeout(undefined);
    if (downloadPath) {
      sendThenSetFilePath(downloadPath);
    } else {
      handleSend();
    }
    inputRef.current?.focus(true);
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

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Enter' && request.url) {
      send();
      return;
    }
    if (!inputRef.current) {
      return;
    }
    executeHotKey(event, hotKeyRefs.REQUEST_FOCUS_URL, () => {
      inputRef.current?.focus();
      inputRef.current?.selectAll();
    });
    executeHotKey(event, hotKeyRefs.REQUEST_TOGGLE_HTTP_METHOD_MENU, () => {
      methodDropdownRef.current?.toggle();
    });
    executeHotKey(event, hotKeyRefs.REQUEST_SHOW_OPTIONS, () => {
      dropdownRef.current?.toggle(true);
    });
    executeHotKey(event, hotKeyRefs.REQUEST_SEND, () => {
      send();
    });
  }, [request.url, send]);
  const handleGlobalKeyDown = useCallback(async (event: KeyboardEvent) => {
    executeHotKey(event, hotKeyRefs.REQUEST_SEND, () => {
      send();
    });
  }, [send]);

  const [lastPastedText, setLastPastedText] = useState<string>();
  const handleUrlChange = useCallback(async (url: string) => {
    const pastedText = lastPastedText;
    // If no pasted text in the queue, just fire the regular change handler
    if (!pastedText) {
      onUrlChange(request, url);
      return;
    }
    // Reset pasted text cache
    setLastPastedText(undefined);
    // Attempt to import the pasted text
    const importedRequest = await handleImport(pastedText);
    // Update depending on whether something was imported
    if (!importedRequest) {
      onUrlChange(request, url);
    }
  }, [handleImport, lastPastedText, onUrlChange, request]);
  const handleUrlPaste = useCallback((event: ClipboardEvent) => {
    // NOTE: We're not actually doing the import here to avoid races with onChange
    setLastPastedText(event.clipboardData?.getData('text/plain'));
  }, []);
  const onMethodChange = useCallback((method: string) => update(request, { method }), [request]);

  const handleSendDropdownHide = useCallback(() => {
    buttonRef.current?.blur();
  }, []);

  const { url, method } = request;
  const isCancellable = currentInterval || currentTimeout;
  return (
    <KeydownBinder onKeydown={handleGlobalKeyDown}>
      <KeydownBinder onKeydown={handleKeyDown} scoped>
        <div className="urlbar">
          <MethodDropdown
            ref={methodDropdownRef}
            onChange={methodValue => onMethodChange(methodValue)}
            method={method}
          />
          <div className="urlbar__flex__right">
            <OneLineEditor
              key={uniquenessKey}
              ref={inputRef}
              onPaste={handleUrlPaste}
              forceEditor
              type="text"
              getAutocompleteConstants={handleAutocompleteUrls}
              placeholder="https://api.myproduct.com/v1/users"
              defaultValue={url}
              onChange={handleUrlChange}
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
                  right
                  ref={dropdownRef}
                  onHide={handleSendDropdownHide}
                >
                  <DropdownButton
                    ref={buttonRef}
                    className="urlbar__send-context"
                    onClick={() => dropdownRef.current?.show()}
                  >
                    <i className="fa fa-caret-down" />
                  </DropdownButton>
                  <DropdownDivider>Basic</DropdownDivider>
                  <DropdownItem onClick={send}>
                    <i className="fa fa-arrow-circle-o-right" /> Send Now
                    <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SEND.id]} />
                  </DropdownItem>
                  <DropdownItem onClick={handleGenerateCode}>
                    <i className="fa fa-code" /> Generate Client Code
                  </DropdownItem>
                  <DropdownDivider>Advanced</DropdownDivider>
                  <DropdownItem onClick={handleSendAfterDelay}>
                    <i className="fa fa-clock-o" /> Send After Delay
                  </DropdownItem>
                  <DropdownItem onClick={handleSendOnInterval}>
                    <i className="fa fa-repeat" /> Repeat on Interval
                  </DropdownItem>
                  {downloadPath ? (
                    <DropdownItem
                      stayOpenAfterClick
                      addIcon
                      buttonClass={PromptButton}
                      onClick={handleClearDownloadLocation}
                    >
                      <i className="fa fa-stop-circle" /> Stop Auto-Download
                    </DropdownItem>
                  ) : (
                    <DropdownItem onClick={downloadAfterSend}>
                      <i className="fa fa-download" /> Download After Send
                    </DropdownItem>
                  )}
                  <DropdownItem onClick={() => sendThenSetFilePath()}>
                    <i className="fa fa-download" /> Send And Download
                  </DropdownItem>
                </Dropdown>
              </>
            )}
          </div>
        </div>
      </KeydownBinder>
    </KeydownBinder>
  );
});

RequestUrlBar.displayName = 'RequestUrlBar';
