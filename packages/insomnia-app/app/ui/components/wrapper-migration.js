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
import envPaths from 'env-paths';
import { getDataDirectory } from '../../common/misc';

type Props = {|
  wrapperProps: WrapperProps,
|};

type State = {|
  loading: boolean,
|} & MigrationOptions;

@autoBindMethodsForReact(AUTOBIND_CFG)
class WrapperMigration extends React.Component<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      useDesignerSettings: false,
      copyResponses: true,
      copyPlugins: true,
      designerDataDir: envPaths('Insomnia Designer', { suffix: '' }).data,
      coreDataDir: getDataDirectory(),
    };
  }

  _handleUpdateState({ currentTarget: { name, value } }: SyntheticEvent<HTMLInputElement>) {
    this.setState({ [name]: value });
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
        label={label}
        onChange={checked => {
          this.setState({ [name]: checked });
        }}
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
          <button key="start" className="btn btn--clicky" onClick={() => {}}>
            Start Migration
          </button>
          <button key="cancel" className="btn btn--super-compact" onClick={() => {}}>
            Cancel
          </button>
        </div>
      </>
    );
  }

  renderPageBody() {
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
          <div className="onboarding__content__body">{this.renderOpts()}</div>
        </div>
      </div>
    );
  }

  render() {
    const { wrapperProps } = this.props;
    return <PageLayout wrapperProps={wrapperProps} renderPageBody={this.renderPageBody} />;
  }
}

export default WrapperMigration;
