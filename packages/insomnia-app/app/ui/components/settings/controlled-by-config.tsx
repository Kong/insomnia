import { Settings } from 'insomnia-common';
import React, { FC } from 'react';
import styled from 'styled-components';

import { isConfigControlledSetting } from '../../../models/settings';
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

export const ControlledByConfig: FC<{ setting: keyof Settings }> = ({ children, setting }) => {
  const controlled = isConfigControlledSetting(setting);

  const helpText = `this value is controlled by \`settings.${setting}\` in your Insomnia Config`;
  if (!controlled) {
    return <div>{children}</div>;
  }

  return (
    <Wrapper>
      <ControlledHelper>
        <span>controlled by insomnia config</span>{' '}
        <HelpTooltip>{helpText}</HelpTooltip>
      </ControlledHelper>
      <ControlledWrapper>
        <ControlledOverlay title={helpText} />
        {children}
      </ControlledWrapper>
    </Wrapper>
  );
};
