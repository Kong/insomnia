// @flow
import type { Plugin } from '../../../plugins/index';
import { getPlugins } from '../../../plugins/index';
import * as React from 'react';
import autobind from 'autobind-decorator';
import * as electron from 'electron';
import Button from '../base/button';
import CopyButton from '../base/copy-button';
import { reload } from '../../../templating/index';
import installPlugin from '../../../plugins/install';
import HelpTooltip from '../help-tooltip';
import Link from '../base/link';
import { delay } from '../../../common/misc';
import { PLUGIN_PATH } from '../../../common/constants';

type State = {
  plugins: Array<Plugin>,
  npmPluginValue: string,
  error: string,
  isInstallingFromNpm: boolean,
  isRefreshingPlugins: boolean
};

@autobind
class Plugins extends React.PureComponent<void, State> {
  _isMounted: boolean;

  constructor(props: any) {
    super(props);
    this.state = {
      plugins: [],
      npmPluginValue: '',
      error: '',
      isInstallingFromNpm: false,
      isRefreshingPlugins: false
    };
  }

  _handleClearError() {
    this.setState({ error: '' });
  }

  _handleAddNpmPluginChange(e: Event) {
    if (e.target instanceof HTMLInputElement) {
      this.setState({ npmPluginValue: e.target.value });
    }
  }

  async _handleAddFromNpm(e: Event): Promise<void> {
    e.preventDefault();

    this.setState({ isInstallingFromNpm: true });

    const newState = { isInstallingFromNpm: false, error: '' };
    try {
      await installPlugin(this.state.npmPluginValue.trim());
      await this._handleRefreshPlugins();
    } catch (err) {
      newState.error = err.message;
    }

    this.setState(newState);
  }

  static _handleOpenDirectory(directory: string): void {
    electron.remote.shell.showItemInFolder(directory);
  }

  async _handleRefreshPlugins(): Promise<void> {
    const start = Date.now();

    this.setState({ isRefreshingPlugins: true });

    // Get and reload plugins
    const plugins = await getPlugins(true);
    reload();

    // Delay loading for at least 500ms. UX FTW!
    const delta = Date.now() - start;
    await delay(500 - delta);

    if (this._isMounted) {
      this.setState({ plugins, isRefreshingPlugins: false });
    }
  }

  async _handleClickRefreshPlugins() {
    await this._handleRefreshPlugins();
  }

  static _handleClickShowPluginsFolder() {
    electron.remote.shell.showItemInFolder(PLUGIN_PATH);
  }

  componentDidMount() {
    this._isMounted = true;
    this._handleRefreshPlugins();
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  render() {
    const {
      plugins,
      error,
      isInstallingFromNpm,
      isRefreshingPlugins
    } = this.state;

    return (
      <div>
        <p className="notice info no-margin-top">
          Plugins is still an experimental feature. See{' '}
          <Link href="https://support.insomnia.rest/article/26-plugins">
            Documentation
          </Link>{' '}
          for more info.
        </p>
        {plugins.length === 0 ? (
          <div className="text-center faint italic pad">No Plugins Added</div>
        ) : (
          <table className="table--fancy table--striped margin-top margin-bottom">
            <thead>
              <tr>
                <th>Name</th>
                <th>Version</th>
                <th>Folder</th>
              </tr>
            </thead>
            <tbody>
              {plugins.map(
                plugin =>
                  !plugin.directory ? null : (
                    <tr key={plugin.name}>
                      <td>
                        {plugin.name}
                        {plugin.description && (
                          <HelpTooltip info className="space-left">
                            {plugin.description}
                          </HelpTooltip>
                        )}
                      </td>
                      <td>{plugin.version}</td>
                      <td className="no-wrap" style={{ width: '10rem' }}>
                        <CopyButton
                          className="btn btn--outlined btn--super-duper-compact"
                          title={plugin.directory}
                          content={plugin.directory}>
                          Copy Path
                        </CopyButton>{' '}
                        <Button
                          className="btn btn--outlined btn--super-duper-compact"
                          onClick={Plugins._handleOpenDirectory}
                          value={plugin.directory}>
                          Show Folder
                        </Button>
                      </td>
                    </tr>
                  )
              )}
            </tbody>
          </table>
        )}

        {error && (
          <div className="notice error text-left margin-bottom">
            <button
              className="pull-right icon"
              onClick={this._handleClearError}>
              <i className="fa fa-times" />
            </button>
            <div className="selectable force-pre-wrap">{error}</div>
          </div>
        )}

        <form onSubmit={this._handleAddFromNpm}>
          <div className="form-row">
            <div className="form-control form-control--outlined">
              <input
                onChange={this._handleAddNpmPluginChange}
                disabled={isInstallingFromNpm}
                type="text"
                placeholder="npm-package-name"
              />
            </div>
            <div className="form-control width-auto">
              <button
                className="btn btn--clicky"
                disabled={isInstallingFromNpm}>
                {isInstallingFromNpm && (
                  <i className="fa fa-refresh fa-spin space-right" />
                )}
                Install Plugin
              </button>
            </div>
          </div>
        </form>

        <hr />

        <div className="text-right">
          <button
            type="button"
            className="btn btn--clicky"
            onClick={Plugins._handleClickShowPluginsFolder}>
            Show Plugins Folder
          </button>
          <button
            type="button"
            disabled={isRefreshingPlugins}
            className="btn btn--clicky space-left"
            onClick={this._handleClickRefreshPlugins}>
            Reload Plugin List
            {isRefreshingPlugins && (
              <i className="fa fa-refresh fa-spin space-left" />
            )}
          </button>
        </div>
      </div>
    );
  }
}

export default Plugins;
