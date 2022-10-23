// eslint-disable-next-line filenames/match-exported
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { forwardRef, ForwardRefRenderFunction, PureComponent } from 'react';
import { ConnectDragPreview, ConnectDragSource, ConnectDropTarget, DragSource, DropTarget, DropTargetMonitor } from 'react-dnd';
import ReactDOM from 'react-dom';

import { AUTOBIND_CFG } from '../../../common/constants';
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

type DragDirection = 0 | 1 | -1;

interface Props {
  onChange?: (pair: Pair) => void;
  onDelete?: (pair: Pair) => void;
  onFocusName?: (pair: Pair, event: FocusEvent | React.FocusEvent<Element, Element>) => void;
  onFocusValue?: (pair: Pair, event: FocusEvent | React.FocusEvent<Element, Element>) => void;
  onFocusDescription?: (pair: Pair, event: FocusEvent | React.FocusEvent<Element, Element>) => void;
  displayDescription: boolean;
  index: number;
  pair: Pair;
  readOnly?: boolean;
  onMove?: (pairToMove: Pair, pairToTarget: Pair, targetOffset: 1 | -1) => void;
  onKeyDown?: (pair: Pair, event: KeyboardEvent | React.KeyboardEvent<Element>, value?: any) => void;
  onBlurName?: (pair: Pair, event: FocusEvent | React.FocusEvent<Element, Element>) => void;
  onBlurValue?: (pair: Pair, event: FocusEvent | React.FocusEvent<Element, Element>) => void;
  onBlurDescription?: (pair: Pair, event: FocusEvent | React.FocusEvent<Element, Element>) => void;
  enableNunjucks?: boolean;
  handleGetAutocompleteNameConstants?: AutocompleteHandler;
  handleGetAutocompleteValueConstants?: AutocompleteHandler;
  namePlaceholder?: string;
  valuePlaceholder?: string;
  descriptionPlaceholder?: string;
  valueInputType?: string;
  forceInput?: boolean;
  allowMultiline?: boolean;
  allowFile?: boolean;
  sortable?: boolean;
  noDelete?: boolean;
  noDropZone?: boolean;
  hideButtons?: boolean;
  className?: string;
  renderLeftIcon?: Function;
  // For drag-n-drop
  connectDragSource?: ConnectDragSource;
  connectDragPreview?: ConnectDragPreview;
  connectDropTarget?: ConnectDropTarget;
  isDragging?: boolean;
  isDraggingOver?: boolean;
}

interface State {
  dragDirection: DragDirection;
}

// export const KeyValueEditorRowInternal = forwardRef<OneLineEditorHandle, Props>(({props, ref}) => {

// })

@autoBindMethodsForReact(AUTOBIND_CFG)
class KeyValueEditorRowInternal extends PureComponent<Props, State> {
  _nameInput: OneLineEditorHandle | null = null;
  _valueInput: OneLineEditorHandle | null = null;
  _descriptionInput: OneLineEditorHandle | null = null;
  state: State = {
    dragDirection: 0,
  };

  focusNameEnd() {
    if (this._nameInput) {
      this._nameInput.focusEnd();
    }
  }

  focusValueEnd() {
    if (this._valueInput) {
      this._valueInput?.focusEnd();
    }
  }

  focusDescriptionEnd() {
    this._descriptionInput?.focusEnd();
  }

  setDragDirection(dragDirection: DragDirection) {
    if (dragDirection !== this.state.dragDirection) {
      this.setState({
        dragDirection,
      });
    }
  }

  _setDescriptionInputRef(descriptionInput: OneLineEditorHandle) {
    this._descriptionInput = descriptionInput;
  }

  _handleTypeChange(def: Partial<Pair>) {
    // Remove newlines if converting to text
    // WARNING: props should never be overwritten!
    let value = this.props.pair.value || '';
    if (def.type === 'text' && !def.multiline && value.includes('\n')) {
      value = value.replace(/\n/g, '');
    }
    this.props.onChange?.(Object.assign({}, this.props.pair, { type: def.type, multiline: def.multiline, value }));
  }

  render() {
    const {
      pair,
      namePlaceholder,
      sortable,
      noDropZone,
      hideButtons,
      forceInput,
      readOnly,
      className,
      isDragging,
      isDraggingOver,
      noDelete,
      renderLeftIcon,
      connectDragSource,
      connectDragPreview,
      connectDropTarget,
      displayDescription,
      descriptionPlaceholder,
      handleGetAutocompleteNameConstants,
      handleGetAutocompleteValueConstants,
      enableNunjucks,
      valueInputType,
      valuePlaceholder,
      onFocusName,
      allowMultiline,
      allowFile,
    } = this.props;
    const { dragDirection } = this.state;
    const classes = classnames(className, {
      'key-value-editor__row-wrapper': true,
      'key-value-editor__row-wrapper--dragging': isDragging,
      'key-value-editor__row-wrapper--dragging-above': isDraggingOver && dragDirection > 0,
      'key-value-editor__row-wrapper--dragging-below': isDraggingOver && dragDirection < 0,
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
            onClick={() => this._handleTypeChange({
              type: 'text',
              multiline: false,
            })}
          >
            Text
          </DropdownItem>
          {allowMultiline && (
            <DropdownItem
              onClick={() => this._handleTypeChange({
                type: 'text',
                multiline: true,
              })}
            >
              Text (Multi-line)
            </DropdownItem>
          )}
          {allowFile && (
            <DropdownItem
              onClick={() => this._handleTypeChange({
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
          onChange={filename => this.props.onChange?.(Object.assign({}, this.props.pair, { filename }))}
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
            onChange: value => this.props.onChange?.(Object.assign({}, this.props.pair, { value })),
            enableRender: enableNunjucks,
            mode: pair.multiline || 'text/plain',
            onModeChange: (mode: string) => {
              this._handleTypeChange(
                Object.assign({}, pair, {
                  multiline: mode,
                }),
              );
            },
          })}
        >
          <i className="fa fa-pencil-square-o space-right" />
          {bytes > 0 ? describeByteSize(bytes, true) : 'Click to Edit'}
        </button>
      );
    } else {
      pairValue = (
        <OneLineEditor
          ref={ref => {
            this._valueInput = ref;
          }}
          readOnly={readOnly}
          forceInput={forceInput}
          type={valueInputType || 'text'}
          placeholder={valuePlaceholder || 'Value'}
          defaultValue={pair.value}
          onPaste={event => {
            if (!this.props.allowMultiline) {
              return;
            }
            const value = event.clipboardData?.getData('text/plain');
            if (value?.includes('\n')) {
              event.preventDefault();
              // Insert the pasted text into the current selection.
              // Unfortunately, this is the easiest way to do this.
              const currentValue = this._valueInput?.getValue();
              const start = this._valueInput?.getSelectionStart() || 0;
              const end = this._valueInput?.getSelectionEnd() || 0;
              const prefix = currentValue?.slice(0, start);
              const suffix = currentValue?.slice(end);
              const finalValue = `${prefix}${value}${suffix}`;
              // Update type and value
              this._handleTypeChange({
                type: 'text',
                multiline: 'text/plain',
              });
              this.props.onChange?.(Object.assign({}, this.props.pair, { value: finalValue }));
            }
          }}
          onChange={value => this.props.onChange?.(Object.assign({}, this.props.pair, { value }))}
          onBlur={event => this.props.onBlurValue?.(this.props.pair, event)}
          onKeyDown={(event, value) => this.props.onKeyDown?.(this.props.pair, event, value)}
          onFocus={event => this.props.onFocusValue?.(this.props.pair, event)}
          getAutocompleteConstants={() => handleGetAutocompleteValueConstants?.(this.props.pair) || []}
        />
      );
    }

    let handle: ConnectDragSource | JSX.Element | undefined | null = null;

    if (sortable) {
      handle = renderLeftIcon ? (
        <div className="key-value-editor__drag">{renderLeftIcon()}</div>
      ) : (
        connectDragSource?.(
          <div className="key-value-editor__drag">
            <i className={'fa ' + (hideButtons ? 'fa-empty' : 'fa-reorder')} />
          </div>,
        )
      );
    }

    const row = (
      <li className={classes}>
        {handle}
        <div className="key-value-editor__row">
          <div
            className={classnames('form-control form-control--underlined form-control--wide', {
              'form-control--inactive': pair.disabled,
            })}
          >
            <OneLineEditor
              ref={ref => {
                this._nameInput = ref;
              }}
              placeholder={namePlaceholder || 'Name'}
              defaultValue={pair.name}
              getAutocompleteConstants={() => handleGetAutocompleteNameConstants?.(this.props.pair) || []}
              forceInput={forceInput}
              readOnly={readOnly}
              onBlur={event => this.props.onBlurName?.(this.props.pair, event)}
              onChange={name => this.props.onChange?.(Object.assign({}, this.props.pair, { name }))}
              onFocus={event => onFocusName?.(this.props.pair, event)}
              onKeyDown={(event, value) => this.props.onKeyDown?.(this.props.pair, event, value)}
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
                ref={this._setDescriptionInputRef}
                readOnly={readOnly}
                forceInput={forceInput}
                placeholder={descriptionPlaceholder || 'Description'}
                defaultValue={pair.description || ''}
                onChange={description => this.props.onChange?.(Object.assign({}, this.props.pair, { description }))}
                onBlur={event => this.props.onBlurDescription?.(this.props.pair, event)}
                onKeyDown={(event, value) => this.props.onKeyDown?.(this.props.pair, event, value)}
                onFocus={event => this.props.onFocusDescription?.(this.props.pair, event)}
              />
            </div>
          ) : null}

          {renderPairSelector}

          {!hideButtons ? (
            <button
              onClick={() => this.props.onChange?.(Object.assign({}, this.props.pair, { disabled: !pair.disabled }))}
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
                onClick={() => this.props.onDelete?.(this.props.pair)}
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

    if (noDropZone) {
      return row;
    } else {
      const dropTarget = connectDropTarget?.(row);
      // @ts-expect-error -- TSCONVERSION investigate whether a cast is actually appropriate here
      return connectDragPreview?.(dropTarget);
    }
  }
}

const dragSource = {
  beginDrag(props: Props) {
    return {
      pair: props.pair,
    };
  },
};

function isAbove(monitor: DropTargetMonitor, component: any) {
  const hoveredNode = ReactDOM.findDOMNode(component);
  // @ts-expect-error -- TSCONVERSION
  const hoveredTop = hoveredNode.getBoundingClientRect().top;
  // @ts-expect-error -- TSCONVERSION
  const height = hoveredNode.clientHeight;
  const draggedTop = monitor.getSourceClientOffset()?.y;
  // NOTE: Not quite sure why it's height / 3 (seems to work)
  return draggedTop !== undefined ? hoveredTop > draggedTop - height / 3 : false;
}

const dragTarget = {
  drop(props: Props, monitor: DropTargetMonitor, component: any) {
    if (isAbove(monitor, component)) {
      props.onMove?.(monitor.getItem().pair, props.pair, 1);
    } else {
      props.onMove?.(monitor.getItem().pair, props.pair, -1);
    }
  },

  hover(_props: Props, monitor: DropTargetMonitor, component: any) {
    if (isAbove(monitor, component)) {
      component.setDragDirection(1);
    } else {
      component.setDragDirection(-1);
    }
  },
};

const KeyValueEditorRowFCWithRef: ForwardRefRenderFunction<KeyValueEditorRowInternal, Omit<Props, 'enableNunjucks'>> = (
  props,
  ref
) => {
  const { enabled } = useNunjucksEnabled();

  return <KeyValueEditorRowInternal ref={ref} {...props} enableNunjucks={enabled} />;

};

const KeyValueEditorRowFC = forwardRef(KeyValueEditorRowFCWithRef);

const source = DragSource('KEY_VALUE_EDITOR', dragSource, (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  connectDragPreview: connect.dragPreview(),
  isDragging: monitor.isDragging(),
}))(KeyValueEditorRowFC);

export const Row = DropTarget('KEY_VALUE_EDITOR', dragTarget, (connect, monitor) => ({
  connectDropTarget: connect.dropTarget(),
  isDraggingOver: monitor.isOver(),
}))(source);

Row.prototype.focusNameEnd = function() {
  this.decoratedRef.current.decoratedRef.current.focusNameEnd();
};

Row.prototype.focusValueEnd = function() {
  this.decoratedRef.current.decoratedRef.current.focusValueEnd();
};

Row.prototype.focusDescriptionEnd = function() {
  this.decoratedRef.current.decoratedRef.current.focusDescriptionEnd();
};
