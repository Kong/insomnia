import classnames from 'classnames';
import React, { FC, Fragment, useRef } from 'react';
import styled from 'styled-components';

import { generateId } from '../../../common/misc';
import { PromptButton } from '../base/prompt-button';
import { createKeybindingsHandler } from '../keydown-binder';
import { AutocompleteHandler, Pair, Row, RowHandle } from './row';

export const Toolbar = styled.div({
  boxSizing: 'content-box',
  position: 'sticky',
  top: 0,
  zIndex: 1,
  backgroundColor: 'var(--color-bg)',
  display: 'flex',
  flexDirection: 'row',
  borderBottom: '1px solid var(--hl-md)',
  height: 'var(--line-height-sm)',
  fontSize: 'var(--font-size-sm)',
  '& > button': {
    color: 'var(--hl)',
    padding: 'var(--padding-xs) var(--padding-xs)',
    height: '100%',
  },
});
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

  const keyDownHandler = createKeybindingsHandler({
    'Enter': () => onChange([...pairs, {
      id: generateId('pair'),
      name: '',
      value: '',
      description: '',
    }]),
  });

  const [showDescription, setShowDescription] = React.useState(false);

  return (
    <Fragment>
      <Toolbar>
        <PromptButton className="btn btn--compact" onClick={() => onChange([])}>
          Delete All Items
        </PromptButton>
        <button
          className="btn btn--compact"
          onClick={() => setShowDescription(!showDescription)}
        >
          Toggle Description
        </button>
        <button
          className="btn btn--compact"
          onClick={() =>
            onChange([
              ...pairs,
              {
                id: generateId('pair'),
                name: '',
                value: '',
                description: '',
              },
            ])
          }
        >
          Add Header
        </button>
      </Toolbar>
      <ul onKeyDown={keyDownHandler} className={classnames('key-value-editor', 'wide', className)}>
        {pairs.length === 0 && (
          <Row
            key='empty-row'
            showDescription={showDescription}
            descriptionPlaceholder={descriptionPlaceholder}
            hideButtons
            readOnly
            onClick={() => onChange([...pairs, {
              id: generateId('pair'),
              name: '',
              value: '',
              description: '',
            }])}
            pair={{ name: '', value: '' }}
            onChange={() => {}}
            addPair={() => {}}
          />
        )}
        {isWebSocketRequest ? readOnlyPairs.map((pair, i) => (
          <Row
            key={i}
            showDescription={showDescription}
            descriptionPlaceholder={descriptionPlaceholder}
            readOnly
            hideButtons
            forceInput
            pair={pair}
            onChange={() => {}}
            addPair={() => {}}
          />
        )) : null}
        {pairs.map(pair => (
          <Row
            key={pair.id}
            showDescription={showDescription}
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
          />
        ))}
      </ul>
    </Fragment>
  );
};
