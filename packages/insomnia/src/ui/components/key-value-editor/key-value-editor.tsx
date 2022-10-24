import classnames from 'classnames';
import React, { FC, useRef, useState } from 'react';

import { generateId } from '../../../common/misc';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { PromptButton } from '../base/prompt-button';
import { AutocompleteHandler, Pair, Row, RowHandle } from './row';

interface Props {
  onChange: Function;
  pairs: Pair[];
  handleGetAutocompleteNameConstants?: AutocompleteHandler;
  handleGetAutocompleteValueConstants?: AutocompleteHandler;
  allowFile?: boolean;
  allowMultiline?: boolean;
  maxPairs?: number;
  namePlaceholder?: string;
  valuePlaceholder?: string;
  descriptionPlaceholder?: string;
  valueInputType?: string;
  disableDelete?: boolean;
  onDelete?: Function;
  onCreate?: Function;
  className?: string;
  isDisabled?: boolean;
  isWebSocketRequest?: boolean;
}

export const KeyValueEditor: FC<Props> = ({
  maxPairs,
  className,
  valueInputType,
  valuePlaceholder,
  namePlaceholder,
  descriptionPlaceholder,
  handleGetAutocompleteNameConstants,
  handleGetAutocompleteValueConstants,
  allowFile,
  allowMultiline,
  disableDelete,
  isDisabled,
  isWebSocketRequest,
  onChange,
  onDelete,
  onCreate,
  pairs,
}) => {
  const [displayDescription, setDisplayDescription] = useState<boolean>(false);
  const rowRef = useRef<RowHandle>(null);
  const classes = classnames('key-value-editor', 'wide', className);
  const hasMaxPairsAndNotExceeded = !maxPairs || pairs.length < maxPairs;
  const showNewHeaderInput = !isDisabled && hasMaxPairsAndNotExceeded;
  function addPair() {
    const numPairs = pairs.length;
    // Don't add any more pairs
    if (maxPairs !== undefined && numPairs >= maxPairs) {
      return;
    }
    rowRef.current?.focusNameEnd();
    onChange([...pairs, {
      id: generateId('pair'),
      name: '',
      value: '',
      description: '',
    }]);
    onCreate?.();
  }

  const readOnlyPairs = [
    { name: 'Connection', value: 'Upgrade' },
    { name: 'Upgrade', value: 'websocket' },
    { name: 'Sec-WebSocket-Key', value: '<calculated at runtime>' },
    { name: 'Sec-WebSocket-Version', value: '13' },
    { name: 'Sec-WebSocket-Extensions', value: 'permessage-deflate; client_max_window_bits' },
  ];
  return (
    <ul className={classes}>
      {isWebSocketRequest ? readOnlyPairs.map((pair, i) => (
        <Row
          key={i}
          displayDescription={displayDescription}
          descriptionPlaceholder={descriptionPlaceholder}
          readOnly
          hideButtons
          forceInput
          pair={pair}
        />
      )) : null}
      {pairs.map(pair => (
        <Row
          noDelete={disableDelete}
          key={pair.id}
          ref={rowRef}
          displayDescription={displayDescription}
          namePlaceholder={namePlaceholder}
          valuePlaceholder={valuePlaceholder}
          descriptionPlaceholder={descriptionPlaceholder}
          valueInputType={valueInputType}
          onChange={pair => {
            const index = pairs.findIndex(p => p.id === pair.id);
            onChange([
              ...pairs.slice(0, index),
              pair,
              ...pairs.slice(index + index),
            ]);
          }}
          onDelete={pair => {
            if (disableDelete) {
              return;
            }
            const index = pairs.findIndex(p => p.id === pair.id);
            onDelete?.(pairs[index]);
            onChange([...pairs.slice(0, index), ...pairs.slice(index + 1)]);
          }}
          handleGetAutocompleteNameConstants={handleGetAutocompleteNameConstants}
          handleGetAutocompleteValueConstants={handleGetAutocompleteValueConstants}
          allowMultiline={allowMultiline}
          allowFile={allowFile}
          readOnly={isDisabled}
          hideButtons={isDisabled}
          pair={pair}
        />
      ))}
      {showNewHeaderInput ? (
        <div className="key-value-editor__drag">
          <Dropdown>
            <DropdownButton>
              <i className="fa fa-cog" />
            </DropdownButton>
            <DropdownItem onClick={() => onChange([])} buttonClass={PromptButton}>
              Delete All Items
            </DropdownItem>
            <DropdownItem onClick={() => setDisplayDescription(!displayDescription)}>Toggle Description</DropdownItem>
            <DropdownItem onClick={() => addPair()}>Add header</DropdownItem>
          </Dropdown>
        </div>
      ) : null}
    </ul>
  );
};
