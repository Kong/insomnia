import React, { FunctionComponent, useCallback } from 'react';
import type { WrapperProps } from './wrapper';
import OnboardingContainer from './onboarding-container';
import Analytics from './analytics';
import { useDispatch } from 'react-redux';
import { setActiveActivity } from '../redux/modules/global';
import { getAppLongName, getAppSynopsis, ACTIVITY_HOME } from '../../common/constants';

interface Props {
  wrapperProps: WrapperProps;
}

const WrapperAnalytics: FunctionComponent<Props> = ({ wrapperProps }) => {
  const reduxDispatch = useDispatch();
  const navigateHome = useCallback(() => {
    reduxDispatch(setActiveActivity(ACTIVITY_HOME));
  }, [reduxDispatch]);
  return (
    <OnboardingContainer
      wrapperProps={wrapperProps}
      header={'Welcome to ' + getAppLongName()}
      subHeader={getAppSynopsis()}>
      <Analytics wrapperProps={wrapperProps} handleDone={navigateHome} />
    </OnboardingContainer>
  );
};

export default WrapperAnalytics;
