import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import { NunjucksEnabledProvider } from '../../context/nunjucks/nunjucks-enabled-context';
import { CopyButton } from '../base/copy-button';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { CodeEditor } from '../codemirror/code-editor';
import { MarkdownEditor } from '../markdown-editor';

const MODES: Record<string, string> = {
  'text/plain': 'Plain Text',
  'application/json': 'JSON',
  'application/xml': 'XML',
  'application/edn': 'EDN',
  'text/x-markdown': 'Markdown',
  'text/html': 'HTML',
};

interface CodePromptModalOptions {
  title: string;
  defaultValue: string;
  submitName: string;
  placeholder?: string;
  hint?: string;
  mode: string;
  hideMode?: boolean;
  enableRender: boolean;
  showCopyButton?: boolean;
  onChange: (value: string) => void;
  onModeChange?: (value: string) => void;
}

export interface CodePromptModalHandle {
  show: (options: CodePromptModalOptions) => void;
  hide: () => void;
}
export const CodePromptModal = forwardRef<CodePromptModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<CodePromptModalOptions>({
    title: 'Not Set',
    defaultValue: '',
    submitName: 'Not Set',
    placeholder: '',
    hint: '',
    mode: 'text/plain',
    hideMode: false,
    enableRender: false,
    showCopyButton: false,
    onChange: () => { },
    onModeChange: () => { },
  });

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: options => {
      const realMode = typeof options.mode === 'string' ? options.mode : 'text/plain';
      setState(state => ({
        ...options,
        mode: realMode || state.mode || 'text/plain',
      }));
      modalRef.current?.show();
    },
  }), []);

  const {
    submitName,
    title,
    placeholder,
    defaultValue,
    hint,
    mode,
    hideMode,
    enableRender,
    showCopyButton,
    onChange,
  } = state;

  return (
    <Modal ref={modalRef} tall>
      <ModalHeader>{title}</ModalHeader>
      <ModalBody
        noScroll
        className="wide tall"
        style={
          showCopyButton
            ? {
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr)',
              gridTemplateRows: 'auto minmax(0, 1fr)',
            }
            : {
              minHeight: '10rem',
            }
        }
      >
        <NunjucksEnabledProvider disable={!enableRender}>
          {showCopyButton ? (
            <div className="pad-top-sm pad-right-sm">
              <CopyButton content={defaultValue} className="pull-right" />
            </div>
          ) : null}
          {mode === 'text/x-markdown' ? (
            <div className="pad-sm tall">
              <MarkdownEditor
                tall
                defaultValue={defaultValue}
                placeholder={placeholder}
                onChange={onChange}
                mode={mode}
              />
            </div>
          ) : (
            <div className="pad-sm pad-bottom tall">
              <div className="form-control form-control--outlined form-control--tall tall">
                <CodeEditor
                  id="code-prompt-modal"
                  hideLineNumbers
                  showPrettifyButton
                  className="tall"
                  defaultValue={defaultValue}
                  placeholder={placeholder}
                  onChange={onChange}
                  mode={mode}
                  enableNunjucks
                />
              </div>
            </div>
          )}
        </NunjucksEnabledProvider>
      </ModalBody>
      <ModalFooter>
        {!hideMode ? (
          <Dropdown
            aria-label='Select a mode'
            triggerButton={
              <DropdownButton className="btn btn--clicky margin-left-sm">
                {MODES[mode]}
                <i className="fa fa-caret-down space-left" />
              </DropdownButton>
            }
          >
            <DropdownSection
              aria-label="Editor Syntax"
              title="Editor Syntax"
            >
              {Object.keys(MODES).map(mode => (
                <DropdownItem
                  key={mode}
                  aria-label={MODES[mode]}
                >
                  <ItemContent
                    icon="code"
                    label={MODES[mode]}
                    onClick={() => {
                      setState(state => ({ ...state, mode }));
                      state.onModeChange?.(mode);
                    }}
                  />
                </DropdownItem>
              ))}
            </DropdownSection>
          </Dropdown>
        ) : null}
        <div className="margin-left faint italic txt-sm">{hint ? `* ${hint}` : ''}</div>
        <button className="btn" onClick={() => modalRef.current?.hide()}>
          {submitName || 'Submit'}
        </button>
      </ModalFooter>
    </Modal>
  );
});
CodePromptModal.displayName = 'CodePromptModal';
