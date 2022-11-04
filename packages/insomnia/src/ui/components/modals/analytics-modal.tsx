import React, { FC, useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { getAppSynopsis, getProductName } from '../../../common/constants';
import * as models from '../../../models';
import chartSrc from '../../images/chart.svg';
import coreLogo from '../../images/insomnia-logo.svg';
import { selectSettings } from '../../redux/selectors';
import { type ModalHandle, Modal } from '../base/modal';
import { Button } from '../themed-button';

const Wrapper = styled.div({
  position: 'relative',
  textAlign: 'center',
});

const Header = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: 'var(--padding-lg)',
  borderBottom: '1px solid var(--hl-sm)',
});

const Headline = styled.div({
  color: 'var(--color-font)',
  fontSize: 'var(--font-size-xl)',
  marginTop: 'var(--padding-sm)',
  marginBottom: 'var(--padding-sm)',
});

const SubHeader = styled.div({
  color: 'var(--hl-xl)',
  marginTop: 0,
  marginBottom: 0,
});

const InsomniaLogo = styled.div({
  top: '-1.75rem',
  position: 'absolute',
  width: '100%',
  textAlign: 'center',
  img: {
    width: '3.5rem',
    height: '3.5rem',
  },
});

const Body = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: 'var(--padding-sm) var(--padding-lg) var(--padding-md)',
});

const DemonstrationChart = styled.img({
  marginTop: 'var(--padding-sm)',
  width: '100%',
});

const ActionButtons = styled.div({
  display: 'flex',
  flexDirection: 'column',
  marginBottom: 'var(--padding-md)',
  padding: '0 var(--padding-lg)',
  '& .btn--super-compact': {
    textDecoration: 'underline',
    color: 'var(--hl-xl)',
    fontSize: 'var(--font-size-md)',
    marginTop: 'var(--padding-sm)',
  },
});

export const AnalyticsModal: FC = () => {
  const { hasPromptedAnalytics } = useSelector(selectSettings);
  const ref = useRef<ModalHandle>(null);

  const onEnable = useCallback(async () => {
    await models.settings.patch({
      enableAnalytics: true,
      hasPromptedAnalytics: true,
    });
  }, []);
  const onDisable = async () => {
    await models.settings.patch({
      enableAnalytics: false,
      hasPromptedAnalytics: true,
    });
  };

  useEffect(() => {
    if (hasPromptedAnalytics) {
      ref.current?.hide();
    } else {
      ref.current?.show();
    }
  }, [hasPromptedAnalytics]);

  if (hasPromptedAnalytics) {
    return null;
  }

  return (
    <Modal centered noEscape skinny ref={ref}>
      <Wrapper>
        <InsomniaLogo>
          <img src={coreLogo} alt="Kong" />
        </InsomniaLogo>

        <Header>
          <Headline>Welcome to {getProductName()}</Headline>
          <SubHeader>{getAppSynopsis()}</SubHeader>
        </Header>

        <Body>
          <p><strong>Share Usage Analytics with Kong Inc</strong></p>

          <DemonstrationChart src={chartSrc} alt="Demonstration chart" />

          <p>Help us understand how <strong>you</strong> use {getProductName()} so we can make it better.</p>
        </Body>

        <ActionButtons>
          <Button
            key="enable"
            bg="surprise"
            radius="3px"
            size="medium"
            variant="contained"
            onClick={onEnable}
          >
            Share Usage Analytics
          </Button>

          <button
            key="disable"
            className="btn btn--super-compact"
            onClick={onDisable}
          >
            Don't share usage analytics
          </button>
        </ActionButtons>
      </Wrapper>
    </Modal>
  );
};
