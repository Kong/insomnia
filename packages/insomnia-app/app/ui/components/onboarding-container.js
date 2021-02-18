// @flow
import React from 'react';
import type { WrapperProps } from './wrapper';
import PageLayout from './page-layout';
import coreLogo from '../images/insomnia-core-logo.png';
import { getAppLongName, getAppSynopsis } from '../../common/constants';

type Props = {
  wrapperProps: WrapperProps,
};

const OnboardingContainer = ({ wrapperProps, children }: Props) => (
  <PageLayout
    wrapperProps={wrapperProps}
    renderPageBody={() => (
      <div className="onboarding">
        <div className="onboarding__background theme--sidebar" />
        <div className="onboarding__content theme--dialog">
          <div className="img-container">
            <img src={coreLogo} alt="Kong" />
          </div>
          <header className="onboarding__content__header">
            <h1>Welcome to {getAppLongName()}</h1>
            <h2>{getAppSynopsis()}</h2>
          </header>
          <div className="onboarding__content__body">{children}</div>
        </div>
      </div>
    )}
  />
);

export default OnboardingContainer;
