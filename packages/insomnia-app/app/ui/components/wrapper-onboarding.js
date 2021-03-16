// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import 'swagger-ui-react/swagger-ui.css';
import { showPrompt } from './modals';
import type { BaseModel } from '../../models';
import * as models from '../../models';
import { ACTIVITY_HOME, getAppLongName, getAppName, getAppSynopsis } from '../../common/constants';
import type { WrapperProps } from './wrapper';
import PageLayout from './page-layout';
import * as db from '../../common/database';
import chartSrc from '../images/chart.svg';
import imgSrc from '../images/logo.png';
import type { ForceToWorkspace } from '../redux/modules/helpers';
import { ForceToWorkspaceKeys } from '../redux/modules/helpers';

type Props = {|
  wrapperProps: WrapperProps,
  handleImportFile: (forceToWorkspace: ForceToWorkspace) => any,
  handleImportUri: (uri: string, forceToWorkspace: ForceToWorkspace) => any,
|};

type State = {|
  step: number,
|};

@autobind
class WrapperOnboarding extends React.PureComponent<Props, State> {
  state = {
    step: 1,
  };

  componentDidMount() {
    db.onChange(this._handleDbChange);
  }

  _handleDbChange(changes: Array<[string, BaseModel, boolean]>) {
    for (const change of changes) {
      if (change[1].type === models.workspace.type) {
        setTimeout(() => {
          this._handleDone();
        }, 400);
      }
    }
  }

  async _handleDone() {
    const { handleSetActiveActivity } = this.props.wrapperProps;

    handleSetActiveActivity(ACTIVITY_HOME);

    // Unsubscribe DB listener
    db.offChange(this._handleDbChange);
  }

  _handleBackStep(e: SyntheticEvent<HTMLAnchorElement>) {
    e.preventDefault();

    this.setState(state => ({ step: state.step - 1 }));
  }

  async _handleCompleteAnalyticsStep(enableAnalytics: boolean) {
    const { settings } = this.props.wrapperProps;

    // Update settings with analytics preferences
    await models.settings.update(settings, { enableAnalytics });

    this.setState(state => ({ step: state.step + 1 }));
  }

  async _handleClickEnableAnalytics(e: SyntheticEvent<HTMLButtonElement>) {
    this._handleCompleteAnalyticsStep(true);
  }

  async _handleClickDisableAnalytics(e: SyntheticEvent<HTMLButtonElement>) {
    this._handleCompleteAnalyticsStep(false);
  }

  _handleImportFile() {
    const { handleImportFile } = this.props;
    handleImportFile(ForceToWorkspaceKeys.current);
  }

  _handleImportUri(defaultValue: string) {
    const { handleImportUri } = this.props;

    showPrompt({
      title: 'Import From URI',
      defaultValue: typeof defaultValue === 'string' ? defaultValue : '',
      placeholder: 'https://example.com/openapi-spec.yaml',
      label: 'URI to Import',
      onComplete: value => {
        handleImportUri(value, ForceToWorkspaceKeys.current);
      },
    });
  }

  _handleImportPetstore() {
    this._handleImportUri(
      'https://gist.githubusercontent.com/gschier/4e2278d5a50b4bbf1110755d9b48a9f9' +
        '/raw/801c05266ae102bcb9288ab92c60f52d45557425/petstore-spec.yaml',
    );
  }

  _handleSkipImport() {
    const { handleSetActiveActivity } = this.props.wrapperProps;
    handleSetActiveActivity(ACTIVITY_HOME);
  }

  renderStep1() {
    return (
      <React.Fragment>
        <p>
          <strong>Share Usage Analytics with Kong Inc</strong>
        </p>
        <img src={chartSrc} alt="Demonstration chart" />
        <p>
          Help us understand how <strong>you</strong> use {getAppLongName()} so we can make it
          better.
        </p>
        <button key="enable" className="btn btn--clicky" onClick={this._handleClickEnableAnalytics}>
          Share Usage Analytics
        </button>
        <button
          key="disable"
          className="btn btn--super-compact"
          onClick={this._handleClickDisableAnalytics}>
          Don't share usage analytics
        </button>
      </React.Fragment>
    );
  }

  renderStep2() {
    const {
      settings: { enableAnalytics },
    } = this.props.wrapperProps;
    return (
      <React.Fragment>
        <p className="notice success text-left margin-top margin-bottom">
          <a href="#" className="pull-right" onClick={this._handleBackStep}>
            Back
          </a>
          {enableAnalytics
            ? `Thanks for helping make ${getAppName()} better!`
            : 'Opted out of analytics'}
        </p>
        <p>Import an OpenAPI spec to get started:</p>
        <button key="file" className="btn btn--clicky" onClick={this._handleImportFile}>
          From File
        </button>
        <button key="petstore" className="btn btn--clicky" onClick={this._handleImportPetstore}>
          Petstore Example
        </button>
        <button key="skip" className="btn btn--super-compact" onClick={this._handleSkipImport}>
          Skip
        </button>
      </React.Fragment>
    );
  }

  renderPageBody() {
    const { step } = this.state;

    let stepBody;
    if (step === 1) {
      stepBody = this.renderStep1();
    } else {
      stepBody = this.renderStep2();
    }

    return (
      <div className="onboarding">
        <div className="onboarding__background theme--sidebar" />
        <div className="onboarding__content theme--dialog">
          <div className="img-container">
            <img src={imgSrc} alt="Kong" />
          </div>
          <header className="onboarding__content__header">
            <h1>Welcome to {getAppLongName()}</h1>
            <h2>{getAppSynopsis()}</h2>
          </header>
          <div className="onboarding__content__body">{stepBody}</div>
        </div>
      </div>
    );
  }

  render() {
    return (
      <PageLayout
        wrapperProps={this.props.wrapperProps}
        renderPageBody={() => this.renderPageBody()}
      />
    );
  }
}

export default WrapperOnboarding;
