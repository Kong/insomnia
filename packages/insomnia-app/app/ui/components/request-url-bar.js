// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { remote } from 'electron';
import { DEBOUNCE_MILLIS, isMac } from '../../common/constants';
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownHint,
  DropdownItem,
} from './base/dropdown';
import { showPrompt } from './modals/index';
import MethodDropdown from './dropdowns/method-dropdown';
import PromptButton from './base/prompt-button';
import OneLineEditor from './codemirror/one-line-editor';
import * as hotkeys from '../../common/hotkeys';
import KeydownBinder from './keydown-binder';
import type { Request } from '../../models/request';

type Props = {
  handleAutocompleteUrls: Function,
  handleGenerateCode: Function,
  handleGetRenderContext: Function,
  handleImport: Function,
  handleRender: string => Promise<string>,
  handleSend: () => void,
  handleSendAndDownload: (filepath?: string) => Promise<void>,
  isVariableUncovered: boolean,
  nunjucksPowerUserMode: boolean,
  onMethodChange: (r: Request, method: string) => Promise<Request>,
  onUrlChange: (r: Request, url: string) => Promise<Request>,
  request: Request,
  uniquenessKey: string,
};

type State = {
  currentInterval: number | null,
  currentTimeout: number | null,
  downloadPath: string | null
};

@autobind
class RequestUrlBar extends React.PureComponent<Props, State> {
  _urlChangeDebounceTimeout: TimeoutID;
  _sendTimeout: TimeoutID;
  _sendInterval: IntervalID;
  _lastPastedText: string | null;
  _dropdown: ?Dropdown;
  _methodDropdown: ?Dropdown;
  _input: ?OneLineEditor;

  constructor(props: Props) {
    super(props);
    this.state = {
      currentInterval: null,
      currentTimeout: null,
      downloadPath: null,
    };

    this._lastPastedText = null;
  }

  _setDropdownRef(n: Dropdown | null) {
    this._dropdown = n;
  }

  _setMethodDropdownRef(n: Dropdown | null) {
    this._methodDropdown = n;
  }

  _setInputRef(n: HTMLInputElement | null) {
    this._input = n;
  }

  _handleMetaClickSend(e: MouseEvent) {
    e.preventDefault();
    this._dropdown && this._dropdown.show();
  }

  _handleFormSubmit(e?: SyntheticEvent<HTMLFormElement>) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    this._handleSend();
  }

  _handleMethodChange(method: string) {
    this.props.onMethodChange(this.props.request, method);
  }

  _handleUrlChange(url: string) {
    clearTimeout(this._urlChangeDebounceTimeout);
    this._urlChangeDebounceTimeout = setTimeout(async () => {
      const pastedText = this._lastPastedText;

      // If no pasted text in the queue, just fire the regular change handler
      if (!pastedText) {
        this.props.onUrlChange(this.props.request, url);
        return;
      }

      // Reset pasted text cache
      this._lastPastedText = null;

      // Attempt to import the pasted text
      const importedRequest = await this.props.handleImport(pastedText);

      // Update depending on whether something was imported
      if (!importedRequest) {
        this.props.onUrlChange(this.props.request, url);
      }
    }, DEBOUNCE_MILLIS);
  }

  _handleUrlPaste(e: SyntheticClipboardEvent<HTMLInputElement>) {
    // NOTE: We're not actually doing the import here to avoid races with onChange
    this._lastPastedText = e.clipboardData.getData('text/plain');
  }

  _handleGenerateCode() {
    this.props.handleGenerateCode();
  }

  _handleSetDownloadLocation() {
    const options = {
      title: 'Select Download Location',
      buttonLabel: 'Select',
      properties: ['openDirectory'],
    };

    remote.dialog.showOpenDialog(options, paths => {
      if (!paths || paths.length === 0) {
        return;
      }

      this.setState({ downloadPath: paths[0] });
    });
  }

  _handleClearDownloadLocation() {
    this.setState({ downloadPath: null });
  }

  _handleKeyDown(e: KeyboardEvent) {
    if (!this._input) {
      return;
    }

    hotkeys.executeHotKey(e, hotkeys.FOCUS_URL, () => {
      this._input && this._input.focus();
      this._input && this._input.selectAll();
    });

    hotkeys.executeHotKey(e, hotkeys.TOGGLE_METHOD_DROPDOWN, () => {
      this._methodDropdown && this._methodDropdown.toggle();
    });

    hotkeys.executeHotKey(e, hotkeys.SHOW_SEND_OPTIONS, () => {
      this._dropdown && this._dropdown.toggle(true);
    });
  }

  _handleSend() {
    // Don't stop interval because duh, it needs to keep going!
    // XXX this._handleStopInterval(); XXX

    this._handleStopTimeout();

    const { downloadPath } = this.state;
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
      defaultValue: 3,
      submitName: 'Start',
      onComplete: seconds => {
        this._handleStopTimeout();
        this._sendTimeout = setTimeout(this._handleSend, seconds * 1000);
        this.setState({ currentTimeout: seconds });
      },
    });
  }

  _handleSendOnInterval() {
    showPrompt({
      inputType: 'decimal',
      title: 'Send on Interval',
      label: 'Interval in seconds',
      defaultValue: 3,
      submitName: 'Start',
      onComplete: seconds => {
        this._handleStopInterval();
        this._sendInterval = setInterval(this._handleSend, seconds * 1000);
        this.setState({ currentInterval: seconds });
      },
    });
  }

  _handleStopInterval() {
    clearInterval(this._sendInterval);
    if (this.state.currentInterval) {
      this.setState({ currentInterval: null });
    }
  }

  _handleStopTimeout() {
    clearTimeout(this._sendTimeout);
    if (this.state.currentTimeout) {
      this.setState({ currentTimeout: null });
    }
  }

  _handleResetTimeouts() {
    this._handleStopTimeout();
    this._handleStopInterval();
  }

  _handleClickSend(e: MouseEvent) {
    const metaPressed = isMac() ? e.metaKey : e.ctrlKey;

    // If we're pressing a meta key, let the dropdown open
    if (metaPressed) {
      e.preventDefault(); // Don't submit the form
      return;
    }

    // If we're not pressing a meta key, cancel dropdown and send the request
    e.stopPropagation(); // Don't trigger the dropdown
    this._handleFormSubmit();
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.request._id !== this.props.request._id) {
      this._handleResetTimeouts();
    }
  }

  renderSendButton() {
    const { currentInterval, currentTimeout, downloadPath } = this.state;

    let cancelButton = null;
    if (currentInterval) {
      cancelButton = (
        <button
          type="button"
          key="cancel-interval"
          className="urlbar__send-btn danger"
          onClick={this._handleStopInterval}>
          Stop
        </button>
      );
    } else if (currentTimeout) {
      cancelButton = (
        <button
          type="button"
          key="cancel-timeout"
          className="urlbar__send-btn danger"
          onClick={this._handleStopTimeout}>
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
            type="submit">
            {downloadPath ? 'Download' : 'Send'}
          </DropdownButton>
          <DropdownDivider>Basic</DropdownDivider>
          <DropdownItem type="submit">
            <i className="fa fa-arrow-circle-o-right"/> Send Now
            <DropdownHint hotkey={hotkeys.SEND_REQUEST}/>
          </DropdownItem>
          <DropdownItem onClick={this._handleGenerateCode}>
            <i className="fa fa-code"/> Generate Client Code
          </DropdownItem>
          <DropdownDivider>Advanced</DropdownDivider>
          <DropdownItem onClick={this._handleSendAfterDelay}>
            <i className="fa fa-clock-o"/> Send After Delay
          </DropdownItem>
          <DropdownItem onClick={this._handleSendOnInterval}>
            <i className="fa fa-repeat"/> Repeat on Interval
          </DropdownItem>
          {downloadPath ? (
            <DropdownItem
              stayOpenAfterClick
              addIcon
              buttonClass={PromptButton}
              onClick={this._handleClearDownloadLocation}>
              <i className="fa fa-stop-circle"/> Stop Auto-Download
            </DropdownItem>
          ) : (
            <DropdownItem onClick={this._handleSetDownloadLocation}>
              <i className="fa fa-download"/> Download After Send
            </DropdownItem>
          )}
          <DropdownItem onClick={this._handleClickSendAndDownload}>
            <i className="fa fa-download"/> Send And Download
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
            method={method}>
            {method} <i className="fa fa-caret-down"/>
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
