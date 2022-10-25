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
  namePlaceholder?: string;
  valuePlaceholder?: string;
  descriptionPlaceholder?: string;
  className?: string;
  isDisabled?: boolean;
  isWebSocketRequest?: boolean;
}

export const KeyValueEditor: FC<Props> = ({
  className,
  valuePlaceholder,
  namePlaceholder,
  descriptionPlaceholder,
  handleGetAutocompleteNameConstants,
  handleGetAutocompleteValueConstants,
  allowFile,
  allowMultiline,
  isDisabled,
  isWebSocketRequest,
  onChange,
  pairs,
}) => {
  const [displayDescription, setDisplayDescription] = useState<boolean>(false);
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
          key={pair.id}
          ref={rowRef}
          displayDescription={displayDescription}
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
        />
      ))}
      {!isDisabled ? (
        <div className="key-value-editor__drag">
          <Dropdown>
            <DropdownButton>
              <i className="fa fa-cog" />
            </DropdownButton>
            <DropdownItem onClick={() => onChange([])} buttonClass={PromptButton}>
              Delete All Items
            </DropdownItem>
            <DropdownItem onClick={() => setDisplayDescription(!displayDescription)}>Toggle Description</DropdownItem>
            <DropdownItem
              onClick={() => {
                rowRef.current?.focusNameEnd();
                onChange([...pairs, {
                  id: generateId('pair'),
                  name: '',
                  value: '',
                  description: '',
                }]);
              }}
            >Add header</DropdownItem>
          </Dropdown>
        </div>
      ) : null}
    </ul>
  );
};
