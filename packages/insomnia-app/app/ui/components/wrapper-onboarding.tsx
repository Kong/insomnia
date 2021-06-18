import React, { Fragment, PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import 'swagger-ui-react/swagger-ui.css';
import { showPrompt } from './modals';
import type { BaseModel } from '../../models';
import { AUTOBIND_CFG, getAppLongName, getAppName, getAppSynopsis } from '../../common/constants';
import type { HandleImportFileCallback, HandleImportUriCallback, WrapperProps } from './wrapper';
import { database as db } from '../../common/database';
import { ForceToWorkspaceKeys } from '../redux/modules/helpers';
import OnboardingContainer from './onboarding-container';
import { isWorkspace, WorkspaceScopeKeys } from '../../models/workspace';
import Analytics from './analytics';

interface Props {
  wrapperProps: WrapperProps;
  handleImportFile: HandleImportFileCallback;
  handleImportUri: HandleImportUriCallback;
}

interface State {
  step: number;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class WrapperOnboarding extends PureComponent<Props, State> {
  state: State = {
    step: 1,
  };

  componentDidMount() {
    db.onChange(this._handleDbChange);
  }

  componentWillUnmount() {
    // Unsubscribe DB listener
    db.offChange(this._handleDbChange);
  }

  _handleDbChange(changes: [string, BaseModel, boolean][]) {
    for (const change of changes) {
      if (isWorkspace(change[1])) {
        setTimeout(() => {
          this._handleDone();
        }, 400);
      }
    }
  }

  _handleDone() {
    this._nextActivity();
  }

  _handleBackStep(e: React.SyntheticEvent<HTMLAnchorElement>) {
    e.preventDefault();
    this.setState(state => ({
      step: state.step - 1,
    }));
  }

  async _handleCompleteAnalyticsStep() {
    this.setState(state => ({
      step: state.step + 1,
    }));
  }

  _handleImportFile() {
    const { handleImportFile } = this.props;
    handleImportFile({
      forceToWorkspace: ForceToWorkspaceKeys.new,
      forceToScope: WorkspaceScopeKeys.design,
    });
  }

  _handleImportUri(defaultValue: string) {
    const { handleImportUri } = this.props;
    showPrompt({
      title: 'Import From URI',
      defaultValue: typeof defaultValue === 'string' ? defaultValue : '',
      placeholder: 'https://example.com/openapi-spec.yaml',
      label: 'URI to Import',
      onComplete: value => {
        handleImportUri(value, {
          forceToWorkspace: ForceToWorkspaceKeys.new,
          forceToScope: WorkspaceScopeKeys.design,
        });
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
    this._nextActivity();
  }

  _nextActivity() {
    this.props.wrapperProps.handleGoToNextActivity();
  }

  renderStep1() {
    return (
      <Analytics
        wrapperProps={this.props.wrapperProps}
        handleDone={this._handleCompleteAnalyticsStep}
      />
    );
  }

  renderStep2() {
    const {
      settings: { enableAnalytics },
    } = this.props.wrapperProps;
    return (
      <Fragment>
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
      </Fragment>
    );
  }

  render() {
    const { step } = this.state;
    let stepBody;

    if (step === 1) {
      stepBody = this.renderStep1();
    } else {
      stepBody = this.renderStep2();
    }

    return (
      <OnboardingContainer
        wrapperProps={this.props.wrapperProps}
        header={'Welcome to ' + getAppLongName()}
        subHeader={getAppSynopsis()}>
        {stepBody}
      </OnboardingContainer>
    );
  }
}

export default WrapperOnboarding;
