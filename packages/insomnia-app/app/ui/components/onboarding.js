// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import imgSrc from '../images/logo.png';
import * as db from '../../common/database';
import * as models from '../../models';
import type { GlobalActivity } from './activity-bar/activity-bar';
import type { BaseModel } from '../../models';
import { showPrompt } from './modals';
import chartSrc from '../images/chart.svg';
import type { Settings } from '../../models/settings';

type Props = {|
  settings: Settings,
  handleImportFile: (forceWorkspace: boolean) => void,
  handleImportUri: (uri: string, forceWorkspace: boolean) => void,
  handleSetActivity: (activity: GlobalActivity) => void,
|};

type State = {|
  step: number,
|};

@autobind
class Onboarding extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      step: 1,
    };
  }

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
    const { handleSetActivity } = this.props;

    // Set activity to 'spec'
    handleSetActivity('spec');

    // Unsubscribe DB listener
    db.offChange(this._handleDbChange);
  }

  _handleBackStep(e: SyntheticEvent<HTMLAnchorElement>) {
    e.preventDefault();

    this.setState(state => ({ step: state.step - 1 }));
  }

  async _handleCompleteAnalyticsStep(enableAnalytics: boolean) {
    const { settings } = this.props;

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
    handleImportFile(true);
  }

  _handleImportUri(defaultValue: string) {
    const { handleImportUri } = this.props;
    showPrompt({
      title: 'Import From URI',
      defaultValue: typeof defaultValue === 'string' ? defaultValue : '',
      placeholder: 'https://example.com/openapi-spec.yaml',
      label: 'URI to Import',
      onComplete: value => {
        handleImportUri(value, true);
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
    const { handleSetActivity } = this.props;
    handleSetActivity(('debug': GlobalActivity));
  }

  renderStep1() {
    return (
      <React.Fragment>
        <p>
          <strong>Share Usage Analytics with Kong</strong>
        </p>
        <p>
          <img src={chartSrc} alt="Demonstration chart" />
        </p>
        <p>
          Help us understand how <strong>you</strong> use Kong Studio so we can make it better.
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
    } = this.props;
    return (
      <React.Fragment>
        <p className="notice success text-left margin-top margin-bottom">
          <a href="#" className="pull-right" onClick={this._handleBackStep}>
            Back
          </a>
          {enableAnalytics
            ? 'Thanks for helping make Studio better!'
            : 'Opted out of analytics tracking'}
        </p>
        <p>
          <strong>Import an OpenAPI spec to get started:</strong>
        </p>
        <button key="file" className="btn btn--clicky" onClick={this._handleImportFile}>
          From File
        </button>
        <button key="petstore" className="btn btn--clicky" onClick={this._handleImportPetstore}>
          Petstore Example
        </button>
        <button key="skip" className="btn btn--super-compact" onClick={this._handleSkipImport}>
          Start From Scratch
        </button>
      </React.Fragment>
    );
  }

  render() {
    const { step } = this.state;

    let stepBody = null;

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
            <h1>Welcome to Kong Studio</h1>
            <h2>Edit, Test, and Deploy services to Kong</h2>
          </header>
          <div className="onboarding__content__body">{stepBody}</div>
        </div>
      </div>
    );
  }
}

export default Onboarding;
