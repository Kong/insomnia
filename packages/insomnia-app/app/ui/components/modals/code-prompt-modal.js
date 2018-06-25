import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import CodeEditor from '../codemirror/code-editor';
import Dropdown from '../base/dropdown/dropdown';
import DropdownButton from '../base/dropdown/dropdown-button';
import DropdownItem from '../base/dropdown/dropdown-item';
import DropdownDivider from '../base/dropdown/dropdown-divider';
import MarkdownEditor from '../markdown-editor';

const MODES = {
  'text/plain': 'Plain Text',
  'application/json': 'JSON',
  'application/xml': 'XML',
  'text/x-markdown': 'Markdown',
  'text/html': 'HTML'
};

@autobind
class CodePromptModal extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      title: 'Not Set',
      defaultValue: '',
      submitName: 'Not Set',
      placeholder: '',
      hint: '',
      mode: 'text/plain',
      hideMode: false,
      enableRender: false
    };
  }

  _setModalRef(n) {
    this.modal = n;
  }

  _handleChange(value) {
    this._onChange(value);
  }

  _handleChangeMode(mode) {
    this.setState({ mode });
    this._onModeChange && this._onModeChange(mode);
  }

  hide() {
    this.modal.hide();
  }

  show(options) {
    const {
      title,
      defaultValue,
      submitName,
      placeholder,
      hint,
      mode,
      hideMode,
      enableRender,
      onChange,
      onModeChange
    } = options;

    this._onChange = onChange;
    this._onModeChange = onModeChange;

    const realMode = typeof mode === 'string' ? mode : 'text/plain';

    this.setState({
      title,
      defaultValue,
      submitName,
      placeholder,
      hint,
      enableRender,
      hideMode,
      mode: realMode || this.state.mode || 'text/plain'
    });

    this.modal.show();
  }

  render() {
    const {
      handleGetRenderContext,
      nunjucksPowerUserMode,
      handleRender,
      editorKeyMap,
      editorIndentSize,
      editorFontSize,
      editorLineWrapping
    } = this.props;

    const {
      submitName,
      title,
      placeholder,
      defaultValue,
      hint,
      mode,
      hideMode,
      enableRender
    } = this.state;

    return (
      <Modal ref={this._setModalRef} freshState tall>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody className="wide tall" style={{ minHeight: '10rem' }}>
          {mode === 'text/x-markdown' ? (
            <div className="pad-sm tall">
              <MarkdownEditor
                tall
                defaultValue={defaultValue}
                placeholder={placeholder}
                onChange={this._handleChange}
                handleGetRenderContext={
                  enableRender ? handleGetRenderContext : null
                }
                handleRender={enableRender ? handleRender : null}
                mode={mode}
                keyMap={editorKeyMap}
                indentSize={editorIndentSize}
                fontSize={editorFontSize}
                lineWrapping={editorLineWrapping}
                nunjucksPowerUserMode={nunjucksPowerUserMode}
              />
            </div>
          ) : (
            <div className="pad-sm pad-bottom tall">
              <div className="form-control form-control--outlined form-control--tall tall">
                <CodeEditor
                  hideLineNumbers
                  className="tall"
                  defaultValue={defaultValue}
                  placeholder={placeholder}
                  onChange={this._handleChange}
                  nunjucksPowerUserMode={nunjucksPowerUserMode}
                  getRenderContext={
                    enableRender ? handleGetRenderContext : null
                  }
                  render={enableRender ? handleRender : null}
                  mode={mode}
                  keyMap={editorKeyMap}
                  indentSize={editorIndentSize}
                  fontSize={editorFontSize}
                  lineWrapping={editorLineWrapping}
                />
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {!hideMode ? (
            <Dropdown>
              <DropdownButton className="btn btn--clicky margin-left-sm">
                {MODES[mode]}
                <i className="fa fa-caret-down space-left" />
              </DropdownButton>
              <DropdownDivider>Editor Syntax</DropdownDivider>
              {Object.keys(MODES).map(mode => (
                <DropdownItem
                  key={mode}
                  value={mode}
                  onClick={this._handleChangeMode}>
                  <i className="fa fa-code" />
                  {MODES[mode]}
                </DropdownItem>
              ))}
            </Dropdown>
          ) : null}
          <div className="margin-left faint italic txt-sm tall">
            {hint ? `* ${hint}` : ''}
          </div>
          <button className="btn" onClick={this.hide}>
            {submitName || 'Submit'}
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

CodePromptModal.propTypes = {
  // Required
  editorFontSize: PropTypes.number.isRequired,
  editorIndentSize: PropTypes.number.isRequired,
  editorKeyMap: PropTypes.string.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired,
  nunjucksPowerUserMode: PropTypes.bool.isRequired,

  // Optional
  handleGetRenderContext: PropTypes.func,
  handleRender: PropTypes.func
};

export default CodePromptModal;
