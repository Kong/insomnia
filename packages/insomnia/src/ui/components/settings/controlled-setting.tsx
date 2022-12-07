import React, { FC, Fragment, PropsWithChildren } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { Settings } from '@insomnia/common/settings';
import { getControlledStatus } from '@insomnia/models/helpers/settings';
import { selectSettings } from '../../redux/selectors';
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

export const ControlledSetting: FC<PropsWithChildren<{ setting: keyof Settings }>> = ({ children, setting }) => {
  const settings = useSelector(selectSettings);
  const { isControlled, controller } = getControlledStatus(settings)(setting);

  if (isControlled === false) {
    return <Fragment>{children}</Fragment>;
  }

  let helpText: string | undefined = undefined;
  let controllerName: string | null = null;
  switch (controller) {
    case 'insomnia-config':
      helpText = `This value is controlled by \`settings.${setting}\` in your Insomnia config`;
      controllerName = 'Insomnia config';
      break;

    case 'incognitoMode':
      helpText = 'This value is controlled by Incognito Mode';
      controllerName = 'Incognito Mode';
      break;

    default:
      helpText = `This value is controlled by ${controller}`;
      controllerName = controller || 'another setting';
  }

  return (
    <Wrapper>
      <Setting>
        <ControlledOverlay title={helpText} />
        {children}
      </Setting>

      <Helper>
        <HelpTooltip info>{helpText}</HelpTooltip>{' '}
        <HelperText>Controlled by {controllerName}</HelperText>
      </Helper>
    </Wrapper>
  );
};
