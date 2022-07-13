import { HotKeyRegistry } from 'insomnia-common';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useInterval } from 'react-use';

import { hotKeyRefs } from '../../common/hotkeys';
import { executeHotKey } from '../../common/hotkeys-listener';
import type { Request } from '../../models/request';
import { useTimeoutWhen } from '../hooks/useTimeoutWhen';
import { Dropdown } from './base/dropdown/dropdown';
import { DropdownButton } from './base/dropdown/dropdown-button';
import { DropdownDivider } from './base/dropdown/dropdown-divider';
import { DropdownHint } from './base/dropdown/dropdown-hint';
import { DropdownItem } from './base/dropdown/dropdown-item';
import { PromptButton } from './base/prompt-button';
import { OneLineEditor } from './codemirror/one-line-editor';
import { MethodDropdown } from './dropdowns/method-dropdown';
import { KeydownBinder } from './keydown-binder';
import { showPrompt } from './modals/index';

interface Props {
  handleAutocompleteUrls: () => Promise<string[]>;
  handleGenerateCode: Function;
  handleImport: Function;
  handleSend: () => void;
  handleSendAndDownload: (filepath?: string) => Promise<void>;
  handleUpdateDownloadPath: Function;
  nunjucksPowerUserMode: boolean;
  onMethodChange: (r: Request, method: string) => Promise<Request>;
  onUrlChange: (r: Request, url: string) => Promise<Request>;
  request: Request;
  uniquenessKey: string;
  hotKeyRegistry: HotKeyRegistry;
  downloadPath: string | null;
}

export interface RequestUrlBarHandle {
  focusInput: () => void;
}
export const RequestUrlBar = forwardRef<RequestUrlBarHandle, Props>(({
  downloadPath,
  handleAutocompleteUrls,
  handleImport,
  handleGenerateCode,
  handleSend,
  handleSendAndDownload,
  handleUpdateDownloadPath,
  hotKeyRegistry,
  onMethodChange,
  onUrlChange,
  request,
  uniquenessKey,
}, ref) => {

  const methodDropdownRef = useRef<Dropdown>(null);
  const dropdownRef = useRef<Dropdown>(null);
  const inputRef = useRef<OneLineEditor>(null);

  const focusInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus(true);
    }
  }, [inputRef]);

  useImperativeHandle(ref, () => ({ focusInput }), [focusInput]);

  const [currentInterval, setCurrentInterval] = useState<number | null>(null);
  const [currentTimeout, setCurrentTimeout] = useState<number | undefined>(undefined);

  const send = useCallback(() => {
    setCurrentTimeout(undefined);
    if (downloadPath) {
      handleSendAndDownload(downloadPath);
    } else {
      handleSend();
    }
  }, [downloadPath, handleSend, handleSendAndDownload]);

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

  const handleSetDownloadLocation = useCallback(async () => {
    const { canceled, filePaths } = await window.dialog.showOpenDialog({
      title: 'Select Download Location',
      buttonLabel: 'Select',
      properties: ['openDirectory'],
    });
    if (canceled) {
      return;
    }
    handleUpdateDownloadPath(request._id, filePaths[0]);
  }, [handleUpdateDownloadPath, request._id]);
  const handleClearDownloadLocation = () => handleUpdateDownloadPath(request._id, null);

  const handleKeyDown = useCallback(async (event: KeyboardEvent) => {
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
  }, [request.url, send]);

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

  const { url, method } = request;
  const isCancellable = currentInterval || currentTimeout;
  return (
    <KeydownBinder onKeydown={handleKeyDown} scoped>
      <div className="urlbar">
        <MethodDropdown
          ref={methodDropdownRef}
          onChange={(methodValue: string) => onMethodChange(request, methodValue)}
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
              <Dropdown key="dropdown" className="tall" right ref={dropdownRef}>
                <DropdownButton
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
                  <DropdownItem onClick={handleSetDownloadLocation}>
                    <i className="fa fa-download" /> Download After Send
                  </DropdownItem>
                )}
                <DropdownItem onClick={handleSendAndDownload}>
                  <i className="fa fa-download" /> Send And Download
                </DropdownItem>
              </Dropdown>
            </>
          )}
        </div>
      </div>
    </KeydownBinder>
  );
});

RequestUrlBar.displayName = 'RequestUrlBar';
