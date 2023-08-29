import React, { FC, PropsWithChildren } from 'react';
import styled from 'styled-components';

import { keyboardShortcutDescriptions } from '../../../common/hotkeys';
import { KeyboardShortcut } from '../../../common/settings';
import { useRootLoaderData } from '../../routes/root';
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

export const PlaceholderResponsePane: FC<PropsWithChildren<{}>> = ({ children }) => {
  const {
    settings,
  } = useRootLoaderData();
  const { hotKeyRegistry } = settings;
  return (
    <Pane type="response">
      <PaneHeader />
      <PaneBody placeholder>
        <Wrapper>
          {[
            'request_send',
            'request_focusUrl',
            'showCookiesEditor',
            'environment_showEditor',
            'preferences_showKeyboardShortcuts',
          ].map(shortcut => (
            <Item key={shortcut}>
              <Description>{keyboardShortcutDescriptions[shortcut as KeyboardShortcut]}</Description>
              <code>
                <Hotkey
                  keyBindings={hotKeyRegistry[shortcut as KeyboardShortcut]}
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
