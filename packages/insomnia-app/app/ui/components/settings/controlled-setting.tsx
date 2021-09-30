import { Settings } from 'insomnia-common';
import React, { FC, Fragment } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { isConfigControlledSetting } from '../../../models/settings';
import { selectSettings } from '../../redux/selectors';
import { HelpTooltip } from '../help-tooltip';

const Wrapper = styled.div({
  position: 'relative',
  marginBottom: 4,
  marginTop: 14,
});

const ControlledWrapper = styled.div({
  border: '1px solid var(--color-surprise)',
  borderRadius: 5,
  padding: '6px 10px',
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

const ControlledHelper = styled.div({
  position: 'absolute',
  top: -8,
  right: 8,
  background: 'var(--color-bg)',
  zIndex: 3,
  padding: '0 5px',
});

export const ControlledSetting: FC<{ setting: keyof Settings }> = ({ children, setting }) => {
  const settings = useSelector(selectSettings);
  const [isControlled, controlledBy] = isConfigControlledSetting(setting, settings);

  if (!isControlled) {
    return <Fragment>{children}</Fragment>;
  }

  let helpText: string | undefined = undefined;
  let controllerName: string | null = null;
  if (controlledBy === 'insomnia-config') {
    helpText = `this value is controlled by \`settings.${setting}\` in your Insomnia Config`;
    controllerName = 'insomnia config';
  }

  // radio silent mode has highest precidence, so it is checked last
  if (controlledBy === 'radioSilentMode') {
    helpText = 'this value is controlled by Radio Silent Mode';
    controllerName = 'radio silent mode';
  }

  return (
    <Wrapper className="wrapper">
      <ControlledHelper>
        <span>controlled by {controllerName}</span>{' '}
        <HelpTooltip>{helpText}</HelpTooltip>
      </ControlledHelper>
      <ControlledWrapper className="controlledWrapper">
        <ControlledOverlay title={helpText} />
        {children}
      </ControlledWrapper>
    </Wrapper>
  );
};
