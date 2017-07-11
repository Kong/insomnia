import React, {PureComponent} from 'react';
import autobind from 'autobind-decorator';
import * as electron from 'electron';
import {createPlugin, getPlugins} from '../../../plugins/index';
import Button from '../base/button';
import CopyButton from '../base/copy-button';
import {showPrompt} from '../modals/index';
import {trackEvent} from '../../../analytics/index';
import {reload} from '../../../templating/index';

@autobind
class Plugins extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      plugins: getPlugins(true)
    };
  }

  _handleOpenDirectory (directory) {
    electron.remote.shell.showItemInFolder(directory);
  }

  _handleGeneratePlugin () {
    showPrompt({
      headerName: 'Plugin Name',
      defaultValue: 'My Plugin',
      submitName: 'Generate Plugin',
      selectText: true,
      placeholder: 'My Cool Plugin',
      label: 'Plugin Name',
      onComplete: async name => {
        await createPlugin(name);
        this._handleRefreshPlugins();
        trackEvent('Plugins', 'Generate');
      }
    });
  }

  _handleRefreshPlugins () {
    // Get and reload plugins
    const plugins = getPlugins(true);
    reload();

    this.setState({plugins});
    trackEvent('Plugins', 'Refresh');
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
          <button className="btn btn--clicky" onClick={this._handleRefreshPlugins}>
            Reload Plugins
          </button>
          {' '}
          <button className="btn btn--clicky" onClick={this._handleGeneratePlugin}>
            Generate New Plugin
          </button>
        </p>
      </div>
    );
  }
}

Plugins.propTypes = {};

export default Plugins;
