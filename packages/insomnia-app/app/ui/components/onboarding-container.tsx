import React, { FunctionComponent } from 'react';

import coreLogo from '../images/insomnia-core-logo.png';
import { PageLayout } from './page-layout';
import type { WrapperProps } from './wrapper';

interface Props {
  wrapperProps: WrapperProps;
  header: string;
  subHeader: string;
}

export const OnboardingContainer: FunctionComponent<Props> = ({ wrapperProps, children, header, subHeader }) => (
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
            <h1>{header}</h1>
            <h2>{subHeader}</h2>
          </header>
          <div className="onboarding__content__body">{children}</div>
        </div>
      </div>
    )}
  />
);
