// @flow

import * as React from 'react';
import PageLayout from './page-layout';
import type { WrapperProps } from './wrapper';
import coreLogo from '../images/insomnia-core-logo.png';
import { AUTOBIND_CFG, getAppLongName, getAppSynopsis } from '../../common/constants';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { ToggleSwitch } from 'insomnia-components';
import HelpTooltip from './help-tooltip';
import type { MigrationOptions } from '../../common/migrate-from-designer';
import { getDataDirectory, getDesignerDataDir } from '../../common/misc';
import migrateFromDesigner, { restartApp } from '../../common/migrate-from-designer';

type Props = {|
  wrapperProps: WrapperProps,
|};

type State = {|
  step: 'options' | 'migrating' | 'success' | 'fail',
  error?: Error,
|} & MigrationOptions;

@autoBindMethodsForReact(AUTOBIND_CFG)
class WrapperMigration extends React.Component<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      step: 'options',
      useDesignerSettings: false,
      copyResponses: true,
      copyPlugins: true,
      designerDataDir: getDesignerDataDir(),
      coreDataDir: getDataDirectory(),
    };
  }

  async _doMigration(): Promise<void> {
    this.setState({ step: 'migrating' });

    const { step, ...options } = this.state;

    const { error } = await migrateFromDesigner(options);

    if (error) {
      await this.setState({ step: 'fail', error });
    } else {
      await this.setState({ step: 'success' });
    }
  }

  _handleUpdateState({ currentTarget: { name, value } }: SyntheticEvent<HTMLInputElement>) {
    this.setState({ [name]: value });
  }

  _handleUpdateStateFromToggleSwitch(checked: boolean, event: Object, id: string) {
    this.setState({ [id]: checked });
  }

  renderTextSetting(label: string, name: $Keys<State>, help: string) {
    if (!this.state.hasOwnProperty(name)) {
      throw new Error(`Invalid text setting name ${name}`);
    }

    return (
      <div className="form-control form-control--outlined margin-bottom">
        <label>
          {label}
          {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
          <input
            type="text"
            name={name}
            defaultValue={this.state[name]}
            onChange={this._handleUpdateState}
          />
        </label>
      </div>
    );
  }

  renderBooleanSetting(label: string, name: string) {
    if (!this.state.hasOwnProperty(name)) {
      throw new Error(`Invalid boolean setting name ${name}`);
    }

    return (
      <ToggleSwitch
        labelClassName="row margin-bottom wide"
        checked={this.state[name]}
        id={name}
        label={label}
        onChange={this._handleUpdateStateFromToggleSwitch}
      />
    );
  }

  renderOpts() {
    return (
      <>
        <p>
          <strong>Would you like to migrate data from Insomnia Designer?</strong>
        </p>
        <div className="text-left margin-top">
          {this.renderBooleanSetting('Use Designer Settings', 'useDesignerSettings')}
          {this.renderBooleanSetting('Copy Plugins', 'copyPlugins')}
          {this.renderBooleanSetting('Copy Responses', 'copyResponses')}
          <details>
            <summary className="margin-bottom">Advanced options</summary>
            {this.renderTextSetting('Designer Data Directory', 'designerDataDir')}
            {this.renderTextSetting('Core Data Directory', 'coreDataDir')}
          </details>
        </div>

        <div className="margin-top">
          <button key="start" className="btn btn--clicky" onClick={this._doMigration}>
            Start Migration
          </button>
          <button key="cancel" className="btn btn--super-compact" onClick={() => {}}>
            Cancel
          </button>
        </div>
      </>
    );
  }

  renderMigrating() {
    return (
      <>
        <p>
          <strong>Migrating</strong>
        </p>
        <p>
          <i className="fa fa-spin fa-refresh" />
        </p>
      </>
    );
  }

  renderSuccess() {
    return (
      <>
        <p>
          <strong>Migrated successfully!</strong>
        </p>
        <p>
          <i className="fa fa-check" />
        </p>

        <p>Please restart the application for your changes to take effect.</p>

        <div className="margin-top">
          <button key="restart" className="btn btn--clicky" onClick={restartApp}>
            Restart
          </button>
        </div>
      </>
    );
  }

  renderFail() {
    const { error } = this.state;
    return (
      <>
        <p>
          <strong>Something went wrong!!</strong>
        </p>
        <p>
          <i className="fa fa-crosshairs" />
        </p>

        <p>
          Something went wrong with the migration and your data has been restored from backup.
          Please restart the application for the changes to take effect.
        </p>

        {error && (
          <details>
            <summary>Additonal information</summary>
            <pre className="pad-top-sm force-wrap selectable">
              <code className="wide">{error.stack || error}</code>
            </pre>
          </details>
        )}

        <div className="margin-top">
          <button key="restart" className="btn btn--clicky" onClick={restartApp}>
            Restart
          </button>
        </div>
      </>
    );
  }

  renderPageBody() {
    let body = null;

    switch (this.state.step) {
      case 'options':
        body = this.renderOpts();
        break;
      case 'migrating':
        body = this.renderMigrating();
        break;
      case 'success':
        body = this.renderSuccess();
        break;
      case 'fail':
        body = this.renderFail();
        break;
      default:
        throw new Error(`${this.state.step} is not recognized as a migration step.`);
    }

    return (
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
          <div className="onboarding__content__body">{body}</div>
        </div>
      </div>
    );
  }

  render() {
    const { wrapperProps } = this.props;
    return (
      <PageLayout
        key={this.state.step}
        wrapperProps={wrapperProps}
        renderPageBody={this.renderPageBody}
      />
    );
  }
}

export default WrapperMigration;
