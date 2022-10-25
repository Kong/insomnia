import classnames from 'classnames';
import React, { FC, useRef, useState } from 'react';

import { generateId } from '../../../common/misc';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { PromptButton } from '../base/prompt-button';
import { AutocompleteHandler, Pair, Row, RowHandle } from './row';

interface Props {
  allowFile?: boolean;
  allowMultiline?: boolean;
  className?: string;
  descriptionPlaceholder?: string;
  handleGetAutocompleteNameConstants?: AutocompleteHandler;
  handleGetAutocompleteValueConstants?: AutocompleteHandler;
  isDisabled?: boolean;
  isWebSocketRequest?: boolean;
  namePlaceholder?: string;
  onChange: Function;
  pairs: Pair[];
  valuePlaceholder?: string;
}

export const KeyValueEditor: FC<Props> = ({
  allowFile,
  allowMultiline,
  className,
  descriptionPlaceholder,
  handleGetAutocompleteNameConstants,
  handleGetAutocompleteValueConstants,
  isDisabled,
  isWebSocketRequest,
  namePlaceholder,
  onChange,
  pairs,
  valuePlaceholder,
}) => {
  const rowRef = useRef<RowHandle>(null);

  const readOnlyPairs = [
    { name: 'Connection', value: 'Upgrade' },
    { name: 'Upgrade', value: 'websocket' },
    { name: 'Sec-WebSocket-Key', value: '<calculated at runtime>' },
    { name: 'Sec-WebSocket-Version', value: '13' },
    { name: 'Sec-WebSocket-Extensions', value: 'permessage-deflate; client_max_window_bits' },
  ];
  return (
    <ul className={classnames('key-value-editor', 'wide', className)}>
      {isWebSocketRequest ? readOnlyPairs.map((pair, i) => (
        <Row
          key={i}
          descriptionPlaceholder={descriptionPlaceholder}
          readOnly
          hideButtons
          forceInput
          pair={pair}
          onChange={() => {}}
          addPair={() => {}}
          deleteAll={() => {}}
        />
      )) : null}
      {pairs.map(pair => (
        <Row
          key={pair.id}
          ref={rowRef}
          namePlaceholder={namePlaceholder}
          valuePlaceholder={valuePlaceholder}
          descriptionPlaceholder={descriptionPlaceholder}
          onChange={pair => onChange(pairs.map(p => (p.id === pair.id ? pair : p)))}
          onDelete={pair => onChange(pairs.filter(p => p.id !== pair.id))}
          handleGetAutocompleteNameConstants={handleGetAutocompleteNameConstants}
          handleGetAutocompleteValueConstants={handleGetAutocompleteValueConstants}
          allowMultiline={allowMultiline}
          allowFile={allowFile}
          readOnly={isDisabled}
          hideButtons={isDisabled}
          pair={pair}
          addPair={() => onChange([...pairs, {
            id: generateId('pair'),
            name: '',
            value: '',
            description: '',
          }])}
          deleteAll={() => onChange([])}
        />
      ))}
    </ul>
  );
};
