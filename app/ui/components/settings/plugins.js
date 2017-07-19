// @flow
import type {Plugin} from '../../../plugins/index';
import {createPlugin, getPlugins} from '../../../plugins/index';
import React from 'react';
import autobind from 'autobind-decorator';
import * as electron from 'electron';
import Button from '../base/button';
import CopyButton from '../base/copy-button';
import {showPrompt} from '../modals/index';
import {trackEvent} from '../../../analytics/index';
import {reload} from '../../../templating/index';

type DefaultProps = void;
type Props = void;
type State = {
  plugins: Array<Plugin>,
  npmPluginValue: string
};

@autobind
class Plugins extends React.PureComponent<DefaultProps, Props, State> {
  props: Props;
  state: State;

  constructor (props: Props) {
    super(props);
    this.state = {
      plugins: [],
      npmPluginValue: ''
    };
  }

  _handleAddNpmPluginChange (e: Event & {target: HTMLButtonElement}) {
    this.setState({npmPluginValue: e.target.value});
  }

  _handleAddFromNpm () {
    console.log('ADD FROM NPM', this.state.npmPluginValue);
  }

  _handleOpenDirectory (directory: string) {
    electron.remote.shell.showItemInFolder(directory);
  }

  _handleGeneratePlugin () {
    showPrompt({
      title: 'Plugin Name',
      defaultValue: 'My Plugin',
      submitName: 'Generate Plugin',
      selectText: true,
      placeholder: 'My Cool Plugin',
      label: 'Plugin Name',
      onComplete: async name => {
        await createPlugin(name);
        await this._handleRefreshPlugins();
        trackEvent('Plugins', 'Generate');
      }
    });
  }

  async _handleRefreshPlugins () {
    // Get and reload plugins
    const plugins = await getPlugins(true);
    reload();

    this.setState({plugins});
    trackEvent('Plugins', 'Refresh');
  }

  componentDidMount () {
    this._handleRefreshPlugins();
  }

  render () {
    const {plugins} = this.state;

    return (
      <div>
        <p className="notice info no-margin-top">
          Plugins are experimental and compatibility may break in future releases
        </p>
        <table className="table--fancy table--striped margin-top margin-bottom">
          <thead>
          <tr>
            <th>Name</th>
            <th>Version</th>
            <th>Folder</th>
          </tr>
          </thead>
          <tbody>
          {plugins.map(plugin => (
            <tr key={plugin.name}>
              <td>{plugin.name}</td>
              <td>{plugin.version}</td>
              <td className="no-wrap" style={{width: '10rem'}}>
                <CopyButton className="btn btn--outlined btn--super-duper-compact"
                            title={plugin.directory}
                            content={plugin.directory}>
                  Copy Path
                </CopyButton>
                {' '}
                <Button className="btn btn--outlined btn--super-duper-compact"
                        onClick={this._handleOpenDirectory}
                        value={plugin.directory}>
                  Show Folder
                </Button>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
        <p className="text-right">
        </p>
        <div className="form-row">
          <div className="form-control form-control--outlined">
            <input onChange={this._handleAddNpmPluginChange}
                   type="text"
                   placeholder="insomnia-foo-bar"/>
          </div>
          <div className="form-control width-auto">
            <button className="btn btn--clicky" onClick={this._handleAddFromNpm}>
              Add From NPM
            </button>
          </div>
          <div className="form-control width-auto">
            <button className="btn btn--clicky" onClick={this._handleRefreshPlugins}>
              Reload
            </button>
          </div>
          <div className="form-control width-auto">
            <button className="btn btn--clicky" onClick={this._handleGeneratePlugin}>
              New Plugin
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default Plugins;
