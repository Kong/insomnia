import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { OpenDialogOptions, remote } from 'electron';
import React, { PureComponent, ReactNode } from 'react';

import { AUTOBIND_CFG, DEBOUNCE_MILLIS, isMac } from '../../common/constants';
import type { HotKeyRegistry } from '../../common/hotkeys';
import { hotKeyRefs } from '../../common/hotkeys';
import { executeHotKey } from '../../common/hotkeys-listener';
import { HandleGetRenderContext, HandleRender } from '../../common/render';
import type { Request } from '../../models/request';
import { Dropdown } from './base/dropdown/dropdown';
import { DropdownButton } from './base/dropdown/dropdown-button';
import { DropdownDivider } from './base/dropdown/dropdown-divider';
import { DropdownHint } from './base/dropdown/dropdown-hint';
import { DropdownItem } from './base/dropdown/dropdown-item';
import PromptButton from './base/prompt-button';
import OneLineEditor from './codemirror/one-line-editor';
import MethodDropdown from './dropdowns/method-dropdown';
import KeydownBinder from './keydown-binder';
import { showPrompt } from './modals/index';

interface Props {
  handleAutocompleteUrls: () => Promise<string[]>;
  handleGenerateCode: Function;
  handleGetRenderContext: HandleGetRenderContext;
  handleImport: Function;
  handleRender: HandleRender;
  handleSend: () => void;
  handleSendAndDownload: (filepath?: string) => Promise<void>;
  handleUpdateDownloadPath: Function;
  isVariableUncovered: boolean;
  nunjucksPowerUserMode: boolean;
  onMethodChange: (r: Request, method: string) => Promise<Request>;
  onUrlChange: (r: Request, url: string) => Promise<Request>;
  request: Request;
  uniquenessKey: string;
  hotKeyRegistry: HotKeyRegistry;
  downloadPath: string | null;
}

interface State {
  currentInterval: number | null;
  currentTimeout: number | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class RequestUrlBar extends PureComponent<Props, State> {
  _urlChangeDebounceTimeout: NodeJS.Timeout | null = null;
  _sendTimeout: NodeJS.Timeout | null = null;
  _sendInterval: NodeJS.Timeout | null = null;
  _dropdown: Dropdown | null = null;
  _methodDropdown: MethodDropdown | null = null;
  _input: OneLineEditor | null = null;
  state: State = {
    currentInterval: null,
    currentTimeout: null,
  };

  _lastPastedText?: string;

  _setDropdownRef(n: Dropdown) {
    this._dropdown = n;
  }

  _setMethodDropdownRef(n: MethodDropdown) {
    this._methodDropdown = n;
  }

  _setInputRef(n: OneLineEditor) {
    this._input = n;
  }

  _handleMetaClickSend(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    this._dropdown?.show();
  }

  _handleFormSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();

    this._handleSend();
  }

  _handleMethodChange(method: string) {
    this.props.onMethodChange(this.props.request, method);
  }

  _handleUrlChange(url: string) {
    if (this._urlChangeDebounceTimeout !== null) {
      clearTimeout(this._urlChangeDebounceTimeout);
    }
    this._urlChangeDebounceTimeout = setTimeout(async () => {
      const pastedText = this._lastPastedText;

      // If no pasted text in the queue, just fire the regular change handler
      if (!pastedText) {
        this.props.onUrlChange(this.props.request, url);
        return;
      }

      // Reset pasted text cache
      this._lastPastedText = undefined;
      // Attempt to import the pasted text
      const importedRequest = await this.props.handleImport(pastedText);

      // Update depending on whether something was imported
      if (!importedRequest) {
        this.props.onUrlChange(this.props.request, url);
      }
    }, DEBOUNCE_MILLIS);
  }

  _handleUrlPaste(e: ClipboardEvent) {
    // NOTE: We're not actually doing the import here to avoid races with onChange
    this._lastPastedText = e.clipboardData?.getData('text/plain');
  }

  _handleGenerateCode() {
    this.props.handleGenerateCode();
  }

  async _handleSetDownloadLocation() {
    const { request } = this.props;
    const options: OpenDialogOptions = {
      title: 'Select Download Location',
      buttonLabel: 'Select',
      properties: ['openDirectory'],
    };
    const { canceled, filePaths } = await remote.dialog.showOpenDialog(options);

    if (canceled) {
      return;
    }

    this.props.handleUpdateDownloadPath(request._id, filePaths[0]);
  }

  _handleClearDownloadLocation() {
    const { request } = this.props;
    this.props.handleUpdateDownloadPath(request._id, null);
  }

  async _handleKeyDown(e: KeyboardEvent) {
    if (!this._input) {
      return;
    }

    executeHotKey(e, hotKeyRefs.REQUEST_FOCUS_URL, () => {
      this._input?.focus();
      this._input?.selectAll();
    });
    executeHotKey(e, hotKeyRefs.REQUEST_TOGGLE_HTTP_METHOD_MENU, () => {
      this._methodDropdown?.toggle();
    });
    executeHotKey(e, hotKeyRefs.REQUEST_SHOW_OPTIONS, () => {
      this._dropdown?.toggle(true);
    });
  }

  _handleSend() {
    // Don't stop interval because duh, it needs to keep going!
    // XXX this._handleStopInterval(); XXX
    this._handleStopTimeout();

    const { downloadPath } = this.props;

    if (downloadPath) {
      this.props.handleSendAndDownload(downloadPath);
    } else {
      this.props.handleSend();
    }
  }

  _handleClickSendAndDownload() {
    this.props.handleSendAndDownload();
  }

  _handleSendAfterDelay() {
    showPrompt({
      inputType: 'decimal',
      title: 'Send After Delay',
      label: 'Delay in seconds',
      // @ts-expect-error TSCONVERSION string vs number issue
      defaultValue: 3,
      submitName: 'Start',
      onComplete: seconds => {
        this._handleStopTimeout();

        // @ts-expect-error TSCONVERSION string vs number issue
        this._sendTimeout = setTimeout(this._handleSend, seconds * 1000);
        this.setState({
          // @ts-expect-error TSCONVERSION string vs number issue
          currentTimeout: seconds,
        });
      },
    });
  }

  _handleSendOnInterval() {
    showPrompt({
      inputType: 'decimal',
      title: 'Send on Interval',
      label: 'Interval in seconds',
      // @ts-expect-error TSCONVERSION string vs number issue
      defaultValue: 3,
      submitName: 'Start',
      onComplete: seconds => {
        this._handleStopInterval();

        // @ts-expect-error TSCONVERSION string vs number issue
        this._sendInterval = setInterval(this._handleSend, seconds * 1000);
        this.setState({
          // @ts-expect-error TSCONVERSION string vs number issue
          currentInterval: seconds,
        });
      },
    });
  }

  _handleStopInterval() {
    if (this._sendInterval) {
      clearInterval(this._sendInterval);
    }

    if (this.state.currentInterval) {
      this.setState({
        currentInterval: null,
      });
    }
  }

  _handleStopTimeout() {
    if (this._sendTimeout !== null) {
      clearTimeout(this._sendTimeout);
    }

    if (this.state.currentTimeout) {
      this.setState({
        currentTimeout: null,
      });
    }
  }

  _handleResetTimeouts() {
    this._handleStopTimeout();

    this._handleStopInterval();
  }

  _handleClickSend(e: React.MouseEvent<HTMLButtonElement>) {
    const metaPressed = isMac() ? e.metaKey : e.ctrlKey;

    // If we're pressing a meta key, let the dropdown open
    if (metaPressed) {
      return;
    }

    // If we're not pressing a meta key, cancel dropdown and send the request
    e.stopPropagation(); // Don't trigger the dropdown

    this._handleSend();
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (nextProps.request._id !== this.props.request._id) {
      this._handleResetTimeouts();
    }
  }

  renderSendButton() {
    const { hotKeyRegistry, downloadPath } = this.props;
    const { currentInterval, currentTimeout } = this.state;
    let cancelButton: ReactNode = null;

    if (currentInterval) {
      cancelButton = (
        <button
          type="button"
          key="cancel-interval"
          className="urlbar__send-btn danger"
          onClick={this._handleStopInterval}
        >
          Stop
        </button>
      );
    } else if (currentTimeout) {
      cancelButton = (
        <button
          type="button"
          key="cancel-timeout"
          className="urlbar__send-btn danger"
          onClick={this._handleStopTimeout}
        >
          Cancel
        </button>
      );
    }

    let sendButton;

    if (!cancelButton) {
      sendButton = (
        <Dropdown key="dropdown" className="tall" right ref={this._setDropdownRef}>
          <DropdownButton
            className="urlbar__send-btn"
            onContextMenu={this._handleMetaClickSend}
            onClick={this._handleClickSend}
          >
            {downloadPath ? 'Download' : 'Send'}
          </DropdownButton>
          <DropdownDivider>Basic</DropdownDivider>
          <DropdownItem onClick={this._handleClickSend}>
            <i className="fa fa-arrow-circle-o-right" /> Send Now
            <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SEND.id]} />
          </DropdownItem>
          <DropdownItem onClick={this._handleGenerateCode}>
            <i className="fa fa-code" /> Generate Client Code
          </DropdownItem>
          <DropdownDivider>Advanced</DropdownDivider>
          <DropdownItem onClick={this._handleSendAfterDelay}>
            <i className="fa fa-clock-o" /> Send After Delay
          </DropdownItem>
          <DropdownItem onClick={this._handleSendOnInterval}>
            <i className="fa fa-repeat" /> Repeat on Interval
          </DropdownItem>
          {downloadPath ? (
            <DropdownItem
              stayOpenAfterClick
              addIcon
              buttonClass={PromptButton}
              onClick={this._handleClearDownloadLocation}
            >
              <i className="fa fa-stop-circle" /> Stop Auto-Download
            </DropdownItem>
          ) : (
            <DropdownItem onClick={this._handleSetDownloadLocation}>
              <i className="fa fa-download" /> Download After Send
            </DropdownItem>
          )}
          <DropdownItem onClick={this._handleClickSendAndDownload}>
            <i className="fa fa-download" /> Send And Download
          </DropdownItem>
        </Dropdown>
      );
    }

    return [cancelButton, sendButton];
  }

  render() {
    const {
      request,
      handleRender,
      nunjucksPowerUserMode,
      isVariableUncovered,
      handleGetRenderContext,
      handleAutocompleteUrls,
      uniquenessKey,
    } = this.props;
    const { url, method } = request;
    return (
      <KeydownBinder onKeydown={this._handleKeyDown}>
        <div className="urlbar">
          <MethodDropdown
            ref={this._setMethodDropdownRef}
            onChange={this._handleMethodChange}
            method={method}
          >
            {method} <i className="fa fa-caret-down" />
          </MethodDropdown>
          <form onSubmit={this._handleFormSubmit}>
            <OneLineEditor
              key={uniquenessKey}
              ref={this._setInputRef}
              onPaste={this._handleUrlPaste}
              forceEditor
              type="text"
              render={handleRender}
              nunjucksPowerUserMode={nunjucksPowerUserMode}
              isVariableUncovered={isVariableUncovered}
              getAutocompleteConstants={handleAutocompleteUrls}
              getRenderContext={handleGetRenderContext}
              placeholder="https://api.myproduct.com/v1/users"
              defaultValue={url}
              onChange={this._handleUrlChange}
            />
            {this.renderSendButton()}
          </form>
        </div>
      </KeydownBinder>
    );
  }
}

export default RequestUrlBar;
