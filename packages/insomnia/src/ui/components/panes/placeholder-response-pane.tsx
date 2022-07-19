import React, { FC } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { hotKeyRefs } from '../../../common/hotkeys';
import { selectHotKeyRegistry } from '../../redux/selectors';
import { Hotkey } from '../hotkey';
import { Pane, PaneBody, PaneHeader } from './pane';

const Wrapper = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
});

const Item = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  margin: 'var(--padding-sm)',
});

const Description = styled.div({
  marginRight: '2em',
});

export const PlaceholderResponsePane: FC = ({ children }) => {
  const hotKeyRegistry = useSelector(selectHotKeyRegistry);
  return (
    <Pane type="response">
      <PaneHeader />
      <PaneBody placeholder>
        <Wrapper>
          {[
            hotKeyRefs.REQUEST_SEND,
            hotKeyRefs.REQUEST_FOCUS_URL,
            hotKeyRefs.SHOW_COOKIES_EDITOR,
            hotKeyRefs.ENVIRONMENT_SHOW_EDITOR,
            hotKeyRefs.PREFERENCES_SHOW_KEYBOARD_SHORTCUTS,
          ].map(({ description, id }) => (
            <Item key={id}>
              <Description>{description}</Description>
              <code>
                <Hotkey
                  keyBindings={hotKeyRegistry[id]}
                  useFallbackMessage
                />
              </code>

            </Item>
          ))}
        </Wrapper>
      </PaneBody>
      {children}
    </Pane>
  );
};
