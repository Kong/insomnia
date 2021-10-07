import { Settings } from 'insomnia-common';
import React, { FC, Fragment } from 'react';
import styled from 'styled-components';

import { isConfigControlledSetting } from '../../../models/helpers/settings';
import { HelpTooltip } from '../help-tooltip';

const Wrapper = styled.div({
  position: 'relative',
  marginBottom: 4,
  marginTop: 14,
  borderLeft: '1px solid var(--color-surprise)',
});

const Setting = styled.div({
  padding: '2px 10px',
  position: 'relative',
  '&:hover': {
    cursor: 'not-allowed',
  },
});

const ControlledOverlay = styled.div({
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  zIndex: 2,
});

const Helper = styled.div({
  color: 'var(--color-surprise)',
  padding: '2px 10px',
  marginTop: -2,
  opacity: 'var(--opacity-subtle)',
});

const HelperText = styled.span({
  fontStyle: 'italic',
});

export const ControlledSetting: FC<{ setting: keyof Settings }> = ({ children, setting }) => {
  const controlledBy = isConfigControlledSetting(setting);

  if (controlledBy === false) {
    return <Fragment>{children}</Fragment>;
  }

  let helpText: string | undefined = undefined;
  let controllerName: string | null = null;

  /** because, and only because, we are not ready to show an incognito mode checkbox to users, we are temporarily disabling this codepath */
  if (controlledBy === 'incognitoMode') {
    helpText = 'this value is controlled by Incognito Mode';
    controllerName = 'incognito mode';
  }

  // the insomnia config has highest precidence, so it is checked last
  if (controlledBy === 'insomnia-config') {
    helpText = `this value is controlled by \`settings.${setting}\` in your Insomnia Config`;
    controllerName = 'insomnia config';
  }

  return (
    <Wrapper>
      <Setting>
        <ControlledOverlay title={helpText} />
        {children}
      </Setting>

      <Helper>
        <HelpTooltip info>{helpText}</HelpTooltip>{' '}
        <HelperText>controlled by {controllerName}</HelperText>
      </Helper>
    </Wrapper>
  );
};
