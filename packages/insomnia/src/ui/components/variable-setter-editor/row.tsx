import classNames from 'classnames';
import React, { FC, useEffect, useRef, useState } from 'react';

import { describeByteSize } from '../../../common/misc';
import { Key } from '../../../templating/utils';
import { useNunjucks } from '../../context/nunjucks/use-nunjucks';
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  ItemContent,
} from '../base/dropdown';
import { PromptButton } from '../base/prompt-button';
import {
  OneLineEditor,
  OneLineEditorHandle,
} from '../codemirror/one-line-editor';
import { showModal } from '../modals';
import { CodePromptModal } from '../modals/code-prompt-modal';
import { Button } from '../themed-button';

export interface VariableSetterPair {
  id: string;
  objectKey: string;
  setterValue: string;
  description: string;
  disabled: boolean;
  multiline: boolean;
}

interface Props {
  onChange: (patch: Partial<VariableSetterPair>) => void;
  onDelete: Function;
  onFocusName: Function;
  onFocusValue: Function;
  index: number;
  pair: VariableSetterPair;
  readOnly?: boolean;
  readOnlyKey?: boolean;
  ignoreSuggestKey?: boolean;
  onMove?: Function;
  onKeyDown?: Function;
  onBlurName?: Function;
  onBlurValue?: Function;
  nunjucksPowerUserMode?: boolean;
  isVariableUncovered?: boolean;
  handleGetAutocompleteValueConstants?: Function;
  valuePlaceholder?: string;
  sortable?: boolean;
  noDelete?: boolean;
  noToggle?: boolean;
  noDropZone?: boolean;
  hideButtons?: boolean;
  className?: string;
  renderLeftIcon?: Function;
  keyWidth?: React.CSSProperties;
  // For drag-n-dro;
  isDragging?: boolean;
  isDraggingOver?: boolean;
  variables: any[];
}

export const VariableValueSetterRow: FC<Props> = ({
  pair,
  className,
  keyWidth,
  variables,
  readOnly,
  onBlurName,
  onFocusName,
  valuePlaceholder,
  onChange,
  onKeyDown,
  handleGetAutocompleteValueConstants,
  noDelete,
  noToggle,
  hideButtons,
  onDelete,
  //   sortable,
  //   renderLeftIcon,
}) => {
  const [variableSelect, setVariableSelect] =
    useState<HTMLSelectElement | null>(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<OneLineEditorHandle>(null);
  const selectRef = useRef(null);

  const selectedId = variables.findIndex((v) => v.name === pair.objectKey);
  const { handleRender, handleGetRenderContext } = useNunjucks();

  const _sendChange = (patch: Partial<VariableSetterPair>) => {
    const tempPair = Object.assign({}, pair, patch);
    onChange && onChange(tempPair);
  };

  const _update = async (value: string | Key | null, noCallback = false) => {
    let preview = '';
    let error = '';
    let stringValue = '';
    let keyValue: Key | null | undefined = null;

    if (value) {
      if (typeof value === 'object') {
        keyValue = value as Key;
        stringValue = keyValue.name;
      } else {
        stringValue = value as string;
        keyValue = variables.find((v) => v.name === stringValue);
      }

      try {
        preview = await handleRender(`{{ ${stringValue} }}`);
      } catch (err) {
        error = err.message;
      }
    }
    // Hack to skip updating if we unmounted for some reason
    if (variableSelect) {
      setPreview(preview);
      setError(error);
    }
    // Call the callback if we need to
    if (!noCallback) {
      _sendChange({
        objectKey: stringValue,
      });
    }
  };

  useEffect(() => {
    _update(pair.setterValue, true);
    if (selectRef.current) {
      selectRef.current.focus();
    }
  }, []);

  const classes = classNames(className, {
    'key-value-editor__row-wrapper': true,
    'key-value-editor__row-wrapper--disabled': pair.disabled,
  });
  //   let handle: JSX.Element | undefined | null = null;
  //   if (sortable) {
  //     handle = renderLeftIcon ? (
  //       <div className="key-value-editor__drag">{renderLeftIcon()}</div>
  //     ) : (
  //       connectDragSource?.(
  //         <div className="key-value-editor__drag">
  //           <i className={'fa ' + (hideButtons ? 'fa-empty' : 'fa-bars')} />
  //         </div>,
  //       )
  //     );
  //   }
  const keyContainerStyle: React.CSSProperties = {};
  if (keyWidth) {
    Object.assign(keyContainerStyle, keyWidth);
  }
  const _handleBlurVariable = (e) => {
    if (onBlurName) {
      onBlurName(pair, e);
    }
  };
  const _handleFocusVariable = (e) => {
    onFocusName(pair, e);
  };

  const _handleChangeVariable = (e) => {
    const selected = e.target.value;
    if (selected) {
      _update(variables[selected]);
    } else {
      _update(null);
    }
  };

  const _handleTypeChange = (def: { multiline: boolean }) => {
    _sendChange({
      multiline: def.multiline,
    });
  };

  const _handleValueChange = (value) => {
    _sendChange({
      setterValue: value,
    });
  };

  const _handleEditMultiline = () => {
    showModal(CodePromptModal, {
      submitName: 'Done',
      title: `Edit setter value for "${pair.objectKey}"`,
      defaultValue: pair.setterValue,
      //   hideLineNumbers: false,
      onChange: _handleValueChange,
      enableRender: !!handleRender || !!handleGetRenderContext,
      mode: `${pair.multiline}` || 'text/plain',
      onModeChange: (mode) => {
        _handleTypeChange(
          Object.assign({}, pair, {
            multiline: mode,
          })
        );
      },
    });
  };

  const _handleKeyDown = (e, value) => {
    if (onKeyDown) {
      onKeyDown(pair, e, value);
    }
  };

  const _handleAutocompleteValues = () => {
    if (handleGetAutocompleteValueConstants) {
      return handleGetAutocompleteValueConstants(pair);
    }
    return [];
  };

  const _handleDisableChange = () => {
    _sendChange({
      disabled: !pair.disabled,
    });
  };

  const _handleDelete = () => {
    if (onDelete) {
      onDelete(pair);
    }
  };

  const renderPairValue = () => {
    if (pair.multiline) {
      const bytes = Buffer.from(pair.setterValue, 'utf8').length;
      return (
        <button
          className='btn btn--outlined btn--super-duper-compact wide ellipsis'
          onClick={_handleEditMultiline}
        >
          <i className='fa fa-pencil-square-o space-right' />
          {bytes > 0 ? describeByteSize(bytes, true) : 'Click to Edit'}
        </button>
      );
    } else {
      return (
        <OneLineEditor
          id={pair.id}
          ref={inputRef}
          readOnly={readOnly}
          type={'text'}
          placeholder={valuePlaceholder || 'Value'}
          defaultValue={pair.setterValue}
          onChange={_handleValueChange}
          onKeyDown={(e, value) => _handleKeyDown(e, value)}
          getAutocompleteConstants={_handleAutocompleteValues}
        />
      );
    }
  };

  const row = (
    <li className={classes}>
      {/* {handle} */}
      <div className='key-value-editor__row'>
        <div
          className={classNames(
            'form-control form-control--underlined form-control--wide',
            {
              'form-control--inactive': pair.disabled,
            }
          )}
          style={keyContainerStyle}
        >
          <select
            value={selectedId === -1 ? '' : selectedId}
            disabled={readOnly}
            onBlur={(e) => _handleBlurVariable(e)}
            onFocus={(e) => _handleFocusVariable(e)}
            onChange={(e) => _handleChangeVariable(e)}
          >
            <option value={''}>-- Please select a variable --</option>
            {variables.map((v, i) => (
              <option key={`${i}::${v.name}`} value={i}>
                [{v.meta?.type?.substr(0, 3)}]({v.meta?.name}) {v.name}
              </option>
            ))}
          </select>
        </div>
        <div
          className={classNames(
            'form-control form-control--underlined form-control--wide',
            {
              'form-control--inactive': pair.disabled,
            }
          )}
        >
          {renderPairValue()}
        </div>

        <Dropdown>
          <DropdownButton className='tall'>
            <i className='fa fa-caret-down' />
          </DropdownButton>
          <DropdownItem>
            <ItemContent
              label='Text'
              onClick={() => _handleTypeChange({ multiline: false })}
            />
          </DropdownItem>
          <DropdownItem>
            <ItemContent
              label='Text (Multi-line)'
              onClick={() => _handleTypeChange({ multiline: true })}
            />
          </DropdownItem>
        </Dropdown>

        {!noToggle &&
          (!hideButtons ? (
            <Button
              onClick={_handleDisableChange}
              title={pair.disabled ? 'Enable item' : 'Disable item'}
            >
              {pair.disabled ? (
                <i className='fa fa-square-o' />
              ) : (
                <i className='fa fa-check-square-o' />
              )}
            </Button>
          ) : (
            <button>
              <i className='fa fa-empty' />
            </button>
          ))}

        {!noDelete &&
          (!hideButtons ? (
            <PromptButton
              key={Math.random()}
              tabIndex={-1}
              confirmMessage=''
              onClick={_handleDelete}
              title='Delete item'
            >
              <i className='fa fa-trash-o' />
            </PromptButton>
          ) : (
            <button>
              <i className='fa fa-empty' />
            </button>
          ))}
      </div>
    </li>
  );
  return row;
};
