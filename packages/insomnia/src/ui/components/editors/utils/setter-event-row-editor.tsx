import classNames from 'classnames';
import React, { FC, Fragment, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

import {
  RequestSetter,
  SetterEventType,
  sort as setterSort,
} from '../../../../models/request-setter';
import { PromptButton } from '../../base/prompt-button';
import { Button } from '../../themed-button';
import {
  VariableSetterPair,
  VariableValueSetterRow,
} from '../../variable-setter-editor/row';

const NAME = 'name';
const VALUE = 'value';
const ENTER = 13;
const BACKSPACE = 8;
const UP = 38;
const DOWN = 40;
const LEFT = 37;
const RIGHT = 39;

interface Props {
  eventName: string;
  eventType: SetterEventType;
  pairs: RequestSetter[];
  variables: any[];
  handleGetAutocompleteValueConstants?: Function;
  maxPairs?: number;
  valuePlaceholder?: string;
  disableDelete?: boolean;
  disableToggle?: boolean;
  onDelete?: Function;
  onDeleteAll?: Function;
  onCreate?: Function;
  onChange: Function;
  className?: string;
  keyWidth?: React.CSSProperties;
}

const StyledContainer = styled.div`
  padding: var(--padding-xs);
  border-bottom: 1.5px solid var(--hl-xl);

  > .event-header {
    display: flex;
    flex-direction: row;
    align-items: stretch;

    h4 {
      width: 100%;
      padding-top: var(--padding-xs);

      .bubble {
        position: relative;
        bottom: 0.4em;
        font-size: 0.8em;
        min-width: 0.6em;
        background: var(--hl-sm);
        padding: 2px;
        border-radius: 3px;
        display: inline-block;
        text-align: center;
        line-height: 0.8em;
        border: 1px solid var(--hl-xxs);
      }
    }

    .btn {
      width: auto;
    }
  }
`;

const _convertPropsPair = (pairs: RequestSetter[]): VariableSetterPair[] => {
  return pairs.sort(setterSort).map((p) => ({
    description: p.description,
    disabled: !p.enabled,
    id: p._id,
    propertyName: p.objectKey,
    value: p.setterValue,
    multiline: p.multiline || false,
  }));
};

const SetterEventRowEditor: FC<Props> = ({
  className,
  pairs,
  eventName,
  maxPairs,
  onDeleteAll,
  eventType,
  onCreate,
  disableDelete,
  disableToggle,
  keyWidth,
  valuePlaceholder,
  onChange,
  onDelete,
  variables,
  handleGetAutocompleteValueConstants,
}) => {
  const [isToggled, setIsToggled] = useState(pairs.length > 0);
  const [pairState, setPairState] = useState(_convertPropsPair(pairs));
  const [focusedPairId, setFocusedPairId] = useState(null);
  const [focusedField, setFocusedField] = useState<string | null>(NAME);
  const [rows, setRows] = useState<typeof VariableValueSetterRow[]>([]);
  const triggerTimeoutRef = useRef(null);
  const classes = classNames('key-value-editor', 'wide', className);

  useEffect(() => {
    const convertedPairs = _convertPropsPair(pairs);
    setPairState(convertedPairs);

    // Handle toggling logic based on initial pairs
    if (!pairs.length && convertedPairs.length) {
      setIsToggled(true);
    }
  }, [pairs]);

  useEffect(() => {
    // Handle unmounting
    return () => {
      if (triggerTimeoutRef.current) {
        clearTimeout(triggerTimeoutRef?.current);
      }
    };
  }, []);

  const _handleToggle = () => setIsToggled(!isToggled);

  const _handleDeleteAllSetter = () => {
    if (onDeleteAll) {
      onDeleteAll(eventType);
      setIsToggled(false);
    }
  };

  const _handleCreateSetter = () => {
    onCreate && onCreate(eventType);
    setIsToggled(true);
  };

  const _handlePairChange = (pair) => {
    const setter = pairs.find((p) => p._id === pair._id);
    if (setter && onChange) {
      const patch: Partial<RequestSetter> = {};
      pair.objectKey && (patch.objectKey = pair.objectKey);
      pair.disabled !== undefined && (patch.enabled = !pair.disabled);
      pair.setterValue && (patch.setterValue = pair.setterValue);
      pair.multiline !== undefined && (patch.multiline = pair.multiline);
      onChange(setter, patch);
    }
  };

  const _handlePairDelete = (pair) => {
    const setter = pairs.find((p) => p._id === pair._id);
    if (setter && onDelete) {
      onDelete(setter);
    }
  };

  const _setFocusedPair = (pair) => {
    if (pair) {
      setFocusedPairId(pair._id);
    } else {
      setFocusedPairId(null);
    }
  };

  const _handleFocusName = (pair) => {
    _setFocusedPair(pair);
    setFocusedField(NAME);
    if (rows[pair.id]) {
      rows[pair.id].focusNameEnd();
    }
  };

  const _handleFocusValue = (pair) => {
    _setFocusedPair(pair);
    setFocusedField(VALUE);
  };

  const _handleKeyDown = (_pair, e, value) => {
    if (e.metaKey || e.ctrlKey) {
      return;
    }

    if (e.keyCode === ENTER) {
      _focusNext(true);
    } else if (e.keyCode === BACKSPACE) {
      if (!value) {
        _focusPrevious();
      }
    } else if (e.keyCode === DOWN) {
      e.preventDefault();

      _focusNextPair();
    } else if (e.keyCode === UP) {
      e.preventDefault();

      _focusPreviousPair();
    }
    // else if (e.keyCode === LEFT) {
    //   // TODO: Implement this
    // } else if (e.keyCode === RIGHT) {
    //   // TODO: Implement this
    // }
  };

  const _focusNext = (addIfValue = false) => {
    if (maxPairs === 1) {
      return;
    }

    if (focusedField === NAME) {
      setFocusedField(VALUE);

      _updateFocus();
    } else if (focusedField === VALUE) {
      setFocusedField(NAME);

      if (addIfValue) {
        onCreate && onCreate();
      } else {
        _focusNextPair();
      }
    }
  };

  const _focusPrevious = () => {
    if (focusedField === VALUE) {
      setFocusedField(NAME);

      _updateFocus();
    } else if (focusedField === NAME) {
      setFocusedField(VALUE);

      _focusPreviousPair();
    }
  };

  const _focusNextPair = () => {
    if (maxPairs === 1) {
      return;
    }

    const i = _getFocusedPairIndex();

    if (i === -1) {
      // No focused pair currently
      return;
    }

    if (i >= pairState - 1) {
      // Focused on last one, so add another
      _handleCreateSetter();
    } else {
      _setFocusedPair(pairState[i + 1]);

      _updateFocus();
    }
  };

  const _focusPreviousPair = () => {
    if (maxPairs === 1) {
      return;
    }

    const i = _getFocusedPairIndex();

    if (i > 0) {
      _setFocusedPair(pairState[i - 1]);

      _updateFocus();
    }
  };

  const _updateFocus = () => {
    const pair = _getFocusedPair();

    const id = pair ? pair._id : 'n/a';
    const row = rows[id];

    if (!row) {
      return;
    }

    // if (focusedField === NAME) {
    //   row.focusNameEnd();
    // } else if (this._focusedField === VALUE) {
    //   row.focusValueEnd();
    // }
  };

  const _getFocusedPair = () => {
    return pairState.find((p) => p._id === focusedPairId) || null;
  };

  const _getFocusedPairIndex = () => {
    return _getPairIndex(_getFocusedPair());
  };

  const _getPairIndex = (pair) => {
    if (pair) {
      return pairState.findIndex((p) => p._id === pair._id);
    } else {
      return -1;
    }
  };

  const _handleBlurName = () => {
    setFocusedField(null);
  };

  return (
    <StyledContainer>
      <div className='event-header'>
        <Button onClick={_handleToggle} className='space-right'>
          {isToggled ? (
            <i className='fa fa-chevron-down' />
          ) : (
            <i className='fa fa-chevron-right' />
          )}
        </Button>
        <h4 onClick={_handleToggle}>
          {eventName}
          {pairs.length ? (
            <span className='bubble space-left'>{pairs.length}</span>
          ) : null}
        </h4>
        {pairs.length ? (
          <PromptButton
            key={Math.random()}
            tabIndex={-1}
            confirmMessage='Click again to confirm'
            onClick={_handleDeleteAllSetter}
            className='btn btn--clicky space-right'
            title='Delete all setter'
          >
            <i className='fa fa-eraser' />
          </PromptButton>
        ) : null}
        {!maxPairs || pairs.length < maxPairs ? (
          <Button onClick={_handleCreateSetter} className='btn btn--clicky'>
            <i className='fa fa-plus-circle' />
          </Button>
        ) : null}
      </div>
      {isToggled && pairs.length > 0 && (
        <Fragment>
          <ul className={classes}>
            {pairs.map((pair, i) => (
              <VariableValueSetterRow
                noDelete={disableDelete}
                noToggle={disableToggle}
                key={pair._id || 'no-id'}
                index={i} // For dragging
                keyWidth={keyWidth}
                sortable
                valuePlaceholder={valuePlaceholder}
                onChange={_handlePairChange}
                onDelete={_handlePairDelete}
                onFocusName={_handleFocusName}
                onFocusValue={_handleFocusValue}
                onKeyDown={_handleKeyDown}
                onBlurName={_handleBlurName}
                variables={variables}
                handleGetAutocompleteValueConstants={
                  handleGetAutocompleteValueConstants
                }
                pair={pair}
              />
            ))}
          </ul>
        </Fragment>
      )}
    </StyledContainer>
  );
};

export default SetterEventRowEditor;
