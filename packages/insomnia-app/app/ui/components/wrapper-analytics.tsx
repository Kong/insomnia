import React, { FunctionComponent, useCallback } from 'react';
import { useDispatch } from 'react-redux';

import { ACTIVITY_HOME, getAppLongName, getAppSynopsis } from '../../common/constants';
import { setActiveActivity } from '../redux/modules/global';
import { Analytics } from './analytics';
import { OnboardingContainer } from './onboarding-container';
import type { WrapperProps } from './wrapper';

interface Props {
  wrapperProps: WrapperProps;
}

export const WrapperAnalytics: FunctionComponent<Props> = ({ wrapperProps }) => {
  const reduxDispatch = useDispatch();
  const navigateHome = useCallback(() => {
    reduxDispatch(setActiveActivity(ACTIVITY_HOME));
  }, [reduxDispatch]);
  return (
    <OnboardingContainer
      wrapperProps={wrapperProps}
      header={'Welcome to ' + getAppLongName()}
      subHeader={getAppSynopsis()}
    >
      <Analytics wrapperProps={wrapperProps} handleDone={navigateHome} />
    </OnboardingContainer>
  );
};
