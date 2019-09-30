// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import imgSrc from '../images/logo.png';
import * as db from '../../common/database';
import * as models from '../../models';
import type { GlobalActivity } from './activity-bar/activity-bar';
import type { BaseModel } from '../../models';
import { showPrompt } from './modals';

type Props = {
  handleImportFile: (forceWorkspace: boolean) => void,
  handleImportUri: (uri: string, forceWorkspace: boolean) => void,
  handleSetActivity: (activity: GlobalActivity) => void,
};

@autobind
class Onboarding extends React.PureComponent<Props> {
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

  _handleDone() {
    const { handleSetActivity } = this.props;
    handleSetActivity('spec');

    // Unsubscribe DB listener
    db.offChange(this._handleDbChange);
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
        '/raw/0e6fef533243d6842dd8f3199ec86394508bf9c5/petstore-spec.yaml',
    );
  }

  render() {
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
          <div className="onboarding__content__body">
            <strong className="pad-bottom-sm">Import an OpenAPI spec to get started:</strong>
            <button className="btn btn--clicky space-right" onClick={this._handleImportFile}>
              From File
            </button>
            <button className="btn btn--clicky" onClick={this._handleImportPetstore}>
              Petstore Example
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default Onboarding;
