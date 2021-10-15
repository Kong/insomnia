import 'swagger-ui-react/swagger-ui.css';

import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { Fragment, PureComponent } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { AUTOBIND_CFG, getAppLongName, getAppName, getAppSynopsis } from '../../common/constants';
import { database as db } from '../../common/database';
import type { BaseModel } from '../../models';
import { isWorkspace, WorkspaceScopeKeys } from '../../models/workspace';
import { ForceToWorkspace } from '../redux/modules/helpers';
import { importFile, importUri } from '../redux/modules/import';
import { Analytics } from './analytics';
import { showPrompt } from './modals';
import { OnboardingContainer } from './onboarding-container';
import type { WrapperProps } from './wrapper';

type ReduxProps = ReturnType<typeof mapDispatchToProps>;

interface Props extends ReduxProps {
  wrapperProps: WrapperProps;
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
    this.props.handleImportFile({
      forceToWorkspace: ForceToWorkspace.new,
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
          forceToWorkspace: ForceToWorkspace.new,
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

  hasStep1() {
    return this.props.wrapperProps.settings.incognitoMode === false;
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

    const lastStep = this.hasStep1() ? (
      <p className="notice success text-left margin-top margin-bottom">
        <a href="#" className="pull-right" onClick={this._handleBackStep}>
          Back
        </a>
        {enableAnalytics
          ? `Thanks for helping make ${getAppName()} better!`
          : 'Opted out of analytics'}
      </p>
    ) : null;

    return (
      <Fragment>
        {lastStep}
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

    if (step === 1 && this.hasStep1()) {
      stepBody = this.renderStep1();
    } else {
      stepBody = this.renderStep2();
    }

    return (
      <OnboardingContainer
        wrapperProps={this.props.wrapperProps}
        header={'Welcome to ' + getAppLongName()}
        subHeader={getAppSynopsis()}
      >
        {stepBody}
      </OnboardingContainer>
    );
  }
}

const mapDispatchToProps = dispatch => {
  const bound = bindActionCreators({
    importFile,
    importUri,
  }, dispatch);

  return ({
    handleImportFile: bound.importFile,
    handleImportUri: bound.importUri,
  });
};

export default connect(null, mapDispatchToProps)(WrapperOnboarding);
