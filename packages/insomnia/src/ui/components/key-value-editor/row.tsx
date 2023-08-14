import classnames from 'classnames';
import React, { FC } from 'react';

import { describeByteSize } from '../../../common/misc';
import { useNunjucksEnabled } from '../../context/nunjucks/nunjucks-enabled-context';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';
import { FileInputButton } from '../base/file-input-button';
import { PromptButton } from '../base/prompt-button';
import { OneLineEditor } from '../codemirror/one-line-editor';
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
  addPair: () => void;
  allowFile?: boolean;
  allowMultiline?: boolean;
  className?: string;
  descriptionPlaceholder?: string;
  handleGetAutocompleteNameConstants?: AutocompleteHandler;
  handleGetAutocompleteValueConstants?: AutocompleteHandler;
  hideButtons?: boolean;
  namePlaceholder?: string;
  onChange: (pair: Pair) => void;
  onDelete?: (pair: Pair) => void;
  pair: Pair;
  readOnly?: boolean;
  valuePlaceholder?: string;
  onClick?: () => void;
  onKeydown?: (e: React.KeyboardEvent) => void;
  showDescription: boolean;
}

export const Row: FC<Props> = ({
  allowFile,
  allowMultiline,
  className,
  descriptionPlaceholder,
  handleGetAutocompleteNameConstants,
  handleGetAutocompleteValueConstants,
  hideButtons,
  namePlaceholder,
  onChange,
  onDelete,
  pair,
  readOnly,
  onClick,
  onKeydown,
  valuePlaceholder,
  showDescription,
}) => {
  const { enabled } = useNunjucksEnabled();

  const classes = classnames(className, {
    'key-value-editor__row-wrapper': true,
    'key-value-editor__row-wrapper--disabled': pair.disabled,
  });

  const isFileOrMultiline = allowMultiline || allowFile;
  const hiddenButtons = isFileOrMultiline ? (<button>
    <i className="fa fa-empty" />
  </button>) : null;

  const isFile = pair.type === 'file';
  const isMultiline = pair.type === 'text' && pair.multiline;
  const bytes = isMultiline ? Buffer.from(pair.value, 'utf8').length : 0;

  return (
    <li onKeyDown={onKeydown} onClick={onClick} className={classes}>
      <div className="key-value-editor__row">
        <div
          className={classnames('form-control form-control--underlined form-control--wide', {
            'form-control--inactive': pair.disabled,
          })}
        >
          <OneLineEditor
            id={'key-value-editor__name' + pair.id}
            placeholder={namePlaceholder || 'Name'}
            defaultValue={pair.name}
            getAutocompleteConstants={() => handleGetAutocompleteNameConstants?.(pair) || []}
            readOnly={readOnly}
            onChange={name => onChange({ ...pair, name })}
          />
        </div>
        <div
          className={classnames('form-control form-control--underlined form-control--wide', {
            'form-control--inactive': pair.disabled,
          })}
        >
          {isFile ? (
            <FileInputButton
              showFileName
              showFileIcon
              className="btn btn--outlined btn--super-duper-compact wide ellipsis"
              path={pair.fileName || ''}
              onChange={fileName => onChange({ ...pair, fileName })}
            />
          ) : isMultiline ? (
            <button
              className="btn btn--outlined btn--super-duper-compact wide ellipsis"
              onClick={() => showModal(CodePromptModal, {
                submitName: 'Done',
                title: `Edit ${pair.name}`,
                defaultValue: pair.value,
                onChange: (value: string) => onChange({ ...pair, value }),
                enableRender: enabled,
                mode: pair.multiline && typeof pair.multiline === 'string' ? pair.multiline : 'text/plain',
                onModeChange: (mode: string) => onChange({ ...pair, multiline: mode }),
              })}
            >
              <i className="fa fa-pencil-square-o space-right" />
              {bytes > 0 ? describeByteSize(bytes, true) : 'Click to Edit'}
            </button>
          ) : (
            <OneLineEditor
              id={'key-value-editor__value' + pair.id}
              type="text"
              readOnly={readOnly}
              placeholder={valuePlaceholder || 'Value'}
              defaultValue={pair.value}
              onChange={value => onChange({ ...pair, value })}
              getAutocompleteConstants={() => handleGetAutocompleteValueConstants?.(pair) || []}
            />
          )
          }
        </div>
        {showDescription ? (
          <div
            className={classnames(
              'form-control form-control--underlined form-control--wide no-min-width',
              { 'form-control--inactive': pair.disabled },
            )}
          >
            <OneLineEditor
              id={'key-value-editor__description' + pair.id}
              readOnly={readOnly}
              placeholder={descriptionPlaceholder || 'Description'}
              defaultValue={pair.description || ''}
              onChange={description => onChange({ ...pair, description })}
            />
          </div>
        ) : null}

        {hideButtons ? hiddenButtons : isFileOrMultiline ? (
          <Dropdown
            aria-label='Select type Dropdown'
            triggerButton={
              <DropdownButton className="tall">
                <i className="fa fa-caret-down" />
              </DropdownButton>
            }
          >
            <DropdownItem aria-label='Text'>
              <ItemContent
                label="Text"
                onClick={() => onChange({ ...pair, type: 'text', multiline: false })}
              />
            </DropdownItem>
            <DropdownItem aria-label='Text (Multi-line)'>
              {allowMultiline && (
                <ItemContent
                  label="Text (Multi-line)"
                  onClick={() => onChange({ ...pair, type: 'text', multiline: true })}
                />
              )}
            </DropdownItem>
            <DropdownItem aria-label='File'>
              {allowFile && (
                <ItemContent
                  label="File"
                  onClick={() => onChange({ ...pair, type: 'file' })}
                />
              )}
            </DropdownItem>
          </Dropdown>
        ) : null}

        {!hideButtons ? (
          <button
            onClick={() => onChange({ ...pair, disabled: !pair.disabled })}
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

        {!hideButtons ? (
          <PromptButton
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
        )}
      </div>
    </li>
  );
};
Row.displayName = 'Row';
