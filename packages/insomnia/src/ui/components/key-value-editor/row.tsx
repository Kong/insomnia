// eslint-disable-next-line filenames/match-exported
import classnames from 'classnames';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';

import { describeByteSize } from '../../../common/misc';
import { useNunjucksEnabled } from '../../context/nunjucks/nunjucks-enabled-context';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { FileInputButton } from '../base/file-input-button';
import { PromptButton } from '../base/prompt-button';
import { OneLineEditor, OneLineEditorHandle } from '../codemirror/one-line-editor';
import { CodePromptModal } from '../modals/code-prompt-modal';
import { showModal } from '../modals/index';

export interface Pair {
  id?: string;
  name: string;
  value: string;
  description?: string;
  fileName?: string;
  type?: string;
  disabled?: boolean;
  multiline?: boolean | string;
}

export type AutocompleteHandler = (pair: Pair) => string[] | PromiseLike<string[]>;

interface Props {
  allowFile?: boolean;
  allowMultiline?: boolean;
  className?: string;
  descriptionPlaceholder?: string;
  displayDescription: boolean;
  forceInput?: boolean;
  handleGetAutocompleteNameConstants?: AutocompleteHandler;
  handleGetAutocompleteValueConstants?: AutocompleteHandler;
  hideButtons?: boolean;
  namePlaceholder?: string;
  noDelete?: boolean;
  noDropZone?: boolean;
  onChange?: (pair: Pair) => void;
  onDelete?: (pair: Pair) => void;
  pair: Pair;
  readOnly?: boolean;
  valueInputType?: string;
  valuePlaceholder?: string;
}
export interface RowHandle {
  focusNameEnd: () => void;
}
export const Row = forwardRef<RowHandle, Props>(({
  allowFile,
  allowMultiline,
  className,
  descriptionPlaceholder,
  displayDescription,
  forceInput,
  handleGetAutocompleteNameConstants,
  handleGetAutocompleteValueConstants,
  hideButtons,
  namePlaceholder,
  noDelete,
  onChange,
  onDelete,
  pair,
  readOnly,
  valueInputType,
  valuePlaceholder,
}, ref) => {

  const { enabled } = useNunjucksEnabled();

  const nameRef = useRef<OneLineEditorHandle>(null);
  const valueRef = useRef<OneLineEditorHandle>(null);
  const descriptionRef = useRef<OneLineEditorHandle>(null);

  useImperativeHandle(ref, () => ({
    focusNameEnd: () => nameRef.current?.focusEnd(),
  }));

  function _handleTypeChange(def: Partial<Pair>) {
    // Remove newlines if converting to text
    // WARNING: props should never be overwritten!
    let value = pair.value || '';
    if (def.type === 'text' && !def.multiline && value.includes('\n')) {
      value = value.replace(/\n/g, '');
    }
    onChange?.(Object.assign({}, pair, { type: def.type, multiline: def.multiline, value }));
  }
  const classes = classnames(className, {
    'key-value-editor__row-wrapper': true,
    'key-value-editor__row-wrapper--disabled': pair.disabled,
  });

  const showDropdown = allowMultiline || allowFile;
  let renderPairSelector;
  // Put a spacer in for dropdown if needed
  if (hideButtons && showDropdown) {
    renderPairSelector = (
      <button>
        <i className="fa fa-empty" />
      </button>
    );
  } else if (hideButtons) {
    renderPairSelector = null;
  } else {
    renderPairSelector = showDropdown ? (
      <Dropdown right>
        <DropdownButton className="tall">
          <i className="fa fa-caret-down" />
        </DropdownButton>
        <DropdownItem
          onClick={() => _handleTypeChange({
            type: 'text',
            multiline: false,
          })}
        >
          Text
        </DropdownItem>
        {allowMultiline && (
          <DropdownItem
            onClick={() => _handleTypeChange({
              type: 'text',
              multiline: true,
            })}
          >
            Text (Multi-line)
          </DropdownItem>
        )}
        {allowFile && (
          <DropdownItem
            onClick={() => _handleTypeChange({
              type: 'file',
            })}
          >
            File
          </DropdownItem>
        )}
      </Dropdown>
    ) : null;
  }

  let pairValue;
  if (pair.type === 'file') {
    pairValue = (
      <FileInputButton
        showFileName
        showFileIcon
        className="btn btn--outlined btn--super-duper-compact wide ellipsis"
        path={pair.fileName || ''}
        onChange={filename => onChange?.(Object.assign({}, pair, { filename }))}
      />
    );
  } else if (pair.type === 'text' && pair.multiline) {
    const bytes = Buffer.from(pair.value, 'utf8').length;
    pairValue = (
      <button
        className="btn btn--outlined btn--super-duper-compact wide ellipsis"
        onClick={() => showModal(CodePromptModal, {
          submitName: 'Done',
          title: `Edit ${pair.name}`,
          defaultValue: pair.value,
          onChange: (value: string) => onChange?.(Object.assign({}, pair, { value })),
          enableRender: enabled,
          mode: pair.multiline || 'text/plain',
          onModeChange: (mode: string) => _handleTypeChange(Object.assign({}, pair, { multiline: mode })),
        })}
      >
        <i className="fa fa-pencil-square-o space-right" />
        {bytes > 0 ? describeByteSize(bytes, true) : 'Click to Edit'}
      </button>
    );
  } else {
    pairValue = (
      <OneLineEditor
        ref={valueRef}
        readOnly={readOnly}
        forceInput={forceInput}
        type={valueInputType || 'text'}
        placeholder={valuePlaceholder || 'Value'}
        defaultValue={pair.value}
        onPaste={event => {
          if (!allowMultiline) {
            return;
          }
          const value = event.clipboardData?.getData('text/plain');
          if (value?.includes('\n')) {
            event.preventDefault();
            // Insert the pasted text into the current selection.
            // Unfortunately, this is the easiest way to do
            const currentValue = valueRef.current?.getValue();
            const start = valueRef.current?.getSelectionStart() || 0;
            const end = valueRef.current?.getSelectionEnd() || 0;
            const prefix = currentValue?.slice(0, start);
            const suffix = currentValue?.slice(end);
            const finalValue = `${prefix}${value}${suffix}`;
            // Update type and value
            _handleTypeChange({
              type: 'text',
              multiline: 'text/plain',
            });
            onChange?.(Object.assign({}, pair, { value: finalValue }));
          }
        }}
        onChange={value => onChange?.(Object.assign({}, pair, { value }))}
        getAutocompleteConstants={() => handleGetAutocompleteValueConstants?.(pair) || []}
      />
    );
  }

  return (
    <li className={classes}>
      <div className="key-value-editor__row">
        <div
          className={classnames('form-control form-control--underlined form-control--wide', {
            'form-control--inactive': pair.disabled,
          })}
        >
          <OneLineEditor
            ref={nameRef}
            placeholder={namePlaceholder || 'Name'}
            defaultValue={pair.name}
            getAutocompleteConstants={() => handleGetAutocompleteNameConstants?.(pair) || []}
            forceInput={forceInput}
            readOnly={readOnly}
            onChange={name => onChange?.(Object.assign({}, pair, { name }))}
          />
        </div>
        <div
          className={classnames('form-control form-control--underlined form-control--wide', {
            'form-control--inactive': pair.disabled,
          })}
        >
          {pairValue}
        </div>
        {displayDescription ? (
          <div
            className={classnames(
              'form-control form-control--underlined form-control--wide no-min-width',
              {
                'form-control--inactive': pair.disabled,
              },
            )}
          >
            <OneLineEditor
              ref={descriptionRef}
              readOnly={readOnly}
              forceInput={forceInput}
              placeholder={descriptionPlaceholder || 'Description'}
              defaultValue={pair.description || ''}
              onChange={description => onChange?.(Object.assign({}, pair, { description }))}
            />
          </div>
        ) : null}

        {renderPairSelector}

        {!hideButtons ? (
          <button
            onClick={() => onChange?.(Object.assign({}, pair, { disabled: !pair.disabled }))}
            title={pair.disabled ? 'Enable item' : 'Disable item'}
          >
            {pair.disabled ? (
              <i className="fa fa-square-o" />
            ) : (
              <i className="fa fa-check-square-o" />
            )}
          </button>
        ) : (
          <button>
            <i className="fa fa-empty" />
          </button>
        )}

        {!noDelete &&
          (!hideButtons ? (
            <PromptButton
              key={Math.random()}
              tabIndex={-1}
              confirmMessage=""
              onClick={() => onDelete?.(pair)}
              title="Delete item"
            >
              <i className="fa fa-trash-o" />
            </PromptButton>
          ) : (
            <button>
              <i className="fa fa-empty" />
            </button>
          ))}
      </div>
    </li>
  );
});
Row.displayName = 'Row';
