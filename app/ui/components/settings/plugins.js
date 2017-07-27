// @flow
import type {Plugin} from '../../../plugins/index';
import {getPlugins} from '../../../plugins/index';
import React from 'react';
import autobind from 'autobind-decorator';
import * as electron from 'electron';
import Button from '../base/button';
import CopyButton from '../base/copy-button';
import {trackEvent} from '../../../analytics/index';
import {reload} from '../../../templating/index';
import installPlugin from '../../../plugins/install';
import HelpTooltip from '../help-tooltip';
import Link from '../base/link';

@autobind
class Plugins extends React.PureComponent {
  state: {
    plugins: Array<Plugin>,
    npmPluginValue: string,
    error: string,
    loading: boolean
  };

  constructor (props: any) {
    super(props);
    this.state = {
      plugins: [],
      npmPluginValue: '',
      error: '',
      loading: false
    };
  }

  _handleClearError () {
    this.setState({error: ''});
  }

  _handleAddNpmPluginChange (e: Event & {target: HTMLButtonElement}) {
    this.setState({npmPluginValue: e.target.value});
  }

  async _handleAddFromNpm (e: Event): Promise<void> {
    e.preventDefault();

    this.setState({loading: true});

    const newState = {loading: false, error: ''};
    try {
      await installPlugin(this.state.npmPluginValue);
      await this._handleRefreshPlugins();
    } catch (err) {
      newState.error = err.message;
    }

    this.setState(newState);
  }

  _handleOpenDirectory (directory: string) {
    electron.remote.shell.showItemInFolder(directory);
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
    const {plugins, error, loading} = this.state;

    return (
      <div>
        <p className="notice info no-margin-top">
          Plugins is still an experimental feature. Please
          {' '}
          <Link href="https://insomnia.rest/documentation/support-and-feedback/">
            Submit Feedback
          </Link> if you have any.
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
              <td>
                {plugin.name}
                {plugin.description && (
                  <HelpTooltip info className="space-left">{plugin.description}</HelpTooltip>
                )}
              </td>
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

        {error && (
          <div className="notice error text-left margin-bottom">
            <button className="pull-right icon" onClick={this._handleClearError}>
              <i className="fa fa-times"/>
            </button>
            {error}
          </div>
        )}

        <form onSubmit={this._handleAddFromNpm}>
          <div className="form-row">
            <div className="form-control form-control--outlined">
              <input onChange={this._handleAddNpmPluginChange}
                     disabled={loading}
                     type="text"
                     placeholder="npm-package-name"/>
            </div>
            <div className="form-control width-auto">
              <button className="btn btn--clicky" disabled={loading}>
                {loading && <i className="fa fa-refresh fa-spin space-right"/>}
                Install Plugin
              </button>
            </div>
          </div>
        </form>

        <hr/>

        <div className="text-right">
          <button type="button" className="btn btn--clicky"
                  onClick={this._handleRefreshPlugins}>
            Reload Plugin List
          </button>
        </div>
      </div>
    );
  }
}

export default Plugins;
