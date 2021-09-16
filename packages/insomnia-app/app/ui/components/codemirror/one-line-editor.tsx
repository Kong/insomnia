import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { Fragment, PureComponent } from 'react';
import ReactDOM from 'react-dom';

import { AUTOBIND_CFG } from '../../../common/constants';
import { HandleGetRenderContext, HandleRender } from '../../../common/render';
import Input from '../base/debounced-input';
import CodeEditor, { CodeEditorOnChange, UnconnectedCodeEditor } from './code-editor';
const MODE_INPUT = 'input';
const MODE_EDITOR = 'editor';
const TYPE_TEXT = 'text';
const NUNJUCKS_REGEX = /({%|%}|{{|}})/;

interface Props {
  defaultValue: string;
  id?: string;
  type?: string;
  mode?: string;
  onBlur?: (e: FocusEvent) => void;
  onKeyDown?: (e: KeyboardEvent, value?: any) => void;
  onFocus?: (e: FocusEvent) => void;
  onChange?: CodeEditorOnChange;
  onPaste?: (e: ClipboardEvent) => void;
  render?: HandleRender;
  getRenderContext?: HandleGetRenderContext;
  nunjucksPowerUserMode?: boolean;
  getAutocompleteConstants?: () => string[] | PromiseLike<string[]>;
  placeholder?: string;
  className?: string;
  forceEditor?: boolean;
  forceInput?: boolean;
  isVariableUncovered?: boolean;
  readOnly?: boolean;
  // TODO(TSCONVERSION) figure out why so many components pass this in yet it isn't used anywhere in this
  disabled?: boolean;
}

interface State {
  mode: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class OneLineEditor extends PureComponent<Props, State> {
  _editor: UnconnectedCodeEditor | null = null;
  _input: Input | null = null;
  _mouseEnterTimeout: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    let mode;

    if (props.forceInput) {
      mode = MODE_INPUT;
    } else if (props.forceEditor) {
      mode = MODE_EDITOR;
    } else if (this._mayContainNunjucks(props.defaultValue)) {
      mode = MODE_EDITOR;
    } else {
      mode = MODE_INPUT;
    }

    this.state = {
      mode,
    };
  }

  focus(setToEnd = false) {
    if (this.state.mode === MODE_EDITOR) {
      if (this._editor && !this._editor?.hasFocus()) {
        setToEnd ? this._editor?.focusEnd() : this._editor?.focus();
      }
    } else {
      if (this._input && !this._input?.hasFocus()) {
        setToEnd ? this._input?.focusEnd() : this._input?.focus();
      }
    }
  }

  focusEnd() {
    this.focus(true);
  }

  selectAll() {
    if (this.state.mode === MODE_EDITOR) {
      this._editor?.selectAll();
    } else {
      this._input?.select();
    }
  }

  getValue() {
    if (this.state.mode === MODE_EDITOR) {
      return this._editor?.getValue();
    } else {
      return this._input?.getValue();
    }
  }

  getSelectionStart() {
    if (this._editor) {
      return this._editor?.getSelectionStart();
    } else {
      console.warn('Tried to get selection start of one-line-editor when <input>');
      // @ts-expect-error -- TSCONVERSION
      return this._input?.value.length;
    }
  }

  getSelectionEnd() {
    if (this._editor) {
      return this._editor?.getSelectionEnd();
    } else {
      console.warn('Tried to get selection end of one-line-editor when <input>');
      // @ts-expect-error -- TSCONVERSION
      return this._input?.value.length;
    }
  }

  componentDidMount() {
    document.body.addEventListener('mousedown', this._handleDocumentMousedown);
  }

  componentWillUnmount() {
    document.body.removeEventListener('mousedown', this._handleDocumentMousedown);
  }

  _handleDocumentMousedown(e) {
    if (!this._editor) {
      return;
    }

    // Clear the selection if mousedown happens outside the input so we act like
    // a regular <input>
    // NOTE: Must be "mousedown", not "click" because "click" triggers on selection drags
    const node = ReactDOM.findDOMNode(this._editor);
    // @ts-expect-error -- TSCONVERSION
    const clickWasOutsideOfComponent = !node.contains(e.target);

    if (clickWasOutsideOfComponent) {
      this._editor?.clearSelection();
    }
  }

  _handleInputDragEnter() {
    this._convertToEditorPreserveFocus();
  }

  _handleInputMouseEnter() {
    // Convert to editor when user hovers mouse over input

    /*
     * NOTE: we're doing it in a timeout because we don't want to convert if the
     * mouse goes in an out right away.
     */
    this._mouseEnterTimeout = setTimeout(this._convertToEditorPreserveFocus, 100);
  }

  _handleInputMouseLeave() {
    if (this._mouseEnterTimeout !== null) {
      clearTimeout(this._mouseEnterTimeout);
    }
  }

  _handleEditorMouseLeave() {
    this._convertToInputIfNotFocused();
  }

  _handleEditorFocus(e) {
    const focusedFromTabEvent = !!e.sourceCapabilities;

    if (focusedFromTabEvent) {
      this._editor?.focusEnd();
    }

    if (!this._editor) {
      console.warn('Tried to focus editor when it was not mounted', this);
      return;
    }

    // Set focused state
    this._editor?.setAttribute('data-focused', 'on');

    this.props.onFocus?.(e);
  }

  _handleInputFocus(e) {
    // If we're focusing the whole thing, blur the input. This happens when
    // the user tabs to the field.
    const start = this._input?.getSelectionStart();

    const end = this._input?.getSelectionEnd();

    const focusedFromTabEvent = start === 0 && end === e.target.value.length;

    if (focusedFromTabEvent) {
      this._input?.focusEnd();

      // Also convert to editor if we tabbed to it. Just in case the user
      // needs an editor
      this._convertToEditorPreserveFocus();
    }

    // Set focused state
    this._input?.setAttribute('data-focused', 'on');

    // Also call the regular callback
    this.props.onFocus?.(e);
  }

  _handleInputChange(value) {
    this._convertToEditorPreserveFocus();

    this.props.onChange?.(value);
  }

  _handleInputKeyDown(e) {
    if (this.props.onKeyDown) {
      this.props.onKeyDown(e, e.target.value);
    }
  }

  _handleInputBlur(e: FocusEvent) {
    // Set focused state
    this._input?.removeAttribute('data-focused');

    this.props.onBlur?.(e);
  }

  _handleEditorBlur(e: FocusEvent) {
    // Editor was already removed from the DOM, so do nothing
    if (!this._editor) {
      return;
    }

    // Set focused state
    this._editor?.removeAttribute('data-focused');

    if (!this.props.forceEditor) {
      // Convert back to input sometime in the future.
      // NOTE: this was originally added because the input would disappear if
      // the user tabbed away very shortly after typing, but it's actually a pretty
      // good feature.
      setTimeout(() => {
        this._convertToInputIfNotFocused();
      }, 2000);
    }

    this.props.onBlur?.(e);
  }

  // @TODO Refactor this event handler. The way we search for a parent form node is not stable.
  _handleKeyDown(e) {
    // submit form if needed
    if (e.keyCode === 13) {
      let node = e.target;

      for (let i = 0; i < 20 && node; i++) {
        if (node.tagName === 'FORM') {
          node.dispatchEvent(new window.Event('submit'));
          e.preventDefault();
          e.stopPropagation();
          break;
        }

        node = node.parentNode;
      }
    }

    this.props.onKeyDown?.(e, this.getValue());
  }

  _convertToEditorPreserveFocus() {
    if (this.state.mode !== MODE_INPUT || this.props.forceInput) {
      return;
    }

    if (!this._input) {
      return;
    }

    if (this._input?.hasFocus()) {
      const start = this._input?.getSelectionStart();
      const end = this._input?.getSelectionEnd();
      if (start === null || end === null) {
        return;
      }

      // Wait for the editor to swap and restore cursor position
      const check = () => {
        if (this._editor) {
          this._editor?.focus();

          this._editor?.setSelection(start, end, 0, 0);
        } else {
          setTimeout(check, 40);
        }
      };

      // Tell the component to show the editor
      setTimeout(check);
    }

    this.setState({
      mode: MODE_EDITOR,
    });
  }

  _convertToInputIfNotFocused() {
    if (this.state.mode === MODE_INPUT || this.props.forceEditor) {
      return;
    }

    if (!this._editor || this._editor?.hasFocus()) {
      return;
    }

    if (this._mayContainNunjucks(this.getValue())) {
      return;
    }

    this.setState({
      mode: MODE_INPUT,
    });
  }

  _setEditorRef(n: UnconnectedCodeEditor) {
    this._editor = n;
  }

  _setInputRef(n: Input) {
    this._input = n;
  }

  _mayContainNunjucks(text) {
    // Not sure, but sometimes this isn't a string
    if (typeof text !== 'string') {
      return false;
    }

    // Does the string contain Nunjucks tags?
    return !!text.match(NUNJUCKS_REGEX);
  }

  render() {
    const {
      id,
      defaultValue,
      className,
      onChange,
      placeholder,
      render,
      onPaste,
      getRenderContext,
      nunjucksPowerUserMode,
      getAutocompleteConstants,
      isVariableUncovered,
      mode: syntaxMode,
      type: originalType,
    } = this.props;
    const { mode } = this.state;
    const type = originalType || TYPE_TEXT;
    const showEditor = mode === MODE_EDITOR;

    if (showEditor) {
      return (
        <Fragment>
          <CodeEditor
            ref={this._setEditorRef}
            defaultTabBehavior
            hideLineNumbers
            hideScrollbars
            noMatchBrackets
            noStyleActiveLine
            noLint
            singleLine
            autoCloseBrackets={false}
            tabIndex={0}
            id={id}
            type={type}
            mode={syntaxMode}
            placeholder={placeholder}
            onPaste={onPaste}
            onBlur={this._handleEditorBlur}
            onKeyDown={this._handleKeyDown}
            onFocus={this._handleEditorFocus}
            onMouseLeave={this._handleEditorMouseLeave}
            onChange={onChange}
            render={render}
            getRenderContext={getRenderContext}
            nunjucksPowerUserMode={nunjucksPowerUserMode}
            getAutocompleteConstants={getAutocompleteConstants}
            className={classnames('editor--single-line', className)}
            defaultValue={defaultValue}
            isVariableUncovered={isVariableUncovered}
          />
        </Fragment>
      );
    } else {
      return (
        <Input
          ref={this._setInputRef}
          // @ts-expect-error -- TSCONVERSION
          id={id}
          type={type}
          className={className}
          style={{
            // background: 'rgba(255, 0, 0, 0.05)', // For debugging
            width: '100%',
          }}
          placeholder={placeholder}
          defaultValue={defaultValue}
          onBlur={this._handleInputBlur}
          onChange={this._handleInputChange}
          onMouseEnter={this._handleInputMouseEnter}
          onMouseLeave={this._handleInputMouseLeave}
          onDragEnter={this._handleInputDragEnter}
          onPaste={onPaste}
          onFocus={this._handleInputFocus}
          onKeyDown={this._handleInputKeyDown}
        />
      );
    }
  }
}

export default OneLineEditor;
