import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG, DEBOUNCE_MILLIS } from '../../../common/constants';
import { generateId, nullFn } from '../../../common/misc';
import { HandleGetRenderContext, HandleRender } from '../../../common/render';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { Lazy } from '../base/lazy';
import { PromptButton } from '../base/prompt-button';
import { Row } from './row';

const NAME = 'name';
const VALUE = 'value';
const DESCRIPTION = 'description';
const ENTER = 13;
const BACKSPACE = 8;
const UP = 38;
const DOWN = 40;
const LEFT = 37;
const RIGHT = 39;

interface Props {
  onChange: Function;
  pairs: any[];
  handleRender?: HandleRender;
  handleGetRenderContext?: HandleGetRenderContext;
  nunjucksPowerUserMode?: boolean;
  isVariableUncovered?: boolean;
  handleGetAutocompleteNameConstants?: Function;
  handleGetAutocompleteValueConstants?: Function;
  allowFile?: boolean;
  allowMultiline?: boolean;
  sortable?: boolean;
  maxPairs?: number;
  namePlaceholder?: string;
  valuePlaceholder?: string;
  descriptionPlaceholder?: string;
  valueInputType?: string;
  disableDelete?: boolean;
  onToggleDisable?: Function;
  onChangeType?: Function;
  onChooseFile?: Function;
  onDelete?: Function;
  onCreate?: Function;
  className?: string;
}

interface State {
  pairs: Props['pairs'];
  displayDescription: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class KeyValueEditor extends PureComponent<Props, State> {
  _focusedPairId: string | null = null;
  _focusedField: string | null = NAME;
  // @ts-expect-error -- TSCONVERSION being imported as a value but should be usable as a type
  private _rows: Row[] = [];
  _triggerTimeout: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    // Migrate and add IDs to all pairs (pairs didn't used to have IDs)
    const pairs = [...props.pairs];

    for (const pair of pairs) {
      if (props.maxPairs !== 1 && !pair.id) {
        pair.id = generateId('pair');
      }
    }

    this.state = {
      pairs,
      // If any pair has a description, display description field
      displayDescription: props.pairs.some(p => p.description),
    };
  }

  // @ts-expect-error -- TSCONVERSION being imported as a value but should be usable as a type
  private _setRowRef(n?: Row) {
    // NOTE: We're not handling unmounting (may lead to a bug)
    if (n) {
      this._rows[n.props.pair.id] = n;
    }
  }

  _handlePairChange(pair) {
    const i = this._getPairIndex(pair);

    const pairs = [
      ...this.state.pairs.slice(0, i),
      Object.assign({}, pair),
      ...this.state.pairs.slice(i + 1),
    ];

    this._onChange(pairs);
  }

  _handleDeleteAll() {
    this._onChange([]);
  }

  _handleMove(pairToMove, pairToTarget, targetOffset) {
    if (pairToMove.id === pairToTarget.id) {
      // Nothing to do
      return;
    }

    const withoutPair = this.state.pairs.filter(p => p.id !== pairToMove.id);
    let toIndex = withoutPair.findIndex(p => p.id === pairToTarget.id);

    // If we're moving below, add 1 to the index
    if (targetOffset < 0) {
      toIndex += 1;
    }

    const pairs = [
      ...withoutPair.slice(0, toIndex),
      Object.assign({}, pairToMove),
      ...withoutPair.slice(toIndex),
    ];

    this._onChange(pairs);
  }

  _handlePairDelete(pair) {
    const i = this.state.pairs.findIndex(p => p.id === pair.id);

    this._deletePair(i, true);
  }

  _handleBlurName() {
    this._focusedField = null;
  }

  _handleBlurValue() {
    this._focusedField = null;
  }

  _handleBlurDescription() {
    this._focusedField = null;
  }

  _handleFocusName(pair) {
    this._setFocusedPair(pair);

    this._focusedField = NAME;

    this._rows[pair.id].focusNameEnd();
  }

  _handleFocusValue(pair) {
    this._setFocusedPair(pair);

    this._focusedField = VALUE;

    this._rows[pair.id].focusValueEnd();
  }

  _handleFocusDescription(pair) {
    this._setFocusedPair(pair);

    this._focusedField = DESCRIPTION;

    this._rows[pair.id].focusDescriptionEnd();
  }

  _handleAddFromName() {
    this._focusedField = NAME;

    this._addPair();
  }

  // Sometimes multiple focus events come in, so lets debounce it
  _handleAddFromValue() {
    this._focusedField = VALUE;

    this._addPair();
  }

  _handleAddFromDescription() {
    this._focusedField = DESCRIPTION;

    this._addPair();
  }

  _handleKeyDown(_pair, e, value) {
    if (e.metaKey || e.ctrlKey) {
      return;
    }

    if (e.keyCode === ENTER) {
      this._focusNext(true);
    } else if (e.keyCode === BACKSPACE) {
      if (!value) {
        this._focusPrevious(true);
      }
    } else if (e.keyCode === DOWN) {
      e.preventDefault();

      this._focusNextPair();
    } else if (e.keyCode === UP) {
      e.preventDefault();

      this._focusPreviousPair();
    } else if (e.keyCode === LEFT) {
      // TODO: Implement this
    } else if (e.keyCode === RIGHT) {
      // TODO: Implement this
    }
  }

  _onChange(pairs) {
    this.setState(
      {
        pairs,
      },
      () => {
        if (this._triggerTimeout !== null) {
          clearTimeout(this._triggerTimeout);
        }
        this._triggerTimeout = setTimeout(() => {
          this.props.onChange(pairs);
        }, DEBOUNCE_MILLIS);
      },
    );
  }

  _addPair(position?: number) {
    const numPairs = this.state.pairs.length;
    const { maxPairs } = this.props;

    // Don't add any more pairs
    if (maxPairs !== undefined && numPairs >= maxPairs) {
      return;
    }

    position = position === undefined ? numPairs : position;
    const pair = {
      id: '',
      name: '',
      value: '',
      description: '',
    };

    // Only add ids if we need 'em
    if (this.props.maxPairs !== 1) {
      pair.id = generateId('pair');
    }

    const pairs = [
      ...this.state.pairs.slice(0, position),
      pair,
      ...this.state.pairs.slice(position),
    ];

    this._setFocusedPair(pair);

    this._onChange(pairs);

    this.props.onCreate?.();
  }

  _deletePair(position, breakFocus = false) {
    if (this.props.disableDelete) {
      return;
    }

    const focusedPosition = this._getFocusedPairIndex();

    const pair = this.state.pairs[position];
    this.props.onDelete?.(pair);
    const pairs = [...this.state.pairs.slice(0, position), ...this.state.pairs.slice(position + 1)];

    if (focusedPosition >= position) {
      const newPosition = breakFocus ? -1 : focusedPosition - 1;

      this._setFocusedPair(pairs[newPosition]);
    }

    this._onChange(pairs);
  }

  _focusNext(addIfValue = false) {
    if (this.props.maxPairs === 1) {
      return;
    }

    if (this._focusedField === NAME) {
      this._focusedField = VALUE;

      this._updateFocus();
    } else if (this._focusedField === VALUE && this.state.displayDescription) {
      this._focusedField = DESCRIPTION;

      this._updateFocus();
    } else if (this._focusedField === VALUE || this._focusedField === DESCRIPTION) {
      this._focusedField = NAME;

      if (addIfValue) {
        this._addPair(this._getFocusedPairIndex() + 1);
      } else {
        this._focusNextPair();
      }
    }
  }

  _focusPrevious(deleteIfEmpty = false) {
    if (this._focusedField === DESCRIPTION) {
      this._focusedField = VALUE;

      this._updateFocus();
    } else if (this._focusedField === VALUE) {
      this._focusedField = NAME;

      this._updateFocus();
    } else if (this._focusedField === NAME) {
      const p = this._getFocusedPair();

      const notEmpty = !p.name && !p.value && !p.fileName;

      if (!this.props.disableDelete && notEmpty && deleteIfEmpty) {
        this._focusedField = VALUE;

        this._deletePair(this._getFocusedPairIndex());
      } else if (!p.name) {
        this._focusedField = VALUE;

        this._focusPreviousPair();
      }
    }
  }

  _focusNextPair() {
    if (this.props.maxPairs === 1) {
      return;
    }

    const i = this._getFocusedPairIndex();

    if (i === -1) {
      // No focused pair currently
      return;
    }

    if (i >= this.state.pairs.length - 1) {
      // Focused on last one, so add another
      this._addPair();
    } else {
      this._setFocusedPair(this.state.pairs[i + 1]);

      this._updateFocus();
    }
  }

  _focusPreviousPair() {
    if (this.props.maxPairs === 1) {
      return;
    }

    const i = this._getFocusedPairIndex();

    if (i > 0) {
      this._setFocusedPair(this.state.pairs[i - 1]);

      this._updateFocus();
    }
  }

  _updateFocus() {
    const pair = this._getFocusedPair();

    const id = pair ? pair.id : 'n/a';
    const row = this._rows[id];

    if (!row) {
      return;
    }

    if (this._focusedField === NAME) {
      row.focusNameEnd();
    } else if (this._focusedField === VALUE) {
      row.focusValueEnd();
    } else if (this._focusedField === DESCRIPTION) {
      row.focusDescriptionEnd();
    }
  }

  _getPairIndex(pair) {
    if (pair) {
      return this.state.pairs.findIndex(p => p.id === pair.id);
    } else {
      return -1;
    }
  }

  _getFocusedPairIndex() {
    return this._getPairIndex(this._getFocusedPair());
  }

  _getFocusedPair() {
    return this.state.pairs.find(p => p.id === this._focusedPairId) || null;
  }

  _setFocusedPair(pair) {
    if (pair) {
      this._focusedPairId = pair.id;
    } else {
      this._focusedPairId = null;
    }
  }

  _toggleDescription() {
    this.setState({
      displayDescription: !this.state.displayDescription,
    });
  }

  componentDidUpdate() {
    this._updateFocus();
  }

  render() {
    const {
      maxPairs,
      className,
      valueInputType,
      valuePlaceholder,
      namePlaceholder,
      descriptionPlaceholder,
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode,
      isVariableUncovered,
      handleGetAutocompleteNameConstants,
      handleGetAutocompleteValueConstants,
      allowFile,
      allowMultiline,
      sortable,
      disableDelete,
    } = this.props;
    const { pairs } = this.state;
    const classes = classnames('key-value-editor', 'wide', className);
    return (
      <Lazy delay={pairs.length > 20 ? 50 : -1}>
        <ul className={classes}>
          {pairs.map((pair, i) => (
            <Row
              noDelete={disableDelete}
              key={pair.id || 'no-id'}
              index={i} // For dragging
              ref={this._setRowRef}
              sortable={sortable}
              displayDescription={this.state.displayDescription}
              namePlaceholder={namePlaceholder}
              valuePlaceholder={valuePlaceholder}
              descriptionPlaceholder={descriptionPlaceholder}
              valueInputType={valueInputType}
              onChange={this._handlePairChange}
              onDelete={this._handlePairDelete}
              onFocusName={this._handleFocusName}
              onFocusValue={this._handleFocusValue}
              onFocusDescription={this._handleFocusDescription}
              onKeyDown={this._handleKeyDown}
              onBlurName={this._handleBlurName}
              onBlurValue={this._handleBlurValue}
              onBlurDescription={this._handleBlurDescription}
              onMove={this._handleMove}
              nunjucksPowerUserMode={nunjucksPowerUserMode}
              isVariableUncovered={isVariableUncovered}
              handleRender={handleRender}
              handleGetRenderContext={handleGetRenderContext}
              handleGetAutocompleteNameConstants={handleGetAutocompleteNameConstants}
              handleGetAutocompleteValueConstants={handleGetAutocompleteValueConstants}
              allowMultiline={allowMultiline}
              allowFile={allowFile}
              pair={pair}
            />
          ))}

          {!maxPairs || pairs.length < maxPairs ? (
            <Row
              key="empty-row"
              hideButtons
              sortable
              noDropZone
              readOnly
              forceInput
              index={-1}
              onChange={nullFn}
              onDelete={nullFn}
              renderLeftIcon={() => (
                <Dropdown>
                  <DropdownButton>
                    <i className="fa fa-cog" />
                  </DropdownButton>
                  <DropdownItem onClick={this._handleDeleteAll} buttonClass={PromptButton}>
                    Delete All Items
                  </DropdownItem>
                  <DropdownItem onClick={this._toggleDescription}>Toggle Description</DropdownItem>
                </Dropdown>
              )}
              className="key-value-editor__row-wrapper--clicker"
              displayDescription={this.state.displayDescription}
              namePlaceholder={`New ${namePlaceholder}`}
              valuePlaceholder={`New ${valuePlaceholder}`}
              descriptionPlaceholder={`New ${descriptionPlaceholder}`}
              onFocusName={this._handleAddFromName}
              onFocusValue={this._handleAddFromValue}
              onFocusDescription={this._handleAddFromDescription}
              allowMultiline={allowMultiline}
              allowFile={allowFile}
              // @ts-expect-error -- TSCONVERSION missing defaults
              pair={{
                name: '',
                value: '',
                description: '',
              }}
            />
          ) : null}
        </ul>
      </Lazy>
    );
  }
}
